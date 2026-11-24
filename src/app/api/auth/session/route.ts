import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authSecret = process.env.AUTH_SECRET;
  const configured = Boolean(
    process.env.DATABASE_URL && process.env.ADMIN_PASSWORD && authSecret && authSecret.length >= 32,
  );
  if (!configured) return NextResponse.json({ configured, authenticated: false, user: null });
  try {
    const user = await getSession(request);
    return NextResponse.json({
      configured,
      authenticated: Boolean(user),
      user: user ? { username: user.username, role: user.role } : null,
    });
  } catch (error) {
    console.error("No se pudo verificar la sesión:", error);
    return NextResponse.json({ error: "No se pudo verificar la sesión." }, { status: 503 });
  }
}