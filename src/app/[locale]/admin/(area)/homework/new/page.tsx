import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { z } from "zod";
import { SessionPicker } from "@/components/admin/after-class/session-picker";
import { Link, redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { requireTeacher } from "@/server/auth/current";
import { assignTargets } from "@/server/homework/assignments";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.homework");
  return { title: t("assign") };
}

export default function NewHomeworkPage({
  searchParams,
}: PageProps<"/[locale]/admin/homework/new">) {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
    >
      <NewHomework searchParams={searchParams} />
    </Suspense>
  );
}

/** Homework is given on a session's after-class page; this picks the session first. */
async function NewHomework({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { teacherId } = await requireTeacher();
  const { session } = await searchParams;
  const sessionId = z.uuid().safeParse(session);
  const [t, locale, targets] = await Promise.all([
    getTranslations("Admin.homework.review"),
    getLocale() as Promise<Locale>,
    assignTargets(teacherId),
  ]);
  if (sessionId.success && targets.some((c) => c.sessions.some((s) => s.id === sessionId.data)))
    redirect({ href: `/admin/sessions/${sessionId.data}`, locale });

  return (
    <div className="space-y-5">
      <Link
        href="/admin/homework"
        className="inline-flex min-h-touch items-center gap-1.5 font-bold text-brand hover:underline"
      >
        <ArrowLeft aria-hidden size={18} className="icon-directional" />
        {t("back")}
      </Link>
      <SessionPicker targets={targets} />
    </div>
  );
}
