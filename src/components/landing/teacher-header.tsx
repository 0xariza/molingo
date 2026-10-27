import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";

const SECTIONS = [
  ["guides", "mona"],
  ["loop", "ai"],
  ["classes", "classes"],
  ["faq", "faq"],
] as const;

/** The teacher page's light, sticky header: their brand leads, Hoopo only as "powered by". */
export function TeacherHeader({ brand, teacher }: { brand: string; teacher: string }) {
  const nav = useTranslations("Landing.nav");
  const t = useTranslations("Landing.footer");
  const c = useTranslations("Common");
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-surface/90 backdrop-blur">
      <nav
        aria-label={c("primaryNav")}
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3"
      >
        <a href="#top" dir="ltr" className="flex flex-col leading-tight">
          <span className="font-['Lexend'] text-[22px] font-bold text-ocean">{brand}</span>
          <span className="text-end font-['Lexend'] text-[11px] text-body">{t("poweredBy")}</span>
        </a>
        <div className="hidden gap-6 text-[15px] font-semibold lg:flex">
          {SECTIONS.map(([id, key]) => (
            <a key={id} href={`#${id}`} className="py-2.5 text-body hover:text-ocean">
              {nav(key, { teacher })}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="inline-flex min-h-touch items-center px-3 font-bold text-ocean"
          >
            {c("login")}
          </Link>
          <a
            href="#book"
            className="hidden min-h-touch items-center rounded-card bg-cinnamon px-4 font-extrabold text-ocean sm:inline-flex"
          >
            {c("freeSession")}
          </a>
        </div>
      </nav>
    </header>
  );
}
