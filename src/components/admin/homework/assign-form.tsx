"use client";

import { Clock } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { AttachmentPicker } from "@/components/homework/attachment-picker";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, TextareaField } from "@/components/ui/field";
import { SelectMenu } from "@/components/ui/select-menu";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, tehranClock, tehranDateKey } from "@/lib/format";
import { classTitle } from "@/lib/names";
import { assignHomeworkAction, type HomeworkFormState } from "@/server/homework/actions";
import type { AssignTarget } from "@/server/homework/assignments";

const initial: HomeworkFormState = { status: "idle" };
const HOUR = 60 * 60 * 1000;

/** The default deadline: an hour before the class next meets (none when nothing is scheduled). */
const defaultDue = (target: AssignTarget | undefined) => {
  const before = target?.nextStartsAt && new Date(target.nextStartsAt.getTime() - HOUR);
  return before
    ? { date: tehranDateKey(before), time: tehranClock(before), suggested: true }
    : { date: "", time: "", suggested: false };
};

/**
 * Homework for a held session. With `sessionId` (from a session's row on the class page) the
 * session is fixed; otherwise the teacher picks the class, then one of its held sessions.
 */
export function AssignForm({
  targets,
  sessionId,
}: {
  targets: AssignTarget[];
  sessionId?: string;
}) {
  const t = useTranslations("Admin.homework.assignDialog");
  const te = useTranslations("Admin.homework.errors");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [state, action] = useActionState(assignHomeworkAction, initial);
  const fixed = sessionId
    ? targets.find((c) => c.sessions.some((s) => s.id === sessionId))
    : undefined;
  const [classId, setClassId] = useState(fixed?.id ?? targets[0]?.id ?? "");
  const target = targets.find((c) => c.id === classId);
  const [picked, setPicked] = useState(sessionId ?? target?.sessions[0]?.id ?? "");
  const session = target?.sessions.find((s) => s.id === picked);
  const [due, setDue] = useState(() => defaultDue(target));
  const [draft, setDraft] = useState({ title: "", body: "", request: "", error: "" });
  const [drafting, setDrafting] = useState(false);
  const writeDraft = async () => {
    setDrafting(true);
    setDraft((d) => ({ ...d, error: "" }));
    try {
      const res = await fetch("/api/homework/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: picked, request: draft.request }),
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
        const [title, ...rest] = text.split("\n");
        setDraft((d) => ({ ...d, title, body: rest.join("\n").trimStart() }));
      }
    } catch (e) {
      setDraft((d) => ({ ...d, error: e instanceof Error ? e.message : "ai_failed" }));
    } finally {
      setDrafting(false);
    }
  };
  const err = (k: string) => state.fieldErrors?.[k] && te(state.fieldErrors[k] as "title");

  useEffect(() => {
    if (state.status === "success") router.push("/admin/homework");
  }, [state.status, router]);

  const name = target ? classTitle(target, locale) : "";
  const count = target?.learnerCount ?? 0;
  const when = (s: { startsAt: Date }) => formatDate(s.startsAt, locale, { year: false });

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-4xl sm:text-5xl">
          {session && fixed ? t("sessionTitle", { n: session.number }) : t("title")}
        </h1>
        {session && fixed && (
          <p className="mt-1">{t("sessionSub", { class: name, date: when(session), count })}</p>
        )}
      </div>
      {targets.length === 0 ? (
        <p>{t("noTargets")}</p>
      ) : (
        <form action={action} className="space-y-4">
          <input type="hidden" name="sessionId" value={picked} />
          {state.status === "error" && state.error && (
            <ErrorAlert>{te(state.error as "not_held")}</ErrorAlert>
          )}
          {!fixed && (
            <div
              role="group"
              aria-labelledby="hw-who"
              className="space-y-3 rounded-2xl bg-surface p-4"
            >
              <p id="hw-who" className="font-extrabold text-ocean">
                {t("who")}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectMenu
                  label={t("class")}
                  value={classId}
                  onChange={(id) => {
                    const next = targets.find((c) => c.id === id);
                    setClassId(id);
                    setPicked(next?.sessions[0]?.id ?? "");
                    setDue(defaultDue(next));
                  }}
                  options={targets.map((c) => ({
                    value: c.id,
                    label: t("classOption", { name: classTitle(c, locale), count: c.learnerCount }),
                  }))}
                />
                <SelectMenu
                  label={t("session")}
                  value={picked}
                  onChange={setPicked}
                  options={(target?.sessions ?? []).map((s, i) => ({
                    value: s.id,
                    label: `${t("sessionOption", { n: s.number, date: when(s) })}${i === 0 ? ` ${t("lastHeld")}` : ""}`,
                  }))}
                />
              </div>
              <p className="text-sm text-ocean">{t("goesTo", { count, class: name })}</p>
              <p className="text-sm">{t("onlyHeld")}</p>
            </div>
          )}
          <div className="space-y-2 rounded-2xl bg-surface p-4">
            <Field
              label={t("aiRequest")}
              name="aiRequest"
              value={draft.request}
              maxLength={500}
              onChange={(e) => setDraft((d) => ({ ...d, request: e.target.value }))}
              hint={t("aiHint")}
            />
            {draft.error && <ErrorAlert>{te(draft.error as "ai_failed")}</ErrorAlert>}
            <button
              type="button"
              onClick={writeDraft}
              disabled={drafting || !draft.request.trim() || !picked}
              className={buttonClass("ghost")}
            >
              {drafting ? t("aiWorking") : t("aiButton")}
            </button>
          </div>
          <Field
            label={t("titleLabel")}
            name="title"
            error={err("title")}
            maxLength={120}
            required
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <TextareaField
            label={t("body")}
            name="body"
            rows={4}
            error={err("body")}
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
          />
          <div className="grid items-start gap-3 sm:grid-cols-2">
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
            <div className="space-y-1.5">
              <label htmlFor="hw-due-time" className="block text-sm font-bold text-ocean">
                {t("dueTime")}
              </label>
              <div className="flex h-12 items-center gap-2 rounded-2xl border-[1.5px] border-line bg-white px-3 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
                <Clock aria-hidden size={18} className="shrink-0 text-body" />
                <input
                  id="hw-due-time"
                  name="dueTime"
                  inputMode="numeric"
                  dir="ltr"
                  maxLength={5}
                  placeholder="18:00"
                  value={due.time}
                  onChange={(e) =>
                    setDue((d) => ({ ...d, time: e.target.value, suggested: false }))
                  }
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
          <AttachmentPicker />
          <div className="flex justify-end gap-3 pt-2">
            <Link href="/admin/homework" className={buttonClass("ghost")}>
              {t("cancel")}
            </Link>
            <SubmitButton pendingLabel={t("sending")} className="">
              {t("submit", { count })}
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
