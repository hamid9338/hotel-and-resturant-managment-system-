import { describe, it, expect } from "vitest";

// Real integration test against the live database — see
// tests/availability.test.ts for the pattern this follows (self-contained
// throwaway rows, skipped gracefully without a real DATABASE_URL).
const databaseUrl = process.env.DATABASE_URL ?? "";
const hasRealDb = databaseUrl.length > 0 && !databaseUrl.includes("placeholder");

describe.skipIf(!hasRealDb)("recipe-based stock deduction", () => {
  it(
    "deducts ingredients for a recipe'd item and leaves a non-recipe'd item untouched",
    async () => {
      const { prisma } = await import("@/lib/db");
      const { billOrder } = await import("@/lib/services/orders");

      const suffix = Date.now();
      const user = await prisma.user.findFirstOrThrow();
      const session = { id: user.id, name: user.name, username: user.username, roleId: user.roleId, roleName: "owner", shift: null };

      const category = await prisma.menuCategory.create({ data: { name: `TestCat-${suffix}` } });
      const ingredient = await prisma.inventoryItem.create({
        data: { sku: `TEST-ING-${suffix}`, name: "Test Rice", unit: "kg", quantityOnHand: 100, reorderLevel: 5 },
      });
      const recipedItem = await prisma.menuItem.create({
        data: { name: `Test Biryani-${suffix}`, categoryId: category.id, price: 500 },
      });
      const plainItem = await prisma.menuItem.create({
        data: { name: `Test Soda-${suffix}`, categoryId: category.id, price: 100 },
      });
      const recipe = await prisma.recipeItem.create({
        data: { menuItemId: recipedItem.id, inventoryItemId: ingredient.id, quantityUsed: 2 },
      });
      const table = await prisma.restaurantTable.create({ data: { label: `T-TEST-${suffix}` } });
      const order = await prisma.restaurantOrder.create({
        data: {
          orderType: "DINE_IN",
          tableId: table.id,
          subtotal: 700,
          taxAmount: 0,
          total: 700,
          status: "PENDING",
          createdById: user.id,
          items: {
            create: [
              { menuItemId: recipedItem.id, nameSnapshot: recipedItem.name, priceSnapshot: 500, qty: 3 },
              { menuItemId: plainItem.id, nameSnapshot: plainItem.name, priceSnapshot: 100, qty: 1 },
            ],
          },
        },
      });

      try {
        await billOrder(session, order.id, { payments: [{ method: "CASH", amount: 700 }] });

        const refreshedIngredient = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: ingredient.id } });
        // 3 biryanis × 2kg rice each = 6kg deducted from 100kg on hand.
        expect(Number(refreshedIngredient.quantityOnHand)).toBe(94);

        const movements = await prisma.stockMovement.findMany({ where: { relatedId: order.id } });
        expect(movements).toHaveLength(1);
        expect(movements[0].source).toBe("RECIPE_DEDUCTION");
        expect(Number(movements[0].quantityDelta)).toBe(-6);
      } finally {
        await prisma.stockMovement.deleteMany({ where: { relatedId: order.id } });
        await prisma.payment.deleteMany({ where: { orderId: order.id } });
        await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
        await prisma.restaurantOrder.delete({ where: { id: order.id } });
        await prisma.restaurantTable.delete({ where: { id: table.id } });
        await prisma.recipeItem.delete({ where: { id: recipe.id } });
        await prisma.menuItem.delete({ where: { id: plainItem.id } });
        await prisma.menuItem.delete({ where: { id: recipedItem.id } });
        await prisma.inventoryItem.delete({ where: { id: ingredient.id } });
        await prisma.menuCategory.delete({ where: { id: category.id } });
      }
    },
    30_000
  );
});
