"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { api } from "@/lib/api-client";

type SearchResult = { type: string; id: string; label: string; sublabel: string | null; href: string };

function groupByType(results: SearchResult[]) {
  const groups = new Map<string, SearchResult[]>();
  for (const r of results) {
    if (!groups.has(r.type)) groups.set(r.type, []);
    groups.get(r.type)!.push(r);
  }
  return [...groups.entries()];
}

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  const search = useCallback((q: string) => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    api
      .get<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`)
      .then((res) => setResults(res.results))
      .catch(() => setResults([]));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 300);
    return () => clearTimeout(timeout);
  }, [query, search]);

  const goTo = (href: string) => {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(href);
  };

  const grouped = results ? groupByType(results) : [];

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <div className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-2 px-3 py-1.5 text-sm text-muted focus-within:border-accent-border">
        <Search size={14} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search…"
          className="w-40 bg-transparent text-foreground outline-none placeholder:text-muted-2"
        />
        <kbd className="rounded border border-border-default px-1 font-mono text-[10px] text-muted-2">Ctrl K</kbd>
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute right-0 top-10 z-50 max-h-96 w-80 overflow-y-auto rounded-xl border border-border-default bg-surface-1 shadow-lg">
          {results === null ? (
            <div className="px-4 py-6 text-center text-sm text-muted">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted">No results for &ldquo;{query}&rdquo;.</div>
          ) : (
            grouped.map(([type, rows]) => (
              <div key={type}>
                <div className="border-b border-t border-border-default bg-surface-2/40 px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-2 first:border-t-0">
                  {type}
                </div>
                {rows.map((r) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => goTo(r.href)}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    <div className="font-medium">{r.label}</div>
                    {r.sublabel && <div className="text-xs text-muted">{r.sublabel}</div>}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
