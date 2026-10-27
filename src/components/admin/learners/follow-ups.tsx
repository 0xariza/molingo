import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { markLeadLostAction } from "@/server/students/actions";
import type { FollowUp } from "@/server/students/learners";

/** Free-session bookings Mona hasn't decided on yet: add as a learner, or close. */
export async function FollowUps({ items }: { items: FollowUp[] }) {
  const [t, levels, locale] = await Promise.all([
    getTranslations("Admin.learners.followUps"),
    getTranslations("Landing.booking.levels"),
    getLocale() as Promise<Locale>,
  ]);
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="follow-ups"
      className="rounded-card border border-hairline bg-white p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="follow-ups"
          className="flex items-center gap-2 font-sans text-lg font-extrabold normal-case tracking-normal"
        >
          {t("title")}
          <span className="rounded-pill bg-sand px-2.5 text-sm text-ocean">
            {formatNumber(items.length, locale)}
          </span>
        </h2>
        <p className="text-sm">{t("lead")}</p>
      </div>
      <ul className="mt-3 divide-y divide-mist">
        {items.map((lead) => (
          <li key={lead.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-bold text-ocean">{lead.name}</p>
              <p className="text-sm">
                <a href={`tel:${lead.phone}`} dir="ltr" className="text-brand underline">
                  {formatPhone(lead.phone)}
                </a>
                {" · "}
                {levels(lead.levelGuess)}
                {lead.sessionAt && (
                  <>
                    {" · "}
                    {t("session", {
                      when: `${formatDate(lead.sessionAt, locale, { year: false })} ${formatTime(lead.sessionAt, locale)}`,
                    })}
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={markLeadLostAction}>
                <input type="hidden" name="leadId" value={lead.id} />
                <button
                  type="submit"
                  aria-label={t("notInterestedLabel", { name: lead.name })}
                  className="min-h-touch rounded-pill border border-line/50 px-4 text-sm font-bold hover:bg-surface"
                >
                  {t("notInterested")}
                </button>
              </form>
              <Link
                href={`/admin/students/new?lead=${lead.id}`}
                aria-label={t("addAsLabel", { name: lead.name })}
                className="inline-flex min-h-touch items-center rounded-pill bg-mist px-4 text-sm font-bold text-brand hover:bg-whale/40"
              >
                {t("addAs")}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
