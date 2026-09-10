import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Deliberately does not import anything from lib/auth/session.ts — that
// module now throws at load time if JWT_SECRET is unset (fail-fast), which
// would take this health check down with it instead of letting it report
// the misconfiguration. Checked directly here instead.
export async function GET() {
  if (!process.env.JWT_SECRET) {
    return NextResponse.json(
      { status: "degraded", database: "unknown", auth: "JWT_SECRET not set", time: new Date().toISOString() },
      { status: 503 }
    );
  }

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
