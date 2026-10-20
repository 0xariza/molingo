"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { learnerNames } from "@/lib/names";
import { cancelSessionAction, markHeldAction, type ClassFormState } from "@/server/classes/actions";
import type { AttendanceStatus, SessionRow } from "@/server/classes/sessions";

type Person = { id: string; fullNameFa: string; fullNameEn: string | null };

const initial: ClassFormState = { status: "idle" };

const phaseTone: Record<SessionRow["phase"], string> = {
  upcoming: "bg-mist text-brand",
  live: "bg-ocean text-white",
  ended: "bg-[#fcefd3] text-[#8a520e]",
  held: "bg-[#ddf5e8] text-[#14613a]",
  cancelled: "bg-[#edf0f3] text-[#4a5866]",
};

/**
 * The class's sessions: a banner while one is on, the recent and next ones (or all), and the
 * actions each allows: cancel before it starts, mark it held (with attendance) once it has.
 */
export function SessionsPanel({
  classId,
  sessions,
  learners,
  sessionCount,
}: {
  classId: string;
  sessions: SessionRow[];
  learners: Person[];
  sessionCount: number;
}) {
  const t = useTranslations("Admin.classes");
  const locale = useLocale() as Locale;
  const n = (v: number) => formatNumber(v, locale);
  const [showAll, setShowAll] = useState(false);
  const [cancelling, setCancelling] = useState<SessionRow | null>(null);
  const [marking, setMarking] = useState<SessionRow | null>(null);
  const when = (s: SessionRow) =>
    `${formatDate(s.startsAt, locale, { year: false })} · ${formatTime(s.startsAt, locale)}–${formatTime(s.endsAt, locale)}`;
  const nameOf = (p: Person) => learnerNames(p, locale).primary;
  const peopleOf = (s: SessionRow) => s.participants ?? learners;

  const held = sessions.filter((s) => s.phase === "held").length;
  const replaced = new Set(
    sessions.filter((s) => s.phase !== "cancelled").map((s) => s.replacesNumber),
  );
  const cancelled = sessions.filter((s) => s.phase === "cancelled").length;
  const live = sessions.find((s) => s.phase === "live");
  const done = sessions.filter((s) => s.phase === "held" || s.phase === "cancelled");
  const upcoming = sessions.filter((s) => s.phase === "upcoming");
  const shown = showAll
    ? sessions
    : sessions.filter(
        (s) =>
          s.phase === "live" ||
          s.phase === "ended" ||
          done.slice(-2).includes(s) ||
          upcoming.slice(0, 3).includes(s),
      );

  return (
    <section
      aria-labelledby="sessions-title"
      className="space-y-4 rounded-[1.75rem] border border-line/40 bg-white p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="sessions-title"
          className="font-sans text-lg font-extrabold normal-case tracking-normal"
        >
          {t("detail.sessions")}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <span>
            <strong className="text-ocean">
              {t("detail.heldOf", { held: n(held), total: n(sessionCount) })}
            </strong>
            {" · "}
            {t("detail.cancelledCount", { count: cancelled })}
          </span>
          <Link
            href={`/admin/classes/${classId}/makeup`}
            className={buttonClass("ghost", "min-h-10 px-4 text-sm")}
          >
            {t("detail.addSession")}
          </Link>
        </div>
      </div>
      <div aria-hidden="true" className="flex gap-0.5">
        {sessions.map((s) => (
          <span
            key={s.id}
            className={`h-2 flex-1 rounded-sm ${s.phase === "held" ? "bg-brand" : s.phase === "cancelled" ? "bg-line/50" : "bg-mist"}`}
          />
        ))}
      </div>

      {live && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-ocean px-5 py-4">
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-full bg-[#4ade80] shadow-[0_0_0_6px_rgba(74,222,128,.25)]"
          />
          <div className="min-w-48 flex-1">
            <p className="text-lg font-extrabold text-white">
              {live.number ? t("detail.liveTitle", { n: n(live.number) }) : t("detail.makeup")}
            </p>
            <p className="text-sm text-whale">
              {t("detail.liveSub", { time: when(live), count: peopleOf(live).length })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMarking(live)}
            className={buttonClass("ghostLight", "min-h-11")}
          >
            {t("detail.sessionFinished")}
          </button>
        </div>
      )}

      <ol className="divide-y divide-mist">
        {shown.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-xl font-extrabold ${
                s.phase === "held"
                  ? "bg-brand text-white"
                  : s.phase === "cancelled"
                    ? "bg-[#edf0f3] text-body/60 line-through"
                    : "bg-mist text-brand"
              }`}
            >
              {s.number ? n(s.number) : "+"}
            </span>
            <div className="min-w-44 flex-1 leading-snug">
              <p className="font-bold text-ocean">{when(s)}</p>
              <p className="text-sm">{noteFor(s)}</p>
            </div>
            <span className={`rounded-pill px-2.5 py-0.5 text-sm font-bold ${phaseTone[s.phase]}`}>
              {t(`detail.phase.${s.phase}`)}
            </span>
            {(s.phase === "ended" || s.phase === "live") && s !== live && (
              <button
                type="button"
                onClick={() => setMarking(s)}
                className={buttonClass("primary", "min-h-10 px-4 text-sm")}
              >
                {t("detail.markHeld")}
              </button>
            )}
            {s.phase === "upcoming" && (
              <button
                type="button"
                onClick={() => setCancelling(s)}
                className="min-h-10 rounded-pill border border-line/50 px-4 text-sm font-bold hover:border-red-700 hover:text-red-700"
              >
                {t("detail.cancel")}
              </button>
            )}
            {s.phase === "cancelled" && !replaced.has(s.number) && (
              <Link
                href={`/admin/classes/${classId}/makeup?replaces=${s.id}`}
                className={buttonClass("ghost", "min-h-10 px-4 text-sm")}
              >
                {t("detail.replace")}
              </Link>
            )}
          </li>
        ))}
      </ol>
      {sessions.length > shown.length || showAll ? (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mx-auto block min-h-10 rounded-pill px-4 text-sm font-bold text-brand hover:bg-surface"
        >
          {showAll ? t("detail.showLess") : t("detail.showAll", { count: n(sessions.length) })}
        </button>
      ) : null}

      {cancelling && (
        <CancelDialog
          session={cancelling}
          when={when(cancelling)}
          onClose={() => setCancelling(null)}
        />
      )}
      {marking && (
        <AttendanceDialog
          session={marking}
          people={peopleOf(marking)}
          nameOf={nameOf}
          onClose={() => setMarking(null)}
        />
      )}
    </section>
  );

  function noteFor(s: SessionRow): string {
    const parts: string[] = [];
    if (s.kind === "makeup")
      parts.push(
        s.replacesNumber ? t("detail.replaces", { n: n(s.replacesNumber) }) : t("detail.makeup"),
      );
    if (s.participants && s.participants.length !== learners.length)
      parts.push(
        t("detail.makeupFor", {
          names: s.participants.map(nameOf).join(locale === "fa" ? "، " : ", "),
        }),
      );
    if (s.phase === "cancelled")
      parts.push(
        s.cancelReason
          ? t("detail.cancelledReason", { reason: s.cancelReason })
          : t("detail.cancelledNote"),
      );
    if (s.counts)
      parts.push(
        t("detail.summary", {
          present: n(s.counts.present),
          absent: n(s.counts.absent),
          excused: n(s.counts.excused),
        }),
      );
    return parts.join(" · ");
  }
}

function CancelDialog({
  session,
  when,
  onClose,
}: {
  session: SessionRow;
  when: string;
  onClose: () => void;
}) {
  const t = useTranslations("Admin.classes");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(async (prev: ClassFormState, form: FormData) => {
    const next = await cancelSessionAction(prev, form);
    if (next.status === "success") onClose();
    return next;
  }, initial);
  return (
    <Modal
      title={
        session.number
          ? t("cancel.title", { n: formatNumber(session.number, locale) })
          : t("cancel.titleMakeup")
      }
      description={t("cancel.lead", { when })}
      closeLabel={t("close")}
      onClose={onClose}
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="sessionId" value={session.id} />
        {state.error && <ErrorAlert>{t(`errors.${state.error as "not_cancellable"}`)}</ErrorAlert>}
        <Field
          label={t("cancel.reason")}
          name="reason"
          maxLength={200}
          hint={t("cancel.reasonHint")}
          error={state.fieldErrors?.reason ? t("errors.reason") : undefined}
        />
        <p className="rounded-2xl bg-surface px-4 py-3 text-sm">{t("cancel.replaceNote")}</p>
        <div className="flex flex-wrap justify-end gap-3 border-t border-mist pt-4">
          <button type="button" onClick={onClose} className={buttonClass("ghost")}>
            {t("cancel.keep")}
          </button>
          <SubmitButton
            pendingLabel={t("cancel.saving")}
            variant="danger"
            className="w-full sm:w-auto"
          >
            {t("cancel.confirm")}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function AttendanceDialog({
  session,
  people,
  nameOf,
  onClose,
}: {
  session: SessionRow;
  people: Person[];
  nameOf: (p: Person) => string;
  onClose: () => void;
}) {
  const t = useTranslations("Admin.classes");
  const locale = useLocale() as Locale;
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(people.map((p) => [p.id, "present"])),
  );
  const [state, action] = useActionState(async (prev: ClassFormState, form: FormData) => {
    const next = await markHeldAction(prev, form);
    if (next.status === "success") onClose();
    return next;
  }, initial);
  const charged = Object.values(marks).filter((m) => m !== "excused").length;
  const note: Record<AttendanceStatus, string> = {
    present: t("attendance.presentNote"),
    absent: t("attendance.absentNote"),
    excused: t("attendance.excusedNote"),
  };

  return (
    <Modal
      title={
        session.number
          ? t("attendance.title", { n: formatNumber(session.number, locale) })
          : t("attendance.titleMakeup")
      }
      description={t("attendance.lead")}
      closeLabel={t("close")}
      onClose={onClose}
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="sessionId" value={session.id} />
        <input type="hidden" name="marks" value={JSON.stringify(marks)} />
        {state.error && <ErrorAlert>{t(`errors.${state.error as "attendance"}`)}</ErrorAlert>}
        <ul className="divide-y divide-mist">
          {people.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-bold text-ocean">{nameOf(p)}</p>
                <p
                  className={`text-sm ${marks[p.id] === "absent" ? "text-red-700" : marks[p.id] === "excused" ? "text-[#8a520e]" : ""}`}
                >
                  {note[marks[p.id]]}
                </p>
              </div>
              <div
                role="group"
                aria-label={t("attendance.group", { name: nameOf(p) })}
                className="grid grid-cols-3 gap-1 rounded-xl bg-mist p-1"
              >
                {(["present", "absent", "excused"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={marks[p.id] === m}
                    onClick={() => setMarks({ ...marks, [p.id]: m })}
                    className="min-h-10 rounded-lg px-3 text-sm font-bold text-body aria-pressed:bg-white aria-pressed:text-ocean aria-pressed:shadow-[0_1px_3px_rgba(7,30,54,.12)]"
                  >
                    {t(`attendance.${m}`)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="rounded-2xl bg-surface px-4 py-3 text-sm">
          {t("attendance.charged", {
            count: formatNumber(charged, locale),
            total: formatNumber(people.length, locale),
          })}
        </p>
        <div className="flex flex-wrap justify-end gap-3 border-t border-mist pt-4">
          <button type="button" onClick={onClose} className={buttonClass("ghost")}>
            {t("attendance.notYet")}
          </button>
          <SubmitButton pendingLabel={t("attendance.saving")} className="w-full sm:w-auto">
            {t("attendance.confirm")}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
