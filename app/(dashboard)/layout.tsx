import type { ReactNode } from "react";
import { requireSessionForPage } from "@/lib/auth/session";
import { getRolePermissionKeys } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/services/settings";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireSessionForPage();
  const permissionKeys = await getRolePermissionKeys(session.roleId);
  const settings = await getSettings();

  return (
    <DashboardShell
      user={{ id: session.id, name: session.name, role: session.roleName, shift: session.shift }}
      permissions={[...permissionKeys]}
      businessName={settings.businessName}
    >
      {children}
    </DashboardShell>
  );
}
