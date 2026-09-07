import { describe, it, expect } from "vitest";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasRealDb = databaseUrl.length > 0 && !databaseUrl.includes("placeholder");

describe.skipIf(!hasRealDb)("multi-delivery purchase order receiving", () => {
  it(
    "accumulates quantityReceived across two partial deliveries and transitions ORDERED -> PARTIALLY_RECEIVED -> RECEIVED",
    async () => {
      const { prisma } = await import("@/lib/db");
      const { createPurchaseOrder, receivePurchaseOrder, updatePurchaseOrderStatus } = await import(
        "@/lib/services/purchase-orders"
      );

      const suffix = Date.now();
      const user = await prisma.user.findFirstOrThrow();
      const session = { id: user.id, name: user.name, username: user.username, roleId: user.roleId, roleName: "owner", shift: null };

      const supplier = await prisma.supplier.create({ data: { name: `Test Supplier-${suffix}` } });
      const item = await prisma.inventoryItem.create({
        data: { sku: `TEST-PO-${suffix}`, name: "Test Flour", unit: "kg", quantityOnHand: 0, reorderLevel: 5 },
      });

      const po = await createPurchaseOrder(session, {
        supplierId: supplier.id,
        items: [{ inventoryItemId: item.id, quantityOrdered: 50, unitCost: 10 }],
      });

      try {
        await updatePurchaseOrderStatus(session, po.id, { status: "ORDERED" });

        // First delivery: 20 of 50 arrive.
        const afterFirst = await receivePurchaseOrder(session, po.id, {
          lines: [{ poItemId: po.items[0].id, quantityReceivedNow: 20 }],
        });
        expect(afterFirst.status).toBe("PARTIALLY_RECEIVED");
        const itemAfterFirst = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
        expect(Number(itemAfterFirst.quantityOnHand)).toBe(20);

        // Over-receiving beyond what's left on the line must reject.
        await expect(
          receivePurchaseOrder(session, po.id, { lines: [{ poItemId: po.items[0].id, quantityReceivedNow: 100 }] })
        ).rejects.toThrow();

        // Second delivery: the remaining 30 arrive.
        const afterSecond = await receivePurchaseOrder(session, po.id, {
          lines: [{ poItemId: po.items[0].id, quantityReceivedNow: 30 }],
        });
        expect(afterSecond.status).toBe("RECEIVED");
        const itemAfterSecond = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
        expect(Number(itemAfterSecond.quantityOnHand)).toBe(50);

        const movements = await prisma.stockMovement.findMany({ where: { relatedId: po.id } });
        expect(movements).toHaveLength(2);
        expect(movements.every((m) => m.source === "PURCHASE_ORDER_RECEIVED")).toBe(true);
      } finally {
        await prisma.stockMovement.deleteMany({ where: { relatedId: po.id } });
        await prisma.purchaseOrderItem.deleteMany({ where: { poId: po.id } });
        await prisma.purchaseOrder.delete({ where: { id: po.id } });
        await prisma.inventoryItem.delete({ where: { id: item.id } });
        await prisma.supplier.delete({ where: { id: supplier.id } });
      }
    },
    30_000
  );
});
