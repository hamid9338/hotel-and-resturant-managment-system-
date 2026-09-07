"use client";

import { useEffect, useRef } from "react";
import { flushOutbox } from "@/lib/offline/sync-client";
import { useToast } from "@/components/ui/toast";

/** Mounted once in the dashboard shell — flushes the IndexedDB outbox on
 * load, whenever the browser comes back online, and on a minute timer. */
export function SyncManager({ userId }: { userId: string }) {
  const toast = useToast();
  const flushingRef = useRef(false);

  useEffect(() => {
    const flush = async () => {
      if (flushingRef.current) return;
      flushingRef.current = true;
      try {
        const result = await flushOutbox(userId);
        if (result.applied > 0) {
          toast.success(`Synced ${result.applied} queued action${result.applied > 1 ? "s" : ""}`);
        }
        if (result.conflicts > 0) {
          toast.error(`${result.conflicts} queued action(s) had conflicts — check Sync Status`);
        }
      } finally {
        flushingRef.current = false;
      }
    };

    flush();
    window.addEventListener("online", flush);
    const interval = setInterval(flush, 60_000);
    return () => {
      window.removeEventListener("online", flush);
      clearInterval(interval);
    };
  }, [userId, toast]);

  return null;
}
