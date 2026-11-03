import { CaretLeft, CaretRight, ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ReviewForm } from "@/components/admin/homework/review-form";
import { FileLink } from "@/components/homework/file-link";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatTime } from "@/lib/format";
import { classTitle, learnerNames } from "@/lib/names";
import { requireTeacher } from "@/server/auth/current";
import { getReview } from "@/server/homework/submissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.homework");
  return { title: t("title") };
}

export default function ReviewPage({ params }: PageProps<"/[locale]/admin/homework/[id]">) {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
    >
      <Review params={params} />
    </Suspense>
  );
}

const tone = {
  submitted: "bg-[#fcefd3] text-[#8a520e]",
  needs_revision: "bg-mist text-brand",
  reviewed: "bg-[#ddf5e8] text-[#14613a]",
} as const;

async function Review({ params }: { params: Promise<{ id: string }> }) {
  const { teacherId } = await requireTeacher();
  const id = z.uuid().safeParse((await params).id);
  const review = id.success ? await getReview(teacherId, id.data) : null;
  if (!review) notFound();

  const [t, locale] = await Promise.all([
    getTranslations("Admin.homework.review"),
    getLocale() as Promise<Locale>,
  ]);
  const name = learnerNames(review, locale).primary;
  const { queue } = review;
  const step =
    "grid size-11 place-items-center rounded-xl border border-hairline bg-white text-ocean";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/homework"
          className="inline-flex min-h-touch items-center gap-1.5 font-bold text-brand hover:underline"
        >
          <ArrowLeft aria-hidden size={18} className="icon-directional" />
          {t("back")}
        </Link>
        {queue && (
          <nav aria-label={t("queue")} className="flex items-center gap-2 text-sm">
            <span>
              <strong className="text-ocean">
                {t("position", { n: queue.position, total: queue.total })}
              </strong>
            </span>
            {queue.previousId ? (
              <Link
                href={`/admin/homework/${queue.previousId}`}
                aria-label={t("previous")}
                className={step}
              >
                <CaretLeft aria-hidden size={18} className="icon-directional" />
              </Link>
            ) : (
              <span aria-hidden className={`${step} text-line`}>
                <CaretLeft size={18} className="icon-directional" />
              </span>
            )}
            {queue.nextId ? (
              <Link
                href={`/admin/homework/${queue.nextId}`}
                aria-label={t("next")}
                className={step}
              >
                <CaretRight aria-hidden size={18} className="icon-directional" />
              </Link>
            ) : (
              <span aria-hidden className={`${step} text-line`}>
                <CaretRight size={18} className="icon-directional" />
              </span>
            )}
          </nav>
        )}
      </div>

      <header className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-full bg-mist text-xl font-extrabold text-brand"
        >
          {name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl sm:text-4xl">{name}</h1>
          <p className="mt-0.5">
            {t("meta", {
              title: review.assignment.title,
              class: classTitle({ nameFa: review.classNameFa, nameEn: review.classNameEn }, locale),
              n: review.sessionNumber,
              when: `${formatDate(review.submittedAt, locale, { year: false })}, ${formatTime(review.submittedAt, locale)}`,
            })}
            {review.late && <span className="font-bold text-[#a64916]"> · {t("late")}</span>}
            {review.revision > 1 && <span> · {t("revision", { n: review.revision })}</span>}
          </p>
        </div>
        <span className={`rounded-pill px-3 py-1 text-sm font-bold ${tone[review.status]}`}>
          {t(`status.${review.status}`)}
        </span>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          <details className="rounded-card border border-hairline bg-white px-5 py-1">
            <summary className="flex min-h-touch cursor-pointer items-center font-bold text-ocean">
              {t("assignment")}
            </summary>
            <div className="space-y-3 pb-4">
              <p className="whitespace-pre-line">{review.assignment.body ?? t("noInstructions")}</p>
              {review.assignment.files.map((f) => (
                <FileLink key={f.id} file={f} locale={locale} />
              ))}
            </div>
          </details>
          <section
            aria-labelledby="answer"
            className="space-y-4 rounded-card border border-hairline bg-white p-5"
          >
            <h2
              id="answer"
              className="font-sans text-lg font-extrabold normal-case tracking-normal"
            >
              {t("answerOf", { name })}
            </h2>
            {review.body ? (
              <p dir="auto" className="whitespace-pre-line text-ocean">
                {review.body}
              </p>
            ) : (
              review.files.length === 0 && <p>{t("noText")}</p>
            )}
            {review.files.map((f) => (
              <FileLink key={f.id} file={f} locale={locale} />
            ))}
          </section>
        </div>
        <ReviewForm
          key={review.id}
          id={review.id}
          name={name}
          feedback={review.feedback}
          hasNext={Boolean(queue?.nextId)}
        />
      </div>
    </div>
  );
}
