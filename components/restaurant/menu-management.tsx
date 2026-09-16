"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen, Search } from "lucide-react";
import { api } from "@/lib/api-client";
import { fetchWithCache } from "@/lib/offline/data-cache";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { formatCurrency, formatRelativeTime } from "@/lib/format";
import { MenuItemModal } from "@/components/restaurant/menu-item-modal";
import { RecipeEditorModal } from "@/components/restaurant/recipe-editor-modal";

export type MenuCategory = { id: string; name: string; sortOrder: number };
export type MenuItemRow = {
  id: string;
  name: string;
  price: string;
  cost: string | null;
  available: boolean;
  description: string | null;
  prepTimeMins: number | null;
  categoryId: string;
  category: MenuCategory;
};

export function MenuManagement({ currency }: { currency: string }) {
  const [items, setItems] = useState<MenuItemRow[] | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [search, setSearch] = useState("");
  const [cacheInfo, setCacheInfo] = useState<{ cachedAt: string; stale: boolean } | null>(null);
  const [itemModal, setItemModal] = useState<{ item: MenuItemRow | null } | null>(null);
  const [recipeModal, setRecipeModal] = useState<{ item: MenuItemRow } | null>(null);

  const load = useCallback(() => {
    fetchWithCache("/api/menu", () => api.get<MenuItemRow[]>("/api/menu"))
      .then(({ data, cachedAt, stale }) => {
        setItems(data);
        if (stale) setCacheInfo({ cachedAt, stale });
      })
      .catch(() => setItems([]));
    fetchWithCache("/api/menu/categories", () => api.get<MenuCategory[]>("/api/menu/categories"))
      .then(({ data }) => setCategories(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (items === null) return <SkeletonRows rows={6} />;

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      {cacheInfo?.stale && (
        <Badge tone="warning">Showing data from {formatRelativeTime(cacheInfo.cachedAt)} — offline</Badge>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Menu</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-2" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dishes" className="w-48 pl-8" />
          </div>
          <Button variant="primary" onClick={() => setItemModal({ item: null })}>
            + Item
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="No menu items" description="Add your first dish to get started." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left font-mono text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Dish</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} className="border-b border-border-default last:border-0 hover:bg-surface-2/50">
                    <td className="cursor-pointer px-4 py-3 font-medium" onClick={() => setItemModal({ item: i })}>
                      {i.name}
                    </td>
                    <td className="px-4 py-3 text-muted">{i.category.name}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(Number(i.price), currency)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={i.available ? "success" : "neutral"}>{i.available ? "Available" : "Unavailable"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setRecipeModal({ item: i })}>
                        Recipe
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {itemModal && (
        <MenuItemModal
          item={itemModal.item}
          categories={categories}
          onClose={() => setItemModal(null)}
          onDone={() => {
            setItemModal(null);
            load();
          }}
        />
      )}
      {recipeModal && (
        <RecipeEditorModal
          menuItem={recipeModal.item}
          onClose={() => setRecipeModal(null)}
          onDone={() => setRecipeModal(null)}
        />
      )}
    </div>
  );
}
