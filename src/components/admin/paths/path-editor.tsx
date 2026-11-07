"use client";

import { ArrowDown, ArrowUp, LockSimple, Minus, Plus, Trash } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Stepper } from "@/components/ui/stepper";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { planSessions, stationRanges } from "@/server/paths/plan";

export type PathSource = {
  id: string;
  title: string;
  level: string;
  complete: boolean;
  stations: {
    id: string;
    title: string;
    sourceUnit: string;
    plannedSessions: number;
    skillCount: number;
  }[];
};

export type PathStart = {
  sourceId: string;
  stations: {
    stationId: string;
    custom: boolean;
    title: string;
    skills: string[];
    included: boolean;
    plannedSessions: number;
    held: number;
  }[];
  heldStations: (string | null)[];
};

type Row = {
  key: string;
  kind: "source" | "custom";
  stationId?: string;
  title: string;
  sub: string;
  skills: string[];
  included: boolean;
  plannedSessions: number;
  held: number;
};

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const box =
  "min-h-12 w-full rounded-lg border border-line bg-white px-3.5 text-base text-ocean outline-none placeholder:text-body/60 focus:border-teal focus:ring-4 focus:ring-teal/15";

/**
 * Picks the class's source and sets its stations for this class: which ones it takes, how many
 * sessions each gets, and class-only stations. Shows which sessions each station gets. Sends the
 * path as JSON in the hidden `path` field ("" for no path).
 */
