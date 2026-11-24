import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { parseMemberPatch, type MemberInput } from "@/lib/types";

const memberColumns: Record<keyof MemberInput, string> = {
  numeroSocio: "numero_socio",
  numeroLegajo: "numero_legajo",
  numeroActa: "numero_acta",
  apellido: "apellido",
  nombre: "nombre",
  dni: "dni",
  sexo: "sexo",
  fechaNacimiento: "fecha_nacimiento",
  tipoSocio: "tipo_socio",
  domicilio: "domicilio",
  localidad: "localidad",
  telefono: "telefono",
  fechaAlta: "fecha_alta",
  fechaBaja: "fecha_baja",
  motivoBaja: "motivo_baja",
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authorization = await authorize(request, ["administrador", "secretaria"]);
  if (!authorization.authorized) return authorization.response;
  const { id } = await context.params;
  const patch = parseMemberPatch(await request.json().catch(() => null));
  if (!patch) return NextResponse.json({ error: "Revisá los valores modificados: el número de socio, el DNI o alguna fecha no son válidos." }, { status: 400 });
  try {
    const fields = Object.keys(patch) as (keyof MemberInput)[];
    const values = fields.map((field) => patch[field]);
    const assignments = fields.map((field, index) => `${memberColumns[field]} = $${index + 1}`);
    values.push(id);
    const rows = await getDb().query(
      `UPDATE socios SET ${assignments.join(", ")}, actualizado_en = NOW()
       WHERE id = $${values.length} RETURNING id`,
      values,
    );
    if (!rows.length) return NextResponse.json({ error: "No se encontró el socio." }, { status: 404 });
    return NextResponse.json({ updated: true });
  } catch (error) {
    const duplicate = typeof error === "object" && error !== null && "code" in error && error.code === "23505";
    if (duplicate) return NextResponse.json({ error: "Ya existe otro socio con ese número o DNI." }, { status: 409 });
    const invalidDateRange = typeof error === "object" && error !== null && "code" in error && error.code === "23514";
    if (invalidDateRange) return NextResponse.json({ error: "La fecha de baja no puede ser anterior a la fecha de alta." }, { status: 400 });
    console.error("No se pudo actualizar el socio:", error);
    return NextResponse.json({ error: "No se pudo actualizar el socio." }, { status: 500 });
  }
}