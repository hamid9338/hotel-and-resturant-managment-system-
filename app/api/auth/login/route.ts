import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSessionCookie } from "@/lib/auth/session";
import { getRolePermissionKeys } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/services/audit";
import { loginSchema } from "@/lib/validation/auth";
import { ok, fail, handleRouteError, AppError } from "@/lib/api/respond";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const { username, pin } = loginSchema.parse(await request.json());
    const ip = clientIp(request);

    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000);
    const recentFailures = await prisma.loginAttempt.count({
      where: { username, ipAddress: ip, success: false, createdAt: { gte: windowStart } },
    });
    if (recentFailures >= MAX_ATTEMPTS) {
      throw new AppError(
        "TOO_MANY_ATTEMPTS",
        `Too many failed attempts. Try again in ${WINDOW_MINUTES} minutes.`,
        429
      );
    }

    const user = await prisma.user.findUnique({ where: { username }, include: { role: true } });
    const valid = user?.active ? await bcrypt.compare(pin, user.pinHash) : false;

    await prisma.loginAttempt.create({
      data: { username, ipAddress: ip, success: valid, userId: user?.id },
    });

    if (!user || !user.active || !valid) {
      if (user) {
        await recordAudit({
          session: null,
          action: `Failed login attempt for "${username}"`,
          module: "System",
          riskLevel: "MEDIUM",
          ipAddress: ip,
        });
      }
      return fail("INVALID_CREDENTIALS", "Invalid username or PIN.", 401);
    }

    await createSessionCookie(user.id);
    const permissionKeys = await getRolePermissionKeys(user.roleId);

    await recordAudit({
      session: { id: user.id, name: user.name, username: user.username, roleId: user.roleId, roleName: user.role.name, shift: user.shift },
      action: "Login successful",
      module: "System",
      ipAddress: ip,
    });

    return ok({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role.name,
        roleLabel: user.role.label,
        shift: user.shift,
      },
      permissions: [...permissionKeys],
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
