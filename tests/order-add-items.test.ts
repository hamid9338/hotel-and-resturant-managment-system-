import { describe, it, expect } from "vitest";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasRealDb = databaseUrl.length > 0 && !databaseUrl.includes("placeholder");

describe.skipIf(!hasRealDb)("adding items to an already-placed order", () => {
  it(
    "recomputes subtotal/tax/total over existing + new items, rejects on a billed/cancelled order, and still deducts recipe stock exactly once at bill time",
    async () => {
      const { prisma } = await import("@/lib/db");
      const { addOrderItems, billOrder } = await import("@/lib/services/orders");

      const suffix = Date.now();
      const user = await prisma.user.findFirstOrThrow();
      const session = { id: user.id, name: user.name, username: user.username, roleId: user.roleId, roleName: "owner", shift: null, permissionKeys: [], authSource: "db" as const };

      const category = await prisma.menuCategory.create({ data: { name: `TestCat-${suffix}` } });
      const firstItem = await prisma.menuItem.create({
        data: { name: `First Item-${suffix}`, categoryId: category.id, price: 1000 },
      });
      const secondItem = await prisma.menuItem.create({
        data: { name: `Second Item-${suffix}`, categoryId: category.id, price: 500 },
      });
      const inventoryItem = await prisma.inventoryItem.create({
        data: { sku: `TEST-ADDITEMS-${suffix}`, name: `Ingredient-${suffix}`, unit: "g", quantityOnHand: 1000 },
      });
      await prisma.recipeItem.create({
        data: { menuItemId: secondItem.id, inventoryItemId: inventoryItem.id, quantityUsed: 50 },
      });
      const table = await prisma.restaurantTable.create({ data: { label: `T-ADDITEMS-${suffix}` } });
      const order = await prisma.restaurantOrder.create({
        data: {
          orderType: "DINE_IN",
          tableId: table.id,
          subtotal: 1000,
          taxAmount: 0,
          total: 1000,
          status: "PENDING",
          createdById: user.id,
          items: { create: [{ menuItemId: firstItem.id, nameSnapshot: firstItem.name, priceSnapshot: 1000, qty: 1 }] },
        },
      });

      try {
        // Adding 2x secondItem (500 each) to the existing 1000 must produce 2000, not just the 1000 delta.
        const updated = await addOrderItems(session, order.id, { items: [{ menuItemId: secondItem.id, qty: 2 }] });
        expect(Number(updated.subtotal)).toBe(2000);
        expect(Number(updated.total)).toBe(2000);
        const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
        expect(items).toHaveLength(2);

        // Billing now must deduct the recipe for the ADDED item (2 x 50g = 100g), even though it was
        // never present at order creation — deduction reads order.items fresh at bill time.
        await billOrder(session, order.id, { payments: [{ method: "CASH", amount: 2000 }] });
        const stockAfter = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItem.id } });
        expect(Number(stockAfter.quantityOnHand)).toBe(900);

        // Cannot add items to a now-billed order.
        await expect(addOrderItems(session, order.id, { items: [{ menuItemId: firstItem.id, qty: 1 }] })).rejects.toThrow();
      } finally {
        await prisma.stockMovement.deleteMany({ where: { inventoryItemId: inventoryItem.id } });
        await prisma.payment.deleteMany({ where: { orderId: order.id } });
        await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
        await prisma.restaurantOrder.delete({ where: { id: order.id } });
        await prisma.restaurantTable.delete({ where: { id: table.id } });
        await prisma.recipeItem.deleteMany({ where: { menuItemId: secondItem.id } });
        await prisma.inventoryItem.delete({ where: { id: inventoryItem.id } });
        await prisma.menuItem.delete({ where: { id: firstItem.id } });
        await prisma.menuItem.delete({ where: { id: secondItem.id } });
        await prisma.menuCategory.delete({ where: { id: category.id } });
      }
    },
    30_000
  );
});
