import { requireSessionForPage } from "@/lib/auth/session";
import { HousekeepingBoard } from "@/components/hotel/housekeeping-board";

export default async function HousekeepingPage() {
  await requireSessionForPage();
  return <HousekeepingBoard />;
}
