import { requireSessionForPage } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { CashRegister } from "@/components/finance/cash-register";

export default async function CashRegisterPage() {
  await requireSessionForPage();
  const settings = await getSettings();
  return <CashRegister currency={settings.currency} />;
}
