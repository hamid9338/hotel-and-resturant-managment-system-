import { describe, it, expect } from "vitest";
import { createBookingSchema, discountSchema } from "@/lib/validation/hotel";
import { createOrderSchema } from "@/lib/validation/restaurant";
import { loginSchema } from "@/lib/validation/auth";

describe("createBookingSchema", () => {
  const base = {
    roomId: "room_1",
    guestName: "Ahmed Raza",
    cnic: "42101-1234567-1",
    phone: "0300-1112233",
    checkIn: "2026-10-01",
    checkOut: "2026-10-05",
  };

  it("accepts a valid booking", () => {
    expect(createBookingSchema.safeParse(base).success).toBe(true);
  });

  it("rejects checkout on or before check-in", () => {
    expect(createBookingSchema.safeParse({ ...base, checkOut: "2026-10-01" }).success).toBe(false);
    expect(createBookingSchema.safeParse({ ...base, checkOut: "2026-09-25" }).success).toBe(false);
  });

  it("rejects a booking with neither CNIC nor passport", () => {
    const withoutCnic = { ...base, cnic: undefined };
    expect(createBookingSchema.safeParse(withoutCnic).success).toBe(false);
  });

  it("accepts a passport in place of a CNIC", () => {
    const withPassportOnly = { ...base, cnic: undefined, passportNo: "AB1234567" };
    expect(createBookingSchema.safeParse(withPassportOnly).success).toBe(true);
  });
});

describe("discountSchema", () => {
  it("rejects a discount over 100%", () => {
    expect(discountSchema.safeParse({ percent: 150, reason: "test" }).success).toBe(false);
  });
  it("rejects a discount with no reason", () => {
    expect(discountSchema.safeParse({ percent: 10, reason: "" }).success).toBe(false);
  });
  it("accepts a valid discount", () => {
    expect(discountSchema.safeParse({ percent: 10, reason: "Loyal guest" }).success).toBe(true);
  });
});

describe("createOrderSchema", () => {
  it("requires a table for dine-in orders", () => {
    const result = createOrderSchema.safeParse({ orderType: "DINE_IN", items: [{ menuItemId: "m1", qty: 1 }] });
    expect(result.success).toBe(false);
  });
  it("requires a room for room-service orders", () => {
    const result = createOrderSchema.safeParse({ orderType: "ROOM_SERVICE", items: [{ menuItemId: "m1", qty: 1 }] });
    expect(result.success).toBe(false);
  });
  it("accepts a valid dine-in order", () => {
    const result = createOrderSchema.safeParse({
      orderType: "DINE_IN",
      tableId: "t1",
      items: [{ menuItemId: "m1", qty: 2 }],
    });
    expect(result.success).toBe(true);
  });
  it("rejects an order with zero items", () => {
    expect(createOrderSchema.safeParse({ orderType: "TAKEAWAY", items: [] }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("rejects an empty username", () => {
    expect(loginSchema.safeParse({ username: "", pin: "1234" }).success).toBe(false);
  });
  it("rejects a PIN shorter than 4 digits", () => {
    expect(loginSchema.safeParse({ username: "owner", pin: "12" }).success).toBe(false);
  });
  it("accepts valid credentials shape", () => {
    expect(loginSchema.safeParse({ username: "owner", pin: "9999" }).success).toBe(true);
  });
});
