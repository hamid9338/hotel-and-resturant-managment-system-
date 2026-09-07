import { requireSessionForPage } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { isOcrConfigured } from "@/lib/services/ocr";
import { BillScanner } from "@/components/ocr/bill-scanner";

export default async function OcrPage() {
  await requireSessionForPage();
  const settings = await getSettings();
  return <BillScanner ocrConfigured={isOcrConfigured()} currency={settings.currency} />;
}
