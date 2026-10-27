"use client";

import { Check, Clock } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { SelectMenu } from "@/components/ui/select-menu";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  formatDate,
  formatNumber,
  formatTime,
  fromTehranTime,
  localDigits,
  tehranDateKey,
} from "@/lib/format";
import { busyTitle, type BusyLike, learnerNames } from "@/lib/names";
import { formatClock, parseClock } from "@/lib/schedule";
import { addMakeupAction, type ClassFormState } from "@/server/classes/actions";

type Person = { id: string; fullNameFa: string; fullNameEn: string | null };
type Busy = BusyLike & { startsAt: Date; endsAt: Date };

const LENGTHS = [30, 45, 60, 75, 90, 120];
const initial: ClassFormState = { status: "idle" };
const section = "space-y-5 rounded-card border border-hairline bg-white p-6 sm:p-7";
const heading = "font-sans text-lg font-extrabold normal-case tracking-normal";

/** A one-off make-up session: what it replaces, the day (with that day's other sessions), the time, who comes. */
export function MakeupForm({
  classId,
  type,
  sessionMinutes,
  cancelled,
  learners,
  busy,
  today,
  replaces: initialReplaces,
}: {
  classId: string;
  type: "private" | "group";
  sessionMinutes: number;
  cancelled: { id: string; number: number | null; startsAt: Date }[];
  learners: Person[];
  busy: Busy[];
  today: string;
  replaces?: string;
}) {
  const t = useTranslations("Admin.classes");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(addMakeupAction, initial);
  const [replaces, setReplaces] = useState(initialReplaces ?? "");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [minutes, setMinutes] = useState(String(sessionMinutes));
  const [who, setWho] = useState(learners.map((l) => l.id));
  const n = (v: number) => formatNumber(v, locale);
  const range = (b: Busy) =>
    [formatTime(b.startsAt, locale), formatTime(b.endsAt, locale)].join("–");

  const start = parseClock(time);
  const onDay = day ? busy.filter((b) => tehranDateKey(b.startsAt) === day) : [];
  const from = day && start !== null ? fromTehranTime(day, formatClock(start)) : null;
  const to = from ? new Date(from.getTime() + Number(minutes) * 60_000) : null;
  const clash = from && to ? onDay.find((b) => b.startsAt < to && b.endsAt > from) : undefined;
  const ok = !!from && !clash && who.length > 0;
  const err = (field: string) =>
    state.fieldErrors?.[field] ? t(`errors.${state.fieldErrors[field] as "date"}`) : undefined;
  const formError =
    state.error === "clash"
      ? state.clash
        ? t("makeup.clash", { name: busyTitle(state.clash, locale, t("levelCheck")) })
        : t("errors.clashGeneric")
      : state.error
        ? t(`errors.${state.error as "past"}`)
        : null;

  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="time" value={time} />
      {who.map((id) => (
        <input key={id} type="hidden" name="studentIds" value={id} />
      ))}
      {formError && <ErrorAlert>{formError}</ErrorAlert>}

      {cancelled.length > 0 && (
        <section aria-labelledby="mk-replaces" className={section}>
          <h2 id="mk-replaces" className={heading}>
            {t("makeup.replaces")}
          </h2>
          <div className="max-w-md">
            <SelectMenu
              label={t("makeup.replaces")}
              name="replacesSessionId"
              value={replaces}
              onChange={setReplaces}
              options={[
                { value: "", label: t("makeup.replacesNone") },
                ...cancelled.map((c) => ({
                  value: c.id,
                  label: t("makeup.replacesOption", { n: c.number ? n(c.number) : "+" }),
                  hint: formatDate(c.startsAt, locale, { year: false }),
                })),
              ]}
            />
          </div>
        </section>
      )}

      <section aria-labelledby="mk-when" className={section}>
        <h2 id="mk-when" className={heading}>
          {t("makeup.day")}
        </h2>
        <div className="grid items-start gap-5 sm:grid-cols-2">
          <DatePicker
            label={t("makeup.day")}
            name="date"
            value={day}
            onChange={setDay}
            allowed={(key) => key >= today}
            placeholder={t("makeup.dayPlaceholder")}
            error={err("date")}
          />
          <div className="space-y-1.5">
            <span className="block text-sm font-bold text-ocean">{t("makeup.busyTitle")}</span>
            {!day ? (
              <p className="flex h-12 items-center rounded-2xl bg-surface px-4 text-sm">
                {t("makeup.dayPlaceholder")}
              </p>
            ) : onDay.length === 0 ? (
              <p className="flex h-12 items-center rounded-2xl bg-[#ddf5e8] px-4 font-semibold text-[#14613a]">
                {t("makeup.busyNone")}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {onDay.map((b) => (
                  <li
                    key={b.startsAt.toISOString()}
                    className="flex items-center gap-3 rounded-xl bg-[#fdf3dc] px-3 py-2 text-[#4d3700]"
                  >
                    <strong dir="ltr">{range(b)}</strong>
                    {busyTitle(b, locale, t("levelCheck"))}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="mk-time" className="block text-sm font-bold text-ocean">
              {t("makeup.time")}
            </label>
            <div
              className={`flex h-12 items-center gap-2 rounded-2xl border-[1.5px] bg-white px-3 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15 ${clash || (time && start === null) ? "border-red-600" : "border-line"}`}
            >
              <Clock aria-hidden size={18} className="shrink-0 text-body" />
              <input
                id="mk-time"
                inputMode="numeric"
                dir="ltr"
                maxLength={5}
                placeholder={t("form.timePlaceholder")}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-center font-bold text-ocean outline-none"
              />
            </div>
            {(err("time") || (time && start === null)) && (
              <p className="text-sm font-medium text-red-700">{t("errors.time")}</p>
            )}
          </div>
          <SelectMenu
            label={t("makeup.minutes")}
            name="minutes"
            value={minutes}
            onChange={setMinutes}
            options={LENGTHS.map((m) => ({
              value: String(m),
              label: t("form.minutesOption", { count: n(m) }),
            }))}
          />
        </div>
        {clash ? (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 font-semibold text-red-800">
            {t("makeup.clash", { name: busyTitle(clash, locale, t("levelCheck")) })}
          </p>
        ) : (
          from &&
          to && (
            <p className="rounded-2xl bg-[#ddf5e8] px-4 py-3 font-semibold text-[#14613a]">
              {t("makeup.free", {
                from: `${formatDate(from, locale, { year: false })} ${formatTime(from, locale)}`,
                to: localDigits(formatTime(to, "en"), locale),
              })}
            </p>
          )
        )}
      </section>

      <section aria-labelledby="mk-who" className={section}>
        <h2 id="mk-who" className={heading}>
          {t("makeup.who")}
        </h2>
        {learners.length === 0 ? (
          <p>{t("makeup.noLearners")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {learners.map((p) => {
              const on = who.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => setWho(on ? who.filter((id) => id !== p.id) : [...who, p.id])}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-line/50 bg-white px-4 text-start font-bold text-ocean aria-checked:border-brand aria-checked:bg-surface aria-checked:ring-1 aria-checked:ring-brand"
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-5.5 place-items-center rounded-md border-[1.5px] ${on ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
                  >
                    {on && <Check size={14} weight="bold" />}
                  </span>
                  {learnerNames(p, locale).primary}
                </button>
              );
            })}
          </div>
        )}
        <p className={`text-sm ${err("studentIds") ? "font-medium text-red-700" : ""}`}>
          {err("studentIds") ?? t("makeup.whoHint")}
        </p>
      </section>

      <section aria-labelledby="mk-bill" className={section}>
        <h2 id="mk-bill" className={heading}>
          {t("makeup.billingTitle")}
        </h2>
        <p className="text-ocean">
          {type === "private" ? t("makeup.billingPrivate") : t("makeup.billingGroup")}
        </p>
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <Link href={`/admin/classes/${classId}`} className={buttonClass("ghost")}>
          {t("form.cancel")}
        </Link>
        {ok ? (
          <SubmitButton pendingLabel={t("makeup.saving")} className="w-full sm:w-auto">
            {t("makeup.save")}
          </SubmitButton>
        ) : (
          <button
            type="button"
            disabled
            className={buttonClass("primary", "w-full opacity-50 sm:w-auto")}
          >
            {t("makeup.save")}
          </button>
        )}
      </div>
    </form>
  );
}
