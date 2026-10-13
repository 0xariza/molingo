import { ArrowRight, Check, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/button";
import { Eyebrow } from "./section-heading";
import { WaveEdge } from "@/components/wave-edge";

const STEPS = ["s1", "s2", "s3", "s4"] as const;

export function Hero() {
  const t = useTranslations("Landing.hero");
  const c = useTranslations("Common");
  return (
    <section className="bg-ocean text-mist">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-6 lg:grid-cols-[1.25fr_1fr] lg:pt-16">
        <div className="space-y-7">
          <Eyebrow className="text-whale">{t("eyebrow")}</Eyebrow>
          <h1 className="text-6xl text-white sm:text-7xl xl:text-8xl">
            {t("title1")}
            <br />
            <span className="text-whale">{t("title2")}</span>
          </h1>
          <p className="max-w-xl text-lg text-mist/90 sm:text-xl">{t("lead")}</p>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <a href="#book" className={buttonClass("sand", "min-h-14 px-7 text-lg")}>
                {c("freeSession")}
                <ArrowRight aria-hidden size={20} weight="bold" className="icon-directional" />
              </a>
              <a href="#roadmap" className={buttonClass("ghostLight", "min-h-14 px-7 text-lg")}>
                {t("secondary")}
              </a>
            </div>
            <p className="text-sm text-whale">{t("ctaNote")}</p>
          </div>
        </div>
        <RoadmapPreview />
      </div>
      <WaveEdge />
    </section>
  );
}

/** A sample student's roadmap, with a nudge from the assistant. Illustrative. */
function RoadmapPreview() {
  const t = useTranslations("Landing.hero");
  const g = useTranslations("Landing.roadmap.goals.work");
  return (
    <div className="relative pb-12 ps-0 sm:ps-6">
      <div className="space-y-5 rounded-card bg-white p-6 text-ocean shadow-[0_24px_60px_-28px_rgb(0_0_0/0.6)] sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-body">{t("card.owner")}</p>
            <p className="text-lg font-extrabold">{t("card.goal")}</p>
          </div>
          <span dir="ltr" className="font-wordmark text-3xl font-bold text-brand">
            {t("card.levels")}
          </span>
        </div>
        <div
          role="img"
          aria-label={t("card.progress")}
          className="h-2 overflow-hidden rounded-pill bg-mist"
        >
          <div className="h-full w-[58%] rounded-pill bg-brand" />
        </div>
        <ol className="space-y-3 text-[0.95rem]">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-3">
              {i < 2 ? (
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-white">
                  <Check aria-hidden size={14} weight="bold" />
                </span>
              ) : i === 2 ? (
                <span className="size-7 shrink-0 rounded-full border-[3px] border-sand bg-ocean" />
              ) : (
                <span className="size-7 shrink-0 rounded-full border-2 border-dashed border-whale" />
              )}
              <span className={i === 2 ? "font-extrabold" : "text-body"}>{g(step)}</span>
              {i === 2 && (
                <span className="ms-auto shrink-0 rounded-pill bg-sand px-2.5 text-xs font-bold">
                  {t("card.now")}
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
      <p className="absolute bottom-0 start-0 flex max-w-72 items-start gap-3 rounded-3xl bg-deep p-4 text-sm leading-relaxed text-white shadow-[0_18px_40px_-16px_rgb(0_0_0/0.6)] sm:-start-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ocean">
          <Sparkle aria-hidden size={18} weight="fill" className="text-sand" />
        </span>
        {t("assistant")}
      </p>
    </div>
  );
}
