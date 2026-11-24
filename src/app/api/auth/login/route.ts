import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, ensureInitialAdmin, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { userRoles } from "@/lib/types";
import { getDb } from "@/lib/db";

function isUserRole(value: unknown): value is (typeof userRoles)[number] {
  return typeof value === "string" && userRoles.some((role) => role === value);
}

export async function POST(request: NextRequest) {
  if (!process.env.ADMIN_PASSWORD || !process.env.DATABASE_URL || !process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    return NextResponse.json({ error: "La aplicación todavía no está configurada." }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const provided = typeof body?.password === "string" ? body.password : "";
  if (!username || !provided || provided.length > 256) return NextResponse.json({ error: "El usuario o la contraseña no son correctos." }, { status: 401 });

  try {
    await ensureInitialAdmin();
    const users = await getDb()`
      SELECT id, username, role, active, password_hash AS "passwordHash",
        session_version AS "sessionVersion"
      FROM usuarios WHERE username = ${username} LIMIT 1
    `;
    const user = users[0];
    if (!user || !user.active || !isUserRole(user.role) || !verifyPassword(provided, String(user.passwordHash))) {
      return NextResponse.json({ error: "El usuario o la contraseña no son correctos." }, { status: 401 });
    }

    const role = user.role;
    const response = NextResponse.json({
      authenticated: true,
      user: { username: String(user.username), role },
    });
    response.cookies.set(SESSION_COOKIE, await createSessionToken({
      id: String(user.id),
      username: String(user.username),
      role,
      sessionVersion: Number(user.sessionVersion),
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (error) {
    console.error("No se pudo iniciar sesión:", error);
    return NextResponse.json({ error: "No se pudo iniciar sesión. Verificá la conexión y el esquema de la base." }, { status: 503 });
  }
}