import { VideoCamera } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { ACCENT } from "@/components/admin/schedule/colors";
import { JoinLink } from "@/components/classroom/join-link";
import { buttonClass } from "@/components/ui/button";
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
  const tc = useTranslations("Classroom");
  const today = tehranDateKey(session.startsAt) === tehranDateKey(now);
  const name = classTitle(session, locale);
  return (
    <section
      aria-labelledby="next-session"
      className="flex flex-col items-start gap-1.5 rounded-card bg-ocean p-6 text-mist"
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
      <JoinLink
        href={`/app/classroom/${session.id}`}
        role="student"
        startsAt={session.startsAt}
        endsAt={session.endsAt}
        open={session.canJoin}
        className={buttonClass("sand", "mt-3")}
      >
        <VideoCamera aria-hidden size={20} weight="fill" />
        {tc("join")}
      </JoinLink>
    </section>
  );
}

/**
 * One session in the learner's calendar; cancelled and moved ones say so, and an open room has a
 * join button. `compact` is the narrow desktop column.
 */
export function SessionCard({
  session: s,
  isToday,
  locale,
  compact = false,
}: {
  session: LearnerSession;
  isToday: boolean;
  locale: Locale;
  compact?: boolean;
}) {
  const t = useTranslations("Student.schedule");
  const tc = useTranslations("Classroom");
  const cancelled = s.phase === "cancelled";
  const name = classTitle(s, locale);
  const color = cancelled ? ACCENT.cancelled : s.kind === "makeup" ? ACCENT.makeup : ACCENT[s.type];
  const minutes = (s.endsAt.getTime() - s.startsAt.getTime()) / 60_000;
  const meta = cancelled
    ? s.cancelReason
      ? t("cancelledReason", { reason: s.cancelReason })
      : t("cancelledNoReason")
    : s.phase === "held" && s.topics
      ? t("topics", { topics: s.topics })
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

  const join = (s.phase === "upcoming" || s.phase === "live") && (
    <JoinLink
      href={`/app/classroom/${s.id}`}
      role="student"
      startsAt={s.startsAt}
      endsAt={s.endsAt}
      open={s.canJoin}
      className={
        compact
          ? "mt-1.5 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[10px] bg-cinnamon text-sm font-bold text-navy hover:bg-[#d56d33]"
          : buttonClass("primary")
      }
    >
      <VideoCamera aria-hidden size={compact ? 16 : 18} weight="fill" />
      {tc("join")}
    </JoinLink>
  );
  const title = s.kind === "makeup" ? t("makeupTitle", { name }) : name;

  if (compact)
    return (
      <article
        title={`${title} · ${formatTime(s.startsAt, locale)}`}
        style={{ "--accent": color } as CSSProperties}
        className={`relative flex flex-col gap-px overflow-hidden rounded-xl border bg-white py-1.5 ps-2.5 pe-2 before:absolute before:inset-y-0 before:start-0 before:w-1 before:bg-(--accent) ${
          s.phase === "live" ? "border-ocean ring-1 ring-ocean" : "border-hairline"
        }`}
      >
        <span
          className={`flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5 ${cancelled ? "opacity-55" : ""}`}
        >
          <b className="text-[11.5px] whitespace-nowrap text-brand tabular-nums">
            {formatTime(s.startsAt, locale)}
          </b>
          {pill && (
            <span
              className={`rounded-pill px-1.5 text-[10px] leading-relaxed font-extrabold whitespace-nowrap ${pill.cls}`}
            >
              {pill.text}
            </span>
          )}
        </span>
        <b
          className={`truncate text-[13px] font-extrabold ${cancelled ? "line-through opacity-55" : ""}`}
        >
          {title}
        </b>
        <span className="line-clamp-2 text-[11px] text-body">{meta}</span>
        {join}
      </article>
    );

  return (
    <article
      style={{ "--accent": color } as CSSProperties}
      className="relative flex flex-wrap items-center gap-3 overflow-hidden rounded-2xl border border-hairline bg-white px-4 py-3 before:absolute before:inset-y-0 before:start-0 before:w-1.5 before:bg-(--accent)"
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
        <b className={`block truncate ${cancelled ? "line-through opacity-55" : ""}`}>{title}</b>
        <span className="text-xs text-body">{meta}</span>
      </span>
      {pill && (
        <span
          className={`rounded-pill px-2.5 text-[11px] font-extrabold whitespace-nowrap ${pill.cls}`}
        >
          {pill.text}
        </span>
      )}
      {join}
    </article>
  );
}
