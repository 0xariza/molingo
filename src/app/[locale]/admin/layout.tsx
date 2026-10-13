import { Suspense } from "react";
import { AreaShell, AreaSkeleton } from "@/components/area-shell";
import { requireAdmin } from "@/server/auth/current";

export default function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  return (
    <Suspense fallback={<AreaSkeleton />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

// Pages and data functions call requireAdmin() too: layouts and pages render in parallel,
// so a layout check alone does not protect page data.
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AreaShell home="/admin">{children}</AreaShell>;
}
