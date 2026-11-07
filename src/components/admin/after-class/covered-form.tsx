"use client";

import { X } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { TextareaField } from "@/components/ui/field";
import { saveCoveredAction, type HomeworkFormState } from "@/server/homework/actions";
import type { AfterClass } from "@/server/homework/after-class";

const initial: HomeworkFormState = { status: "idle" };

/** Part 1 of the after-class page: the station skills worked on, topics, summary, private note. */
export function CoveredForm({ page }: { page: AfterClass }) {
  const t = useTranslations("Admin.afterClass");
  const te = useTranslations("Admin.homework.errors");
  const [state, action] = useActionState(saveCoveredAction, initial);
  const [skills, setSkills] = useState(
    page.station?.skills.filter((k) => k.worked).map((k) => k.id) ?? [],
  );
  const [topics, setTopics] = useState(page.topics);
  const [draft, setDraft] = useState("");
  const addTopic = () => {
    const topic = draft.trim();
    if (topic && !topics.includes(topic)) setTopics([...topics, topic]);
    setDraft("");
  };
  const heading = "text-sm font-bold text-ocean";

  return (
    <form id="covered-form" action={action} className="space-y-5">
      <input type="hidden" name="sessionId" value={page.sessionId} />
      {skills.map((id) => (
        <input key={id} type="hidden" name="skillIds" value={id} />
      ))}
      {topics.map((topic) => (
        <input key={topic} type="hidden" name="topics" value={topic} />
      ))}
      {state.status === "error" && (
        <ErrorAlert>{te((state.error ?? "body") as "not_held")}</ErrorAlert>
      )}

      {page.station && (
        <fieldset className="space-y-2">
          <legend className={heading}>
            {t("skills")}{" "}
            <span className="font-normal text-body">
              {t("skillsStation", { n: page.station.position })}
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {page.station.skills.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={skills.includes(k.id)}
                onClick={() =>
                  setSkills(
                    skills.includes(k.id) ? skills.filter((x) => x !== k.id) : [...skills, k.id],
                  )
                }
                className="min-h-10 rounded-pill border-[1.5px] border-line bg-white px-4 text-sm font-bold text-ocean hover:border-brand aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-white"
              >
                {k.text}
              </button>
            ))}
          </div>
          <p className="text-sm">
            {t("skillsCount", { n: skills.length, total: page.station.skills.length })}
          </p>
        </fieldset>
      )}

      <div className="space-y-2">
        <label htmlFor="topic-new" className={`block ${heading}`}>
          {t("topics")}
        </label>
        {topics.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {topics.map((topic) => (
              <li
                key={topic}
                className="inline-flex min-h-9 items-center gap-1 rounded-pill bg-mist ps-3.5 font-semibold text-ocean"
              >
                <span dir="auto">{topic}</span>
                <button
                  type="button"
                  aria-label={t("removeTopic", { topic })}
                  onClick={() => setTopics(topics.filter((x) => x !== topic))}
                  className="grid size-9 place-items-center rounded-full hover:bg-white"
                >
                  <X aria-hidden size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex h-12 items-center gap-2 rounded-2xl border-[1.5px] border-line bg-white ps-4 pe-2 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
          <input
            id="topic-new"
            value={draft}
            maxLength={80}
            dir="auto"
            placeholder={t("topicPlaceholder")}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTopic();
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-ocean outline-none"
          />
          <button
            type="button"
            onClick={addTopic}
            disabled={!draft.trim() || topics.length >= 12}
            className="min-h-10 rounded-pill px-3 font-bold text-brand hover:bg-surface disabled:opacity-50"
          >
            {t("addTopic")}
          </button>
        </div>
      </div>

      <TextareaField
        label={`${t("summary")} ${t("optional")}`}
        name="summary"
        rows={3}
        maxLength={2000}
        defaultValue={page.summary ?? ""}
      />
      <TextareaField
        label={t("privateNote")}
        hint={t("privateNoteHint")}
        name="privateNote"
        rows={2}
        maxLength={2000}
        defaultValue={page.privateNote ?? ""}
      />

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-mist pt-4">
        {state.status === "success" && (
          <p role="status" className="me-auto font-bold text-brand">
            {t("saved")}
          </p>
        )}
      </div>
    </form>
  );
}
