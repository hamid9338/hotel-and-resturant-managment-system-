import { describe, it, expect } from "vitest";
import { deriveOrderStatusFromItems } from "@/lib/services/orders";

describe("deriveOrderStatusFromItems", () => {
  it("stays PENDING while every item is still queued", () => {
    expect(deriveOrderStatusFromItems([{ status: "QUEUED" }, { status: null }], "PENDING")).toBe("PENDING");
  });

  it("moves to PREPARING once any item starts cooking", () => {
    expect(deriveOrderStatusFromItems([{ status: "COOKING" }, { status: "QUEUED" }], "PENDING")).toBe("PREPARING");
  });

  it("moves to READY only once every item is ready or served", () => {
    expect(deriveOrderStatusFromItems([{ status: "READY" }, { status: "COOKING" }], "PREPARING")).toBe("PREPARING");
    expect(deriveOrderStatusFromItems([{ status: "READY" }, { status: "SERVED" }], "PREPARING")).toBe("READY");
  });

  it("moves to SERVED only once every item is served", () => {
    expect(deriveOrderStatusFromItems([{ status: "SERVED" }, { status: "READY" }], "READY")).toBe("READY");
    expect(deriveOrderStatusFromItems([{ status: "SERVED" }, { status: "SERVED" }], "READY")).toBe("SERVED");
  });

  it("never overrides a terminal BILLED or CANCELLED status", () => {
    expect(deriveOrderStatusFromItems([{ status: "SERVED" }], "BILLED")).toBe("BILLED");
    expect(deriveOrderStatusFromItems([{ status: "QUEUED" }], "CANCELLED")).toBe("CANCELLED");
  });

  it("leaves currentStatus unchanged for an order with no items", () => {
    expect(deriveOrderStatusFromItems([], "PENDING")).toBe("PENDING");
  });
});
