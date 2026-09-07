"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type ThemeContextValue = { theme: Theme; setTheme: (t: Theme) => void; resolvedTheme: "light" | "dark" };

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "kvl-theme";
// localStorage writes don't fire a `storage` event in the tab that made them
// (only in other tabs), so setTheme() dispatches this to notify our own
// useSyncExternalStore subscribers in the same tab.
const LOCAL_CHANGE_EVENT = "kvl-theme-local-change";

function getStoredTheme(): Theme {
  return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
}

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function subscribe(callback: () => void) {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener("change", callback);
  window.addEventListener(LOCAL_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    mql.removeEventListener("change", callback);
    window.removeEventListener(LOCAL_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getServerSnapshot(): Theme {
  return "system";
}

/** Pairs with the inline anti-flash script in app/layout.tsx, which sets the
 * initial data-theme attribute synchronously before hydration. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getStoredTheme, getServerSnapshot);
  const resolvedTheme = typeof window === "undefined" ? "light" : resolveTheme(theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = (next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
  };

  return <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
