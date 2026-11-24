import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { parseMember } from "@/lib/types";

const selectMembers = `
  SELECT id, numero_socio AS "numeroSocio", numero_legajo AS "numeroLegajo",
    numero_acta AS "numeroActa", apellido, nombre, dni, sexo,
    fecha_nacimiento AS "fechaNacimiento", tipo_socio AS "tipoSocio", domicilio,
    localidad, telefono, fecha_alta AS "fechaAlta", fecha_baja AS "fechaBaja",
    motivo_baja AS "motivoBaja"
  FROM socios
`;

export async function GET(request: NextRequest) {
  const authorization = await authorize(request);
  if (!authorization.authorized) return authorization.response;
  try {
    const rows = await getDb().query(`${selectMembers} ORDER BY numero_socio`);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("No se pudo consultar el padrón:", error);
    return NextResponse.json({ error: "No se pudo consultar la base. Revisá la conexión y el esquema." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorize(request, ["administrador", "secretaria"]);
  if (!authorization.authorized) return authorization.response;
  const member = parseMember(await request.json().catch(() => null));
  if (!member) return NextResponse.json({ error: "Completá un número de socio válido y el DNI. Revisá también las fechas." }, { status: 400 });
  try {
    const rows = await getDb()`
      INSERT INTO socios (numero_socio, numero_legajo, numero_acta, apellido, nombre, dni, sexo,
        fecha_nacimiento, tipo_socio, domicilio, localidad, telefono, fecha_alta, fecha_baja, motivo_baja)
      VALUES (${member.numeroSocio}, ${member.numeroLegajo}, ${member.numeroActa}, ${member.apellido},
        ${member.nombre}, ${member.dni}, ${member.sexo}, ${member.fechaNacimiento}, ${member.tipoSocio},
        ${member.domicilio}, ${member.localidad}, ${member.telefono}, ${member.fechaAlta},
        ${member.fechaBaja}, ${member.motivoBaja})
      RETURNING id
    `;
    return NextResponse.json({ id: rows[0].id }, { status: 201 });
  } catch (error) {
    const duplicate = typeof error === "object" && error !== null && "code" in error && error.code === "23505";
    if (duplicate) return NextResponse.json({ error: "Ya existe un socio con ese número o DNI." }, { status: 409 });
    console.error("No se pudo guardar el socio:", error);
    return NextResponse.json({ error: "No se pudo guardar el socio." }, { status: 500 });
  }
}