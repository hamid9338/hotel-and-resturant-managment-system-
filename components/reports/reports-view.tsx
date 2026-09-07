"use client";

import { useEffect, useState } from "react";
import { Percent, TrendingUp } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SkeletonRows } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";

type Summary = {
  totalRevenue: number;
  hotelRevenue: number;
  restaurantRevenue: number;
  roomStats: Record<string, number>;
  topMenuItems: { name: string; qty: number }[];
};
type Trend = { date: string; hotel: number; restaurant: number };

export function ReportsView({ currency }: { currency: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trend, setTrend] = useState<Trend[]>([]);

  useEffect(() => {
    api
      .get<Summary>("/api/reports/summary?period=30d")
      .then(setSummary)
      .catch(() => {});
    api
      .get<Trend[]>("/api/reports/daily?days=30")
      .then(setTrend)
      .catch(() => {});
  }, []);

  if (!summary) return <SkeletonRows rows={6} />;

  const totalRooms = Object.values(summary.roomStats).reduce((a, b) => a + b, 0) || 1;
  const occupancyRate = Math.round(((summary.roomStats.OCCUPIED ?? 0) / totalRooms) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted">Last 30 days.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Occupancy Rate" value={`${occupancyRate}%`} icon={Percent} tone="info" />
        <StatCard label="30-Day Revenue" value={formatCurrency(summary.totalRevenue, currency)} icon={TrendingUp} tone="accent" />
        <StatCard label="Hotel Revenue" value={formatCurrency(summary.hotelRevenue, currency)} />
        <StatCard label="Restaurant Revenue" value={formatCurrency(summary.restaurantRevenue, currency)} tone="cyan" />
      </div>

      <Card>
        <CardHeader title="Revenue Trend" subtitle="Last 30 days" />
        <CardBody>
          <RevenueChart data={trend} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Top Menu Items" subtitle="By quantity sold, billed orders" />
        <CardBody>
          {summary.topMenuItems.length === 0 ? (
            <p className="text-sm text-muted">No data yet.</p>
          ) : (
            <ul className="space-y-2">
              {summary.topMenuItems.map((item, i) => (
                <li key={item.name} className="flex items-center justify-between text-sm">
                  <span>
                    <span className="mr-2 font-mono text-xs text-muted-2">#{i + 1}</span>
                    {item.name}
                  </span>
                  <span className="font-mono text-xs text-muted">{item.qty} sold</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
