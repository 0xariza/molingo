import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Mascot } from "@/components/mascot";
import { Eyebrow, SectionTitle } from "./section-heading";
import { WaitlistForm } from "./waitlist-form";

/** The learning loop: Hoopo before, during and after class (coming soon), and the waitlist. */
export function AiAssistant() {
  const t = useTranslations("Landing.ai");
  const w = useTranslations("Landing.waitlist");
  return (
    <section id="loop" className="scroll-mt-20 border-y border-hairline bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-11 px-4 py-24">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-3.5">
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <SectionTitle first={t("title1")} second={t("title2")} />
          </div>
          <p className="flex-[1_1_320px] text-lg">{t("lead")}</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <Stage
            state="neutral"
            tag={t("before.tag")}
            title={t("before.title")}
            body={t("before.body")}
          >
            <div className="rounded-card border border-hairline bg-white px-3.5 py-3 text-[15px] text-ocean">
              {t("before.example")}
            </div>
          </Stage>
          <Stage
            state="closed"
            tag={t("during.tag")}
            title={t("during.title")}
            body={t("during.body")}
          >
            <div
              dir="ltr"
              aria-label={t("during.exampleLabel")}
              className="rounded-card border border-hairline bg-white px-3.5 py-3 text-[15px]"
            >
              <s className="text-[#b42318]">{t("during.wrong")}</s>
              <span aria-hidden="true"> → </span>
              <b className="text-[#1f7a4d]">{t("during.right")}</b>
            </div>
          </Stage>
          <Stage
            state="open"
            tag={t("after.tag")}
            title={t("after.title")}
            body={t("after.body")}
            warm
          >
            <div
              dir="ltr"
              role="group"
              aria-label={t("after.chatLabel")}
              className="flex flex-col gap-2 rounded-card bg-white p-3 font-['Lexend'] text-sm leading-normal text-ocean"
            >
              <p className="self-start rounded-[14px_14px_14px_4px] bg-teal-soft px-3 py-2">
                {t("after.chatQ")}
              </p>
              <p className="self-end rounded-[14px_14px_4px_14px] bg-ocean px-3 py-2 text-white">
                {t("after.chatA")}
              </p>
              <p className="self-start rounded-[14px_14px_14px_4px] bg-teal-soft px-3 py-2">
                {t("after.chatFix")}
              </p>
            </div>
          </Stage>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-ocean px-6 py-5 text-room-ink">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-sans text-[19px] font-extrabold tracking-normal normal-case text-white">
              {w("title")}
            </h3>
            <p className="text-[15px] text-room-muted">{w("lead")}</p>
          </div>
          <div className="w-full max-w-lg flex-[1_1_360px] rounded-card bg-white p-3">
            <WaitlistForm />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stage({
  state,
  tag,
  title,
  body,
  warm = false,
  children,
}: {
  state: "neutral" | "closed" | "open";
  tag: string;
  title: string;
  body: string;
  warm?: boolean;
  children: ReactNode;
}) {
  return (
    <article
      className={`flex flex-col gap-3 rounded-[22px] p-7 ${warm ? "bg-cinnamon-soft" : "bg-surface"}`}
    >
      <Mascot state={state} className="size-21" />
      <p
        className={`text-xs font-semibold tracking-[0.06em] uppercase ${warm ? "text-cinnamon-ink" : ""}`}
      >
        {tag}
      </p>
      <h3 className="font-sans text-2xl leading-normal font-extrabold tracking-normal normal-case text-ocean">
        {title}
      </h3>
      <p>{body}</p>
      <div className="mt-auto">{children}</div>
    </article>
  );
}
