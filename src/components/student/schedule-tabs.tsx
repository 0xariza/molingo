import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** The two views of the learner's schedule: the week, and the classes it comes from. */
export async function ScheduleTabs({ current }: { current: "week" | "classes" }) {
  const t = await getTranslations("Student.schedule");
  const tab =
    "inline-flex min-h-11 items-center rounded-pill px-5 font-extrabold text-ocean aria-[current=page]:bg-ocean aria-[current=page]:text-white";
  return (
    <nav
      aria-label={t("tabsLabel")}
      className="flex gap-2 rounded-pill bg-white p-1 w-fit border border-hairline"
    >
      <Link
        href="/app/schedule"
        aria-current={current === "week" ? "page" : undefined}
        className={tab}
      >
        {t("tabWeek")}
      </Link>
      <Link
        href="/app/classes"
        aria-current={current === "classes" ? "page" : undefined}
        className={tab}
      >
        {t("tabClasses")}
      </Link>
    </nav>
  );
}
