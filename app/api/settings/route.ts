import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { getSettings, updateSettings } from "@/lib/services/settings";
import { updateSettingsSchema } from "@/lib/validation/settings";
import { recordAudit } from "@/lib/services/audit";
import { isOcrConfigured } from "@/lib/services/ocr";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET() {
  try {
    const session = await requireSession();
    await requirePermission(session, "settings.view");
    const settings = await getSettings();
    return ok({ ...settings, ocrConfigured: isOcrConfigured() });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    await requirePermission(session, "settings.edit");
    const input = updateSettingsSchema.parse(await request.json());
    const settings = await updateSettings(input);
    await recordAudit({ session, action: "Settings updated", module: "Settings", newValue: input });
    return ok(settings);
  } catch (err) {
    return handleRouteError(err);
  }
}
