import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const linkClass = "inline-flex min-h-touch items-center hover:text-white";

/** Closing call to action, then the site links. */
export function SiteFooter() {
  const t = useTranslations("Landing.footer");
  const nav = useTranslations("Landing.nav");
  const c = useTranslations("Common");
  return (
    <footer className="bg-ocean pb-safe text-mist">
      <div className="mx-auto max-w-6xl px-4 pt-16 sm:pt-24">
        <div className="flex flex-wrap items-center justify-between gap-8 rounded-[2rem] bg-whale p-7 text-ocean sm:p-12">
          <div className="min-w-0 flex-[999_1_28rem] space-y-3">
            <p className="font-heading text-5xl sm:text-6xl">
              {t("ctaTitle1")}
              <br />
              {t("ctaTitle2")}
            </p>
            <p className="text-lg text-ocean/80">{t("ctaLead")}</p>
          </div>
          <a href="#book" className={buttonClass("ocean", "min-h-16 px-8 text-lg")}>
            {c("freeSession")}
            <ArrowRight aria-hidden size={20} weight="bold" className="icon-directional" />
          </a>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo variant="dark" />
          <p className="max-w-sm">{t("about")}</p>
        </div>
        <nav aria-label={t("explore")} className="flex flex-col">
          <p className="mb-1 font-extrabold text-white">{t("explore")}</p>
          <a href="#roadmap" className={linkClass}>
            {nav("roadmap")}
          </a>
          <a href="#ai" className={linkClass}>
            {nav("ai")}
          </a>
          <a href="#classes" className={linkClass}>
            {nav("classes")}
          </a>
          <a href="#mona" className={linkClass}>
            {nav("mona")}
          </a>
        </nav>
        <nav aria-label={t("help")} className="flex flex-col">
          <p className="mb-1 font-extrabold text-white">{t("help")}</p>
          <Link href="/login" className={linkClass}>
            {c("login")}
          </Link>
          <a href="#faq" className={linkClass}>
            {nav("faq")}
          </a>
        </nav>
      </div>

      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-white/10 px-4 py-6 text-sm text-whale">
        <p>{t("rights", { brand: c("brand") })}</p>
        <LanguageSwitcher tone="dark" />
      </div>
    </footer>
  );
}
