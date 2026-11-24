import "server-only";
import { jwtVerify, SignJWT } from "jose";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "socios_session";

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET debe tener al menos 32 caracteres.");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken() {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secretKey());
}

export async function hasValidSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !process.env.AUTH_SECRET) return false;
  try {
    await jwtVerify(token, secretKey());
    return true;
  } catch {
    return false;
  }
}