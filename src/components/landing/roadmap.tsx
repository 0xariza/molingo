import { Check } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { RoadmapExplorer } from "./roadmap-explorer";
import { Eyebrow, SectionTitle } from "./section-heading";

const PROMISES = ["p1", "p2", "p3"] as const;

export function Roadmap() {
  const t = useTranslations("Landing.roadmap");
  return (
    <section id="roadmap" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-16 sm:py-28">
        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div className="space-y-4">
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <SectionTitle first={t("title1")} second={t("title2")} />
          </div>
          <p className="text-lg">{t("lead")}</p>
        </div>
        <div className="space-y-8 rounded-[2rem] bg-ocean p-5 text-white sm:p-10">
          <RoadmapExplorer />
          <ul className="flex flex-wrap gap-x-7 gap-y-3 border-t border-white/10 pt-6 text-mist">
            {PROMISES.map((key) => (
              <li key={key} className="flex items-center gap-2">
                <Check aria-hidden size={18} weight="bold" className="text-whale" />
                {t(`promises.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
