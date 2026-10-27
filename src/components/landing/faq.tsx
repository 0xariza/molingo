import { Plus } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { SectionTitle } from "./section-heading";

const ITEMS = ["groupRoadmap", "privateOrGroup", "aiWhen", "aiReplace", "need"] as const;

/** Native <details> accordion: works without JavaScript and with the keyboard. */
export function Faq({ teacher }: { teacher: string }) {
  const t = useTranslations("Landing.faq");
  return (
    <section
      id="faq"
      className="mx-auto grid max-w-6xl scroll-mt-20 gap-11 px-4 py-24 md:grid-cols-[0.8fr_1.6fr]"
    >
      <SectionTitle first={t("title1")} second={t("title2")} />
      <div className="space-y-3">
        {ITEMS.map((key) => (
          <details
            key={key}
            className="group rounded-card border border-hairline bg-white px-6 open:pb-5"
          >
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-extrabold text-ocean [&::-webkit-details-marker]:hidden">
              {t(`items.${key}.q`, { teacher })}
              <Plus
                aria-hidden
                size={22}
                weight="bold"
                className="shrink-0 text-cinnamon-ink transition group-open:rotate-45"
              />
            </summary>
            <p className="max-w-[65ch]">{t(`items.${key}.a`, { teacher })}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
