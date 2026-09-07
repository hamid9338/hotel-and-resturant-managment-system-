import { requireSessionForPage } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { BookingsTable } from "@/components/hotel/bookings-table";

export default async function BookingsPage() {
  await requireSessionForPage();
  const settings = await getSettings();
  return <BookingsTable currency={settings.currency} />;
}
