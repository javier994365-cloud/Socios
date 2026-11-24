import { NextRequest, NextResponse } from "next/server";
import { authorize, hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { userRoles } from "@/lib/types";

function isUserRole(value: unknown): value is (typeof userRoles)[number] {
  return typeof value === "string" && userRoles.some((role) => role === value);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authorization = await authorize(request, ["administrador"]);
  if (!authorization.authorized) return authorization.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Los cambios de usuario no son válidos." }, { status: 400 });
  }
  const fields = Object.keys(body);
  if (!fields.length || fields.some((field) => !["role", "active", "password"].includes(field))) {
    return NextResponse.json({ error: "Los cambios de usuario no son válidos." }, { status: 400 });
  }
  if (Object.prototype.hasOwnProperty.call(body, "role") && !isUserRole(body.role)) {
    return NextResponse.json({ error: "Seleccioná un rol válido." }, { status: 400 });
  }
  if (Object.prototype.hasOwnProperty.call(body, "active") && typeof body.active !== "boolean") {
    return NextResponse.json({ error: "El estado del usuario no es válido." }, { status: 400 });
  }
  if (Object.prototype.hasOwnProperty.call(body, "password") &&
    (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 256)) {
    return NextResponse.json({ error: "La contraseña debe tener entre 12 y 256 caracteres." }, { status: 400 });
  }

  try {
    const db = getDb();
    const targets = await db`
      SELECT id, role, active FROM usuarios WHERE id = ${id} LIMIT 1
    `;
    const target = targets[0];
    if (!target) return NextResponse.json({ error: "No se encontró el usuario." }, { status: 404 });

    const losesAdminAccess = target.role === "administrador" && target.active &&
      ((body.role !== undefined && body.role !== "administrador") || body.active === false);
    if (losesAdminAccess) {
      if (authorization.user.id === id) {
        return NextResponse.json({ error: "No podés quitar o desactivar tu propio acceso de administrador." }, { status: 400 });
      }
      const admins = await db`
        SELECT COUNT(*) AS count FROM usuarios
        WHERE role = 'administrador' AND active = TRUE AND id <> ${id}
      `;
      if (Number(admins[0]?.count ?? 0) === 0) {
        return NextResponse.json({ error: "Debe quedar al menos un administrador activo." }, { status: 400 });
      }
    }

    const changes: { column: string; value: unknown }[] = [];
    if (body.role !== undefined) changes.push({ column: "role", value: body.role });
    if (body.active !== undefined) changes.push({ column: "active", value: body.active });
    if (body.password !== undefined) changes.push({ column: "password_hash", value: hashPassword(body.password) });
    const values = changes.map((change) => change.value);
    const assignments = changes.map((change, index) => `${change.column} = $${index + 1}`);
    assignments.push("session_version = session_version + 1", "updated_at = NOW()");
    values.push(id);
    const updated = await db.query(
      `UPDATE usuarios SET ${assignments.join(", ")} WHERE id = $${values.length}
       RETURNING id, username, role, active, created_at AS "createdAt"`,
      values,
    );
    if (!updated.length) return NextResponse.json({ error: "No se encontró el usuario." }, { status: 404 });
    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("No se pudo actualizar el usuario:", error);
    return NextResponse.json({ error: "No se pudo actualizar el usuario." }, { status: 500 });
  }
}
