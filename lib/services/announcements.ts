import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/api/respond";
import { recordAudit } from "@/lib/services/audit";
import { normalizePakistaniPhone, sendWhatsAppMessage } from "@/lib/services/whatsapp";
import type { SessionUser } from "@/lib/auth/session";
import type { sendAnnouncementSchema } from "@/lib/validation/announcements";

type SendAnnouncementInput = z.infer<typeof sendAnnouncementSchema>;

/**
 * Creates the Announcement + one PENDING AnnouncementRecipient row per
 * matched guest, synchronously — fast, so the request returns immediately
 * with the full (still-pending) recipient list. The actual per-guest
 * WhatsApp sends are dispatched separately via dispatchAnnouncement(), which
 * the route calls inside after() so this function never has to wait on
 * however long a few dozen outbound API calls take.
 */
export async function createAnnouncement(session: SessionUser, input: SendAnnouncementInput) {
  const guests = await prisma.guest.findMany({
    where:
      input.audience === "active"
        ? { bookings: { some: { status: { in: ["RESERVED", "CHECKED_IN"] } } } }
        : undefined,
  });
  if (guests.length === 0) {
    throw new AppError("NO_RECIPIENTS", "No guests match this audience.", 422);
  }

  const announcement = await prisma.announcement.create({
    data: {
      templateName: input.templateName,
      variables: input.variables,
      createdById: session.id,
      recipients: {
        create: guests.map((g) => ({ guestId: g.id, phone: g.phone, status: "PENDING" as const })),
      },
    },
    include: { recipients: { include: { guest: { select: { id: true, name: true } } } } },
  });

  await recordAudit({
    session,
    action: `Announcement queued: "${input.templateName}" to ${guests.length} guest(s)`,
    module: "Hotel",
    entityType: "Announcement",
    entityId: announcement.id,
  });

  return announcement;
}

/**
 * Actually sends the WhatsApp message to every PENDING recipient of one
 * announcement, updating each row to SENT/FAILED as results land. Meant to
 * be called from inside after() — see app/api/announcements/route.ts —
 * since a route handler's own try/catch can't observe anything thrown here.
 */
export async function dispatchAnnouncement(announcementId: string) {
  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    include: { recipients: { where: { status: "PENDING" } } },
  });
  if (!announcement) return;

  const variables = announcement.variables as string[];

  for (const recipient of announcement.recipients) {
    const normalized = normalizePakistaniPhone(recipient.phone);
    if (!normalized) {
      await prisma.announcementRecipient.update({
        where: { id: recipient.id },
        data: { status: "FAILED", error: "Phone number is not a recognizable Pakistani mobile number." },
      });
      continue;
    }

    const result = await sendWhatsAppMessage(normalized, announcement.templateName, variables);
    await prisma.announcementRecipient.update({
      where: { id: recipient.id },
      data: result.ok ? { status: "SENT", sentAt: new Date() } : { status: "FAILED", error: result.error },
    });
  }
}

export async function getAnnouncement(id: string) {
  return prisma.announcement.findUnique({
    where: { id },
    include: { recipients: { include: { guest: { select: { id: true, name: true } } } } },
  });
}

export async function listAnnouncements() {
  return prisma.announcement.findMany({
    include: { recipients: true, createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
