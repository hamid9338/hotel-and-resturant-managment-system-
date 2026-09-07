import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected", time: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { status: "degraded", database: "unreachable", time: new Date().toISOString() },
      { status: 503 }
    );
  }
}
