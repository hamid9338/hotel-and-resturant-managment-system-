import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { generateNarrativeSchema } from "@/lib/validation/ai-insights";
import { generateReportNarrative } from "@/lib/services/ai-insights";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "reports.view");
    const input = generateNarrativeSchema.parse(await request.json());
    const data = await generateReportNarrative(session, input.period);
    return ok(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
