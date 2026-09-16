import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/api/respond";
import { recordAudit } from "@/lib/services/audit";
import type { SessionUser } from "@/lib/auth/session";
import type { createMenuItemSchema, createMenuCategorySchema, setRecipeSchema } from "@/lib/validation/restaurant";

type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>;
type SetRecipeInput = z.infer<typeof setRecipeSchema>;

export async function createMenuItem(session: SessionUser, input: CreateMenuItemInput) {
  const category = await prisma.menuCategory.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new AppError("CATEGORY_NOT_FOUND", "Menu category not found.", 404);

  const item = await prisma.menuItem.create({ data: input, include: { category: true } });

  await recordAudit({
    session,
    action: `Menu item created: ${item.name}`,
    module: "Restaurant",
    entityType: "MenuItem",
    entityId: item.id,
  });

  return item;
}

export async function createMenuCategory(session: SessionUser, input: CreateMenuCategoryInput) {
  const category = await prisma.menuCategory.create({ data: input });

  await recordAudit({
    session,
    action: `Menu category created: ${category.name}`,
    module: "Restaurant",
    entityType: "MenuCategory",
    entityId: category.id,
  });

  return category;
}

export async function getMenuItemRecipe(menuItemId: string) {
  return prisma.recipeItem.findMany({
    where: { menuItemId },
    include: { inventoryItem: { select: { id: true, name: true, unit: true } } },
  });
}

/**
 * Replaces the full recipe-line set for one menu item in a single
 * transaction (delete what's there, insert what was submitted) — simpler and
 * less error-prone than fine-grained per-line CRUD for something staff
 * naturally edit as "here's the whole ingredient list." Doesn't touch
 * InventoryItem.quantityOnHand at all; that only ever moves via
 * recordStockMovement at bill time (lib/services/orders.ts::billOrder).
 */
export async function setMenuItemRecipe(session: SessionUser, menuItemId: string, input: SetRecipeInput) {
  const menuItem = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
  if (!menuItem) throw new AppError("MENU_ITEM_NOT_FOUND", "Menu item not found.", 404);

  if (input.lines.length > 0) {
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { id: { in: input.lines.map((l) => l.inventoryItemId) } },
    });
    if (inventoryItems.length !== new Set(input.lines.map((l) => l.inventoryItemId)).size) {
      throw new AppError("INVENTORY_ITEM_NOT_FOUND", "One of the selected ingredients no longer exists.", 404);
    }
  }

  await prisma.$transaction([
    prisma.recipeItem.deleteMany({ where: { menuItemId } }),
    prisma.recipeItem.createMany({
      data: input.lines.map((line) => ({
        menuItemId,
        inventoryItemId: line.inventoryItemId,
        quantityUsed: line.quantityUsed,
      })),
    }),
  ]);

  await recordAudit({
    session,
    action: `Recipe updated: ${menuItem.name}`,
    module: "Restaurant",
    entityType: "MenuItem",
    entityId: menuItem.id,
    details: `${input.lines.length} ingredient(s)`,
  });

  return getMenuItemRecipe(menuItemId);
}
