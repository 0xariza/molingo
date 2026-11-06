"use client";

import { Clock } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { AttachmentPicker } from "@/components/homework/attachment-picker";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, TextareaField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Locale } from "@/i18n/routing";
import { tehranClock, tehranDateKey } from "@/lib/format";
import { learnerNames } from "@/lib/names";
import { assignHomeworkAction, type HomeworkFormState } from "@/server/homework/actions";
import type { AfterClass, SessionHomework } from "@/server/homework/after-class";
import { HOMEWORK_TYPES, type HomeworkType } from "@/server/homework/types";
import { TYPE_LOOK } from "@/components/homework/homework-types";

const initial: HomeworkFormState = { status: "idle" };
const HOUR = 60 * 60 * 1000;

/** The default deadline: an hour before the class next meets (none when nothing is scheduled). */
const defaultDue = (next: Date | null) => {
  const before = next && new Date(next.getTime() - HOUR);
  return before
    ? { date: tehranDateKey(before), time: tehranClock(before), suggested: true }
    : { date: "", time: "", suggested: false };
};

/**
 * One homework item of a held session, new or being edited. It goes out when saved: to the whole
 * class, or to chosen learners. A skill of the session's station can be named.
 */
export function HomeworkEditor({
  page,
  item,
  onDone,
}: {
  page: AfterClass;
  item: SessionHomework | null;
  onDone: () => void;
}) {
  const t = useTranslations("Admin.homework.assignDialog");
  const te = useTranslations("Admin.homework.errors");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(async (prev: HomeworkFormState, form: FormData) => {
    const next = await assignHomeworkAction(prev, form);
    if (next.status === "success") onDone();
    return next;
  }, initial);

  const [type, setType] = useState<HomeworkType>(item?.type ?? "listening");
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [toAll, setToAll] = useState(item ? item.all : true);
  const [chosen, setChosen] = useState<string[]>(item && !item.all ? item.recipientIds : []);
  const [skill, setSkill] = useState(item?.skillId ?? "");
  const [due, setDue] = useState(() =>
    item
      ? item.dueAt
        ? { date: tehranDateKey(item.dueAt), time: tehranClock(item.dueAt), suggested: false }
        : { date: "", time: "", suggested: false }
      : defaultDue(page.nextStartsAt),
  );
  const [ai, setAi] = useState({ request: "", error: "", busy: false });
  const group = page.learners.length > 1;
  const count = toAll || !group ? page.learners.length : chosen.length;
  const err = (k: string) => state.fieldErrors?.[k] && te(state.fieldErrors[k] as "title");

  async function draft() {
    setAi((a) => ({ ...a, busy: true, error: "" }));
    try {
      const res = await fetch("/api/homework/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: page.sessionId, type, request: ai.request }),
      });
      if (!res.ok || !res.body) {
        const { error } = await res.json().catch(() => ({ error: "ai_failed" }));
        throw new Error(error);
      }
      // The first line is the title, the rest (after the blank line) the instructions.
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let text = "";
      for (let part = await reader.read(); !part.done; part = await reader.read()) {
        text += part.value;
        const [first, ...rest] = text.split("\n");
        setTitle(first);
        setBody(rest.join("\n").trimStart());
      }
    } catch (e) {
      setAi((a) => ({ ...a, error: e instanceof Error ? e.message : "ai_failed" }));
    } finally {
      setAi((a) => ({ ...a, busy: false }));
    }
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="sessionId" value={page.sessionId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="type" value={type} />
      {group &&
        !toAll &&
        chosen.map((id) => <input key={id} type="hidden" name="studentIds" value={id} />)}
      {state.status === "error" && state.error && (
        <ErrorAlert>{te(state.error as "not_held")}</ErrorAlert>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold text-ocean">{t("type")}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {HOMEWORK_TYPES.map((k) => {
            const Icon = TYPE_LOOK[k].icon;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={type === k}
                onClick={() => setType(k)}
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-line bg-white font-bold text-body hover:border-brand aria-pressed:border-ocean aria-pressed:bg-ocean aria-pressed:text-white"
              >
                <Icon aria-hidden size={22} />
                {t(`types.${k}`)}
              </button>
            );
          })}
        </div>
        <p className="rounded-2xl bg-surface px-4 py-2.5 text-sm text-ocean">
          {t(`typeHint.${type}`)}
        </p>
      </fieldset>

      <div className="space-y-2 rounded-2xl bg-surface p-4">
        <Field
          label={t("aiRequest")}
          name="aiRequest"
          value={ai.request}
          maxLength={500}
          onChange={(e) => setAi((a) => ({ ...a, request: e.target.value }))}
          hint={t("aiHint")}
        />
        {ai.error && <ErrorAlert>{te(ai.error as "ai_failed")}</ErrorAlert>}
        <button
          type="button"
          onClick={draft}
          disabled={ai.busy || !ai.request.trim()}
          className={buttonClass("ghost")}
        >
          {ai.busy ? t("aiWorking") : t("aiButton")}
        </button>
      </div>

      <Field
        label={t("titleLabel")}
        name="title"
        dir="auto"
        error={err("title")}
        maxLength={120}
        required
        value={title}
        placeholder={t(`defaultTitle.${type}`)}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !title.trim() && setTitle(t(`defaultTitle.${type}`))}
      />
      <TextareaField
        label={t("body")}
        name="body"
        dir="auto"
        rows={4}
        error={err("body")}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <div className="space-y-2">
        <p className="text-sm font-bold text-ocean">
          {t("attachLabel")}{" "}
          <span className="font-normal text-body">{t(`attachNeed.${type}`)}</span>
        </p>
        <AttachmentPicker kept={item?.files.map((f) => ({ id: f.id, name: f.name })) ?? []} />
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        {group && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-ocean">{t("for")}</legend>
            <label className="flex min-h-touch items-center gap-2.5 font-semibold text-ocean">
              <input
                type="radio"
                name="who"
                checked={toAll}
                onChange={() => setToAll(true)}
                className="size-5 accent-brand"
              />
              {t("everyone", { count: page.learners.length })}
            </label>
            <label className="flex min-h-touch items-center gap-2.5 font-semibold text-ocean">
              <input
                type="radio"
                name="who"
                checked={!toAll}
                onChange={() => setToAll(false)}
                className="size-5 accent-brand"
              />
              {t("chosen")}
            </label>
            {!toAll && (
              <ul className="space-y-1 ps-7">
                {page.learners.map((l) => (
                  <li key={l.id}>
                    <label className="flex min-h-10 items-center gap-2.5 text-ocean">
                      <input
                        type="checkbox"
                        checked={chosen.includes(l.id)}
                        onChange={(e) =>
                          setChosen(
                            e.target.checked ? [...chosen, l.id] : chosen.filter((x) => x !== l.id),
                          )
                        }
                        className="size-5 accent-brand"
                      />
                      {learnerNames(l, locale).primary}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        )}
        <div className="space-y-2">
          <DatePicker
            label={`${t("due")} ${t("optional")}`}
            name="dueDate"
            value={due.date}
            onChange={(date) => setDue((d) => ({ ...d, date, suggested: false }))}
            allowed={(key) => key >= tehranDateKey(new Date())}
            placeholder={t("pickDate")}
            error={err("dueDate")}
            hint={due.suggested ? t("dueHelp") : undefined}
          />
          <label htmlFor={`hw-due-time-${item?.id ?? "new"}`} className="sr-only">
            {t("dueTime")}
          </label>
          <div className="flex h-12 items-center gap-2 rounded-2xl border-[1.5px] border-line bg-white px-3 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
            <Clock aria-hidden size={18} className="shrink-0 text-body" />
            <input
              id={`hw-due-time-${item?.id ?? "new"}`}
              name="dueTime"
              inputMode="numeric"
              dir="ltr"
              maxLength={5}
              placeholder="18:00"
              value={due.time}
              onChange={(e) => setDue((d) => ({ ...d, time: e.target.value, suggested: false }))}
              className="min-w-0 flex-1 bg-transparent text-center font-bold text-ocean outline-none"
            />
          </div>
          {(due.date || due.time) && (
            <button
              type="button"
              onClick={() => setDue({ date: "", time: "", suggested: false })}
              className="min-h-touch font-bold text-brand hover:underline"
            >
              {t("dueClear")}
            </button>
          )}
        </div>
      </div>

      {page.station && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-ocean">
            {t("skill")}{" "}
            <span className="font-normal text-body">
              {t("skillOptional", { n: page.station.position })}
            </span>
          </legend>
          <input type="hidden" name="stationSkillId" value={skill} />
          <div className="flex flex-wrap gap-2">
            {page.station.skills.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={skill === k.id}
                onClick={() => setSkill(skill === k.id ? "" : k.id)}
                className="min-h-10 rounded-pill border-[1.5px] border-line bg-white px-4 text-sm font-bold text-ocean hover:border-brand aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-white"
              >
                {k.text}
              </button>
            ))}
          </div>
          <p className="text-sm">{t("skillHint")}</p>
        </fieldset>
      )}

      <div className="flex flex-wrap justify-end gap-3 border-t border-mist pt-4">
        <button type="button" onClick={onDone} className={buttonClass("ghost")}>
          {t("cancel")}
        </button>
        <SubmitButton
          pendingLabel={t("sending")}
          blocked={group && !toAll && chosen.length === 0}
          className="w-full sm:w-auto"
        >
          {item ? t("save") : t("send", { count })}
        </SubmitButton>
      </div>
    </form>
  );
}
