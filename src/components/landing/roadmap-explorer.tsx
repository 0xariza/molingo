"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";

const GOALS = ["work", "move", "travel", "exam"] as const;
const STEPS = ["s1", "s2", "s3", "s4"] as const;
/** The sample learner has finished two stops and is on the third. */
const CURRENT = 2;

const cardStyle = {
  done: "bg-deep text-white",
  now: "bg-white text-ocean",
  next: "border-2 border-dashed border-white/20 text-white",
} as const;
const numberStyle = { done: "text-whale", now: "text-brand", next: "text-whale/70" } as const;
const badgeStyle = {
  done: "bg-white/10 text-white",
  now: "bg-sand text-ocean",
  next: "bg-white/5 text-mist",
} as const;

/** Pick a goal and watch the sample roadmap's stops change. */
export function RoadmapExplorer() {
  const t = useTranslations("Landing.roadmap");
  const locale = useLocale() as Locale;
  const [goal, setGoal] = useState<(typeof GOALS)[number]>("work");

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-3">
        <p id="roadmap-goal" className="w-full font-bold sm:w-auto sm:me-2">
          {t("try")}
        </p>
        <div role="group" aria-labelledby="roadmap-goal" className="flex flex-wrap gap-2">
          {GOALS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={goal === key}
              onClick={() => setGoal(key)}
              className={`min-h-touch rounded-pill px-5 font-bold transition ${
                goal === key
                  ? "bg-whale text-ocean"
                  : "border border-white/25 text-white hover:border-whale"
              }`}
            >
              {t(`goals.${key}.label`)}
            </button>
          ))}
        </div>
      </div>
      <ol aria-live="polite" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => {
          const status = i < CURRENT ? "done" : i === CURRENT ? "now" : "next";
          return (
            <li
              key={step}
              className={`flex min-h-40 flex-col gap-3 rounded-3xl p-5 ${cardStyle[status]}`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-heading text-4xl ${numberStyle[status]}`}>
                  {formatNumber(i + 1, locale)}
                </span>
                <span className={`rounded-pill px-3 text-sm font-bold ${badgeStyle[status]}`}>
                  {t(`badges.${status}`)}
                </span>
              </div>
              <p className="text-lg font-extrabold leading-snug">{t(`goals.${goal}.${step}`)}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
