import { describe, it, expect } from "vitest";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasRealDb = databaseUrl.length > 0 && !databaseUrl.includes("placeholder");

describe.skipIf(!hasRealDb)("split-by-payment-method billing", () => {
  it(
    "creates one Payment row per split entry, and rejects a mismatched sum before any write",
    async () => {
      const { prisma } = await import("@/lib/db");
      const { billOrder } = await import("@/lib/services/orders");

      const suffix = Date.now();
      const user = await prisma.user.findFirstOrThrow();
      const session = { id: user.id, name: user.name, username: user.username, roleId: user.roleId, roleName: "owner", shift: null };

      const category = await prisma.menuCategory.create({ data: { name: `TestCat-${suffix}` } });
      const menuItem = await prisma.menuItem.create({
        data: { name: `Test Item-${suffix}`, categoryId: category.id, price: 1000 },
      });
      const table = await prisma.restaurantTable.create({ data: { label: `T-SPLIT-${suffix}` } });
      const order = await prisma.restaurantOrder.create({
        data: {
          orderType: "DINE_IN",
          tableId: table.id,
          subtotal: 1000,
          taxAmount: 0,
          total: 1000,
          status: "PENDING",
          createdById: user.id,
          items: { create: [{ menuItemId: menuItem.id, nameSnapshot: menuItem.name, priceSnapshot: 1000, qty: 1 }] },
        },
      });

      try {
        // Mismatched sum (600 + 300 = 900, not 1000) must reject before any write.
        await expect(
          billOrder(session, order.id, {
            payments: [
              { method: "CASH", amount: 600 },
              { method: "CARD", amount: 300 },
            ],
          })
        ).rejects.toThrow();

        const stillPending = await prisma.restaurantOrder.findUniqueOrThrow({ where: { id: order.id } });
        expect(stillPending.status).toBe("PENDING");
        expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(0);

        // Correct split (600 + 400 = 1000) succeeds and creates exactly 2 rows.
        await billOrder(session, order.id, {
          payments: [
            { method: "CASH", amount: 600 },
            { method: "CARD", amount: 400 },
          ],
        });

        const payments = await prisma.payment.findMany({ where: { orderId: order.id } });
        expect(payments).toHaveLength(2);
        expect(payments.reduce((sum, p) => sum + Number(p.amount), 0)).toBe(1000);

        const billed = await prisma.restaurantOrder.findUniqueOrThrow({ where: { id: order.id } });
        expect(billed.status).toBe("BILLED");
        expect(billed.invoiceNo).toBeTruthy();
      } finally {
        await prisma.payment.deleteMany({ where: { orderId: order.id } });
        await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
        await prisma.restaurantOrder.delete({ where: { id: order.id } });
        await prisma.restaurantTable.delete({ where: { id: table.id } });
        await prisma.menuItem.delete({ where: { id: menuItem.id } });
        await prisma.menuCategory.delete({ where: { id: category.id } });
      }
    },
    30_000
  );
});
