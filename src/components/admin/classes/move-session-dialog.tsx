"use client";

import { Clock } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Locale } from "@/i18n/routing";
import { formatTime, fromTehranTime, localDigits, tehranDateKey } from "@/lib/format";
import { busyTitle } from "@/lib/names";
import { formatClock, parseClock } from "@/lib/schedule";
import { moveSessionAction, type ClassFormState } from "@/server/classes/actions";

/**
 * Moves one upcoming session to any day from today and a new start time, keeping its length.
 * The server checks clashes and past times (the week calendar has the richer, week-only version).
 */
export function MoveSessionDialog({
  session,
  title,
  when,
  onClose,
}: {
  session: { id: string; startsAt: Date; endsAt: Date };
  title: string;
  when: string;
  onClose: () => void;
}) {
  const t = useTranslations("Admin.schedule");
  const tc = useTranslations("Admin.classes");
  const locale = useLocale() as Locale;
  const [day, setDay] = useState(tehranDateKey(session.startsAt));
  const [time, setTime] = useState(localDigits(formatTime(session.startsAt, "en"), locale));
  const [state, action] = useActionState(
    async (prev: ClassFormState, form: FormData) => {
      const next = await moveSessionAction(prev, form);
      if (next.status === "success") onClose();
      return next;
    },
    { status: "idle" } as ClassFormState,
  );

  const start = parseClock(time);
  const from = start === null ? null : fromTehranTime(day, formatClock(start));
  const to = from && new Date(from.getTime() + (+session.endsAt - +session.startsAt));
  const today = tehranDateKey(new Date());
  const error =
    state.status !== "error"
      ? null
      : state.error === "clash"
        ? state.clash
          ? t("clash", {
              name: busyTitle(state.clash, locale, tc("levelCheck")),
              time: formatTime(new Date(state.clash.startsAt), locale),
            })
          : t("errors.clashGeneric")
        : t(
            `errors.${(state.error ?? Object.values(state.fieldErrors ?? {})[0] ?? "time") as "time"}`,
          );

  return (
    <Modal title={title} description={when} closeLabel={t("close")} onClose={onClose}>
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="sessionId" value={session.id} />
        <input type="hidden" name="date" value={day} />
        <input type="hidden" name="time" value={start === null ? "" : formatClock(start)} />
        {error && <ErrorAlert>{error}</ErrorAlert>}
        <DatePicker
          label={t("newDay")}
          value={day}
          onChange={setDay}
          allowed={(key) => key >= today}
          placeholder={t("newDay")}
        />
        <div className="grid grid-cols-2 items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="move-time" className="block text-sm font-bold text-ocean">
              {t("startTime")}
            </label>
            <div
              className={`flex h-12 items-center gap-2 rounded-2xl border-[1.5px] bg-white px-3 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15 ${time && start === null ? "border-red-600" : "border-line"}`}
            >
              <Clock aria-hidden size={18} className="shrink-0 text-body" />
              <input
                id="move-time"
                inputMode="numeric"
                dir="ltr"
                maxLength={5}
                placeholder={t("timePlaceholder")}
                value={time}
                aria-invalid={(!!time && start === null) || undefined}
                onChange={(e) => setTime(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-center text-base font-extrabold text-ocean outline-none"
              />
            </div>
          </div>
          <p className="flex h-12 items-center rounded-2xl bg-surface px-4 font-bold">
            {t("until", { time: to ? formatTime(to, locale) : "—" })}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-mist pt-4">
          <button type="button" onClick={onClose} className={buttonClass("ghost")}>
            {t("back")}
          </button>
          <SubmitButton pendingLabel={t("moving")} blocked={!from} className="w-full sm:w-auto">
            {t("confirmMove")}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
