const STATUS_META: Record<string, { label: string; className: string }> = {
  AVAILABLE: { label: "Available", className: "bg-success" },
  OCCUPIED: { label: "Occupied", className: "bg-accent" },
  CLEANING: { label: "Cleaning", className: "bg-info" },
  MAINTENANCE: { label: "Maintenance", className: "bg-warning" },
  OUT_OF_SERVICE: { label: "Out of Service", className: "bg-danger" },
};

export function RoomStatusBreakdown({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="space-y-3">
      {Object.entries(STATUS_META).map(([key, meta]) => {
        const count = counts[key] ?? 0;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted">{meta.label}</span>
              <span className="font-mono text-foreground">{count}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div className={`h-full ${meta.className}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
