import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { searchQuerySchema } from "@/lib/validation/search";
import { globalSearch } from "@/lib/services/search";
import { ok, handleRouteError } from "@/lib/api/respond";

// Deliberate exception to the usual one-permission-per-route gate: this
// request fans out across many permission domains internally
// (globalSearch checks each entity type's own view permission before
// running that type's query), so there's no single key to require here.
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { q } = searchQuerySchema.parse({ q: request.nextUrl.searchParams.get("q") ?? "" });
    const data = await globalSearch(session, q);
    return ok(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
