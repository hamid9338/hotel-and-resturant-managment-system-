import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "accent" | "success" | "danger" | "warning" | "info" | "cyan" | "neutral";

const BAR_CLASSES: Record<Tone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  cyan: "bg-cyan",
  neutral: "bg-muted-2",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border-default bg-surface-1 p-4">
      <div className={cn("absolute inset-x-0 top-0 h-[3px]", BAR_CLASSES[tone])} />
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate font-mono text-[10px] uppercase tracking-wider text-muted">{label}</div>
          <div className="font-display mt-1.5 text-2xl font-semibold text-foreground">{value}</div>
          {hint && <div className="mt-1 truncate text-xs text-muted">{hint}</div>}
        </div>
        {Icon && <Icon size={18} className="mt-0.5 shrink-0 text-muted-2" />}
      </div>
    </div>
  );
}
