import { Check } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { connection } from "next/server";
import { Suspense } from "react";
import { listOpenSlots } from "@/server/funnel/level-check";
import { BookingForm } from "./booking-form";
import { Eyebrow, SectionTitle } from "./section-heading";

const PERKS = ["p1", "p2", "p3"] as const;

/** Free session booking: pick one of Mona's open times, then leave a name and number. */
export function Booking() {
  const t = useTranslations("Landing.booking");
  return (
    <section id="book" className="scroll-mt-20 bg-deep text-mist">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-28 lg:grid-cols-[1fr_1.6fr] lg:items-start">
        <div className="space-y-5">
          <Eyebrow className="text-whale">{t("eyebrow")}</Eyebrow>
          <SectionTitle
            first={t("title1")}
            second={t("title2")}
            accent="text-whale"
            className="text-white"
          />
          <p className="text-lg">{t("lead")}</p>
          <ul className="space-y-2.5">
            {PERKS.map((key) => (
              <li key={key} className="flex items-start gap-2.5">
                <Check aria-hidden size={20} weight="bold" className="mt-1 shrink-0 text-whale" />
                {t(`perks.${key}`)}
              </li>
            ))}
          </ul>
        </div>
        {/* min-w-0 here and on the form's fieldset keep the scrolling day row from widening the page. */}
        <div className="min-w-0 rounded-[2rem] bg-white p-5 text-body shadow-[0_24px_60px_-28px_rgb(0_0_0/0.5)] sm:p-8">
          <Suspense fallback={<CalendarSkeleton />}>
            <OpenSlots />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

/** Free slots change with every booking, so they're read per request. */
async function OpenSlots() {
  await connection();
  const now = new Date();
  const slots = await listOpenSlots(now);
  return (
    <BookingForm
      now={now.toISOString()}
      slots={slots.map((s) => ({ id: s.id, startsAt: s.startsAt.toISOString() }))}
    />
  );
}

function CalendarSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse space-y-4">
      <div className="h-6 w-1/3 rounded-full bg-mist" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-mist" />
        ))}
      </div>
      <div className="h-24 rounded-2xl bg-mist" />
    </div>
  );
}
