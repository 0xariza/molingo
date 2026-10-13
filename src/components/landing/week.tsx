import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Eyebrow, SectionTitle } from "./section-heading";

/** Who does what on each day of a sample week. */
const DAYS = [
  { key: "d1", who: "mona" },
  { key: "d2", who: "assistant" },
  { key: "d3", who: "assistant" },
  { key: "d4", who: "mona" },
  { key: "d5", who: "roadmap" },
] as const;

const style = {
  mona: { card: "bg-ocean text-mist", day: "text-white", tag: "bg-white text-ocean" },
  assistant: { card: "bg-white", day: "", tag: "bg-mist text-brand" },
  roadmap: { card: "bg-whale text-ocean", day: "", tag: "bg-ocean text-white" },
} as const;

export function Week() {
  const t = useTranslations("Landing.week");
  return (
    <section className="reveal mx-auto max-w-6xl space-y-10 px-4 py-16 sm:py-28">
      <div className="space-y-4">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <SectionTitle first={t("title1")} second={t("title2")} />
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {DAYS.map(({ key, who }) => (
          <li
            key={key}
            className={`flex min-h-44 flex-col gap-3 rounded-3xl p-5 ${style[who].card}`}
          >
            <h3 className={`text-3xl ${style[who].day}`}>{t(`${key}.day`)}</h3>
            <span className={`self-start rounded-pill px-3 text-sm font-bold ${style[who].tag}`}>
              {t(`who.${who}`)}
            </span>
            <p className={who === "roadmap" ? "font-bold" : ""}>
              {who === "roadmap" && (
                <CheckCircle
                  aria-hidden
                  size={20}
                  weight="fill"
                  className="me-1 inline align-[-4px]"
                />
              )}
              {t(`${key}.body`)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
