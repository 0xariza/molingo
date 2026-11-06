import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AssessmentForm } from "@/components/student/assessment-form";
import { requireStudent } from "@/server/auth/current";
import { learnerResult, startAssessment } from "@/server/assessments/assessments";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Student.assessment");
  return { title: t("metaTitle") };
}

export default function LearnerAssessmentPage({
  params,
}: PageProps<"/[locale]/app/assessment/[id]">) {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-64 animate-pulse rounded-card bg-mist" />}
    >
      <Assessment params={params} />
    </Suspense>
  );
}

async function Assessment({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  const { id } = await params;
  const valid = z.uuid().safeParse(id);
  if (!valid.success) notFound();
  const t = await getTranslations("Student.assessment");
  const result = await learnerResult(user.id, valid.data);
  if (result)
    return (
      <div className="space-y-5">
        <h1 className="text-4xl sm:text-5xl">{t("resultReady")}</h1>
        <p className="text-2xl font-extrabold text-ocean">
          {t("total", { score: result.score, max: result.max })}
        </p>
        <ul className="space-y-1">
          {result.sections.map((s) => (
            <li key={s.section} className="flex justify-between">
              <span>{t(`sections.${s.section as "reading"}`)}</span>
              <span>{t("total", { score: s.score, max: s.max })}</span>
            </li>
          ))}
        </ul>
        {result.feedback && (
          <section className="space-y-1 rounded-card border border-hairline bg-white p-5">
            <h2 className="font-sans text-lg font-extrabold normal-case tracking-normal">
              {t("feedback")}
            </h2>
            <p dir="auto">{result.feedback}</p>
          </section>
        )}
      </div>
    );
  const attempt = await startAssessment(user.id, valid.data);
  if (!attempt) notFound();
  return (
    <div className="space-y-5">
      <h1 className="text-4xl sm:text-5xl">
        {t(attempt.kind === "stage" ? "kindStage" : "kindFinal")}
      </h1>
      {attempt.submitted ? (
        <p>{t("handedIn")}</p>
      ) : (
        <>
          <p>{t("intro", { n: attempt.minutes })}</p>
          <AssessmentForm
            assessmentId={valid.data}
            questions={attempt.questions}
            given={attempt.given}
          />
        </>
      )}
    </div>
  );
}
