import { useTranslations } from "next-intl";
import { Fragment } from "react";

const ITEMS = ["roadmap", "teacher", "assistant", "formats"] as const;

/** The four promises in one line, separated by a small wave. */
export function Highlights() {
  const t = useTranslations("Landing.highlights");
  return (
    <section aria-label={t("label")} className="border-b border-mist">
      <ul className="font-heading mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 pt-2 pb-8 text-2xl text-brand sm:justify-between sm:text-3xl">
        {ITEMS.map((key, i) => (
          <Fragment key={key}>
            {i > 0 && (
              <li aria-hidden="true" className="hidden text-whale sm:block">
                ~
              </li>
            )}
            <li>{t(key)}</li>
          </Fragment>
        ))}
      </ul>
    </section>
  );
}
