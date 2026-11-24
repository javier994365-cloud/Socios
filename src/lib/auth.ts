import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import type { UserRole } from "@/lib/types";

export const SESSION_COOKIE = "socios_session";

const keyLength = 64;
const validRoles = new Set<string>(["consulta", "secretaria", "administrador"]);

export type SessionUser = {
  id: string;
  username: string;
  role: UserRole;
};

export type AuthUser = SessionUser & {
  sessionVersion: number;
};

export type AuthorizationResult =
  | { authorized: true; user: SessionUser }
  | { authorized: false; response: NextResponse };

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && validRoles.has(value);
}

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET debe tener al menos 32 caracteres.");
  return new TextEncoder().encode(secret);
}

export function hashPassword(password: string) {
  if (password.length > 256) throw new Error("La contraseña supera el máximo de 256 caracteres.");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, keyLength).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, encodedHash: string) {
  if (password.length > 256) return false;
  const [salt, storedHash, ...extra] = encodedHash.split(":");
  if (
    extra.length ||
    !/^[a-f0-9]{32}$/.test(salt ?? "") ||
    !/^[a-f0-9]{128}$/.test(storedHash ?? "")
  ) return false;
  const actual = scryptSync(password, salt, keyLength);
  const expected = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function ensureInitialAdmin() {
  const db = getDb();
  const users = await db`SELECT id FROM usuarios LIMIT 1`;
  if (users.length) return;

  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("Falta configurar ADMIN_PASSWORD para crear el usuario inicial.");
  if (password.length > 256) throw new Error("ADMIN_PASSWORD supera el máximo de 256 caracteres.");
  const passwordHash = hashPassword(password);
  await db`
    INSERT INTO usuarios (username, password_hash, role)
    VALUES ('admin', ${passwordHash}, 'administrador')
    ON CONFLICT (username) DO NOTHING
  `;
}

export async function createSessionToken(user: AuthUser) {
  return new SignJWT({ sessionVersion: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secretKey());
}

export async function getSession(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !process.env.AUTH_SECRET) return null;

  let payload;
  try {
    ({ payload } = await jwtVerify(token, secretKey()));
  } catch {
    return null;
  }
  if (typeof payload.sub !== "string" || typeof payload.sessionVersion !== "number") return null;

  const users = await getDb()`
    SELECT id, username, role, session_version AS "sessionVersion"
    FROM usuarios
    WHERE id = ${payload.sub} AND active = TRUE
    LIMIT 1
  `;
  const user = users[0];
  if (
    !user ||
    !isUserRole(user.role) ||
    Number(user.sessionVersion) !== payload.sessionVersion
  ) return null;

  return { id: String(user.id), username: String(user.username), role: user.role };
}

export async function authorize(
  request: NextRequest,
  allowedRoles?: readonly UserRole[],
): Promise<AuthorizationResult> {
  let user: SessionUser | null;
  try {
    user = await getSession(request);
  } catch (error) {
    console.error("No se pudo verificar la sesión:", error);
    return {
      authorized: false,
      response: NextResponse.json({ error: "No se pudo verificar la sesión." }, { status: 503 }),
    };
  }
  if (!user) {
    return { authorized: false, response: NextResponse.json({ error: "No autorizado." }, { status: 401 }) };
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { authorized: false, response: NextResponse.json({ error: "No tenés permisos para esta acción." }, { status: 403 }) };
  }
  return { authorized: true, user };
}
