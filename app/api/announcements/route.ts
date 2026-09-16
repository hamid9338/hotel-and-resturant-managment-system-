import { NextRequest, after } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { sendAnnouncementSchema } from "@/lib/validation/announcements";
import { createAnnouncement, dispatchAnnouncement, listAnnouncements } from "@/lib/services/announcements";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "announcements.send");
    const input = sendAnnouncementSchema.parse(await request.json());
    const announcement = await createAnnouncement(session, input);

    // The actual WhatsApp API calls happen after the response is already on
    // the wire — see the matching comment on runAnomalyChecksIfDue() in
    // app/api/reports/summary/route.ts for why after() is the right tool
    // here: this request shouldn't stay open for however long a few dozen
    // outbound sends take, but the work must still be guaranteed to run.
    after(async () => {
      try {
        await dispatchAnnouncement(announcement.id);
      } catch (err) {
        console.error("announcement dispatch failed:", err);
      }
    });

    return ok(announcement, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET() {
  try {
    const session = await requireSession();
    await requirePermission(session, "announcements.send");
    const announcements = await listAnnouncements();
    return ok(announcements);
  } catch (err) {
    return handleRouteError(err);
  }
}
