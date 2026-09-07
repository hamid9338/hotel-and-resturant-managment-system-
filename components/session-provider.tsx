"use client";

import { createContext, useContext, type ReactNode } from "react";

const SessionContext = createContext<{ id: string } | null>(null);

export function SessionProvider({ userId, children }: { userId: string; children: ReactNode }) {
  return <SessionContext.Provider value={{ id: userId }}>{children}</SessionContext.Provider>;
}

export function useSessionUser() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessionUser must be used within SessionProvider");
  return ctx;
}
