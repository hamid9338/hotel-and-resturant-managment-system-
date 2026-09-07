import { requireSessionForPage } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { ExpensesList } from "@/components/finance/expenses-list";

export default async function ExpensesPage() {
  await requireSessionForPage();
  const settings = await getSettings();
  return <ExpensesList currency={settings.currency} />;
}
