import { Check } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { connection } from "next/server";
import { Suspense } from "react";
import { listOpenSlots } from "@/server/funnel/level-check";
import { BookingForm } from "./booking-form";
import { Eyebrow, SectionTitle } from "./section-heading";

const PERKS = ["p1", "p2", "p3"] as const;

/** Free session booking: pick one of Mona's open times, then leave a name and number. */
export function Booking({ teacherId, teacher }: { teacherId: string; teacher: string }) {
  const t = useTranslations("Landing.booking");
  return (
    <section id="book" className="scroll-mt-20 bg-ocean text-room-muted">
      <div className="mx-auto grid max-w-6xl gap-11 px-4 py-24 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        <div className="space-y-5">
          <Eyebrow className="text-room-cinnamon-ink">{t("eyebrow", { teacher })}</Eyebrow>
          <SectionTitle
            first={t("title1")}
            second={t("title2")}
            accent="text-room-cinnamon-ink"
            className="text-white"
          />
          <p className="text-lg">{t("lead", { teacher })}</p>
          <ul className="space-y-2.5">
            {PERKS.map((key) => (
              <li key={key} className="flex items-start gap-2.5">
                <Check
                  aria-hidden
                  size={20}
                  weight="bold"
                  className="mt-1 shrink-0 text-room-teal"
                />
                {t(`perks.${key}`, { teacher })}
              </li>
            ))}
          </ul>
        </div>
        {/* min-w-0 here and on the form's fieldset keep the scrolling day row from widening the page. */}
        <div className="min-w-0 rounded-[22px] bg-white p-5 text-body sm:p-7">
          <Suspense fallback={<CalendarSkeleton />}>
            <OpenSlots teacherId={teacherId} teacher={teacher} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

/** Free slots change with every booking, so they're read per request. */
async function OpenSlots({ teacherId, teacher }: { teacherId: string; teacher: string }) {
  await connection();
  const now = new Date();
  const slots = await listOpenSlots(teacherId, now);
  return (
    <BookingForm
      teacher={teacher}
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
