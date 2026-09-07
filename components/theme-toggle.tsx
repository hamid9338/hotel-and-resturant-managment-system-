"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

const OPTIONS = [
  { key: "light" as const, icon: Sun, label: "Light" },
  { key: "dark" as const, icon: Moon, label: "Dark" },
  { key: "system" as const, icon: Monitor, label: "System" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border-default bg-surface-2 p-0.5">
      {OPTIONS.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          onClick={() => setTheme(key)}
          title={label}
          aria-label={label}
          className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
            theme === key ? "bg-surface-1 text-accent shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          <Icon size={13} />
        </button>
      ))}
    </div>
  );
}
