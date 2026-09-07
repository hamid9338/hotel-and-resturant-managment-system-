"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut, Wifi, WifiOff } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { useOnlineStatus } from "@/lib/use-online-status";
import { ThemeToggle } from "@/components/theme-toggle";
import { PermissionsProvider } from "@/components/permissions-provider";
import { SessionProvider } from "@/components/session-provider";
import { SyncManager } from "@/components/offline/sync-manager";
import { clearOutboxForUser } from "@/lib/offline/outbox";
import { api } from "@/lib/api-client";

type ShellUser = { id: string; name: string; role: string; shift: string | null };

export function DashboardShell({
  user,
  permissions,
  businessName,
  children,
}: {
  user: ShellUser;
  permissions: string[];
  businessName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const online = useOnlineStatus();

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || item.permission.some((p) => permissions.includes(p)));
  const sections = [...new Set(visibleItems.map((i) => i.section))];

  const logout = async () => {
    await api.post("/api/auth/logout").catch(() => {});
    // A front desk terminal may be shared across shifts — never leave one
    // staff member's queued-but-unsynced writes visible to the next.
    await clearOutboxForUser(user.id).catch(() => {});
    router.push("/login");
    router.refresh();
  };

  const initials =
    user.name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  const navContent = (
    <>
      <div className="border-b border-border-default px-5 py-4">
        <div className="font-display text-lg font-semibold text-accent">Kashmir View Lodges</div>
        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">Hotel & Management System</div>
      </div>
      <div className="flex items-center gap-2.5 border-b border-border-default px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent-border bg-accent-soft font-display text-xs font-semibold text-accent">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{user.name}</div>
          <div className="truncate font-mono text-[10px] capitalize text-muted">{user.role.replace(/_/g, " ")}</div>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {sections.map((section) => (
          <div key={section || "top"}>
            {section && (
              <div className="mb-1 px-2 font-mono text-[10px] uppercase tracking-wider text-muted-2">{section}</div>
            )}
            <div className="space-y-0.5">
              {visibleItems
                .filter((i) => i.section === section)
                .map((item) => {
                  const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm transition-colors ${
                        active
                          ? "border-accent-border bg-accent-soft text-accent"
                          : "border-transparent text-muted hover:bg-surface-2 hover:text-foreground"
                      }`}
                    >
                      <Icon size={16} />
                      {item.label}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-border-default px-4 py-3">
        <div className="mb-2.5 flex items-center gap-2 font-mono text-[11px] text-muted">
          {online ? <Wifi size={13} className="text-success" /> : <WifiOff size={13} className="text-danger" />}
          {online ? "Online" : "Offline"}
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted hover:bg-surface-3 hover:text-foreground"
        >
          <LogOut size={14} /> Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border-default bg-surface-1 md:flex">{navContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 flex w-72 flex-col bg-surface-1">{navContent}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border-default bg-surface-1 px-4 py-3 md:px-6">
          <button className="text-muted md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="hidden font-mono text-xs text-muted md:block">{businessName}</div>
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <SessionProvider userId={user.id}>
            <PermissionsProvider permissions={permissions}>{children}</PermissionsProvider>
            <SyncManager userId={user.id} />
          </SessionProvider>
        </main>
      </div>
    </div>
  );
}
