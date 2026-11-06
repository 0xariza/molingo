import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AreaShell, AreaSkeleton } from "@/components/area-shell";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { requireStudent } from "@/server/auth/current";
import { dueCount } from "@/server/homework/submissions";

export default function StudentLayout({ children }: LayoutProps<"/[locale]/app">) {
  return (
    <Suspense fallback={<AreaSkeleton />}>
      <StudentGate>{children}</StudentGate>
    </Suspense>
  );
}

async function StudentGate({ children }: { children: React.ReactNode }) {
  const user = await requireStudent();
  const [t, locale, due] = await Promise.all([
    getTranslations("Student"),
    getLocale() as Promise<Locale>,
    dueCount(user.id),
  ]);
  return (
    <AreaShell
      home="/app"
      user={{ name: user.displayName, role: t("role") }}
      account={{ phone: formatPhone(user.phone) }}
      items={[
        { href: "/app", label: t("nav.home"), icon: "home" },
        { href: "/app/path", label: t("nav.path"), icon: "path" },
        { href: "/app/classes", label: t("nav.classes"), icon: "classes" },
        { href: "/app/schedule", label: t("nav.schedule"), icon: "schedule" },
        {
          href: "/app/homework",
          label: t("nav.homework"),
          icon: "homework",
          badge: due ? formatNumber(due, locale) : undefined,
        },
      ]}
    >
      {children}
    </AreaShell>
  );
}
