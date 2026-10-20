"use client";

import { Clock, Phone, Plus } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState, type ReactNode } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  formatDate,
  formatDayParts,
  formatNumber,
  formatTime,
  fromTehranTime,
  localDigits,
  tehranDateKey,
  toLatinDigits,
} from "@/lib/format";
import { busyTitle, classTitle } from "@/lib/names";
import { formatPhone } from "@/lib/phone";
import { addDays, busyMinutes, formatClock, formatHours, parseClock } from "@/lib/schedule";
import {
  cancelSessionAction,
  moveSessionAction,
  type ClassFormState,
} from "@/server/classes/actions";
import {
  addSlotAction,
  assignSlotAction,
  cancelBookingAction,
  removeSlotAction,
  type FormState,
} from "@/server/funnel/actions";
import { LEVEL_CHECK_MINUTES } from "@/server/funnel/constants";
import { isBusy, PILL_STYLE, useItemText, type CalendarItem, type WeekData } from "./calendar-item";

export type Selection =
  { type: "item"; item: CalendarItem; mode?: "move" | "cancel" } | { type: "add"; day: string };

type Props = {
  selection: Selection;
  data: WeekData;
  items: CalendarItem[];
  onClose: () => void;
  onSelect: (s: Selection) => void;
};

const footer = "flex flex-wrap gap-2.5 border-t border-mist pt-4";

/** What happens when Mona opens a card or adds a time, in one dialog. */
export function ScheduleDialog(props: Props) {
  const { selection } = props;
  if (selection.type === "add") return <AddSlot {...props} day={selection.day} />;
  const { item, mode } = selection;
  if (item.kind === "levelCheck" && !item.slot.lead) return <AssignSlot {...props} item={item} />;
  if (mode === "move" && item.kind === "session") return <MoveSession {...props} item={item} />;
  if (mode === "cancel") return <Cancel {...props} item={item} />;
  return <Details {...props} item={item} />;
}

function useWhen(item: CalendarItem) {
  const t = useTranslations("Admin.schedule");
  const locale = useLocale() as Locale;
  return `${formatDate(item.startsAt, locale, { year: false })} · ${t("timeRange", {
    from: formatTime(item.startsAt, locale),
    to: formatTime(item.endsAt, locale),
  })}`;
}

function Details({ item, data, onClose, onSelect }: Props & { item: CalendarItem }) {
  const t = useTranslations("Admin.schedule");
  const levels = useTranslations("Landing.booking.levels");
  const locale = useLocale() as Locale;
  const text = useItemText(item, data);
  const when = useWhen(item);
  const facts: [string, ReactNode][] = [];
  let actions: ReactNode;

  if (item.kind === "levelCheck" && item.slot.lead) {
    const lead = item.slot.lead;
    const ahead = item.startsAt > data.now;
    facts.push(
      [t("facts.phone"), <bdi key="p">{localDigits(formatPhone(lead.phone), locale)}</bdi>],
      [t("facts.level"), levels(lead.levelGuess)],
      [t("facts.booking"), t(`facts.${lead.source}`)],
    );
    actions = (
      <>
        <a href={`tel:${lead.phone}`} className={buttonClass("ocean")}>
          <Phone aria-hidden size={18} />
          {t("call")}
        </a>
        {ahead && (
          <button
            type="button"
            onClick={() => onSelect({ type: "item", item, mode: "cancel" })}
            className={buttonClass("ghost", "border-red-200 text-red-700 hover:bg-red-50")}
          >
            {t("cancelBooking")}
          </button>
        )}
      </>
    );
  } else if (item.kind === "session") {
    const s = item.session;
    facts.push(
      [t("facts.learners"), t("facts.learnersCount", { count: s.people })],
      [
        t("facts.status"),
        <span
          key="s"
          className={`rounded-pill px-2.5 py-0.5 text-sm font-extrabold ${PILL_STYLE[s.phase]}`}
        >
          {t(`pill.${s.phase}`)}
        </span>,
      ],
    );
    if (s.movedFrom)
      facts.push([
        t("facts.movedFrom"),
        `${formatDate(s.movedFrom, locale, { year: false })} · ${formatTime(s.movedFrom, locale)}`,
      ]);
    if (s.cancelReason) facts.push([t("facts.reason"), s.cancelReason]);
    const toConfirm = s.phase === "live" || s.phase === "ended";
    actions = (
      <>
        <Link href={`/admin/classes/${s.classId}`} className={buttonClass("ocean")}>
          {toConfirm ? t("markHeld") : t("goClass")}
        </Link>
        {s.phase === "upcoming" && (
          <>
            <button
              type="button"
              onClick={() => onSelect({ type: "item", item, mode: "move" })}
              className={buttonClass("ghost")}
            >
              {t("move")}
            </button>
            <button
              type="button"
              onClick={() => onSelect({ type: "item", item, mode: "cancel" })}
              className={buttonClass("ghost", "border-red-200 text-red-700 hover:bg-red-50")}
            >
              {t("cancel")}
            </button>
          </>
        )}
      </>
    );
  }

  return (
    <Modal title={text.fullTitle} description={when} closeLabel={t("close")} onClose={onClose}>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-body">{k}</dt>
            <dd className="font-bold text-ocean">{v}</dd>
          </div>
        ))}
      </dl>
      <div className={footer}>{actions}</div>
    </Modal>
  );
}

