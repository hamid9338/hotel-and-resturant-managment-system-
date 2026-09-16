import { requireSessionForPage } from "@/lib/auth/session";
import { isWhatsAppConfigured } from "@/lib/services/whatsapp";
import { Announcements } from "@/components/hotel/announcements";

export default async function AnnouncementsPage() {
  await requireSessionForPage();
  return <Announcements whatsappConfigured={isWhatsAppConfigured()} />;
}
