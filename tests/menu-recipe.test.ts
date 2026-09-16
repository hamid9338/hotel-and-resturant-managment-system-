import { describe, it, expect } from "vitest";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasRealDb = databaseUrl.length > 0 && !databaseUrl.includes("placeholder");

describe.skipIf(!hasRealDb)("menu item and recipe management", () => {
  it(
    "creates a menu item, sets a recipe, and replaces (not appends to) the recipe on a second save",
    async () => {
      const { prisma } = await import("@/lib/db");
      const { createMenuItem, setMenuItemRecipe, getMenuItemRecipe } = await import("@/lib/services/menu");

      const suffix = Date.now();
      const user = await prisma.user.findFirstOrThrow();
      const session = { id: user.id, name: user.name, username: user.username, roleId: user.roleId, roleName: "owner", shift: null, permissionKeys: [], authSource: "db" as const };

      const category = await prisma.menuCategory.create({ data: { name: `TestCat-${suffix}` } });
      const chicken = await prisma.inventoryItem.create({
        data: { sku: `TEST-CHICKEN-${suffix}`, name: `Chicken-${suffix}`, unit: "g", quantityOnHand: 1000 },
      });
      const tomato = await prisma.inventoryItem.create({
        data: { sku: `TEST-TOMATO-${suffix}`, name: `Tomato-${suffix}`, unit: "g", quantityOnHand: 1000 },
      });

      let menuItemId: string | null = null;
      try {
        const item = await createMenuItem(session, {
          name: `Karahi-${suffix}`,
          categoryId: category.id,
          price: 1500,
          available: true,
        });
        menuItemId = item.id;
        expect(item.name).toBe(`Karahi-${suffix}`);

        // First save: two ingredients.
        await setMenuItemRecipe(session, item.id, {
          lines: [
            { inventoryItemId: chicken.id, quantityUsed: 500 },
            { inventoryItemId: tomato.id, quantityUsed: 200 },
          ],
        });
        const firstSave = await getMenuItemRecipe(item.id);
        expect(firstSave).toHaveLength(2);

        // Second save: replaces the whole set with just one line — the old
        // tomato line must be gone, not left alongside the new one.
        await setMenuItemRecipe(session, item.id, { lines: [{ inventoryItemId: chicken.id, quantityUsed: 600 }] });
        const secondSave = await getMenuItemRecipe(item.id);
        expect(secondSave).toHaveLength(1);
        expect(secondSave[0].inventoryItemId).toBe(chicken.id);
        expect(Number(secondSave[0].quantityUsed)).toBe(600);

        // Third save: an empty set clears the recipe entirely.
        await setMenuItemRecipe(session, item.id, { lines: [] });
        expect(await getMenuItemRecipe(item.id)).toHaveLength(0);
      } finally {
        if (menuItemId) {
          await prisma.recipeItem.deleteMany({ where: { menuItemId } });
          await prisma.menuItem.delete({ where: { id: menuItemId } });
        }
        await prisma.inventoryItem.delete({ where: { id: chicken.id } });
        await prisma.inventoryItem.delete({ where: { id: tomato.id } });
        await prisma.menuCategory.delete({ where: { id: category.id } });
      }
    },
    30_000
  );
});
