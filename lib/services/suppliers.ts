import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/services/audit";
import type { SessionUser } from "@/lib/auth/session";
import type { supplierSchema } from "@/lib/validation/purchasing";

type SupplierInput = z.infer<typeof supplierSchema>;

export async function listSuppliers() {
  return prisma.supplier.findMany({ orderBy: { name: "asc" } });
}

export async function createSupplier(session: SessionUser, input: SupplierInput) {
  const supplier = await prisma.supplier.create({ data: input });

  await recordAudit({
    session,
    action: `Supplier added: ${supplier.name}`,
    module: "Inventory",
    entityType: "Supplier",
    entityId: supplier.id,
  });

  return supplier;
}

export async function updateSupplier(session: SessionUser, id: string, input: SupplierInput) {
  const supplier = await prisma.supplier.update({ where: { id }, data: input });

  await recordAudit({
    session,
    action: `Supplier updated: ${supplier.name}`,
    module: "Inventory",
    entityType: "Supplier",
    entityId: supplier.id,
  });

  return supplier;
}
