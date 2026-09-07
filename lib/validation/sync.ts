import { z } from "zod";

// Whitelisted operation kinds only — every delete-shaped action in this app
// (cancel a booking, void an order) is already a status change, so the
// offline outbox never needs a harder tombstone story.
export const syncOperationKindEnum = z.enum([
  "bookings.create",
  "bookings.checkin",
  "bookings.checkout",
  "orders.create",
  "orders.updateStatus",
  "rooms.updateStatus",
]);

export const syncOperationSchema = z.object({
  id: z.string().min(1),
  deviceId: z.string().min(1),
  operationKind: syncOperationKindEnum,
  /** For *.create kinds: the id the client already assigned this record locally. */
  entityId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
  clientTimestamp: z.string(),
});

export const syncPushSchema = z.object({
  operations: z.array(syncOperationSchema).min(1).max(50),
});

export type SyncOperationInput = z.infer<typeof syncOperationSchema>;
