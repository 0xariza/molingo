import { UserCircle } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Eyebrow } from "./section-heading";

export function AboutMona() {
  const t = useTranslations("Landing.mona");
  return (
    <section id="mona" className="scroll-mt-20 bg-white">
      <div className="reveal mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:py-28 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
        {/* TODO(content): replace with Mona's photo (portrait, about 800x1000), self-hosted in public/. */}
        <div
          role="img"
          aria-label={t("photoAlt")}
          className="mx-auto grid aspect-[4/5] w-full max-w-xs place-items-center rounded-[2rem] bg-mist md:max-w-none"
        >
          <UserCircle aria-hidden size={96} weight="thin" className="text-whale" />
        </div>
        <div className="space-y-6">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <blockquote className="font-heading text-4xl text-ocean sm:text-5xl">
            {t("quote1")} <span className="mark">{t("quote2")}</span>
          </blockquote>
          <p className="max-w-[60ch] text-lg">{t("body")}</p>
          <p className="font-heading text-4xl text-brand">{t("name")}</p>
        </div>
      </div>
    </section>
  );
}
