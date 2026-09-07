import { requireSessionForPage } from "@/lib/auth/session";
import { SuppliersList } from "@/components/inventory/suppliers-list";

export default async function SuppliersPage() {
  await requireSessionForPage();
  return <SuppliersList />;
}
