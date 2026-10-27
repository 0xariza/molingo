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
export function ClassFormats({ teacherId, teacher }: { teacherId: string; teacher: string }) {
  const t = useTranslations("Landing.formats");
  return (
    <section id="classes" className="scroll-mt-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-11 px-4 py-24">
        <div className="flex max-w-3xl flex-col gap-3.5">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <SectionTitle first={t("title1")} second={t("title2")} />
          <p className="text-lg">{t("lead")}</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <article className="flex flex-col gap-4 rounded-[22px] border-2 border-cinnamon bg-white p-8">
            <Header title={t("private.title")} tag={t("private.tag", { teacher })} warm />
            <p>{t("private.body")}</p>
            <Features base="private" />
            <a href="#book" className={buttonClass("primary", "mt-auto")}>
              {t("private.cta")}
            </a>
          </article>
          <article className="flex flex-col gap-4 rounded-[22px] border border-hairline bg-white p-8">
            <Header title={t("group.title")} tag={t("group.tag")} />
            <p>{t("group.body")}</p>
            <Features base="group" />
            <Suspense
              fallback={
                <FormingEmpty
                  title={t("group.emptyTitle")}
                  body={t("group.emptyBody", { teacher })}
                />
              }
            >
              <FormingGroups teacherId={teacherId} teacher={teacher} />
            </Suspense>
            <a href="#book" className={buttonClass("ghost", "border-2 border-teal text-teal")}>
              {t("group.cta")}
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}

function Header({ title, tag, warm = false }: { title: string; tag: string; warm?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-3xl">{title}</h3>
      <span
        className={`rounded-pill px-3 py-0.5 text-[13px] font-extrabold ${warm ? "bg-cinnamon-soft text-cinnamon-ink" : "bg-teal-soft text-teal"}`}
      >
        {tag}
      </span>
    </div>
  );
}

function Features({ base }: { base: "private" | "group" }) {
  const t = useTranslations("Landing.formats");
  return (
    <ul className="space-y-2.5">
      {FEATURES.map((key) => (
        <li key={key} className="flex items-start gap-2.5">
          <Check aria-hidden size={20} weight="bold" className="mt-1 shrink-0 text-teal" />
          {t(`${base}.${key}`)}
        </li>
      ))}
    </ul>
  );
}
