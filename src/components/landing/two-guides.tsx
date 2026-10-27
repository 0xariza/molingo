import { Check } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Mascot } from "@/components/mascot";
import { Eyebrow, SectionTitle } from "./section-heading";

/**
 * The teacher and Hoopo, side by side. The teacher card shows their own bio when they've written
 * one; their photo comes with file uploads (M8), so the initial stands in.
 */
export function TwoGuides({ teacher, bio }: { teacher: string; bio: string | null }) {
  const t = useTranslations("Landing.guides");
  const h = useTranslations("Landing.hero");
  return (
    <section id="guides" className="scroll-mt-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-11 px-4 py-24">
        <div className="flex max-w-3xl flex-col gap-3.5">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <SectionTitle first={t("title1", { teacher })} second={t("title2")} accent="" />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <article className="flex flex-col gap-4 rounded-[22px] border border-hairline bg-white p-8">
            <div className="flex items-center gap-3.5">
              <span
                aria-hidden="true"
                className="grid size-18 place-items-center rounded-full bg-cinnamon-soft text-3xl font-bold text-cinnamon-ink"
              >
                {teacher.trim().charAt(0)}
              </span>
              <div className="flex flex-col leading-normal">
                <b className="text-[22px] text-ocean">{teacher}</b>
                <span className="text-sm">{t("teacherRole")}</span>
              </div>
            </div>
            <p className="whitespace-pre-line">{bio ?? t("teacherBody")}</p>
            <Checks items={[t("t1"), t("t2"), t("t3")]} tone="text-teal" />
          </article>
          <article className="flex flex-col gap-4 rounded-[22px] bg-ocean p-8 text-room-muted">
            <div className="flex items-center gap-3.5">
              <span className="grid size-18 place-items-center rounded-full bg-room-card">
                <Mascot className="size-16" />
              </span>
              <div className="flex flex-col leading-normal">
                <b className="text-[22px] text-white">{h("hoopo")}</b>
                <span className="text-sm">{t("hoopoRole")}</span>
              </div>
            </div>
            <p>{t("hoopoBody")}</p>
            <Checks items={[t("h1"), t("h2"), t("h3", { teacher })]} tone="text-room-teal" />
          </article>
        </div>
      </div>
    </section>
  );
}

function Checks({ items, tone }: { items: string[]; tone: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2.5">
          <Check aria-hidden size={18} weight="bold" className={`shrink-0 ${tone}`} />
          {item}
        </li>
      ))}
    </ul>
  );
}
