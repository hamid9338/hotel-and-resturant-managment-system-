import { requireSessionForPage } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { RoomGrid } from "@/components/hotel/room-grid";

export default async function HotelRoomsPage() {
  await requireSessionForPage();
  const settings = await getSettings();
  return <RoomGrid currency={settings.currency} />;
}
