import "server-only";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";

export type SearchResult = { type: string; id: string; label: string; sublabel: string | null; href: string };

/**
 * Fans out across many permission domains in one request, so each entity
 * type's own existing view permission is checked here and the query skipped
 * entirely when absent — rather than one blanket "search" permission, and
 * rather than running every query and filtering results after the fact.
 */
export async function globalSearch(session: SessionUser, query: string): Promise<{ results: SearchResult[] }> {
  const q = query.trim();
  if (q.length < 2) return { results: [] };

  const [canHotel, canRestaurant, canInventory, canStaff, canMaintenance, canOcr] = await Promise.all([
    hasPermission(session, "hotel.view"),
    hasPermission(session, "restaurant.view"),
    hasPermission(session, "inventory.view"),
    hasPermission(session, "staff.view_all"),
    hasPermission(session, "hotel.manage_maintenance"),
    hasPermission(session, "ocr.view"),
  ]);

  const tasks: Promise<SearchResult[]>[] = [];

  if (canHotel) {
    tasks.push(
      prisma.guest
        .findMany({
          where: {
            OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { cnic: { contains: q } }],
          },
          take: 5,
        })
        .then((rows) =>
          rows.map((g) => ({ type: "Guest", id: g.id, label: g.name, sublabel: g.phone, href: `/hotel/guests/${g.id}` }))
        )
    );
    tasks.push(
      prisma.room
        .findMany({ where: { number: { contains: q, mode: "insensitive" } }, take: 5 })
        .then((rows) => rows.map((r) => ({ type: "Room", id: r.id, label: `Room ${r.number}`, sublabel: null, href: "/hotel" })))
    );
    tasks.push(
      prisma.booking
        .findMany({
          where: {
            OR: [
              { invoiceNo: { contains: q, mode: "insensitive" } },
              { guest: { name: { contains: q, mode: "insensitive" } } },
            ],
          },
          include: { guest: { select: { name: true } } },
          take: 5,
        })
        .then((rows) =>
          rows.map((b) => ({
            type: "Booking",
            id: b.id,
            label: b.invoiceNo ?? `Booking — ${b.guest.name}`,
            sublabel: b.guest.name,
            href: "/hotel/bookings",
          }))
        )
    );
  }

  if (canRestaurant) {
    tasks.push(
      prisma.menuItem
        .findMany({ where: { name: { contains: q, mode: "insensitive" } }, take: 5 })
        .then((rows) => rows.map((m) => ({ type: "Menu Item", id: m.id, label: m.name, sublabel: null, href: "/restaurant" })))
    );
  }

  if (canInventory) {
    tasks.push(
      prisma.inventoryItem
        .findMany({
          where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] },
          take: 5,
        })
        .then((rows) => rows.map((i) => ({ type: "Inventory", id: i.id, label: i.name, sublabel: i.sku, href: "/inventory" })))
    );
    tasks.push(
      prisma.supplier
        .findMany({ where: { name: { contains: q, mode: "insensitive" } }, take: 5 })
        .then((rows) =>
          rows.map((s) => ({ type: "Supplier", id: s.id, label: s.name, sublabel: s.company, href: "/inventory/suppliers" }))
        )
    );
  }

  if (canStaff) {
    tasks.push(
      prisma.user
        .findMany({ where: { name: { contains: q, mode: "insensitive" } }, take: 5 })
        .then((rows) => rows.map((u) => ({ type: "Staff", id: u.id, label: u.name, sublabel: null, href: "/staff" })))
    );
  }

  if (canMaintenance) {
    tasks.push(
      prisma.maintenanceTicket
        .findMany({ where: { title: { contains: q, mode: "insensitive" } }, take: 5 })
        .then((rows) => rows.map((t) => ({ type: "Maintenance", id: t.id, label: t.title, sublabel: null, href: "/maintenance" })))
    );
  }

  if (canOcr) {
    tasks.push(
      prisma.oCRBill
        .findMany({
          where: { OR: [{ vendor: { contains: q, mode: "insensitive" } }, { billNo: { contains: q, mode: "insensitive" } }] },
          take: 5,
        })
        .then((rows) =>
          rows.map((b) => ({ type: "Scanned Bill", id: b.id, label: b.vendor ?? "Unknown vendor", sublabel: b.billNo, href: "/ocr" }))
        )
    );
  }

  const grouped = await Promise.all(tasks);
  return { results: grouped.flat() };
}
