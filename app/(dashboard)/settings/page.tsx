import { requireSessionForPage } from "@/lib/auth/session";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  await requireSessionForPage();
  return <SettingsForm />;
}
