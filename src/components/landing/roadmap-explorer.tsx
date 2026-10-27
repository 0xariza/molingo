"use client";

import { Check } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";

const GOALS = ["work", "move", "travel", "exam"] as const;
const STEPS = ["s1", "s2", "s3", "s4"] as const;
/** The sample learner has finished two stops and is on the third. */
const CURRENT = 2;

const dotStyle = {
  done: "bg-cinnamon text-ocean",
  now: "border-2 border-cinnamon bg-cinnamon-soft text-cinnamon-ink shadow-[0_0_0_5px_var(--color-cinnamon-soft)]",
  next: "border-2 border-line bg-white text-body",
} as const;
const titleStyle = {
  done: "text-ocean",
  now: "font-extrabold text-cinnamon-ink",
  next: "text-body",
};

/** Pick a goal and watch Sara's sample roadmap, and Hoopo's nudge, change. */
export function RoadmapExplorer({ teacher }: { teacher: string }) {
  const t = useTranslations("Landing.roadmap");
  const h = useTranslations("Landing.hero");
  const locale = useLocale() as Locale;
  const [goal, setGoal] = useState<(typeof GOALS)[number]>("work");

  return (
    <div className="flex flex-col gap-5 rounded-[22px] border border-hairline bg-white p-6 pt-7 shadow-[0_1px_2px_rgb(27_37_64/0.06),0_12px_32px_rgb(27_37_64/0.08)]">
      <div className="flex flex-col gap-2.5">
        <p id="roadmap-goal" className="text-[15px] font-extrabold text-ocean">
          {t("try")}
        </p>
        <div role="group" aria-labelledby="roadmap-goal" className="flex flex-wrap gap-2">
          {GOALS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={goal === key}
              onClick={() => setGoal(key)}
              className={`min-h-touch rounded-pill px-4 text-[15px] font-bold transition ${
                goal === key
                  ? "border-2 border-cinnamon bg-cinnamon-soft text-cinnamon-ink"
                  : "border-[1.5px] border-hairline bg-white text-body hover:border-line"
              }`}
            >
              {t(`goals.${key}.label`)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-hairline pt-4">
        <b className="text-ocean">{h("card.owner")}</b>
        <span dir="ltr" className="font-['Lexend'] text-[22px] font-bold text-cinnamon-ink">
          {h("card.levels")}
        </span>
      </div>
      <ol aria-live="polite" className="flex flex-col">
        {STEPS.map((step, i) => {
          const status = i < CURRENT ? "done" : i === CURRENT ? "now" : "next";
          return (
            <li key={step} className="flex items-stretch gap-3.5">
              <div className="flex w-8 flex-none flex-col items-center">
                <span
                  className={`grid size-8 flex-none place-items-center rounded-full text-sm font-bold ${dotStyle[status]}`}
                >
                  {status === "done" ? (
                    <Check aria-hidden size={16} weight="bold" />
                  ) : (
                    formatNumber(i + 1, locale)
                  )}
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`min-h-3.5 w-1 flex-1 rounded-pill ${status === "done" ? "bg-cinnamon" : "bg-hairline"}`}
                  />
                )}
              </div>
              <div className="flex flex-col pb-3.5 leading-relaxed">
                <span className={titleStyle[status]}>
                  {t(`goals.${goal}.${step}`, { teacher })}
                </span>
                <span className="text-[13px]">{t(`badges.${status}`)}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex items-start gap-2.5 rounded-[14px_14px_14px_4px] bg-teal-soft px-3.5 py-3">
        <span className="flex-none rounded-pill bg-teal px-2.5 text-xs leading-loose font-extrabold text-white">
          {h("hoopo")}
        </span>
        <span className="text-[15px] leading-relaxed text-ocean">{t(`goals.${goal}.nudge`)}</span>
      </div>
    </div>
  );
}
