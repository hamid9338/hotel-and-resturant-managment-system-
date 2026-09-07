import { ROLES as ROLE_DEFS } from "@/lib/rbac-matrix";

// Just the id/label pairs, for populating role <select> dropdowns —
// derived from the same source prisma/seed.ts uses, so this can't drift
// from what's actually seeded.
export const ROLES = ROLE_DEFS.map((r) => ({ name: r.name, label: r.label }));
