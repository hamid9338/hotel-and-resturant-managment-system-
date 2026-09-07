import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import type { RoomWithBookings } from "@/lib/types/hotel";

const STATUS_TONE: Record<string, "success" | "accent" | "info" | "warning" | "danger"> = {
  AVAILABLE: "success",
  OCCUPIED: "accent",
  CLEANING: "info",
  MAINTENANCE: "warning",
  OUT_OF_SERVICE: "danger",
};

export function RoomCard({
  room,
  currency,
  onClick,
}: {
  room: RoomWithBookings;
  currency: string;
  onClick: () => void;
}) {
  const guestName = room.activeBooking?.guest.name;
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-xl border border-border-default bg-surface-1 p-4 text-left transition-all hover:border-accent-border hover:shadow-sm"
    >
      <div className="flex w-full items-center justify-between">
        <span className="font-display text-xl font-semibold">{room.number}</span>
        <Badge tone={STATUS_TONE[room.status] ?? "neutral"}>{room.status.replace(/_/g, " ")}</Badge>
      </div>
      <div className="text-xs text-muted">
        {room.roomType.name} · Floor {room.floor}
      </div>
      {guestName ? (
        <div className="mt-1 w-full truncate rounded-md bg-surface-2 px-2 py-1 text-xs">{guestName}</div>
      ) : (
        <div className="mt-1 font-mono text-xs text-muted-2">
          {formatCurrency(Number(room.roomType.basePrice), currency)}/night
        </div>
      )}
      {room.upcomingBookings.length > 0 && (
        <div className="font-mono text-[10px] text-accent">
          {room.upcomingBookings.length} upcoming reservation{room.upcomingBookings.length > 1 ? "s" : ""}
        </div>
      )}
    </button>
  );
}
