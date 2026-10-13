import { getTranslations } from "next-intl/server";
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
  const [user, t] = await Promise.all([requireStudent(), getTranslations("Student")]);
  return (
    <AreaShell
      home="/app"
      user={{ name: user.displayName, role: t("role") }}
      items={[{ href: "/app", label: t("nav.home"), icon: "home" }]}
    >
      {children}
    </AreaShell>
  );
}
