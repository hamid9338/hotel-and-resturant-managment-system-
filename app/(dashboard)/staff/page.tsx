import { requireSessionForPage } from "@/lib/auth/session";
import { StaffList } from "@/components/staff/staff-list";

export default async function StaffPage() {
  await requireSessionForPage();
  return <StaffList />;
}
