import { requireSessionForPage } from "@/lib/auth/session";
import { GuestsList } from "@/components/hotel/guests-list";

export default async function GuestsPage() {
  await requireSessionForPage();
  return <GuestsList />;
}
