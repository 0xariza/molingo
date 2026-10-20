import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { ACCENT } from "@/components/admin/schedule/colors";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatTime, tehranDateKey } from "@/lib/format";
import { classTitle } from "@/lib/names";
import type { LearnerSession } from "@/server/scheduling/learner";
import { DeviceTime } from "./device-time";

/** The learner's session that's on now or comes next (not cancelled). */
export function nextSession(list: LearnerSession[]) {
  return list.find((s) => s.phase === "upcoming" || s.phase === "live");
}

/** The navy "next session" card: when (Tehran time, plus device time abroad). */
export function NextSessionCard({
  session,
  now,
  locale,
}: {
  session: LearnerSession;
  now: Date;
  locale: Locale;
}) {
  const t = useTranslations("Student.schedule");
  const today = tehranDateKey(session.startsAt) === tehranDateKey(now);
  const name = classTitle(session, locale);
  return (
    <section
      aria-labelledby="next-session"
      className="flex flex-col items-start gap-1.5 rounded-[1.75rem] bg-ocean p-6 text-mist"
    >
      <span className="rounded-pill bg-sand px-3 text-xs font-extrabold text-ocean">
        {session.phase === "live" ? t("live") : today ? t("nextToday") : t("next")}
      </span>
      <h2
        id="next-session"
        className="font-sans text-xl font-extrabold normal-case tracking-normal text-white"
      >
        {t("withLevel", {
          name: session.kind === "makeup" ? t("makeupTitle", { name }) : name,
          level: session.level,
        })}
      </h2>
      <p>
        {t("tehranTime", {
          when: formatDate(session.startsAt, locale, { year: false }),
          from: formatTime(session.startsAt, locale),
          to: formatTime(session.endsAt, locale),
        })}
      </p>
      <DeviceTime from={session.startsAt} to={session.endsAt} locale={locale} />
    </section>
  );
}

/** Two weeks of sessions, by day; cancelled and moved ones say so. */
export function SessionList({
  sessions,
  now,
  locale,
}: {
  sessions: LearnerSession[];
  now: Date;
  locale: Locale;
}) {
  const t = useTranslations("Student.schedule");
  const today = tehranDateKey(now);
  const days = [...new Set(sessions.map((s) => tehranDateKey(s.startsAt)))];

  if (sessions.length === 0)
    return <p className="rounded-card bg-white p-6 text-center">{t("empty")}</p>;

  return (
    <div className="space-y-2.5">
      {days.map((day) => {
        const onDay = sessions.filter((s) => tehranDateKey(s.startsAt) === day);
        const label = formatDate(onDay[0].startsAt, locale, { year: false });
        return (
          <section key={day} aria-label={label} className="space-y-2.5">
            <h2 className="mx-1 mt-1.5 font-sans text-sm font-extrabold normal-case tracking-normal text-body">
              {day === today ? t("todayDay", { day: label }) : label}
            </h2>
            {onDay.map((s) => (
              <SessionCard key={s.id} session={s} isToday={day === today} locale={locale} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function SessionCard({
  session: s,
  isToday,
  locale,
}: {
  session: LearnerSession;
  isToday: boolean;
  locale: Locale;
}) {
  const t = useTranslations("Student.schedule");
  const cancelled = s.phase === "cancelled";
  const name = classTitle(s, locale);
  const color = cancelled ? ACCENT.cancelled : s.kind === "makeup" ? ACCENT.makeup : ACCENT[s.type];
  const minutes = (s.endsAt.getTime() - s.startsAt.getTime()) / 60_000;
  const meta = cancelled
    ? s.cancelReason
      ? t("cancelledReason", { reason: s.cancelReason })
      : t("cancelledNoReason")
    : s.movedFrom
      ? t("movedFrom", {
          when: `${formatDate(s.movedFrom, locale, { year: false })} ${formatTime(s.movedFrom, locale)}`,
        })
      : s.number
        ? `${s.level} · ${t("sessionOf", { n: s.number, total: s.sessionCount })}`
        : s.level;
  const pill = cancelled
    ? { text: t("cancelled"), cls: "bg-[#fdecea] text-[#b03a2e]" }
    : s.phase === "held"
      ? { text: t("held"), cls: "bg-[#ddf5e8] text-[#14613a]" }
      : s.phase === "live"
        ? { text: t("live"), cls: "bg-ocean text-white" }
        : s.kind === "makeup"
          ? { text: t("makeup"), cls: "bg-[#fde5d6] text-[#a34a12]" }
          : s.movedFrom
            ? { text: t("moved"), cls: "bg-mist text-brand" }
            : isToday && s.phase === "upcoming"
              ? { text: t("today"), cls: "bg-mist text-brand" }
              : null;

  return (
    <article
      style={{ "--accent": color } as CSSProperties}
      className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-line/40 bg-white px-4 py-3 before:absolute before:inset-y-0 before:start-0 before:w-1.5 before:bg-(--accent)"
    >
      <span
        className={`flex min-w-13 flex-col items-center leading-tight ${cancelled ? "opacity-55" : ""}`}
      >
        <b
          className={`text-base font-extrabold text-brand tabular-nums ${cancelled ? "line-through" : ""}`}
        >
          {formatTime(s.startsAt, locale)}
        </b>
        <small className="text-[11px] text-body">{t("minutes", { count: minutes })}</small>
      </span>
      <span className="min-w-0 flex-1 leading-snug">
        <b className={`block truncate ${cancelled ? "line-through opacity-55" : ""}`}>
          {s.kind === "makeup" ? t("makeupTitle", { name }) : name}
        </b>
        <span className="text-xs text-body">{meta}</span>
      </span>
      {pill && (
        <span
          className={`rounded-pill px-2.5 text-[11px] font-extrabold whitespace-nowrap ${pill.cls}`}
        >
          {pill.text}
        </span>
      )}
    </article>
  );
}
