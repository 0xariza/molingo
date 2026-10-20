import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { getLocale, getTranslations } from "next-intl/server";
import { inputClass } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber } from "@/lib/format";
import { learnerNames } from "@/lib/names";
import { formatPhone } from "@/lib/phone";
import { learnerStatuses, type LearnerRow, type LearnerStatus } from "@/server/students/learners";
import { StatusBadge } from "./status-badge";

const loginTone = {
  none: "text-body/80",
  pending: "font-bold text-[#8a520e]",
  active: "",
  off: "text-body/80",
} as const;

/** Status filter chips, a search box and the learners (newest first). */
export async function LearnerList({
  rows,
  counts,
  status,
  q,
}: {
  rows: LearnerRow[];
  counts: Record<LearnerStatus, number>;
  status?: LearnerStatus;
  q?: string;
}) {
  const [t, ts, tl, locale] = await Promise.all([
    getTranslations("Admin.learners"),
    getTranslations("Admin.learners.status"),
    getTranslations("Admin.learners.login.state"),
    getLocale() as Promise<Locale>,
  ]);
  const n = (value: number) => formatNumber(value, locale);
  const total = learnerStatuses.reduce((sum, s) => sum + counts[s], 0);
  const filters = [
    { key: undefined, label: t("filters.all"), count: total },
    ...learnerStatuses.map((s) => ({ key: s, label: ts(s), count: counts[s] })),
  ];
  const href = (s?: LearnerStatus) => {
    const params = new URLSearchParams();
    if (s) params.set("status", s);
    if (q) params.set("q", q);
    const query = params.toString();
    return query ? `/admin/students?${query}` : "/admin/students";
  };

  return (
    <section aria-labelledby="learner-list" className="space-y-4">
      <h2 id="learner-list" className="sr-only">
        {t("list.label")}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t("filters.label")} className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const active = f.key === status;
            return (
              <Link
                key={f.key ?? "all"}
                href={href(f.key)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-touch items-center gap-2 rounded-pill border px-4 font-bold ${
                  active
                    ? "border-ocean bg-ocean text-white"
                    : "border-line/50 bg-white hover:border-brand"
                }`}
              >
                {f.label}
                <span className="font-semibold opacity-75">{n(f.count)}</span>
              </Link>
            );
          })}
        </nav>
        <form
          role="search"
          action={`/${locale}/admin/students`}
          className="flex w-full gap-2 sm:w-80"
        >
          {status && <input type="hidden" name="status" value={status} />}
          <label htmlFor="learner-search" className="sr-only">
            {t("filters.search")}
          </label>
          <input
            id="learner-search"
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t("filters.searchPlaceholder")}
            className={`${inputClass} min-h-touch rounded-pill bg-white`}
          />
          <button
            type="submit"
            aria-label={t("filters.submit")}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-ocean text-white hover:bg-deep"
          >
            <MagnifyingGlass aria-hidden size={18} />
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[1.75rem] border border-line/40 bg-white p-6">
          {status || q ? t("list.noMatch") : t("list.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-mist overflow-hidden rounded-[1.75rem] border border-line/40 bg-white">
          {rows.map((row) => {
            const { primary, secondary } = learnerNames(row, locale);
            return (
              <li key={row.id}>
                <Link
                  href={`/admin/students/${row.id}`}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-5 py-4 hover:bg-surface md:grid-cols-[auto_2fr_1.2fr_1.4fr_1.2fr_auto]"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-10 place-items-center rounded-full bg-mist font-extrabold text-brand"
                  >
                    {primary.slice(0, 1)}
                  </span>
                  <span className="min-w-0 leading-snug">
                    <span className="block truncate font-bold text-ocean">{primary}</span>
                    {secondary && <span className="block truncate text-sm">{secondary}</span>}
                  </span>
                  <span dir="ltr" className="hidden text-start text-sm md:block">
                    {formatPhone(row.phone)}
                  </span>
                  <span className={`hidden text-sm md:block ${loginTone[row.login]}`}>
                    {tl(row.login)}
                  </span>
                  <span className="hidden text-sm md:block">
                    {row.startedAt
                      ? formatDate(row.startedAt, locale, { weekday: false })
                      : t("list.notStarted")}
                  </span>
                  <StatusBadge status={row.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
