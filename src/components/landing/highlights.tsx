import { Check } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

const ITEMS = ["roadmap", "teacher", "assistant", "formats"] as const;

/** The four promises in one white strip. */
export function Highlights() {
  const t = useTranslations("Landing.highlights");
  return (
    <section aria-label={t("label")} className="border-y border-hairline bg-white">
      <ul className="mx-auto flex max-w-6xl flex-wrap justify-between gap-x-8 gap-y-3 px-4 py-5 font-bold text-ocean">
        {ITEMS.map((key) => (
          <li key={key} className="flex items-center gap-2">
            <Check aria-hidden size={18} weight="bold" className="text-teal" />
            {t(key)}
          </li>
        ))}
      </ul>
    </section>
  );
}
