import { Suspense } from "react";
import { AreaShell, AreaSkeleton } from "@/components/area-shell";
import { requireStudent } from "@/server/auth/current";

export default function StudentLayout({ children }: LayoutProps<"/[locale]/app">) {
  return (
    <Suspense fallback={<AreaSkeleton />}>
      <StudentGate>{children}</StudentGate>
    </Suspense>
  );
}

async function StudentGate({ children }: { children: React.ReactNode }) {
  await requireStudent();
  return <AreaShell home="/app">{children}</AreaShell>;
}
