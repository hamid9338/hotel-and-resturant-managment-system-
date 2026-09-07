import { notFound } from "next/navigation";
import { Phone, MapPin, IdCard } from "lucide-react";
import { requireSessionForPage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/services/settings";
import { toNumber, round2 } from "@/lib/money";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function GuestProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionForPage();
  if (!(await hasPermission(session, "hotel.view"))) notFound();

  const { id } = await params;
  const [guest, settings] = await Promise.all([
    prisma.guest.findUnique({
      where: { id },
      include: {
        bookings: {
          include: { room: { include: { roomType: true } } },
          orderBy: { checkIn: "desc" },
        },
      },
    }),
    getSettings(),
  ]);
  if (!guest) notFound();

  const totalSpending = round2(guest.bookings.reduce((sum, b) => sum + toNumber(b.advancePaid), 0));
  const outstandingBalance = round2(guest.bookings.reduce((sum, b) => sum + toNumber(b.balanceDue), 0));

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">{guest.name}</h1>
        <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <Phone size={13} /> {guest.phone}
          </span>
          {guest.cnic && (
            <span className="flex items-center gap-1.5">
              <IdCard size={13} /> {guest.cnic}
            </span>
          )}
          {guest.address && (
            <span className="flex items-center gap-1.5">
              <MapPin size={13} /> {guest.address}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardBody>
            <div className="text-xs text-muted">Total Visits</div>
            <div className="font-display mt-1 text-xl font-semibold">{guest.bookings.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-muted">Total Spending</div>
            <div className="font-display mt-1 text-xl font-semibold">
              {formatCurrency(totalSpending, settings.currency)}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-muted">Outstanding Balance</div>
            <div className={`font-display mt-1 text-xl font-semibold ${outstandingBalance > 0 ? "text-danger" : ""}`}>
              {formatCurrency(outstandingBalance, settings.currency)}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Stay History" />
        {guest.bookings.length === 0 ? (
          <CardBody>
            <p className="text-sm text-muted">No stays recorded yet.</p>
          </CardBody>
        ) : (
          <div className="divide-y divide-border-default">
            {guest.bookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">
                    Room {b.room.number} · {b.room.roomType.name}
                  </div>
                  <div className="text-xs text-muted">
                    {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono">{formatCurrency(toNumber(b.total), settings.currency)}</div>
                  <Badge tone={b.status === "CHECKED_OUT" ? "success" : b.status === "CANCELLED" ? "neutral" : "accent"}>
                    {b.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {guest.notes && (
        <Card>
          <CardHeader title="Notes" />
          <CardBody>
            <p className="whitespace-pre-wrap text-sm text-muted">{guest.notes}</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
