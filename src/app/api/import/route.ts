import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { blankMember, parseMember, type MemberInput } from "@/lib/types";

export const runtime = "nodejs";
const maxFileSize = 4 * 1024 * 1024;
const fieldAliases: Record<string, keyof MemberInput> = {
  nosocio: "numeroSocio", numerosocio: "numeroSocio", numerodesocio: "numeroSocio", nrosocio: "numeroSocio", socio: "numeroSocio",
  nolegajo: "numeroLegajo", nlegajo: "numeroLegajo", nrolegajo: "numeroLegajo", numerodelegajo: "numeroLegajo",
  noacta: "numeroActa", numeroacta: "numeroActa", numerodeacta: "numeroActa", nroacta: "numeroActa",
  apellido: "apellido", nombre: "nombre", dni: "dni", documento: "dni", sexo: "sexo",
  fechanacimiento: "fechaNacimiento", fechadenacimiento: "fechaNacimiento", tiposocio: "tipoSocio", tipodesocio: "tipoSocio",
  domicilio: "domicilio", localidad: "localidad", telefono: "telefono", celular: "telefono",
  fechaalta: "fechaAlta", fechadealta: "fechaAlta", fechabaja: "fechaBaja", fechadebaja: "fechaBaja", motivobaja: "motivoBaja",
};

function normalizeHeader(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/°/g, "o").replace(/[^a-z0-9]/g, "");
}

function cellText(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "text" in value) return value.text;
  if (value && typeof value === "object" && "result" in value) return value.result;
  return value;
}

function displayCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "(vacío)";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const localDate = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (localDate) return `${localDate[3]}-${localDate[2].padStart(2, "0")}-${localDate[1].padStart(2, "0")}`;
  return null;
}

function mapRow(row: unknown[], headers: unknown[]): MemberInput | null {
  const mapped: Record<string, unknown> = { ...blankMember };
  headers.forEach((header, index) => {
    const field = fieldAliases[normalizeHeader(header)];
    if (!field) return;
    const value = cellText(row[index]);
    if (["fechaNacimiento", "fechaAlta", "fechaBaja"].includes(field)) {
      const date = parseDate(value);
      mapped[field] = date ?? (value === null || value === undefined || value === "" ? null : "fecha-invalida");
    } else {
      mapped[field] = value === null || value === undefined ? "" : String(value).trim();
    }
  });
  return parseMember(mapped);
}

async function readRows(file: File): Promise<unknown[][]> {
  const buffer = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    return sheet.getSheetValues().slice(1).map((row) =>
      Array.isArray(row) ? row.slice(1).map(cellText) : [],
    );
  }
  if (file.name.toLowerCase().endsWith(".csv")) {
    const bytes = new Uint8Array(buffer);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      text = new TextDecoder("windows-1252").decode(bytes);
    }
    text = text.replace(/^\uFEFF/, "");
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
    return parse(text, { bom: true, skip_empty_lines: true, delimiter }) as unknown[][];
  }
  throw new Error("Formato no compatible. Usá un archivo .xlsx o .csv.");
}

export async function POST(request: NextRequest) {
  const authorization = await authorize(request, ["administrador"]);
  if (!authorization.authorized) return authorization.response;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    if (body?.action !== "confirm" || !Array.isArray(body.members) || body.members.length > 1000) {
      return NextResponse.json({ error: "La confirmación no es válida o supera el máximo de 1000 filas." }, { status: 400 });
    }
    const members = body.members.map(parseMember);
    if (members.some((member: MemberInput | null) => !member)) {
      return NextResponse.json({ error: "La vista previa contiene filas inválidas. Volvé a cargar la planilla." }, { status: 400 });
    }
    try {
      const valid = members as MemberInput[];
      if (!valid.length) return NextResponse.json({ inserted: 0, duplicates: 0 });
      const values: unknown[] = [];
      const placeholders = valid.map((member) => {
        const fields = [member.numeroSocio, member.numeroLegajo, member.numeroActa, member.apellido,
          member.nombre, member.dni, member.sexo, member.fechaNacimiento, member.tipoSocio,
          member.domicilio, member.localidad, member.telefono, member.fechaAlta, member.fechaBaja, member.motivoBaja];
        return `(${fields.map((value) => {
          values.push(value);
          return `$${values.length}`;
        }).join(", ")})`;
      });
      const insertedRows = await getDb().query(
        `INSERT INTO socios (numero_socio, numero_legajo, numero_acta, apellido, nombre, dni, sexo,
          fecha_nacimiento, tipo_socio, domicilio, localidad, telefono, fecha_alta, fecha_baja, motivo_baja)
         VALUES ${placeholders.join(", ")} ON CONFLICT DO NOTHING RETURNING id`,
        values,
      );
      const inserted = insertedRows.length;
      return NextResponse.json({ inserted, duplicates: valid.length - inserted });
    } catch (error) {
      console.error("No se pudo confirmar la importación:", error);
      return NextResponse.json({ error: "No se pudo guardar la importación." }, { status: 500 });
    }
  }
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Seleccioná una planilla para importar." }, { status: 400 });
  if (file.size > maxFileSize) return NextResponse.json({ error: "El archivo supera el límite de 4 MiB." }, { status: 413 });

  try {
    const rows = await readRows(file);
    if (rows.length < 2) return NextResponse.json({ error: "La planilla no contiene filas para importar." }, { status: 400 });
    const [headers, ...dataRows] = rows;
    if (dataRows.length > 1000) return NextResponse.json({ error: "La planilla supera el máximo de 1000 filas por importación." }, { status: 413 });
    const seenNumbers = new Set<number>();
    const seenDnis = new Set<string>();
    const valid: MemberInput[] = [];
    const errors: { rowNumber: number; message: string; fields: { column: string; value: string }[] }[] = [];
    let duplicates = 0;

    dataRows.forEach((row, index) => {
      const member = mapRow(row, headers);
      if (!member) {
        errors.push({
          rowNumber: index + 2,
          message: "Falta el número de socio o el DNI, o hay una fecha inválida.",
          fields: headers.map((header, columnIndex) => ({
            column: String(header ?? `Columna ${columnIndex + 1}`),
            value: displayCell(cellText(row[columnIndex])),
          })),
        });
        return;
      }
      if (seenNumbers.has(member.numeroSocio) || seenDnis.has(member.dni)) {
        duplicates += 1;
        return;
      }
      seenNumbers.add(member.numeroSocio);
      seenDnis.add(member.dni);
      valid.push(member);
    });

    const existing = valid.length ? await getDb()`
      SELECT numero_socio AS "numeroSocio", dni FROM socios
      WHERE numero_socio = ANY(${valid.map((member) => member.numeroSocio)}::int[])
        OR dni = ANY(${valid.map((member) => member.dni)}::text[])
    ` : [];
    const existingNumbers = new Set(existing.map((row) => Number(row.numeroSocio)));
    const existingDnis = new Set(existing.map((row) => String(row.dni)));
    const ready = valid.filter((member) => !existingNumbers.has(member.numeroSocio) && !existingDnis.has(member.dni));
    duplicates += valid.length - ready.length;
    return NextResponse.json({ members: ready, valid: ready.length, duplicates, rejected: errors.length, errors: errors.slice(0, 20) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo procesar la planilla.";
    console.error("No se pudo importar el padrón:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}