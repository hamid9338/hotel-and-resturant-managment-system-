"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, UserPlus, Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { usePermissions } from "@/components/permissions-provider";
import { GuestFormModal } from "@/components/hotel/guest-form-modal";
import type { Guest } from "@/lib/types/hotel";

export function GuestsList() {
  const { has } = usePermissions();
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(() => {
    api
      .get<Guest[]>(`/api/guests${search ? `?q=${encodeURIComponent(search)}` : ""}`)
      .then(setGuests)
      .catch(() => setGuests([]));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Guests</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, CNIC"
              className="w-56 pl-8"
            />
          </div>
          {has("hotel.create_booking") && (
            <Button variant="primary" onClick={() => setShowAdd(true)}>
              <UserPlus size={15} /> Add Guest
            </Button>
          )}
        </div>
      </div>

      {guests === null ? (
        <SkeletonRows rows={6} />
      ) : guests.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No guests found"
          description="Guests are also created automatically the first time they book a room."
        />
      ) : (
        <Card>
          <div className="divide-y divide-border-default">
            {guests.map((g) => (
              <Link
                key={g.id}
                href={`/hotel/guests/${g.id}`}
                className="flex items-center justify-between px-5 py-3 text-sm hover:bg-surface-2/50"
              >
                <div>
                  <div className="font-medium">{g.name}</div>
                  <div className="text-xs text-muted">
                    {g.phone}
                    {g.cnic ? ` · ${g.cnic}` : ""}
                  </div>
                </div>
                <div className="text-xs text-muted">{g.address}</div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {showAdd && (
        <GuestFormModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}
