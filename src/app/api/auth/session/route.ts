import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authSecret = process.env.AUTH_SECRET;
  const configured = Boolean(
    process.env.DATABASE_URL && process.env.ADMIN_PASSWORD && authSecret && authSecret.length >= 32,
  );
  return NextResponse.json({ configured, authenticated: configured && await hasValidSession(request) });
}