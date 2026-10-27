import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cardTitle, Eyebrow, SectionTitle } from "./section-heading";
import { WaitlistForm } from "./waitlist-form";

/** The AI assistant across the learning loop (coming soon), with the waitlist. */
export function AiAssistant() {
  const t = useTranslations("Landing.ai");
  const w = useTranslations("Landing.waitlist");
  return (
    <section id="ai" className="scroll-mt-20 bg-ocean text-mist">
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-16 sm:py-28">
        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div className="space-y-4">
            <Eyebrow className="text-sand">{t("eyebrow")}</Eyebrow>
            <SectionTitle
              first={t("title1")}
              second={t("title2")}
              accent="text-whale"
              className="text-white"
            />
          </div>
          <p className="text-lg text-mist/90">{t("lead")}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Stage step="01" tag={t("before.tag")} title={t("before.title")} body={t("before.body")}>
            <Example label={t("before.exampleLabel")}>{t("before.example")}</Example>
          </Stage>
          <Stage step="02" tag={t("during.tag")} title={t("during.title")} body={t("during.body")}>
            <Example label={t("during.exampleLabel")}>
              <span dir="ltr" lang="en">
                <s className="text-[#ff9a8f]">{t("during.wrong")}</s>
                {" → "}
                <b className="text-[#7fe0ae]">{t("during.right")}</b>
              </span>
            </Example>
          </Stage>
          <Stage
            step="03"
            tag={t("after.tag")}
            title={t("after.title")}
            body={t("after.body")}
            highlight
          >
            <div
              role="group"
              aria-label={t("after.chatLabel")}
              dir="ltr"
              lang="en"
              className="mt-auto flex flex-col gap-2 rounded-2xl bg-white p-3 text-sm leading-snug text-ocean"
            >
              <p className="self-start rounded-2xl rounded-es-sm bg-mist px-3 py-2">
                {t("after.chatQ")}
              </p>
              <p className="self-end rounded-2xl rounded-ee-sm bg-ocean px-3 py-2 text-white">
                {t("after.chatA")}
              </p>
              <p className="self-start rounded-2xl rounded-es-sm bg-mist px-3 py-2">
                {t("after.chatFix")}
              </p>
            </div>
          </Stage>
        </div>

        <div className="grid gap-5 rounded-card bg-white p-6 text-body sm:p-8 md:grid-cols-[1fr_1.1fr] md:items-center">
          <div>
            <h3 className={cardTitle}>{w("title")}</h3>
            <p className="mt-1">{w("lead")}</p>
          </div>
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}

function Stage({
  step,
  tag,
  title,
  body,
  highlight = false,
  children,
}: {
  step: string;
  tag: string;
  title: string;
  body: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <article
      className={`flex flex-col gap-4 rounded-card p-6 sm:p-8 ${highlight ? "bg-whale text-ocean" : "border border-white/10 bg-white/5"}`}
    >
      <p
        className={`flex items-center gap-2 text-sm font-bold ${highlight ? "text-deep" : "text-whale"}`}
      >
        <span className="text-lg tracking-widest">{step}</span>
        {tag}
      </p>
      <h3 className={`text-3xl sm:text-4xl ${highlight ? "text-ocean" : "text-white"}`}>{title}</h3>
      <p className={highlight ? "text-ocean/80" : ""}>{body}</p>
      {children}
    </article>
  );
}

function Example({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-auto rounded-2xl bg-ocean px-4 py-3">
      <p className="text-sm text-whale">{label}</p>
      <div className="font-semibold text-white">{children}</div>
    </div>
  );
}
