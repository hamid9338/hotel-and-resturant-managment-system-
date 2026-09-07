import { describe, it, expect } from "vitest";

// This is an integration test against a real database — the exact
// double-booking-prevention check the project spec calls for. It requires a
// real DATABASE_URL (not the placeholder in .env.example) and is skipped
// gracefully otherwise rather than failing the suite. Run `npm test` again
// after wiring up a real Postgres connection to exercise it.
const databaseUrl = process.env.DATABASE_URL ?? "";
const hasRealDb = databaseUrl.length > 0 && !databaseUrl.includes("placeholder");

describe.skipIf(!hasRealDb)("assertRoomAvailable", () => {
  it("rejects an overlapping reservation but allows same-day turnover", async () => {
    // Neon's serverless compute suspends when idle and can take several
    // seconds to resume on the first query of a run — well past Vitest's
    // 5s default for what's otherwise a fast test.
    const { prisma } = await import("@/lib/db");
    const { assertRoomAvailable } = await import("@/lib/services/availability");

    const suffix = Date.now();
    const roomType = await prisma.roomType.create({
      data: { name: `TestType-${suffix}`, basePrice: 1000, capacity: 2 },
    });
    const room = await prisma.room.create({ data: { number: `T-${suffix}`, floor: 9, roomTypeId: roomType.id } });
    const guest = await prisma.guest.create({ data: { name: "Test Guest", phone: "0000000000" } });
    const user = await prisma.user.findFirstOrThrow();

    const existing = await prisma.booking.create({
      data: {
        roomId: room.id,
        guestId: guest.id,
        checkIn: new Date("2027-01-10"),
        checkOut: new Date("2027-01-15"),
        nights: 5,
        rate: 1000,
        subtotal: 5000,
        taxAmount: 250,
        total: 5250,
        balanceDue: 5250,
        status: "RESERVED",
        createdById: user.id,
      },
    });

    try {
      // Overlaps the middle of the existing stay.
      await expect(
        assertRoomAvailable(room.id, new Date("2027-01-12"), new Date("2027-01-18"))
      ).rejects.toThrow();

      // Starts the same day the existing stay checks out — legal turnover, not a conflict.
      await expect(
        assertRoomAvailable(room.id, new Date("2027-01-15"), new Date("2027-01-20"))
      ).resolves.toBeUndefined();

      // Ends the same day the existing stay checks in — also legal.
      await expect(
        assertRoomAvailable(room.id, new Date("2027-01-01"), new Date("2027-01-10"))
      ).resolves.toBeUndefined();
    } finally {
      await prisma.booking.delete({ where: { id: existing.id } });
      await prisma.guest.delete({ where: { id: guest.id } });
      await prisma.room.delete({ where: { id: room.id } });
      await prisma.roomType.delete({ where: { id: roomType.id } });
    }
  }, 30_000);
});
