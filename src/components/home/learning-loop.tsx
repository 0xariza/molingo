"use client";

import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Mascot } from "@/components/mascot";
import type { Locale } from "@/i18n/routing";
import { localDigits } from "@/lib/format";

const STEPS = [
  { key: "s1", state: "neutral", tag: "bg-ocean", at: "left-1/2 top-[15%]" },
  { key: "s2", state: "open", tag: "bg-teal", at: "left-[85%] top-1/2" },
  { key: "s3", state: "closed", tag: "bg-cinnamon-ink", at: "left-1/2 top-[85%]" },
  { key: "s4", state: "open", tag: "bg-teal", at: "left-[15%] top-1/2" },
] as const;

/** Clockwise arcs (with arrowheads) between the four stops, from the design. */
const ARCS = [
  ["M357.9 98.1A210 210 0 0 1 501.9 242.1", "M505.3 228.7L502.4 244L491.8 232.5"],
  ["M501.9 357.9A210 210 0 0 1 357.9 501.9", "M371.3 505.3L356 502.4L367.5 491.8"],
  ["M242.1 501.9A210 210 0 0 1 98.1 357.9", "M94.7 371.3L97.6 356L108.2 367.5"],
  ["M98.1 242.1A210 210 0 0 1 242.1 98.1", "M228.7 94.7L244 97.6L232.5 108.2"],
];

/** The learning loop: four stops around Hoopo; pick one (or step through) to read it. */
export function LearningLoop() {
  const t = useTranslations("Home.loop");
  const locale = useLocale() as Locale;
  const [step, setStep] = useState(0);
  const cur = STEPS[step];
  const n = (i: number) => localDigits(String(i + 1).padStart(2, "0"), locale);

  return (
    <div className="flex flex-col items-center gap-14 lg:flex-row">
      <div className="relative aspect-square w-full max-w-140 flex-[1_1_520px]">
        <svg aria-hidden="true" viewBox="0 0 600 600" className="absolute inset-0 size-full">
          <circle cx="300" cy="300" r="210" fill="none" stroke="#d6dbe8" strokeWidth="1.5" />
          <circle cx="300" cy="300" r="118" fill="#fff0e6" />
          {ARCS.map(([arc, head]) => (
            <g
              key={arc}
              fill="none"
              stroke="#e27a3f"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                d={arc}
                className="motion-safe:animate-[flow_1.4s_linear_infinite] [stroke-dasharray:6_10]"
              />
              <path d={head} />
            </g>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="motion-safe:animate-[bob_3.2s_ease-in-out_infinite]">
            <Mascot state={cur.state} className="size-[min(150px,25vw)]" />
          </div>
        </div>
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={step === i}
            onClick={() => setStep(i)}
            className={`absolute flex min-w-24 -translate-1/2 flex-col items-center gap-0.5 rounded-2xl px-3.5 py-2.5 sm:min-w-28 ${s.at} ${
              step === i
                ? "bg-ocean text-white shadow-[0_12px_28px_-10px_rgb(27_37_64/0.5)]"
                : "border-[1.5px] border-hairline bg-white text-ocean"
            }`}
          >
            <span
              className={`font-['Lexend'] text-[13px] font-bold ${step === i ? "text-room-cinnamon-ink" : "text-cinnamon-ink"}`}
            >
              {n(i)}
            </span>
            <span className="text-sm leading-normal font-extrabold">
              {t(`steps.${s.key}.short`)}
            </span>
          </button>
        ))}
      </div>

      <div aria-live="polite" className="flex min-w-0 flex-[1_1_420px] flex-col gap-4.5">
        <span className="font-['Lexend'] text-[15px] font-bold text-cinnamon-ink">
          {t("of", { n: n(step) })}
        </span>
        <h3 className="font-sans text-[clamp(1.625rem,2.6vw,2.125rem)] leading-snug font-bold tracking-normal normal-case text-ocean">
          {t(`steps.${cur.key}.title`)}
        </h3>
        <p className="text-lg">{t(`steps.${cur.key}.detail`)}</p>
        <div className="flex items-start gap-3 rounded-[18px] border border-hairline bg-surface px-4.5 py-4">
          <span
            className={`flex-none rounded-pill px-2.5 text-xs leading-loose font-extrabold text-white ${cur.tag}`}
          >
            {t(`steps.${cur.key}.tag`)}
          </span>
          <span className="text-[15px] leading-relaxed text-ocean">
            {t(`steps.${cur.key}.sample`)}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={t("prev")}
            onClick={() => setStep((step + 3) % 4)}
            className="grid size-12 place-items-center rounded-card border-[1.5px] border-line bg-white text-ocean"
          >
            <ArrowLeft aria-hidden size={20} className="icon-directional" />
          </button>
          <button
            type="button"
            aria-label={t("next")}
            onClick={() => setStep((step + 1) % 4)}
            className="grid size-12 place-items-center rounded-card bg-ocean text-white"
          >
            <ArrowRight aria-hidden size={20} className="icon-directional" />
          </button>
        </div>
      </div>
    </div>
  );
}
