import { ArrowRight, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { BackLink } from "@/components/admin/learners/back-link";
import { Roster } from "@/components/admin/classes/roster";
import { scheduleText } from "@/components/admin/classes/schedule-text";
import { SessionsPanel } from "@/components/admin/classes/sessions-panel";
import { ShareLinkButton } from "@/components/admin/classes/share-link";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber, formatToman, fromTehranTime } from "@/lib/format";
import { classTitle, learnerNames } from "@/lib/names";
import { requireAdmin } from "@/server/auth/current";
import { archiveClassAction } from "@/server/classes/actions";
import { listCandidates, listClasses } from "@/server/classes/classes";
import { getClassDetail } from "@/server/classes/sessions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.classes");
  return { title: t("title") };
}

export default function ClassPage({ params }: PageProps<"/[locale]/admin/classes/[id]">) {
  return (
    <div className="space-y-5">
      <Suspense
        fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
      >
        <ClassView params={params} />
      </Suspense>
    </div>
  );
}

const card = "space-y-4 rounded-[1.75rem] border border-line/40 bg-white p-6";
const heading = "font-sans text-lg font-extrabold normal-case tracking-normal";

async function ClassView({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const valid = z.uuid().safeParse(id);
  const cls = valid.success ? await getClassDetail(valid.data) : null;
  if (!cls) notFound();

  const [t, locale, candidates, cards] = await Promise.all([
    getTranslations("Admin.classes"),
    getLocale() as Promise<Locale>,
    listCandidates(),
    listClasses(),
  ]);
  const n = (v: number) => formatNumber(v, locale);
  const daysShort = t.raw("weekdaysShort") as string[];
  const running = cls.state === "open" || cls.state === "full";
  const free = cls.capacity - cls.learners.length;
  const last = cls.sessions.filter((s) => s.phase !== "cancelled").at(-1);
  const stateLabel =
    cls.state === "open" ? t("detail.freeSeats", { count: free }) : t(`state.${cls.state}`);
  const targets = cards
    .filter((c) => c.id !== cls.id && (c.state === "open" || c.state === "full"))
    .map((c) => ({
      id: c.id,
      name: classTitle(c, locale),
      level: c.level,
      schedule: scheduleText(c.slots, daysShort, t("and"), locale),
      free: c.capacity - c.taken,
    }));
  const details: [string, string][] = [
    [t("detail.level"), `${cls.level} · ${t(`levels.${cls.level}`)}`],
    [t("detail.type"), t(`type.${cls.type}`)],
    [t("detail.capacity"), t("detail.capacityValue", { count: cls.capacity })],
    [t("detail.starts"), formatDate(fromTehranTime(cls.startsOn, "12:00"), locale)],
    [t("detail.schedule"), scheduleText(cls.slots, daysShort, t("and"), locale)],
    [
      t("detail.sessions"),
      t("detail.sessionsValue", {
        count: n(cls.sessionCount),
        date: last ? formatDate(last.startsAt, locale, { year: false }) : "—",
      }),
    ],
    [
      t("detail.price"),
      cls.type === "private"
        ? t("detail.pricePrivate", { amount: formatToman(cls.priceToman, locale) })
        : t("detail.priceGroup", { amount: formatToman(cls.priceToman, locale) }),
    ],
  ];
  if (cls.type === "group")
    details.push([
      t("detail.landing"),
      cls.isPublic ? t("detail.landingYes") : t("detail.landingNo"),
    ]);

  return (
    <>
      <BackLink href="/admin/classes" label={t("back")} />
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            dir="ltr"
            className="grid size-16 shrink-0 place-items-center rounded-2xl bg-ocean text-2xl font-extrabold text-white"
          >
            {cls.level}
          </span>
          <div>
            <h1 className="text-3xl sm:text-4xl">{classTitle(cls, locale)}</h1>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-sm font-bold">
              <span className="rounded-pill bg-[#ddf5e8] px-2.5 text-[#14613a]">{stateLabel}</span>
              <span className="rounded-pill bg-mist px-2.5 text-brand">
                {t(`type.${cls.type}`)}
              </span>
              <span className="rounded-pill bg-mist px-2.5 text-brand">
                {scheduleText(cls.slots, daysShort, t("and"), locale)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {cls.state === "finished" ? (
            <Link href={`/admin/classes/new?from=${cls.id}`} className={buttonClass("primary")}>
              <ArrowRight aria-hidden size={18} className="icon-directional" />
              {t("detail.next")}
            </Link>
          ) : (
            running && (
              <span
                aria-disabled="true"
                title={
                  last
                    ? t("detail.nextLocked", {
                        date: formatDate(last.startsAt, locale, { year: false }),
                      })
                    : undefined
                }
                className={buttonClass(
                  "primary",
                  "cursor-not-allowed bg-mist text-body/60 hover:bg-mist",
                )}
              >
                <ArrowRight aria-hidden size={18} className="icon-directional" />
                {t("detail.next")}
              </span>
            )
          )}
          {running && <ShareLinkButton url={`${process.env.APP_URL}/j/${cls.id}`} />}
          {cls.state !== "archived" && (
            <Link href={`/admin/classes/${cls.id}/edit`} className={buttonClass("ghost")}>
              <PencilSimple aria-hidden size={18} />
              {t("detail.edit")}
            </Link>
          )}
          {cls.state !== "archived" && cls.learners.length === 0 && (
            <form action={archiveClassAction}>
              <input type="hidden" name="id" value={cls.id} />
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="min-h-touch rounded-pill border border-line/50 px-5 font-bold hover:border-brand"
              >
                {t("detail.archive")}
              </button>
            </form>
          )}
        </div>
      </header>
      {running && last && (
        <p className="-mt-2 text-end text-sm">
          {t("detail.nextLocked", { date: formatDate(last.startsAt, locale, { year: false }) })}
        </p>
      )}

      <SessionsPanel
        classId={cls.id}
        sessions={cls.sessions}
        learners={cls.learners}
        sessionCount={cls.sessionCount}
      />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Roster
          classId={cls.id}
          className={classTitle(cls, locale)}
          capacity={cls.capacity}
          canAdd={cls.state === "open"}
          running={running}
          learners={cls.learners}
          candidates={candidates}
          targets={targets}
        />
        <div className="space-y-5">
          <section aria-labelledby="details-title" className={card}>
            <h2 id="details-title" className={heading}>
              {t("detail.details")}
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5">
              {details.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt>{label}</dt>
                  <dd className="font-bold text-ocean">{value}</dd>
                </div>
              ))}
            </dl>
            {cls.description && <p className="whitespace-pre-line text-ocean">{cls.description}</p>}
          </section>
          {cls.pastLearners.length > 0 && (
            <section aria-labelledby="past-title" className={card}>
              <h2 id="past-title" className={heading}>
                {t("detail.past")}
              </h2>
              <ul className="divide-y divide-mist">
                {cls.pastLearners.map((p) => (
                  <li key={`${p.id}-${p.until.toISOString()}`} className="py-2.5">
                    <Link
                      href={`/admin/students/${p.id}`}
                      className="font-bold text-ocean hover:underline"
                    >
                      {learnerNames(p, locale).primary}
                    </Link>
                    <p className="text-sm">
                      {t("detail.pastRange", {
                        from: formatDate(p.since, locale, { weekday: false, year: false }),
                        to: formatDate(p.until, locale, { weekday: false, year: false }),
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
