import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

const linkClass = "inline-flex min-h-touch items-center hover:text-white";

/** The teacher's brand, the page's sections, and "made with Hoopo". */
export function SiteFooter({ teacher, brand }: { teacher: string; brand: string }) {
  const t = useTranslations("Landing.footer");
  const nav = useTranslations("Landing.nav");
  const locale = useLocale() as Locale;
  // The year in the page's calendar: Solar Hijri in Persian.
  const year = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : "en", {
    year: "numeric",
  }).format(new Date());
  return (
    <footer className="bg-room pb-safe text-room-muted">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-8 px-4 pt-14 pb-7">
        <div className="flex max-w-sm flex-col gap-3">
          <a
            href="#top"
            dir="ltr"
            className="self-start font-['Lexend'] text-[22px] font-bold text-room-ink"
          >
            {brand}
          </a>
          <p className="text-[15px]">{t("tagline", { teacher })}</p>
        </div>
        <nav aria-label={t("explore")} className="flex flex-wrap items-start gap-x-7 text-[15px]">
          <a href="#guides" className={linkClass}>
            {nav("mona", { teacher })}
          </a>
          <a href="#classes" className={linkClass}>
            {nav("classes")}
          </a>
          <Link href="/login" className={linkClass}>
            {t("learnerLogin")}
          </Link>
        </nav>
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-room-line px-4 py-6 text-sm">
        <p>{t("rights", { year, brand })}</p>
        <LanguageSwitcher tone="dark" />
      </div>
    </footer>
  );
}
