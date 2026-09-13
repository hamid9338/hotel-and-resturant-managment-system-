import { describe, it, expect } from "vitest";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasRealDb = databaseUrl.length > 0 && !databaseUrl.includes("placeholder");

// Exercises applySyncOperation() directly (not through HTTP) for the 3
// operation kinds added to support offline purchases. The other 4
// already-whitelisted-but-client-unwired kinds (bookings.checkin/checkout,
// orders.updateStatus, rooms.updateStatus) are deliberately not covered here
// — out of scope for this change, see the plan.
describe.skipIf(!hasRealDb)("offline sync — purchasing operations", () => {
  it(
    "applies expenses.create and assigns the client-supplied id",
    async () => {
      const { prisma } = await import("@/lib/db");
      const { applySyncOperation } = await import("@/lib/services/sync");
      const owner = await prisma.user.findFirstOrThrow({ where: { role: { name: "owner" } } });
      const session = { id: owner.id, name: owner.name, username: owner.username, roleId: owner.roleId, roleName: "owner", shift: null };
      const id = crypto.randomUUID();

      try {
        const result = await applySyncOperation(session, {
          id,
          deviceId: "test-device",
          operationKind: "expenses.create",
          entityId: id,
          payload: { category: `TestSyncExpense-${Date.now()}`, amount: 100, method: "CASH" },
          clientTimestamp: new Date().toISOString(),
        });
        expect(result).toMatchObject({ status: "applied", entityId: id });
        const expense = await prisma.expense.findUnique({ where: { id } });
        expect(expense).toBeTruthy();
      } finally {
        await prisma.expense.deleteMany({ where: { id } });
        await prisma.syncOperation.deleteMany({ where: { id } });
      }
    },
    30_000
  );

  it(
    "applies purchaseOrders.create and assigns the client-supplied id",
    async () => {
      const { prisma } = await import("@/lib/db");
      const { applySyncOperation } = await import("@/lib/services/sync");
      const owner = await prisma.user.findFirstOrThrow({ where: { role: { name: "owner" } } });
      const session = { id: owner.id, name: owner.name, username: owner.username, roleId: owner.roleId, roleName: "owner", shift: null };

      const suffix = Date.now();
      const supplier = await prisma.supplier.create({ data: { name: `Test Sync Supplier-${suffix}` } });
      const item = await prisma.inventoryItem.create({
        data: { sku: `TEST-SYNC-PO-${suffix}`, name: "Test Sync PO Item", unit: "kg", quantityOnHand: 0, reorderLevel: 5 },
      });
      const id = crypto.randomUUID();

      try {
        const result = await applySyncOperation(session, {
          id,
          deviceId: "test-device",
          operationKind: "purchaseOrders.create",
          entityId: id,
          payload: { supplierId: supplier.id, items: [{ inventoryItemId: item.id, quantityOrdered: 10, unitCost: 5 }] },
          clientTimestamp: new Date().toISOString(),
        });
        expect(result).toMatchObject({ status: "applied", entityId: id });
        const po = await prisma.purchaseOrder.findUnique({ where: { id } });
        expect(po).toBeTruthy();
      } finally {
        await prisma.purchaseOrderItem.deleteMany({ where: { poId: id } });
        await prisma.purchaseOrder.deleteMany({ where: { id } });
        await prisma.inventoryItem.delete({ where: { id: item.id } });
        await prisma.supplier.delete({ where: { id: supplier.id } });
        await prisma.syncOperation.deleteMany({ where: { id } });
      }
    },
    30_000
  );

  it(
    "applies inventory.adjustStock, increments quantityOnHand, and returns the item's real id (not the synthetic entityId)",
    async () => {
      const { prisma } = await import("@/lib/db");
      const { applySyncOperation } = await import("@/lib/services/sync");
      const owner = await prisma.user.findFirstOrThrow({ where: { role: { name: "owner" } } });
      const session = { id: owner.id, name: owner.name, username: owner.username, roleId: owner.roleId, roleName: "owner", shift: null };

      const suffix = Date.now();
      const item = await prisma.inventoryItem.create({
        data: { sku: `TEST-SYNC-ADJ-${suffix}`, name: "Test Sync Adjust Item", unit: "kg", quantityOnHand: 10, reorderLevel: 5 },
      });
      // Deliberately different from item.id — matches the client-side fix:
      // this is the queued operation's own idempotency key, not the target.
      const opId = crypto.randomUUID();

      try {
        const result = await applySyncOperation(session, {
          id: opId,
          deviceId: "test-device",
          operationKind: "inventory.adjustStock",
          entityId: opId,
          payload: { inventoryItemId: item.id, quantityDelta: 5, reason: "Test sync adjustment" },
          clientTimestamp: new Date().toISOString(),
        });
        expect(result).toMatchObject({ status: "applied", entityId: item.id });
        const updated = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
        expect(Number(updated.quantityOnHand)).toBe(15);
      } finally {
        await prisma.stockMovement.deleteMany({ where: { inventoryItemId: item.id } });
        await prisma.inventoryItem.delete({ where: { id: item.id } });
        await prisma.syncOperation.deleteMany({ where: { id: opId } });
      }
    },
    30_000
  );

  it(
    "rejects all three new kinds for a role without the matching permission",
    async () => {
      const { prisma } = await import("@/lib/db");
      const { applySyncOperation } = await import("@/lib/services/sync");
      const role = await prisma.role.findUniqueOrThrow({ where: { name: "waiter" } });
      const waiter = await prisma.user.findFirstOrThrow({ where: { roleId: role.id } });
      const session = { id: waiter.id, name: waiter.name, username: waiter.username, roleId: role.id, roleName: "waiter", shift: null };

      const cases: {
        operationKind: "expenses.create" | "purchaseOrders.create" | "inventory.adjustStock";
        payload: Record<string, unknown>;
      }[] = [
        { operationKind: "expenses.create", payload: { category: "x", amount: 1, method: "CASH" } },
        { operationKind: "purchaseOrders.create", payload: { supplierId: "nonexistent", items: [] } },
        { operationKind: "inventory.adjustStock", payload: { inventoryItemId: "nonexistent", quantityDelta: 1, reason: "test reason" } },
      ];

      for (const c of cases) {
        const id = crypto.randomUUID();
        try {
          const result = await applySyncOperation(session, {
            id,
            deviceId: "test-device",
            entityId: id,
            clientTimestamp: new Date().toISOString(),
            ...c,
          });
          expect(result.status, `${c.operationKind} should be rejected for waiter`).toBe("rejected");
          if (result.status === "rejected") {
            expect(result.reason).toContain("does not have permission");
          }
        } finally {
          await prisma.syncOperation.deleteMany({ where: { id } });
        }
      }
    },
    30_000
  );

  it(
    "applying the same expenses.create operation id twice only creates one row",
    async () => {
      const { prisma } = await import("@/lib/db");
      const { applySyncOperation } = await import("@/lib/services/sync");
      const owner = await prisma.user.findFirstOrThrow({ where: { role: { name: "owner" } } });
      const session = { id: owner.id, name: owner.name, username: owner.username, roleId: owner.roleId, roleName: "owner", shift: null };
      const id = crypto.randomUUID();
      const op = {
        id,
        deviceId: "test-device",
        operationKind: "expenses.create" as const,
        entityId: id,
        payload: { category: `TestSyncIdempotent-${Date.now()}`, amount: 50, method: "CASH" },
        clientTimestamp: new Date().toISOString(),
      };

      try {
        const first = await applySyncOperation(session, op);
        expect(first.status).toBe("applied");
        const second = await applySyncOperation(session, op);
        expect(second.status).toBe("duplicate");
        const count = await prisma.expense.count({ where: { id } });
        expect(count).toBe(1);
      } finally {
        await prisma.expense.deleteMany({ where: { id } });
        await prisma.syncOperation.deleteMany({ where: { id } });
      }
    },
    30_000
  );
});
