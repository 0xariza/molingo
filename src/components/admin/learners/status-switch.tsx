import { getTranslations } from "next-intl/server";
import { setLearnerStatusAction } from "@/server/students/actions";
import { learnerStatuses, type LearnerStatus } from "@/server/students/learners";

/** One tap changes the status; the current one is pressed. */
export async function StatusSwitch({ id, status }: { id: string; status: LearnerStatus }) {
  const [t, ts] = await Promise.all([
    getTranslations("Admin.learners.profile"),
    getTranslations("Admin.learners.status"),
  ]);
  return (
    <section
      aria-labelledby="status-title"
      className="space-y-4 rounded-card border border-hairline bg-white p-6"
    >
      <h2
        id="status-title"
        className="font-sans text-lg font-extrabold normal-case tracking-normal"
      >
        {t("statusTitle")}
      </h2>
      <form action={setLearnerStatusAction}>
        <input type="hidden" name="id" value={id} />
        <div
          role="group"
          aria-label={t("statusLabel")}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {learnerStatuses.map((s) => (
            <button
              key={s}
              type="submit"
              name="status"
              value={s}
              aria-pressed={s === status}
              className="min-h-touch rounded-pill border border-line/50 bg-white px-4 font-bold hover:border-brand aria-pressed:border-ocean aria-pressed:bg-ocean aria-pressed:text-white"
            >
              {ts(s)}
            </button>
          ))}
        </div>
      </form>
      <p className="text-sm">{t("statusHint")}</p>
    </section>
  );
}
