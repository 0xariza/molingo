"use client";

import { Clock } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { AttachmentPicker } from "@/components/homework/attachment-picker";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, TextareaField } from "@/components/ui/field";
import { SelectMenu } from "@/components/ui/select-menu";
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

  const [type, setType] = useState<HomeworkType>(item?.type ?? "writing");
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  // "all" or one learner's id.
  const [who, setWho] = useState(item && !item.all ? (item.recipientIds[0] ?? "all") : "all");
  const [skill, setSkill] = useState(item?.skillId ?? "");
  const suggested = defaultDue(page.nextStartsAt);
  const [dueMode, setDueMode] = useState<"suggested" | "custom" | "none">(
    item ? (item.dueAt ? "custom" : "none") : suggested.suggested ? "suggested" : "none",
  );
  const [custom, setCustom] = useState(
    item?.dueAt
      ? { date: tehranDateKey(item.dueAt), time: tehranClock(item.dueAt) }
      : { date: suggested.date, time: suggested.time },
  );
  const due =
    dueMode === "suggested" ? suggested : dueMode === "custom" ? custom : { date: "", time: "" };
  const [ai, setAi] = useState({ request: "", error: "", busy: false });
  const group = page.learners.length > 1;
  // Without a title the item is "type: description…".
  const fallback = body.trim()
    ? `${t(`types.${type}`)}: ${body.trim().slice(0, 40)}${body.trim().length > 40 ? "…" : ""}`
    : t(`types.${type}`);
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
    <form id="homework-form" action={action} className="space-y-5">
      <input type="hidden" name="sessionId" value={page.sessionId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="titleFallback" value={fallback} />
      <input type="hidden" name="dueDate" value={due.date} />
      <input type="hidden" name="dueTime" value={due.time} />
      {group && who !== "all" && <input type="hidden" name="studentIds" value={who} />}
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
        value={title}
        placeholder={fallback}
        hint={t("titleHint", { type: t(`types.${type}`) })}
        onChange={(e) => setTitle(e.target.value)}
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
        <AttachmentPicker
          kept={item?.files ?? []}
          recordLabel={type === "speaking" ? t("recordSample") : undefined}
        />
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        {group && (
          <SelectMenu
            label={t("for")}
            value={who}
            onChange={setWho}
            options={[
              { value: "all", label: t("everyone", { count: page.learners.length }) },
              ...page.learners.map((l) => ({
                value: l.id,
                label: learnerNames(l, locale).primary,
              })),
            ]}
          />
        )}
        <SelectMenu
          label={t("due")}
          value={dueMode}
          onChange={(v) => setDueMode(v as typeof dueMode)}
          options={[
            { value: "suggested", label: t("dueSuggested"), disabled: !suggested.suggested },
            { value: "custom", label: t("dueCustom") },
            { value: "none", label: t("dueNone") },
          ]}
        />
      </div>
      {dueMode === "custom" && (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <DatePicker
            label={t("dueDate")}
            value={custom.date}
            onChange={(date) => setCustom((c) => ({ ...c, date }))}
            allowed={(key) => key >= tehranDateKey(new Date())}
            placeholder={t("pickDate")}
            error={err("dueDate")}
          />
          <label className="block space-y-1.5">
            <span className="block text-sm font-bold text-ocean">{t("dueTime")}</span>
            <span className="flex h-12 items-center gap-2 rounded-2xl border-[1.5px] border-line bg-white px-3 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
              <Clock aria-hidden size={18} className="shrink-0 text-body" />
              <input
                inputMode="numeric"
                dir="ltr"
                maxLength={5}
                placeholder="18:00"
                value={custom.time}
                onChange={(e) => setCustom((c) => ({ ...c, time: e.target.value }))}
                className="min-w-0 flex-1 bg-transparent text-ocean outline-none"
              />
            </span>
          </label>
        </div>
      )}

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
          <p className="text-sm">{skill ? t("skillHint") : t("skillNoneHint")}</p>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-mist pt-4">
        <button type="button" onClick={onDone} className={buttonClass("quiet")}>
          {t("close")}
        </button>
        <SubmitButton pendingLabel={t("savingItem")} className="w-full sm:w-auto">
          {t("saveItem")}
        </SubmitButton>
      </div>
    </form>
  );
}
