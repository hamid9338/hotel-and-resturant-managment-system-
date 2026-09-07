import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";

/** The business-settings singleton row (id=1), created on first read if missing. */
export const getSettings = cache(async () => {
  const existing = await prisma.systemSetting.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.systemSetting.create({ data: { id: 1 } });
});

export async function updateSettings(data: {
  businessName?: string;
  currency?: string;
  timezone?: string;
  taxRatePct?: number;
  serviceChargePct?: number;
  invoicePrefix?: string;
}) {
  return prisma.systemSetting.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
}
