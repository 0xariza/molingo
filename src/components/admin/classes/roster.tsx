"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ErrorAlert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber } from "@/lib/format";
import { learnerNames } from "@/lib/names";
import {
  endEnrollmentAction,
  moveLearnerAction,
  type ClassFormState,
} from "@/server/classes/actions";
import { AddLearnerPicker } from "./add-learner-button";
import type { Candidate } from "./learner-picker-items";

type Person = { id: string; fullNameFa: string; fullNameEn: string | null };
export type MoveTarget = {
  id: string;
  name: string;
  level: string;
  schedule: string;
  free: number;
};

const initial: ClassFormState = { status: "idle" };
const rowButton =
  "min-h-10 rounded-pill border border-line/50 px-3.5 text-sm font-bold hover:border-brand";

/** Who's in the class: end a place, move someone, or add a learner while seats are free. */
export function Roster({
  classId,
  className,
  capacity,
  canAdd,
  running,
  learners,
  candidates,
  targets,
}: {
  classId: string;
  className: string;
  capacity: number;
  canAdd: boolean;
  running: boolean;
  learners: (Person & { since: Date })[];
  candidates: Candidate[];
  targets: MoveTarget[];
}) {
  const t = useTranslations("Admin.classes");
  const locale = useLocale() as Locale;
  const n = (v: number) => formatNumber(v, locale);
  const [moving, setMoving] = useState<Person | null>(null);
  const nameOf = (p: Person) => learnerNames(p, locale).primary;

  return (
    <section
      aria-labelledby="roster-title"
      className="space-y-4 rounded-[1.75rem] border border-line/40 bg-white p-6"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="roster-title"
          className="font-sans text-lg font-extrabold normal-case tracking-normal"
        >
          {t("detail.learners")}
        </h2>
        <strong className="text-ocean">
          {t("detail.seats", { taken: n(learners.length), capacity: n(capacity) })}
        </strong>
      </div>
      <div aria-hidden="true" className="flex gap-1">
        {Array.from({ length: capacity }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-sm ${i < learners.length ? "bg-brand" : "bg-mist"}`}
          />
        ))}
      </div>
      {learners.length === 0 ? (
        <p>{t("detail.noLearners")}</p>
      ) : (
        <ul className="divide-y divide-mist">
          {learners.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-mist font-extrabold text-brand"
              >
                {nameOf(p).slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1 leading-snug">
                <Link
                  href={`/admin/students/${p.id}`}
                  className="font-bold text-ocean hover:underline"
                >
                  {nameOf(p)}
                </Link>
                <p className="text-sm">
                  {t("detail.since", {
                    date: formatDate(p.since, locale, { weekday: false, year: false }),
                  })}
                </p>
              </div>
              {running && (
                <>
                  <button
                    type="button"
                    onClick={() => setMoving(p)}
                    aria-label={t("detail.moveLabel", { name: nameOf(p) })}
                    className={rowButton}
                  >
                    {t("detail.move")}
                  </button>
                  <form action={endEnrollmentAction}>
                    <input type="hidden" name="classId" value={classId} />
                    <input type="hidden" name="studentId" value={p.id} />
                    <button
                      type="submit"
                      aria-label={t("detail.endLabel", { name: nameOf(p) })}
                      className={rowButton}
                    >
                      {t("detail.end")}
                    </button>
                  </form>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {running && (
        <div className="border-t border-mist pt-4">
          {canAdd ? (
            <>
              <AddLearnerPicker
                classId={classId}
                candidates={candidates}
                inClass={learners.map((l) => l.id)}
              />
              <p className="mt-2 text-sm">{t("detail.addHint")}</p>
            </>
          ) : (
            <p className="rounded-2xl bg-surface px-4 py-3 text-sm">{t("detail.full")}</p>
          )}
        </div>
      )}
      {moving && (
        <MoveDialog
          classId={classId}
          fromName={className}
          person={moving}
          name={nameOf(moving)}
          targets={targets}
          onClose={() => setMoving(null)}
        />
      )}
    </section>
  );
}

function MoveDialog({
  classId,
  fromName,
  person,
  name,
  targets,
  onClose,
}: {
  classId: string;
  fromName: string;
  person: Person;
  name: string;
  targets: MoveTarget[];
  onClose: () => void;
}) {
  const t = useTranslations("Admin.classes");
  const [to, setTo] = useState("");
  const [state, action] = useActionState(async (prev: ClassFormState, form: FormData) => {
    const next = await moveLearnerAction(prev, form);
    if (next.status === "success") onClose();
    return next;
  }, initial);

  return (
    <Modal
      title={t("move.title", { name })}
      description={t("move.lead", { from: fromName })}
      closeLabel={t("close")}
      onClose={onClose}
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="classId" value={classId} />
        <input type="hidden" name="studentId" value={person.id} />
        <input type="hidden" name="toClassId" value={to} />
        {state.error && <ErrorAlert>{t(`errors.${state.error as "full"}`)}</ErrorAlert>}
        {targets.length === 0 ? (
          <p>{t("move.none")}</p>
        ) : (
          <div role="radiogroup" aria-label={t("move.pick")} className="space-y-2">
            {targets.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={to === c.id}
                disabled={c.free === 0}
                onClick={() => setTo(c.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-mist bg-white px-3 py-2.5 text-start aria-checked:border-brand aria-checked:bg-surface aria-checked:ring-1 aria-checked:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span
                  dir="ltr"
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-ocean text-sm font-extrabold text-white"
                >
                  {c.level}
                </span>
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="block font-bold text-ocean">{c.name}</span>
                  <span className="text-sm">{c.schedule}</span>
                </span>
                <span className="rounded-pill bg-mist px-2.5 text-xs font-bold text-brand">
                  {c.free ? t("move.free", { count: c.free }) : t("move.full")}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-3 border-t border-mist pt-4">
          <button type="button" onClick={onClose} className={buttonClass("ghost")}>
            {t("form.cancel")}
          </button>
          {targets.length > 0 && (
            <SubmitButton pendingLabel={t("move.saving")} className="w-full sm:w-auto">
              {t("move.confirm")}
            </SubmitButton>
          )}
        </div>
      </form>
    </Modal>
  );
}
