import { describe, it, expect } from "vitest";
import { PERMISSIONS, ROLES } from "@/lib/rbac-matrix";

describe("RBAC matrix consistency", () => {
  const validKeys = new Set(PERMISSIONS.map((p) => p.key));

  it("has no duplicate permission keys", () => {
    expect(validKeys.size).toBe(PERMISSIONS.length);
  });

  it("has no duplicate role names", () => {
    const names = new Set(ROLES.map((r) => r.name));
    expect(names.size).toBe(ROLES.length);
  });

  it("every role only references permission keys that actually exist", () => {
    for (const role of ROLES) {
      for (const key of role.permissions) {
        expect(validKeys.has(key), `${role.name} references unknown permission "${key}"`).toBe(true);
      }
    }
  });

  it("every role has no duplicate permissions in its own list", () => {
    for (const role of ROLES) {
      expect(new Set(role.permissions).size, `${role.name} has a duplicate permission entry`).toBe(
        role.permissions.length
      );
    }
  });

  it("owner has every defined permission", () => {
    const owner = ROLES.find((r) => r.name === "owner");
    expect(owner).toBeDefined();
    for (const p of PERMISSIONS) {
      expect(owner!.permissions, `owner is missing "${p.key}"`).toContain(p.key);
    }
  });

  it("only owner/manager can apply a hotel discount or manage the menu", () => {
    const sensitive = ["hotel.discount", "restaurant.manage_menu"];
    for (const role of ROLES) {
      if (role.name === "owner" || role.name === "manager") continue;
      for (const key of sensitive) {
        expect(role.permissions, `${role.name} should not have "${key}"`).not.toContain(key);
      }
    }
  });

  it("only the owner can create or edit staff accounts (matches the prototype's rule exactly)", () => {
    for (const role of ROLES) {
      if (role.name === "owner") continue;
      expect(role.permissions, `${role.name} should not have "staff.create"`).not.toContain("staff.create");
      expect(role.permissions, `${role.name} should not have "staff.edit"`).not.toContain("staff.edit");
    }
  });
});
