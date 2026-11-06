import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AssessmentBuilder } from "@/components/admin/assessment/builder";
import { BackLink } from "@/components/admin/learners/back-link";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireTeacher } from "@/server/auth/current";
import {
  markAnswerAction,
  openAssessmentAction,
  publishResultAction,
} from "@/server/assessments/actions";
import { assessmentReview, getAssessment } from "@/server/assessments/assessments";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.assessment");
  return { title: t("metaTitle") };
}

export default function AssessmentPage({
  params,
}: PageProps<"/[locale]/admin/sessions/[id]/assessment">) {
  return (
    <div className="max-w-3xl space-y-5">
      <Suspense
        fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
      >
        <AssessmentView params={params} />
      </Suspense>
    </div>
  );
}

const card = "space-y-4 rounded-card border border-hairline bg-white p-6";
const heading = "font-sans text-lg font-extrabold normal-case tracking-normal";

async function AssessmentView({ params }: { params: Promise<{ id: string }> }) {
  const { teacherId } = await requireTeacher();
  const { id } = await params;
  const valid = z.uuid().safeParse(id);
  const [t, data] = await Promise.all([
    getTranslations("Admin.assessment"),
    valid.success ? getAssessment(teacherId, valid.data) : null,
  ]);
  if (!data || !valid.success) notFound();
  const { assessment, questions } = data;
  const review = assessment ? await assessmentReview(teacherId, valid.data) : null;

  return (
    <>
      <BackLink href={`/admin/sessions/${valid.data}`} label={t("back")} />
      <h1 className="text-4xl sm:text-5xl">
        {t(data.kind === "stage" ? "kindStage" : "kindFinal")}
      </h1>

      <section aria-labelledby="build-title" className={card}>
        <div>
          <h2 id="build-title" className={heading}>
            {t("build")}
          </h2>
          <p className="text-sm">{t("buildHint")}</p>
        </div>
        <AssessmentBuilder
          sessionId={valid.data}
          minutes={assessment?.minutes ?? 30}
          locked={data.started}
          questions={questions.map((q) => ({
            section: q.section,
            kind: q.kind,
            prompt: q.prompt,
            points: q.points,
            options: q.options,
            correctIndex: q.correctIndex,
            acceptedAnswers: q.acceptedAnswers,
          }))}
        />
      </section>

      {assessment && (
        <section aria-labelledby="open-title" className={card}>
          <div>
            <h2 id="open-title" className={heading}>
              {t("open")} · {t(assessment.openedAt ? "opened" : "closed")}
            </h2>
            <p className="text-sm">{t("openHint")}</p>
          </div>
          <form action={openAssessmentAction}>
            <input type="hidden" name="sessionId" value={valid.data} />
            <input type="hidden" name="open" value={assessment.openedAt ? "0" : "1"} />
            <SubmitButton pendingLabel={t("saving")} className="">
              {t(assessment.openedAt ? "closeNow" : "openNow")}
            </SubmitButton>
          </form>
        </section>
      )}

      {review && (
        <section aria-labelledby="review-title" className={card}>
          <h2 id="review-title" className={heading}>
            {t("review")}
          </h2>
          {review.learners.length === 0 && <p>{t("noAnswers")}</p>}
          {review.learners.map((l) => (
            <article key={l.studentId} className="space-y-3 border-t border-hairline pt-4">
              <h3 className="font-bold text-ocean" dir="auto">
                {t("answerOf", { name: l.fullNameFa, score: l.score, max: review.max })}
                {" · "}
                {l.publishedAt
                  ? t("sent")
                  : l.submittedAt
                    ? l.unmarked
                      ? t("unmarked", { n: l.unmarked })
                      : t("submittedState")
                    : t("startedState")}
              </h3>
              {l.submittedAt &&
                review.questions.map((q) => {
                  const a = l.answers.find((x) => x.questionId === q.id);
                  return (
                    <div key={q.id} className="space-y-2">
                      <p dir="auto" className="font-semibold text-ocean">
                        {q.prompt}
                      </p>
                      <p dir="auto">
                        {t("given")}:{" "}
                        {q.kind === "mc"
                          ? (q.options?.[a?.choice ?? -1] ?? t("none"))
                          : (a?.text ?? t("none"))}
                        {" · "}
                        {a?.score ?? "—"}/{q.points}
                      </p>
                      {q.kind === "essay" && !l.publishedAt && (
                        <form action={markAnswerAction} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="questionId" value={q.id} />
                          <input type="hidden" name="studentId" value={l.studentId} />
                          <label className="text-sm font-bold text-ocean">
                            {t("scoreLabel", { max: q.points })}
                            <input
                              name="score"
                              type="number"
                              min={0}
                              max={q.points}
                              defaultValue={a?.score ?? ""}
                              className="ms-2 min-h-11 w-20 rounded-lg border border-line px-2"
                            />
                          </label>
                          <SubmitButton pendingLabel={t("saving")} className="" variant="ghost">
                            {t("mark")}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  );
                })}
              {l.submittedAt && !l.publishedAt && (
                <form action={publishResultAction} className="space-y-2">
                  <input type="hidden" name="assessmentId" value={review.assessmentId} />
                  <input type="hidden" name="studentId" value={l.studentId} />
                  <label className="block text-sm font-bold text-ocean">
                    {t("feedback")}
                    <textarea
                      name="feedback"
                      dir="auto"
                      rows={3}
                      defaultValue={l.feedback ?? ""}
                      className="mt-1 w-full rounded-lg border border-line p-3"
                    />
                  </label>
                  <SubmitButton pendingLabel={t("saving")} blocked={l.unmarked > 0} className="">
                    {t("sendResult")}
                  </SubmitButton>
                  {l.unmarked > 0 && <p className="text-sm">{t("sendHint")}</p>}
                </form>
              )}
            </article>
          ))}
        </section>
      )}
    </>
  );
}
