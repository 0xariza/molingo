import { CalendarClock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** Shown instead of the room when the join rule says no (too early, ended, removed…). */
export function ClosedRoom({
  message,
  backHref,
  backLabel,
}: {
  message: string;
  backHref: string;
  backLabel: string;
}) {
  const t = useTranslations("Classroom");
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-page px-4 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-cinnamon-soft text-cinnamon-ink">
          <CalendarClock aria-hidden size={26} />
        </span>
        <h1 className="font-sans text-2xl font-extrabold tracking-normal normal-case text-navy">
          {t("closedTitle")}
        </h1>
        <p className="text-navy-muted">{message}</p>
        <Link
          href={backHref}
          className="inline-flex min-h-12 items-center rounded-[14px] bg-cinnamon px-6 font-bold text-navy"
        >
          {backLabel}
        </Link>
      </div>
    </main>
  );
}
