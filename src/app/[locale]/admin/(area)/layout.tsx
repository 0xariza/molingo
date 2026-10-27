import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AreaShell, AreaSkeleton } from "@/components/area-shell";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { requireTeacher } from "@/server/auth/current";
import { listUpcomingSlots } from "@/server/funnel/level-check";

export default function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  return (
    <Suspense fallback={<AreaSkeleton />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

// Pages and data functions call requireTeacher() too: layouts and pages render in parallel,
// so a layout check alone does not protect page data.
async function AdminGate({ children }: { children: React.ReactNode }) {
  // The session check comes first: it marks the request dynamic before the bookings read the clock.
  const user = await requireTeacher();
  const [t, locale, slots] = await Promise.all([
    getTranslations("Admin"),
    getLocale() as Promise<Locale>,
    listUpcomingSlots(user.teacherId),
  ]);
  const booked = slots.filter((s) => s.lead).length;
  return (
    <AreaShell
      home="/admin"
      user={{ name: user.displayName, role: t("role") }}
      items={[
        { href: "/admin", label: t("nav.dashboard"), icon: "home" },
        {
          href: "/admin/schedule",
          label: t("nav.schedule"),
          icon: "schedule",
          badge: booked ? formatNumber(booked, locale) : undefined,
        },
        { href: "/admin/students", label: t("nav.learners"), icon: "learners" },
        { href: "/admin/classes", label: t("nav.classes"), icon: "classes" },
        { href: "/admin/my-page", label: t("nav.myPage"), icon: "page" },
      ]}
    >
      {children}
    </AreaShell>
  );
}
