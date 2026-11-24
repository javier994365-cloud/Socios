import { NextRequest, NextResponse } from "next/server";
import { authorize, hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { userRoles } from "@/lib/types";

function isUserRole(value: unknown): value is (typeof userRoles)[number] {
  return typeof value === "string" && userRoles.some((role) => role === value);
}

export async function GET(request: NextRequest) {
  const authorization = await authorize(request, ["administrador"]);
  if (!authorization.authorized) return authorization.response;
  try {
    const users = await getDb()`
      SELECT id, username, role, active, created_at AS "createdAt"
      FROM usuarios ORDER BY username
    `;
    return NextResponse.json(users);
  } catch (error) {
    console.error("No se pudieron consultar los usuarios:", error);
    return NextResponse.json({ error: "No se pudieron consultar los usuarios." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorize(request, ["administrador"]);
  if (!authorization.authorized) return authorization.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) ||
    Object.keys(body).some((field) => !["username", "password", "role"].includes(field))) {
    return NextResponse.json({ error: "Los datos del usuario no son válidos." }, { status: 400 });
  }
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    return NextResponse.json({ error: "El usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo." }, { status: 400 });
  }
  if (password.length < 12 || password.length > 256) {
    return NextResponse.json({ error: "La contraseña debe tener entre 12 y 256 caracteres." }, { status: 400 });
  }
  if (!isUserRole(body?.role)) {
    return NextResponse.json({ error: "Seleccioná un rol válido." }, { status: 400 });
  }

  try {
    const users = await getDb()`
      INSERT INTO usuarios (username, password_hash, role)
      VALUES (${username}, ${hashPassword(password)}, ${body.role})
      RETURNING id, username, role, active, created_at AS "createdAt"
    `;
    return NextResponse.json(users[0], { status: 201 });
  } catch (error) {
    const duplicate = typeof error === "object" && error !== null && "code" in error && error.code === "23505";
    if (duplicate) return NextResponse.json({ error: "Ese nombre de usuario ya está en uso." }, { status: 409 });
    console.error("No se pudo crear el usuario:", error);
    return NextResponse.json({ error: "No se pudo crear el usuario." }, { status: 500 });
  }
}
