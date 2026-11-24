import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !process.env.DATABASE_URL || !process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    return NextResponse.json({ error: "La aplicación todavía no está configurada." }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const provided = typeof body?.password === "string" ? body.password : "";
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  const matches = expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
  if (!matches) return NextResponse.json({ error: "La contraseña no es correcta." }, { status: 401 });

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}