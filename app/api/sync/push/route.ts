import { requireSession } from "@/lib/auth/session";
import { syncPushSchema } from "@/lib/validation/sync";
import { applySyncOperation } from "@/lib/services/sync";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const { operations } = syncPushSchema.parse(await request.json());

    // Sequential, not Promise.all: operations from one device may depend on
    // each other's ordering (e.g. create an order, then update its status),
    // and batches are small (one device's outbox), so there's no throughput
    // reason to parallelize at the cost of that ordering guarantee.
    const results = [];
    for (const op of operations) {
      results.push(await applySyncOperation(session, op));
    }

    return ok({ results });
  } catch (err) {
    return handleRouteError(err);
  }
}
