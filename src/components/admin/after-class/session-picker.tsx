"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { SelectMenu } from "@/components/ui/select-menu";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { classTitle } from "@/lib/names";
import type { AssignTarget } from "@/server/homework/assignments";

/** Picks a class and one of its held sessions, then opens that session's after-class page. */
export function SessionPicker({ targets }: { targets: AssignTarget[] }) {
  const t = useTranslations("Admin.homework.assignDialog");
  const ta = useTranslations("Admin.afterClass.pick");
  const locale = useLocale() as Locale;
  const [classId, setClassId] = useState(targets[0]?.id ?? "");
  const target = targets.find((c) => c.id === classId);
  const [picked, setPicked] = useState(target?.sessions[0]?.id ?? "");
  const when = (s: { startsAt: Date }) => formatDate(s.startsAt, locale, { year: false });

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-4xl sm:text-5xl">{ta("title")}</h1>
        <p className="mt-1">{ta("lead")}</p>
      </div>
      {targets.length === 0 ? (
        <p>{t("noTargets")}</p>
      ) : (
        <div className="space-y-4 rounded-card border border-hairline bg-white p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectMenu
              label={t("class")}
              value={classId}
              onChange={(id) => {
                setClassId(id);
                setPicked(targets.find((c) => c.id === id)?.sessions[0]?.id ?? "");
              }}
              options={targets.map((c) => ({
                value: c.id,
                label: t("classOption", { name: classTitle(c, locale), count: c.learnerCount }),
              }))}
            />
            <SelectMenu
              label={t("session")}
              value={picked}
              onChange={setPicked}
              options={(target?.sessions ?? []).map((s, i) => ({
                value: s.id,
                label: `${t("sessionOption", { n: s.number, date: when(s) })}${i === 0 ? ` ${t("lastHeld")}` : ""}`,
              }))}
            />
          </div>
          <p className="text-sm">{t("onlyHeld")}</p>
          <div className="flex justify-end">
            <Link href={`/admin/sessions/${picked}`} className={buttonClass("primary")}>
              {ta("go")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
