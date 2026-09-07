"use client";

import { useEffect, useState } from "react";
import { DollarSign, BedDouble, UtensilsCrossed, TrendingUp, AlertTriangle, Wallet, LogIn, LogOut } from "lucide-react";
import { api } from "@/lib/api-client";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { RoomStatusBreakdown } from "@/components/dashboard/room-status-breakdown";
import { formatCurrency } from "@/lib/format";

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "month", label: "This Month" },
];

type Summary = {
  hotelRevenue: number;
  restaurantRevenue: number;
  totalRevenue: number;
  estimatedProfit: number;
  pendingCheckins: number;
  pendingCheckouts: number;
  outstandingPayments: number;
  highRiskActions: number;
  roomStats: Record<string, number>;
  topMenuItems: { name: string; qty: number }[];
  recentBookings: {
    id: string;
    guest: { name: string };
    room: { number: string };
    status: string;
    total: string;
  }[];
};

type Trend = { date: string; hotel: number; restaurant: number };

export function DashboardContent({ currency }: { currency: string }) {
  const [period, setPeriod] = useState("today");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trend, setTrend] = useState<Trend[]>([]);

  // Deliberately keeps showing the previous period's numbers while a new
  // period loads (rather than a `loading` flag flashing a skeleton on every
  // click) — only the very first load has no data yet to show.
  useEffect(() => {
    let active = true;
    Promise.all([api.get<Summary>(`/api/reports/summary?period=${period}`), api.get<Trend[]>(`/api/reports/daily?days=7`)]).then(
      ([s, t]) => {
        if (!active) return;
        setSummary(s);
        setTrend(t);
      }
    );
    return () => {
      active = false;
    };
  }, [period]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border-default bg-surface-2 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p.key ? "bg-surface-1 text-accent shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!summary ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total Revenue" value={formatCurrency(summary.totalRevenue, currency)} icon={DollarSign} tone="accent" />
            <StatCard label="Hotel Revenue" value={formatCurrency(summary.hotelRevenue, currency)} icon={BedDouble} tone="info" />
            <StatCard
              label="Restaurant Revenue"
              value={formatCurrency(summary.restaurantRevenue, currency)}
              icon={UtensilsCrossed}
              tone="cyan"
            />
            <StatCard
              label="Est. Profit"
              value={formatCurrency(summary.estimatedProfit, currency)}
              icon={TrendingUp}
              tone="success"
              hint="Revenue minus purchases & approved expenses"
            />
            <StatCard label="Pending Check-ins" value={String(summary.pendingCheckins)} icon={LogIn} tone="warning" />
            <StatCard label="Pending Check-outs" value={String(summary.pendingCheckouts)} icon={LogOut} tone="warning" />
            <StatCard
              label="Outstanding Payments"
              value={formatCurrency(summary.outstandingPayments, currency)}
              icon={Wallet}
              tone="danger"
            />
            <StatCard
              label="High-Risk Actions"
              value={String(summary.highRiskActions)}
              icon={AlertTriangle}
              tone="danger"
              hint="Flagged in audit log"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Revenue Trend" subtitle="Last 7 days — hotel vs. restaurant" />
              <CardBody>
                <RevenueChart data={trend} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Room Status" />
              <CardBody>
                <RoomStatusBreakdown counts={summary.roomStats} />
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Top Menu Items" subtitle="By quantity sold, billed orders" />
              <CardBody>
                {summary.topMenuItems.length === 0 ? (
                  <p className="text-sm text-muted">No billed orders in this period yet.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {summary.topMenuItems.map((item, i) => (
                      <li key={item.name} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-2">#{i + 1}</span>
                          {item.name}
                        </span>
                        <span className="font-mono text-xs text-muted">{item.qty} sold</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Recent Bookings" />
              <CardBody className="p-0">
                {summary.recentBookings.length === 0 ? (
                  <p className="p-5 text-sm text-muted">No bookings yet.</p>
                ) : (
                  <div className="divide-y divide-border-default">
                    {summary.recentBookings.slice(0, 6).map((b) => (
                      <div key={b.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                        <div>
                          <div className="font-medium">{b.guest.name}</div>
                          <div className="text-xs text-muted">Room {b.room.number}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-xs">{formatCurrency(Number(b.total), currency)}</div>
                          <div className="text-xs capitalize text-muted">{b.status.toLowerCase().replace("_", " ")}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
