import { describe, it, expect } from "vitest";
import { normalizePakistaniPhone } from "@/lib/services/whatsapp";

describe("normalizePakistaniPhone", () => {
  it("rewrites a local 11-digit number (leading 0) to E.164", () => {
    expect(normalizePakistaniPhone("0300-9999999")).toBe("923009999999");
    expect(normalizePakistaniPhone("03219876543")).toBe("923219876543");
  });

  it("passes through an already-E.164 12-digit number", () => {
    expect(normalizePakistaniPhone("923009999999")).toBe("923009999999");
    expect(normalizePakistaniPhone("+92 300 9999999")).toBe("923009999999");
  });

  it("adds the country code to a bare 10-digit mobile number", () => {
    expect(normalizePakistaniPhone("3009999999")).toBe("923009999999");
  });

  it("rejects anything that isn't a recognizable Pakistani mobile number", () => {
    expect(normalizePakistaniPhone("12345")).toBeNull();
    expect(normalizePakistaniPhone("021-34567890")).toBeNull(); // landline, not mobile
    expect(normalizePakistaniPhone("")).toBeNull();
    expect(normalizePakistaniPhone("not a phone number")).toBeNull();
  });
});
