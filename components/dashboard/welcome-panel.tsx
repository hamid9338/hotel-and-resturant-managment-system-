import Link from "next/link";
import { getRolePermissionKeys } from "@/lib/auth/permissions";
import { NAV_ITEMS } from "@/lib/nav";
import type { SessionUser } from "@/lib/auth/session";

// Shown instead of the KPI dashboard to roles without reports.view (waiter,
// housekeeper, kitchen staff, ...) — revenue/financial figures aren't
// something every role should see, but everyone still needs a working
// landing page, not a locked-out one.
export async function WelcomePanel({ session }: { session: SessionUser }) {
  const permissionKeys = [...(await getRolePermissionKeys(session.roleId))];
  const quickLinks = NAV_ITEMS.filter(
    (item) => item.href !== "/" && (!item.permission || item.permission.some((p) => permissionKeys.includes(p)))
  );

  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="mb-6 text-center sm:text-left">
        <h1 className="font-display text-2xl font-semibold">Welcome back, {session.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted capitalize">{session.roleName.replace(/_/g, " ")}{session.shift ? ` · ${session.shift} shift` : ""}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-2 rounded-xl border border-border-default bg-surface-1 p-5 text-center transition-colors hover:border-accent-border hover:bg-accent-soft"
            >
              <Icon size={22} className="text-accent" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
