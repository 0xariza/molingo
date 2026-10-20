import { Check } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { FormingEmpty, FormingGroups } from "./forming-groups";
import { Eyebrow, SectionTitle } from "./section-heading";

const FEATURES = ["f1", "f2", "f3"] as const;

/**
 * Private and group classes. The group card lists Mona's open public groups (streamed in), or the
 * "groups are forming" note when there are none.
 */
export function ClassFormats() {
  const t = useTranslations("Landing.formats");
  return (
    <section id="classes" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-16 sm:py-28">
        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div className="space-y-4">
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <SectionTitle first={t("title1")} second={t("title2")} />
          </div>
          <p className="text-lg">{t("lead")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="flex flex-col gap-5 rounded-[2rem] bg-ocean p-7 text-mist sm:p-10">
            <Header title={t("private.title")} tag={t("private.tag")} dark />
            <p className="text-lg">{t("private.body")}</p>
            <Features base="private" dark />
            <a href="#book" className={buttonClass("sand", "mt-auto")}>
              {t("private.cta")}
            </a>
          </article>
          <article className="flex flex-col gap-5 rounded-[2rem] bg-surface p-7 sm:p-10">
            <Header title={t("group.title")} tag={t("group.tag")} />
            <p className="text-lg">{t("group.body")}</p>
            <Features base="group" />
            <Suspense
              fallback={<FormingEmpty title={t("group.emptyTitle")} body={t("group.emptyBody")} />}
            >
              <FormingGroups />
            </Suspense>
            <a href="#book" className={buttonClass("primary")}>
              {t("group.cta")}
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}

function Header({ title, tag, dark = false }: { title: string; tag: string; dark?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className={`text-5xl ${dark ? "text-white" : ""}`}>{title}</h3>
      <span
        className={`rounded-pill px-3 py-1 text-sm font-bold ${dark ? "bg-white/10 text-mist" : "bg-white text-brand"}`}
      >
        {tag}
      </span>
    </div>
  );
}

function Features({ base, dark = false }: { base: "private" | "group"; dark?: boolean }) {
  const t = useTranslations("Landing.formats");
  return (
    <ul className="space-y-2.5">
      {FEATURES.map((key) => (
        <li key={key} className="flex items-start gap-2.5">
          <Check
            aria-hidden
            size={20}
            weight="bold"
            className={`mt-1 shrink-0 ${dark ? "text-whale" : "text-brand"}`}
          />
          {t(`${base}.${key}`)}
        </li>
      ))}
    </ul>
  );
}
