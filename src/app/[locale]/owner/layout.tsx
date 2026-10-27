import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AreaShell, AreaSkeleton } from "@/components/area-shell";
import { requireOwner } from "@/server/auth/current";

export default function OwnerLayout({ children }: LayoutProps<"/[locale]/owner">) {
  return (
    <Suspense fallback={<AreaSkeleton />}>
      <OwnerGate>{children}</OwnerGate>
    </Suspense>
  );
}

// The page and every owner action call requireOwner() too; this only frames the area.
async function OwnerGate({ children }: { children: React.ReactNode }) {
  const user = await requireOwner();
  const t = await getTranslations("Owner");
  return (
    <AreaShell
      home="/owner"
      user={{ name: user.displayName, role: t("role") }}
      items={[{ href: "/owner", label: t("nav.teachers"), icon: "teachers" }]}
    >
      {children}
    </AreaShell>
  );
}
