import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "kvl-outbox";
const STORE = "operations";

export type OperationKind =
  | "bookings.create"
  | "bookings.checkin"
  | "bookings.checkout"
  | "orders.create"
  | "orders.updateStatus"
  | "rooms.updateStatus";

export type QueuedOperation = {
  id: string;
  deviceId: string;
  operationKind: OperationKind;
  entityId?: string;
  payload: Record<string, unknown>;
  clientTimestamp: string;
  userId: string;
  status: "pending" | "synced";
};

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export function getDeviceId(): string {
  const key = "kvl-device-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export async function queueOperation(op: {
  id: string;
  operationKind: OperationKind;
  entityId?: string;
  payload: Record<string, unknown>;
  userId: string;
}) {
  const db = await getDb();
  const record: QueuedOperation = {
    ...op,
    deviceId: getDeviceId(),
    clientTimestamp: new Date().toISOString(),
    status: "pending",
  };
  await db.put(STORE, record);
  return record;
}

export async function getPendingOperations(userId: string): Promise<QueuedOperation[]> {
  const db = await getDb();
  const all = (await db.getAll(STORE)) as QueuedOperation[];
  return all.filter((op) => op.status === "pending" && op.userId === userId);
}

export async function markSynced(ids: string[]) {
  if (ids.length === 0) return;
  const db = await getDb();
  const tx = db.transaction(STORE, "readwrite");
  for (const id of ids) {
    const existing = await tx.store.get(id);
    if (existing) await tx.store.put({ ...existing, status: "synced" });
  }
  await tx.done;
}

/** Called on logout so a shared front-desk terminal never mixes staff members' queued writes. */
export async function clearOutboxForUser(userId: string) {
  const db = await getDb();
  const all = (await db.getAll(STORE)) as QueuedOperation[];
  const tx = db.transaction(STORE, "readwrite");
  for (const op of all) {
    if (op.userId === userId) await tx.store.delete(op.id);
  }
  await tx.done;
}