/** Cancels a session (never charged) or a level-check booking (the time opens again). */
function Cancel({ item, data, onClose, onSelect }: Props & { item: CalendarItem }) {
  const t = useTranslations("Admin.schedule");
  const text = useItemText(item, data);
  const when = useWhen(item);
  const back = () => onSelect({ type: "item", item });
  const isSession = item.kind === "session";
  const [state, action] = useActionState(
    async (prev: ClassFormState | FormState, form: FormData) => {
      const next = isSession
        ? await cancelSessionAction(prev as ClassFormState, form)
        : await cancelBookingAction(prev as FormState, form);
      if (next.status === "success") onClose();
      return next;
    },
    { status: "idle" },
  );
  const error = state.status === "error" && (state.fieldErrors?.reason ? "reason" : state.error);

  return (
    <Modal title={text.fullTitle} description={when} closeLabel={t("close")} onClose={onClose}>
      <form action={action} className="space-y-4">
        {error && <ErrorAlert>{t(`errors.${error as "reason"}`)}</ErrorAlert>}
        {isSession ? (
          <>
            <input type="hidden" name="sessionId" value={item.id} />
            <p>{t("cancelLead")}</p>
            <Field
              label={t("reason")}
              hint={t("reasonHint")}
              name="reason"
              maxLength={200}
              placeholder={t("reasonPlaceholder")}
            />
          </>
        ) : (
          <>
            <input type="hidden" name="slotId" value={item.id} />
            <p>{t("cancelBookingLead", { name: text.title })}</p>
          </>
        )}
        <div className={`${footer} justify-end`}>
          <button type="button" onClick={back} className={buttonClass("ghost")}>
            {t("keep")}
          </button>
          <SubmitButton variant="danger" pendingLabel={t("cancelling")} className="w-auto">
            {isSession ? t("confirmCancel") : t("cancelBooking")}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

/** The other entries a new time would overlap on that day (cancelled sessions don't count). */
function clashOn(items: CalendarItem[], from: Date, to: Date, except?: string) {
  return items.find(
    (i) =>
      i.id !== except &&
      !(i.kind === "session" && i.session.phase === "cancelled") &&
      i.startsAt < to &&
      i.endsAt > from,
  );
}

function TimeInput({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  const t = useTranslations("Admin.schedule");
  return (
    <div className="space-y-1.5">
      <label htmlFor="sched-time" className="block text-sm font-bold text-ocean">
        {label}
      </label>
      <div
        className={`flex h-12 items-center gap-2 rounded-2xl border-[1.5px] bg-white px-3 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15 ${invalid ? "border-red-600" : "border-line"}`}
      >
        <Clock aria-hidden size={18} className="shrink-0 text-body" />
        <input
          id="sched-time"
          inputMode="numeric"
          dir="ltr"
          maxLength={5}
          placeholder={t("timePlaceholder")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-center text-base font-extrabold text-ocean outline-none"
        />
      </div>
    </div>
  );
}

function Note({ tone, children }: { tone: "ok" | "warn" | "bad"; children: ReactNode }) {
  const style = {
    ok: "bg-[#ddf5e8] text-[#14613a]",
    warn: "bg-[#fdf3dc] text-[#4d3700]",
    bad: "bg-red-50 text-red-800",
  }[tone];
  return (
    <p
      role={tone === "bad" ? "alert" : "status"}
      className={`rounded-xl px-4 py-2.5 font-bold ${style}`}
    >
      {children}
    </p>
  );
}

/** Moves one upcoming session to another day of the week shown, with clash and hour checks. */
function MoveSession({
  item,
  data,
  items,
  onClose,
  onSelect,
}: Props & { item: Extract<CalendarItem, { kind: "session" }> }) {
  const t = useTranslations("Admin.schedule");
  const tc = useTranslations("Admin.classes");
  const locale = useLocale() as Locale;
  const when = useWhen(item);
  const title = useItemText(item, data).fullTitle;
  const [day, setDay] = useState(tehranDateKey(item.startsAt));
  const [time, setTime] = useState(formatTime(item.startsAt, "en"));
  const [state, action] = useActionState(
    async (prev: ClassFormState, form: FormData) => {
      const next = await moveSessionAction(prev, form);
      if (next.status === "success") onClose();
      return next;
    },
    { status: "idle" },
  );

  const length = item.endsAt.getTime() - item.startsAt.getTime();
  const start = parseClock(time);
  const from = start === null ? null : fromTehranTime(day, formatClock(start));
  const to = from && new Date(from.getTime() + length);
  const clash = from && to ? clashOn(items, from, to, item.id) : undefined;
  const past = !!from && from <= data.now;
  const dayName = formatDayParts(fromTehranTime(day, "12:00"), locale).weekday;
  const after =
    busyMinutes(
      items.filter((i) => isBusy(i) && i.id !== item.id),
      day,
    ) +
    length / 60_000;
  const hours = (m: number) => localDigits(formatHours(m), locale);
  const limit = formatNumber(data.limits.day / 60, locale);
  const clashName = (c: CalendarItem) =>
    c.kind === "session"
      ? classTitle(c.session, locale)
      : c.slot.lead
        ? t("levelCheckTitle", { name: c.slot.lead.name })
        : t("openTitle");
  const serverError =
    state.status === "error"
      ? state.error === "clash"
        ? state.clash
          ? t("clash", {
              name: busyTitle(state.clash, locale, tc("levelCheck")),
              time: formatTime(new Date(state.clash.startsAt), locale),
            })
          : t("errors.clashGeneric")
        : t(
            `errors.${(state.error ?? Object.values(state.fieldErrors ?? {})[0] ?? "time") as "time"}`,
          )
      : null;

  return (
    <Modal title={title} description={when} closeLabel={t("close")} onClose={onClose}>
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="sessionId" value={item.id} />
        <input type="hidden" name="date" value={day} />
        <input type="hidden" name="time" value={start === null ? "" : formatClock(start)} />
        {serverError && <ErrorAlert>{serverError}</ErrorAlert>}
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-bold text-ocean">{t("newDay")}</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 }, (_, i) => addDays(data.start, i)).map((key) => {
              const parts = formatDayParts(fromTehranTime(key, "12:00"), locale);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={key === day}
                  disabled={key < data.today}
                  onClick={() => setDay(key)}
                  className="flex min-h-13 flex-col items-center justify-center rounded-xl border border-line/50 bg-white text-sm leading-tight font-bold text-ocean disabled:cursor-not-allowed disabled:opacity-35 aria-pressed:border-ocean aria-pressed:bg-ocean aria-pressed:text-white"
                >
                  {parts.weekday}
                  <small className="text-[11px] font-semibold opacity-80">{parts.day}</small>
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 items-end gap-3">
          <TimeInput
            label={t("startTime")}
            value={time}
            onChange={setTime}
            invalid={!!time && start === null}
          />
          <p className="flex h-12 items-center rounded-2xl bg-surface px-4 font-bold">
            {t("until", { time: to ? formatTime(to, locale) : "—" })}
          </p>
        </div>
        {time && start === null ? (
          <Note tone="bad">{t("errors.time")}</Note>
        ) : past ? (
          <Note tone="bad">{t("errors.past")}</Note>
        ) : clash ? (
          <Note tone="bad">
            {t("clash", { name: clashName(clash), time: formatTime(clash.startsAt, locale) })}
          </Note>
        ) : from && after > data.limits.day ? (
          <Note tone="warn">{t("dayOver", { day: dayName, used: hours(after), limit })}</Note>
        ) : from ? (
          <Note tone="ok">{t("free", { day: dayName, used: hours(after), limit })}</Note>
        ) : null}
        <div className={`${footer} justify-end`}>
          <button
            type="button"
            onClick={() => onSelect({ type: "item", item })}
            className={buttonClass("ghost")}
          >
            {t("back")}
          </button>
          {from && !clash && !past ? (
            <SubmitButton pendingLabel={t("moving")} className="w-auto">
              {t("confirmMove")}
            </SubmitButton>
          ) : (
            <button type="button" disabled className={buttonClass("primary", "opacity-50")}>
              {t("confirmMove")}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

/** Opens a new level-check time on one day; it shows on the landing page until it's booked. */
function AddSlot({ day, data, items, onClose }: Props & { day: string }) {
  const t = useTranslations("Admin.schedule");
  const locale = useLocale() as Locale;
  const [time, setTime] = useState("");
  const [state, action] = useActionState(
    async (prev: FormState, form: FormData) => {
      const next = await addSlotAction(prev, form);
      if (next.status === "success") onClose();
      return next;
    },
    { status: "idle" },
  );
  const start = parseClock(time);
  const from = start === null ? null : fromTehranTime(day, formatClock(start));
  const to = from && new Date(from.getTime() + LEVEL_CHECK_MINUTES * 60_000);
  const clash = from && to ? clashOn(items, from, to) : undefined;
  const past = !!from && from <= data.now;
  const serverError =
    state.status === "error"
      ? t(
          `errors.${(state.error ?? Object.values(state.fieldErrors ?? {})[0] ?? "time") as "time"}`,
        )
      : null;
  const clashName = (c: CalendarItem) =>
    c.kind === "session"
      ? classTitle(c.session, locale)
      : c.slot.lead
        ? t("levelCheckTitle", { name: c.slot.lead.name })
        : t("openTitle");

  return (
    <Modal
      title={t("newSlotTitle")}
      description={formatDate(fromTehranTime(day, "12:00"), locale, { year: false })}
      closeLabel={t("close")}
      onClose={onClose}
    >
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="date" value={day} />
        <input type="hidden" name="time" value={start === null ? "" : formatClock(start)} />
        {serverError && <ErrorAlert>{serverError}</ErrorAlert>}
        <div className="grid grid-cols-2 items-end gap-3">
          <TimeInput
            label={t("startTime")}
            value={time}
            onChange={setTime}
            invalid={!!time && start === null}
          />
          <p className="flex h-12 items-center rounded-2xl bg-surface px-4 font-bold">
            {t("lengthUntil", {
              minutes: LEVEL_CHECK_MINUTES,
              time: to ? formatTime(to, locale) : "—",
            })}
          </p>
        </div>
        {time && start === null ? (
          <Note tone="bad">{t("errors.time")}</Note>
        ) : past ? (
          <Note tone="bad">{t("errors.past")}</Note>
        ) : clash ? (
          <Note tone="bad">
            {t("clash", { name: clashName(clash), time: formatTime(clash.startsAt, locale) })}
          </Note>
        ) : null}
        <p className="text-sm text-body">{t("addHint")}</p>
        <div className={`${footer} justify-end`}>
          <button type="button" onClick={onClose} className={buttonClass("ghost")}>
            {t("back")}
          </button>
          {from && !clash && !past ? (
            <SubmitButton pendingLabel={t("adding")} className="w-auto">
              {t("addConfirm")}
            </SubmitButton>
          ) : (
            <button type="button" disabled className={buttonClass("primary", "opacity-50")}>
              {t("addConfirm")}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

/** Gives an open time to someone waiting, or to a new person; or removes the time. */
function AssignSlot({
  item,
  data,
  onClose,
}: Props & { item: Extract<CalendarItem, { kind: "levelCheck" }> }) {
  const t = useTranslations("Admin.schedule");
  const levels = useTranslations("Landing.booking.levels");
  const locale = useLocale() as Locale;
  const when = useWhen(item);
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [state, action, pending] = useActionState(
    async (prev: FormState, form: FormData) => {
      const next = await assignSlotAction(prev, form);
      if (next.status === "success") onClose();
      return next;
    },
    { status: "idle" },
  );
  const q = toLatinDigits(query.trim()).toLowerCase();
  const shown = data.leads.filter(
    (l) =>
      !q ||
      l.name.toLowerCase().includes(q) ||
      formatPhone(l.phone).replace(/\s/g, "").includes(q.replace(/\s/g, "")),
  );
  const chosen = data.leads.find((l) => l.id === pick);
  const isNew = pick === "new";
  const err = (field: string) =>
    state.fieldErrors?.[field] ? t(`errors.${state.fieldErrors[field] as "name"}`) : undefined;
  const formError =
    state.status === "error" && state.error ? t(`errors.${state.error as "lead"}`) : null;
  const ready = !!chosen || (isNew && name.trim().length >= 2);
  const option =
    "flex min-h-13 w-full items-center gap-3 rounded-2xl border border-mist bg-white px-3 py-1.5 text-start text-ocean aria-checked:border-brand aria-checked:bg-surface aria-checked:ring-1 aria-checked:ring-brand";
  const ahead = item.startsAt > data.now;

  return (
    <Modal title={t("openTitle")} description={when} closeLabel={t("close")} onClose={onClose}>
      {ahead && (
        <form id="assign" action={action} className="space-y-3" noValidate>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slotId" value={item.id} />
          {chosen && <input type="hidden" name="leadId" value={chosen.id} />}
          {formError && <ErrorAlert>{formError}</ErrorAlert>}
          <p className="font-extrabold text-ocean">{t("assignWho")}</p>
          <input
            type="search"
            aria-label={t("search")}
            placeholder={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full rounded-xl border border-line/60 px-3 text-ocean outline-none focus:border-brand"
          />
          <div
            role="radiogroup"
            aria-label={t("candidates")}
            className="flex max-h-60 flex-col gap-1.5 overflow-y-auto"
          >
            {shown.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={pick === l.id}
                onClick={() => setPick(l.id)}
                className={option}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mist font-black text-brand">
                  {l.name.slice(0, 1)}
                </span>
                <span className="flex-1 leading-snug">
                  <span className="block font-bold">{l.name}</span>
                  <small className="text-xs text-body">
                    {t(`leadStatus.${l.status}`)} · {levels(l.levelGuess)} ·{" "}
                    <bdi>{localDigits(formatPhone(l.phone), locale)}</bdi>
                  </small>
                </span>
              </button>
            ))}
            {data.leads.length === 0 && <p className="text-sm text-body">{t("noCandidates")}</p>}
            <button
              type="button"
              role="radio"
              aria-checked={isNew}
              onClick={() => setPick("new")}
              className={option}
            >
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-[#fdf3dc] text-[#8a520e]"
              >
                <Plus size={18} weight="bold" />
              </span>
              <span className="flex-1 leading-snug">
                <span className="block font-bold">{t("newPerson")}</span>
                <small className="text-xs text-body">{t("newPersonHint")}</small>
              </span>
            </button>
          </div>
          {isNew && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={t("name")}
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                error={err("name")}
              />
              <Field
                label={t("phone")}
                name="phone"
                type="tel"
                dir="ltr"
                inputMode="tel"
                placeholder={t("phonePlaceholder")}
                autoComplete="off"
                defaultValue={state.values?.phone}
                error={err("phone")}
              />
            </div>
          )}
        </form>
      )}
      <div className={`${footer} justify-between`}>
        <form
          action={async (form) => {
            await removeSlotAction(form);
            onClose();
          }}
        >
          <input type="hidden" name="slotId" value={item.id} />
          <SubmitButton
            variant="ghost"
            pendingLabel={t("removeSlot")}
            className="w-auto border-red-200 text-red-700 hover:bg-red-50"
          >
            {t("removeSlot")}
          </SubmitButton>
        </form>
        {ahead &&
          (ready ? (
            <button type="submit" form="assign" disabled={pending} className={buttonClass("ocean")}>
              {pending
                ? t("assigning")
                : t("assignFor", { name: chosen ? chosen.name : name.trim() })}
            </button>
          ) : (
            <button type="button" disabled className={buttonClass("ocean", "opacity-50")}>
              {t("assign")}
            </button>
          ))}
      </div>
    </Modal>
  );
}
