"use client";

import { createContext, useContext, type ReactNode } from "react";

const PermissionsContext = createContext<string[]>([]);

export function PermissionsProvider({ permissions, children }: { permissions: string[]; children: ReactNode }) {
  return <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const permissions = useContext(PermissionsContext);
  return {
    permissions,
    has: (key: string) => permissions.includes(key),
    hasAny: (keys: string[]) => keys.some((k) => permissions.includes(k)),
  };
}
