import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Mascot } from "@/components/mascot";
import { RoadmapExplorer } from "./roadmap-explorer";

/** The hero: the promise on one side, the goal → roadmap demo (with Hoopo) on the other. */
export function Hero({ teacher }: { teacher: string }) {
  const t = useTranslations("Landing.hero");
  const c = useTranslations("Common");
  return (
    <section id="top">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-12 px-4 pt-16 pb-18">
        <div className="flex min-w-0 flex-[999_1_500px] flex-col gap-6">
          <p className="self-start rounded-pill bg-teal-soft px-3.5 py-1 text-sm font-bold text-teal">
            {t("eyebrow")}
          </p>
          <h1 className="text-[clamp(2.75rem,6.4vw,5.25rem)] leading-[1.28]">
            {t("title1")}
            <br />
            <span className="text-cinnamon-ink">{t("title2")}</span>
          </h1>
          <p className="max-w-xl text-xl leading-loose">{t("lead", { teacher })}</p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#book"
              className="inline-flex min-h-14 items-center gap-2.5 rounded-card bg-cinnamon px-7 text-lg font-extrabold text-ocean hover:bg-[#d56d33]"
            >
              {c("freeSession")}
              <ArrowRight aria-hidden size={20} weight="bold" className="icon-directional" />
            </a>
            <a
              href="#guides"
              className="inline-flex min-h-14 items-center rounded-card border-2 border-teal px-6 font-extrabold text-teal hover:bg-teal-soft"
            >
              {t("secondary")}
            </a>
          </div>
          <p className="text-sm">{t("ctaNote", { teacher })}</p>
        </div>

        <div className="relative min-w-0 flex-[1_1_440px] pt-24">
          <div className="absolute start-auto end-5 top-0 z-10">
            <span
              aria-hidden="true"
              className="absolute start-3.5 top-1.5 h-16 w-26 rounded-pill bg-sand/35 blur-xl"
            />
            <Mascot state="open" className="relative size-33" />
          </div>
          <RoadmapExplorer teacher={teacher} />
        </div>
      </div>
    </section>
  );
}
