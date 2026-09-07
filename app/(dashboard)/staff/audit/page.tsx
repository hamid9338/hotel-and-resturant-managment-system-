import { requireSessionForPage } from "@/lib/auth/session";
import { AuditLogView } from "@/components/staff/audit-log-view";

export default async function AuditPage() {
  await requireSessionForPage();
  return <AuditLogView />;
}
