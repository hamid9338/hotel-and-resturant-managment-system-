import { requireSessionForPage } from "@/lib/auth/session";
import { RolesPermissionMatrix } from "@/components/staff/roles-permission-matrix";

export default async function RolesPage() {
  await requireSessionForPage();
  return <RolesPermissionMatrix />;
}
