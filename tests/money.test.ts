import { describe, it, expect } from "vitest";
import { round2, toNumber } from "@/lib/money";

describe("round2", () => {
  it("rounds to two decimal places", () => {
    expect(round2(19.999)).toBe(20);
    expect(round2(100)).toBe(100);
    expect(round2(33.333)).toBe(33.33);
    expect(round2(66.666)).toBe(66.67);
  });
});

describe("toNumber", () => {
  it("passes plain numbers through unchanged", () => {
    expect(toNumber(42)).toBe(42);
  });
  it("returns 0 for null or undefined", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });
  it("unwraps Decimal-like objects via toNumber()", () => {
    expect(toNumber({ toNumber: () => 99.5 })).toBe(99.5);
  });
});
