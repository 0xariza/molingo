"use client";

import { Check } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import type { LearnerStation } from "@/server/paths/station-check";

const W = 356;
const STEP = 120;
const point = (i: number) => ({ x: i % 2 ? 266 : 90, y: 60 + i * STEP });
const curve = (from: number, to: number) => {
  let d = `M${point(from).x} ${point(from).y}`;
  for (let i = from; i < to; i++) {
    const a = point(i);
    const b = point(i + 1);
    d += `C${a.x} ${a.y + 52} ${b.x} ${b.y - 52} ${b.x} ${b.y}`;
  }
  return d;
};

/**
 * The learner's trail: one node per station on a winding line, done ones filled, the current one
 * large. Choosing a station shows its skills in a panel beside the map (a dialog on a narrow
 * screen). The map is drawn left-to-right in both languages. `children` go under the panel.
 */
export function PathMap({
  stations,
  children,
}: {
  stations: LearnerStation[];
  children?: ReactNode;
}) {
  const t = useTranslations("Student.path");
  const locale = useLocale() as Locale;
  const n = (v: number) => formatNumber(v, locale);
  const [open, setOpen] = useState<number | null>(null);
  const wide = useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(min-width: 1024px)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
  const height = point(stations.length - 1).y + 90;
  const current = Math.max(
    0,
    stations.findIndex((s) => s.state === "current"),
  );
  const at = open ?? current;
  const shown = stations[at];
  const sub = (s: LearnerStation) =>
    s.state === "done"
      ? t("doneSub")
      : s.state === "current"
        ? t("sessionOf", { n: n(Math.min(s.held + 1, s.planned)), total: n(s.planned) })
        : t("sessions", { n: s.planned });

  const detail = (
    <div className="space-y-3">
      <p className="text-sm font-bold text-cinnamon-ink">
        {t("stationOf", { n: n(at + 1), total: n(stations.length) })}
        {shown.state === "done"
          ? ` · ${t("doneSub")}`
          : shown.state === "current"
            ? ` · ${t("nowHere")}`
            : ""}
        {shown.unit ? ` · ${shown.unit}` : ""}
      </p>
      <ul className="space-y-2">
        {shown.skills.map((k) => {
          const on = k.result === "ready" || k.worked;
          return (
            <li key={k.id} className="flex items-center gap-3 rounded-2xl bg-surface px-3.5 py-3">
              <span
                aria-hidden
                className={`grid size-6 shrink-0 place-items-center rounded-full ${on ? "bg-[#1f7a4d] text-white" : "border-2 border-line"}`}
              >
                {on && <Check weight="bold" size={14} />}
              </span>
              <span dir="auto" className="flex-1 leading-snug text-ocean">
                {k.text}
              </span>
              <span className="shrink-0 text-sm font-bold text-ocean">
                {k.result
                  ? t(k.result)
                  : k.worked
                    ? t("worked")
                    : shown.state === "next"
                      ? ""
                      : t("notYet")}
              </span>
            </li>
          );
        })}
        {shown.skills.length === 0 && <li>{t("noSkills")}</li>}
      </ul>
    </div>
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <div
        dir="ltr"
        className="relative mx-auto w-full max-w-[440px] rounded-card bg-white p-2"
        style={{ aspectRatio: `${W} / ${height}` }}
      >
        <svg viewBox={`0 0 ${W} ${height}`} aria-hidden className="absolute inset-0 size-full">
          <path
            d={curve(0, stations.length - 1)}
            fill="none"
            stroke="#c9cfdf"
            strokeWidth="4"
            strokeDasharray="2 10"
            strokeLinecap="round"
          />
          {current > 0 && (
            <path
              d={curve(0, current)}
              fill="none"
              stroke="#e27a3f"
              strokeWidth="5"
              strokeLinecap="round"
            />
          )}
        </svg>
        {stations.map((s, i) => {
          const p = point(i);
          const isNow = s.state === "current";
          const size = isNow ? 76 : 48;
          const far = p.x > W / 2;
          // The label clears the node and, on the current one, its 8px halo.
          const gap = size / 2 + (isNow ? 8 : 0) + 12;
          return (
            <div key={i}>
              <button
                type="button"
                onClick={() => setOpen(i)}
                aria-label={`${s.title}. ${sub(s)}`}
                aria-current={isNow ? "step" : undefined}
                style={{
                  left: `${((p.x - size / 2) / W) * 100}%`,
                  top: `${((p.y - size / 2) / height) * 100}%`,
                  width: `${(size / W) * 100}%`,
                  aspectRatio: "1",
                }}
                className={`absolute grid place-items-center rounded-full text-lg font-extrabold transition active:scale-95 ${wide && open === i && !isNow ? "ring-4 ring-brand/40" : ""} ${
                  s.state === "done"
                    ? "bg-[#e27a3f] text-white"
                    : isNow
                      ? "bg-ocean text-white shadow-[0_0_0_8px_rgba(226,122,63,.28)]"
                      : "border-2 border-[#7f89a6] bg-white text-ocean"
                }`}
              >
                {s.state === "done" ? <Check aria-hidden weight="bold" size={22} /> : n(i + 1)}
              </button>
              <p
                style={{
                  left: `${((far ? p.x - gap - 128 : p.x + gap) / W) * 100}%`,
                  top: `${((p.y - 22) / height) * 100}%`,
                  width: `${(128 / W) * 100}%`,
                }}
                className={`pointer-events-none absolute text-sm leading-snug ${far ? "text-end" : "text-start"} ${isNow ? "font-extrabold text-cinnamon-ink" : "font-bold text-ocean"}`}
              >
                <span dir="auto" className="block">
                  {s.title}
                </span>
                <span className="block text-xs font-medium text-body">{sub(s)}</span>
              </p>
            </div>
          );
        })}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6">
        {wide && (
          <section
            aria-label={shown.title}
            className="space-y-3 rounded-card border border-hairline bg-white p-5"
          >
            <h2 dir="auto" className="font-sans text-xl font-extrabold normal-case tracking-normal">
              {shown.title}
            </h2>
            {detail}
          </section>
        )}
        {children}
      </aside>

      {!wide && open !== null && (
        <Modal title={shown.title} closeLabel={t("close")} onClose={() => setOpen(null)}>
          {detail}
        </Modal>
      )}
    </div>
  );
}
