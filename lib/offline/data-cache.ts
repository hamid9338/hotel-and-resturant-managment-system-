import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "kvl-data-cache";
const STORE = "responses";

type CacheEntry<T> = { key: string; data: T; cachedAt: string };

export type FetchWithCacheResult<T> = { data: T; cachedAt: string; stale: boolean };

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Tries fetcher() first; on success, caches the result under `key` (the API
 * path, so components sharing an endpoint share a cache entry) and returns it
 * fresh. On a network failure (TypeError — the same convention
 * lib/offline/sync-client.ts::submitOrQueue uses to tell "offline" apart from
 * "the server rejected this"), falls back to the last cached value for that
 * key when one exists, marked stale; a real rejection, or no cached entry,
 * rethrows exactly as it did before this cache existed.
 */
export async function fetchWithCache<T>(key: string, fetcher: () => Promise<T>): Promise<FetchWithCacheResult<T>> {
  try {
    const data = await fetcher();
    const cachedAt = new Date().toISOString();
    const db = await getDb();
    await db.put(STORE, { key, data, cachedAt } satisfies CacheEntry<T>);
    return { data, cachedAt, stale: false };
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
    const db = await getDb();
    const entry = (await db.get(STORE, key)) as CacheEntry<T> | undefined;
    if (!entry) throw err;
    return { data: entry.data, cachedAt: entry.cachedAt, stale: true };
  }
}
