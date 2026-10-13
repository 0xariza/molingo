import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SlotForm } from "@/components/admin/slot-form";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatTime, tehranDateKey } from "@/lib/format";
import { requireAdmin } from "@/server/auth/current";
import { removeSlotAction } from "@/server/funnel/actions";
import { BOOKING_DAYS, listUpcomingSlots } from "@/server/funnel/level-check";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.levelChecks");
  return { title: t("title") };
}

export default async function LevelChecksPage() {
  const t = await getTranslations("Admin.levelChecks");
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
        <p className="max-w-2xl">{t("lead")}</p>
      </header>
      <Suspense
        fallback={<div aria-hidden="true" className="h-64 animate-pulse rounded-card bg-mist" />}
      >
        <Slots />
      </Suspense>
    </div>
  );
}

/** Reads the session and the slots, so it streams in per request. */
async function Slots() {
  await requireAdmin();
  const [t, levels, locale] = await Promise.all([
    getTranslations("Admin.levelChecks"),
    getTranslations("Landing.booking.levels"),
    getLocale() as Promise<Locale>,
  ]);
  const now = new Date();
  const slots = await listUpcomingSlots(now);
  const days = Array.from({ length: BOOKING_DAYS }, (_, i) => {
    const date = new Date(now.getTime() + i * DAY_MS);
    return { value: tehranDateKey(date), label: formatDate(date, locale, { year: false }) };
  });

  return (
    <>
      <section aria-labelledby="add-slot" className="rounded-card bg-white p-6 sm:p-8">
        <h2 id="add-slot" className="font-sans text-xl font-extrabold normal-case tracking-normal">
          {t("addTitle")}
        </h2>
        <SlotForm days={days} />
      </section>

      <section aria-labelledby="upcoming" className="space-y-3">
        <h2 id="upcoming" className="font-sans text-xl font-extrabold normal-case tracking-normal">
          {t("upcoming")}
        </h2>
        {slots.length === 0 ? (
          <p className="rounded-card bg-white p-6">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-mist overflow-hidden rounded-card bg-white">
            {slots.map((slot) => {
              const when = `${formatDate(slot.startsAt, locale, { year: false })} · ${formatTime(slot.startsAt, locale)}`;
              return (
                <li
                  key={slot.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                >
                  <div>
                    <p className="font-bold text-ocean">{when}</p>
                    {slot.lead ? (
                      <p className="text-sm">
                        <span className="font-semibold">{slot.lead.name}</span>
                        {" · "}
                        <a
                          href={`tel:${slot.lead.phone}`}
                          dir="ltr"
                          className="text-brand underline"
                        >
                          {slot.lead.phone}
                        </a>
                        {" · "}
                        {levels(slot.lead.levelGuess)}
                      </p>
                    ) : null}
                  </div>
                  {slot.lead ? (
                    <span className="rounded-pill bg-sand px-3 py-1 text-sm font-bold text-ocean">
                      {t("booked")}
                    </span>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="rounded-pill bg-mist px-3 py-1 text-sm font-bold text-brand">
                        {t("free")}
                      </span>
                      <form action={removeSlotAction}>
                        <input type="hidden" name="slotId" value={slot.id} />
                        <button
                          type="submit"
                          aria-label={t("removeLabel", { when })}
                          className="min-h-touch rounded-pill px-4 text-sm font-bold text-red-700 hover:bg-red-50"
                        >
                          {t("remove")}
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