export function PathEditor({
  level,
  sources,
  sessionCount,
  start,
  optional,
}: {
  level: string;
  sources: PathSource[];
  sessionCount: number;
  start: PathStart | null;
  /** In the new-class wizard the path can be left out. */
  optional: boolean;
}) {
  const t = useTranslations("Admin.paths");
  const tc = useTranslations("Admin.classes");
  const locale = useLocale() as Locale;
  const n = (v: number) => formatNumber(v, locale);
  const stationSub = (unit: string, count: number) =>
    unit ? t("stationSub", { unit, count: n(count) }) : t("customSub", { count: n(count) });
  const atLevel = sources.filter((s) => s.level === level);

  const rowsFor = (sourceId: string): Row[] => {
    const src = sources.find((s) => s.id === sourceId);
    if (!src) return [];
    if (start && start.sourceId === sourceId)
      return start.stations.map((s) => {
        const station = src.stations.find((x) => x.id === s.stationId);
        return {
          key: s.stationId,
          kind: s.custom ? "custom" : "source",
          stationId: s.stationId,
          title: s.title,
          sub: s.custom
            ? t("customSub", { count: n(s.skills.length) })
            : stationSub(station?.sourceUnit ?? "", station?.skillCount ?? 0),
          skills: s.skills,
          included: s.included,
          plannedSessions: s.plannedSessions,
          held: s.held,
        };
      });
    return src.stations.map((s) => ({
      key: s.id,
      kind: "source",
      stationId: s.id,
      title: s.title,
      sub: stationSub(s.sourceUnit, s.skillCount),
      skills: [],
      included: true,
      plannedSessions: s.plannedSessions,
      held: 0,
    }));
  };

  const [use, setUse] = useState(Boolean(start) || !optional);
  const [sourceId, setSourceId] = useState(
    start?.sourceId ?? atLevel.find((s) => s.complete)?.id ?? "",
  );
  const [rows, setRows] = useState<Row[]>(() => rowsFor(sourceId));
  const [draft, setDraft] = useState<{
    title: string;
    plannedSessions: number;
    skills: string[];
  } | null>(null);
  const [seq, setSeq] = useState(0);
  // A source made here: only its name is asked; the stations are the class-only rows below.
  const [fresh, setFresh] = useState<string | null>(null);

  const pick = (id: string) => {
    setFresh(null);
    setSourceId(id);
    setRows(rowsFor(id));
  };
  // A level change in the wizard drops a source of another level.
  const current = atLevel.find((s) => s.id === sourceId);
  if (use && !current && fresh === null) {
    const next = atLevel.find((s) => s.complete)?.id ?? "";
    if (next !== sourceId) pick(next);
  }

  const update = (key: string, patch: Partial<Row>) =>
    setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const lockedCount = rows.filter((r) => r.held > 0).length;
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < lockedCount || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };

  const plan = [
    ...planSessions(
      rows.map((r) => ({ id: r.key, included: r.included, plannedSessions: r.plannedSessions })),
      Array.from({ length: sessionCount }, (_, i) => {
        const held = start?.heldStations[i] ?? null;
        return { id: String(i), held: held !== null, pathStationId: held };
      }),
    ).values(),
  ];
  const ranges = stationRanges(
    rows.map((r) => ({ id: r.key, included: r.included, plannedSessions: r.plannedSessions })),
    plan,
  );
  const taken = rows.filter((r) => r.included);
  const planned = taken.reduce((a, r) => a + r.plannedSessions, 0);
  const fitting = ranges.filter((r) => r.count > 0).length;

  const value =
    use && (current?.complete || fresh?.trim()) && taken.length
      ? JSON.stringify({
          ...(fresh === null ? { sourceId } : { newSource: { title: fresh.trim() } }),
          items: rows.map((r) =>
            r.kind === "source"
              ? {
                  kind: "source",
                  stationId: r.stationId,
                  included: r.included,
                  plannedSessions: r.plannedSessions,
                }
              : {
                  kind: "custom",
                  stationId: r.stationId,
                  title: r.title,
                  plannedSessions: r.plannedSessions,
                  skills: r.skills,
                },
          ),
        })
      : "";

  const draftSkills = draft?.skills.filter((s) => s.trim()).length ?? 0;
  const draftOk = Boolean(draft?.title.trim()) && draftSkills >= 1;
  const levelIndex = LEVELS.indexOf(level as (typeof LEVELS)[number]);
  const target = LEVELS[levelIndex + 1];

  return (
    <div className="space-y-5">
      <input type="hidden" name="path" value={value} />
      <p className="flex flex-wrap gap-x-2 rounded-2xl bg-surface px-4 py-3 text-sm">
        <span>
          {t("level")}{" "}
          <bdi dir="ltr" className="font-bold text-ocean">
            {level}
          </bdi>
        </span>
        {target && (
          <span>
            {t("target")}{" "}
            <b className="text-ocean">
              <bdi dir="ltr">{target}</bdi> {tc(`levels.${target}`)}
            </b>
          </span>
        )}
        <span className="text-line">{t("targetNote")}</span>
      </p>

      {optional && (
        <div
          role="radiogroup"
          aria-label={t("title")}
          className="grid grid-cols-2 gap-1 rounded-2xl bg-mist p-1"
        >
          {[
            [false, t("none"), t("noneHint")],
            [true, t("withSource"), t("withSourceHint")],
          ].map(([on, label, hint]) => (
            <button
              key={String(on)}
              type="button"
              role="radio"
              aria-checked={use === on}
              onClick={() => setUse(on as boolean)}
              className="min-h-13 rounded-xl px-3 py-1.5 font-bold leading-tight text-body transition aria-checked:bg-white aria-checked:text-ocean aria-checked:shadow-[0_1px_3px_rgba(7,30,54,.12)]"
            >
              <span className="block">{label as string}</span>
              <span className="block text-xs font-medium">{hint as string}</span>
            </button>
          ))}
        </div>
      )}

      {use && (
        <>
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-bold text-ocean">{t("source")}</legend>
            {atLevel.length === 0 && fresh === null && (
              <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm">
                {t("noSources", { level })}
              </p>
            )}
            {atLevel.map((s) => (
              <div
                key={s.id}
                className={`flex min-h-15 items-center gap-3 rounded-2xl border-[1.5px] px-4 py-2 ${s.id === sourceId ? "border-brand bg-mist/50" : "border-hairline"} ${s.complete ? "" : "border-dashed opacity-80"}`}
              >
                <input
                  type="radio"
                  name="path-source"
                  id={`src-${s.id}`}
                  checked={s.id === sourceId}
                  disabled={!s.complete || (lockedCount > 0 && s.id !== sourceId)}
                  onChange={() => pick(s.id)}
                  className="size-5 accent-brand"
                />
                <label htmlFor={`src-${s.id}`} className="min-w-0 flex-1 leading-snug">
                  <b className="block text-ocean">{s.title}</b>
                  <span className={`text-sm ${s.complete ? "" : "text-cinnamon-ink"}`}>
                    {s.complete
                      ? t("sourceReady", { count: n(s.stations.length) })
                      : t("sourceIncomplete")}
                  </span>
                </label>
                {!s.complete && (
                  <Link href={`/admin/sources/${s.id}`} className="text-sm font-bold text-brand">
                    {t("complete")}
                  </Link>
                )}
              </div>
            ))}
            {fresh === null ? (
              <button
                type="button"
                disabled={lockedCount > 0}
                onClick={() => {
                  setSourceId("");
                  setRows([]);
                  setFresh("");
                }}
                className="flex min-h-15 w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-whale font-bold text-brand hover:bg-mist/40 disabled:opacity-50"
              >
                <Plus aria-hidden size={16} weight="bold" />
                {t("addSource")}
              </button>
            ) : (
              <label className="block space-y-1.5 rounded-2xl border-[1.5px] border-brand p-4">
                <span className="block text-sm font-bold text-ocean">{t("newSourceName")}</span>
                <input
                  value={fresh}
                  onChange={(e) => setFresh(e.target.value)}
                  placeholder={t("newSourcePlaceholder")}
                  className={box}
                />
              </label>
            )}
          </fieldset>

          {(current?.complete || fresh !== null) && (
            <section aria-labelledby="path-stations" className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id="path-stations" className="text-sm font-bold text-ocean">
                  {t("stations")}
                </h3>
                <span className="text-sm">
                  {t("summary", { stations: n(taken.length), sessions: n(planned) })}
                </span>
              </div>
              <p className="text-sm text-body/80">
                {lockedCount ? t("lockedHint") : t("stationsHint")}
              </p>
              <ol className="overflow-hidden rounded-2xl border border-hairline">
                {rows.map((r, i) => {
                  const range = ranges[i];
                  const locked = r.held > 0;
                  return (
                    <li
                      key={r.key}
                      className={`flex flex-wrap items-center gap-3 border-t border-surface px-3 py-2 first:border-t-0 ${r.included ? "bg-white" : "bg-surface"}`}
                    >
                      {locked ? (
                        <LockSimple aria-label={t("locked")} size={20} className="mx-3 text-line" />
                      ) : r.kind === "source" ? (
                        <input
                          type="checkbox"
                          checked={r.included}
                          onChange={(e) => update(r.key, { included: e.target.checked })}
                          aria-label={t("take", { name: r.title })}
                          className="m-3 size-5 accent-brand"
                        />
                      ) : (
                        <button
                          type="button"
                          aria-label={t("removeCustom", { name: r.title })}
                          onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
                          className="grid size-11 place-items-center rounded-xl text-body hover:bg-surface hover:text-red-700"
                        >
                          <Trash aria-hidden size={18} />
                        </button>
                      )}
                      <span className="min-w-0 flex-1 leading-snug">
                        <b className={`block ${r.included ? "text-ocean" : "text-body/60"}`}>
                          {r.title}
                        </b>
                        <span className="text-xs">
                          {r.included ? r.sub : t("skipped")}
                          {r.kind === "custom" && ` · ${t("customTag")}`}
                        </span>
                      </span>
                      {r.kind === "custom" && !locked && (
                        <span className="flex">
                          <button
                            type="button"
                            aria-label={t("up")}
                            disabled={i <= lockedCount}
                            onClick={() => move(i, -1)}
                            className="grid size-11 place-items-center rounded-xl text-body hover:bg-surface disabled:text-line/40"
                          >
                            <ArrowUp aria-hidden size={16} />
                          </button>
                          <button
                            type="button"
                            aria-label={t("down")}
                            disabled={i === rows.length - 1}
                            onClick={() => move(i, 1)}
                            className="grid size-11 place-items-center rounded-xl text-body hover:bg-surface disabled:text-line/40"
                          >
                            <ArrowDown aria-hidden size={16} />
                          </button>
                        </span>
                      )}
                      {r.included && (
                        <span className="flex items-center gap-2">
                          <span className="w-32 text-end text-xs font-bold text-ocean">
                            {range.first === null
                              ? t("nextCourse")
                              : range.first === range.last
                                ? t("oneSession", { n: n(range.first) })
                                : t("sessions", { first: n(range.first), last: n(range.last!) })}
                          </span>
                          <span className="flex h-10 items-center overflow-hidden rounded-xl border border-hairline">
                            <button
                              type="button"
                              aria-label={t("less", { name: r.title })}
                              disabled={r.plannedSessions <= Math.max(1, r.held)}
                              onClick={() =>
                                update(r.key, { plannedSessions: r.plannedSessions - 1 })
                              }
                              className="grid h-full w-9 place-items-center font-bold text-brand disabled:text-line/40"
                            >
                              <Minus aria-hidden size={14} weight="bold" />
                            </button>
                            <span className="w-6 text-center font-extrabold text-ocean">
                              {n(r.plannedSessions)}
                            </span>
                            <button
                              type="button"
                              aria-label={t("more", { name: r.title })}
                              disabled={r.plannedSessions >= 99}
                              onClick={() =>
                                update(r.key, { plannedSessions: r.plannedSessions + 1 })
                              }
                              className="grid h-full w-9 place-items-center font-bold text-brand disabled:text-line/40"
                            >
                              <Plus aria-hidden size={14} weight="bold" />
                            </button>
                          </span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>

              {draft ? (
                <div className="space-y-3 rounded-2xl border-[1.5px] border-brand p-4">
                  <b className="text-ocean">{t("customTitle")}</b>
                  <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="block space-y-1.5">
                      <span className="block text-sm font-bold text-ocean">{t("customName")}</span>
                      <input
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        placeholder={t("customPlaceholder")}
                        className={box}
                      />
                    </label>
                    <Stepper
                      id="custom-sessions"
                      label={t("customSessions")}
                      name="custom-sessions"
                      value={draft.plannedSessions}
                      min={1}
                      max={99}
                      display={n(draft.plannedSessions)}
                      onChange={(v) => setDraft({ ...draft, plannedSessions: v })}
                      lessLabel={t("lessPlain")}
                      moreLabel={t("morePlain")}
                    />
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="mb-1 text-sm font-bold text-ocean">
                      {t("customSkills")}
                    </legend>
                    {draft.skills.map((v, i) => (
                      <input
                        key={i}
                        value={v}
                        aria-label={t("customSkill", { n: n(i + 1) })}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            skills: draft.skills.map((s, j) => (j === i ? e.target.value : s)),
                          })
                        }
                        className={box}
                      />
                    ))}
                    {
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, skills: [...draft.skills, ""] })}
                        className="min-h-touch text-sm font-bold text-brand"
                      >
                        {t("customMoreSkill")}
                      </button>
                    }
                  </fieldset>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="flex-1 text-sm">
                      {draftOk ? t("customOnlyHere") : t("customNeed")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDraft(null)}
                      className="min-h-11 rounded-[14px] border border-brand px-4 text-sm font-bold text-brand"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="button"
                      disabled={!draftOk}
                      onClick={() => {
                        setRows([
                          ...rows,
                          {
                            key: `new-${seq}`,
                            kind: "custom",
                            title: draft.title.trim(),
                            sub: t("customSub", { count: n(draftSkills) }),
                            skills: draft.skills.map((s) => s.trim()).filter(Boolean),
                            included: true,
                            plannedSessions: draft.plannedSessions,
                            held: 0,
                          },
                        ]);
                        setSeq(seq + 1);
                        setDraft(null);
                      }}
                      className="min-h-11 rounded-[14px] bg-ocean px-4 text-sm font-bold text-white disabled:opacity-40"
                    >
                      {t("customAdd")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDraft({ title: "", plannedSessions: 2, skills: [""] })}
                  className="flex min-h-13 w-full items-center justify-center rounded-2xl border-[1.5px] border-dashed border-whale font-bold text-brand hover:bg-mist/40"
                >
                  {t("addCustom")}
                </button>
              )}

              <p className="rounded-2xl bg-surface px-4 py-3 text-sm">
                {sessionCount
                  ? t("fit", {
                      fitting: n(fitting),
                      total: n(taken.length),
                      count: n(sessionCount),
                    })
                  : t("fitLater")}{" "}
                {t("checkRule")}
              </p>
            </section>
          )}
        </>
      )}
      {optional && !use && (
        <p className="rounded-2xl bg-surface px-4 py-3 text-sm">{t("noneBody")}</p>
      )}
    </div>
  );
}
