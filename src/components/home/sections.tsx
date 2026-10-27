import {
  ArrowRight,
  Bell,
  ChartBar,
  CheckCircle,
  Link as LinkIcon,
  NotePencil,
  PaperPlaneTilt,
  Plus,
  Quotes,
  Receipt,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { Mascot } from "@/components/mascot";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { LearningLoop } from "./learning-loop";
import { RequestAccess } from "./request-access";

/* The platform home page for teachers (design: HoopoHome / HoopoHomeEN). Sections whose
   features aren't built yet carry a "coming soon" tag; [X]-style placeholders stay visible
   until the real numbers exist (PLAN, M6d), and the page only shows behind PLATFORM_HOME. */

const cta =
  "inline-flex min-h-14 items-center gap-2.5 rounded-card bg-cinnamon px-7 text-lg font-extrabold text-ocean hover:bg-[#d56d33]";
const h2 = "text-[clamp(2rem,4.2vw,3.25rem)] leading-tight";

function Kicker({ children, soon = false }: { children: ReactNode; soon?: boolean }) {
  const t = useTranslations("Home");
  return (
    <p className="flex items-center gap-2.5 text-sm font-extrabold text-cinnamon-ink">
      <span aria-hidden="true" className="h-[3px] w-6 rounded-pill bg-cinnamon-ink" />
      {children}
      {soon && (
        <span className="rounded-pill bg-teal-soft px-2.5 text-xs font-bold text-teal">
          {t("soon")}
        </span>
      )}
    </p>
  );
}

function Heading({
  kicker,
  first,
  second,
  lead,
  soon,
}: {
  kicker: string;
  first: string;
  second: string;
  lead?: string;
  soon?: boolean;
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Kicker soon={soon}>{kicker}</Kicker>
      <h2 className={h2}>
        {first}
        <br />
        {second}
      </h2>
      {lead && <p className="max-w-155 text-[19px] leading-relaxed">{lead}</p>}
    </div>
  );
}

/** Hoopo with a speech bubble: the voice of each outcome section. */
function Says({ state, children }: { state: "neutral" | "closed" | "open"; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Mascot
        state={state}
        className="size-13 motion-safe:animate-[bob_3.2s_ease-in-out_infinite]"
      />
      <span className="rounded-[14px_14px_14px_4px] border border-hairline bg-white px-3.5 py-2 text-[15px] font-bold text-ocean">
        {children}
      </span>
    </div>
  );
}

function Points({ items }: { items: { icon: ReactNode; title: string; body: string }[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.title} className="flex items-start gap-3.5">
          <span className="mt-1 grid size-7 flex-none place-items-center rounded-[9px] bg-cinnamon-soft text-cinnamon-ink">
            {item.icon}
          </span>
          <span className="flex flex-col leading-relaxed">
            <b className="text-[17px] text-ocean">{item.title}</b>
            <span className="text-[15px]">{item.body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function HomeHeader() {
  const t = useTranslations("Home.nav");
  const c = useTranslations("Common");
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-surface/90 backdrop-blur">
      <nav
        aria-label={c("primaryNav")}
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3"
      >
        <a href="#top" className="inline-flex min-h-touch items-center">
          <Logo className="text-xl sm:text-2xl" />
        </a>
        <div className="hidden gap-6 text-[15px] font-semibold lg:flex">
          {(["time", "loop", "learners"] as const).map((id) => (
            <a key={id} href={`#${id}`} className="py-2.5 text-body hover:text-ocean">
              {t(id === "time" ? "features" : id)}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="inline-flex min-h-touch items-center px-3 font-bold text-ocean"
          >
            {c("login")}
          </Link>
          <a
            href="#start"
            className="hidden min-h-touch items-center rounded-card bg-cinnamon px-4 font-extrabold text-ocean sm:inline-flex"
          >
            {t("cta")}
          </a>
        </div>
      </nav>
    </header>
  );
}

export function HomeHero({ teacherHref }: { teacherHref: string }) {
  const t = useTranslations("Home.hero");
  const nav = useTranslations("Home.nav");
  return (
    <section id="top" className="overflow-hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-12 px-4 pt-22 pb-24">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-7">
          <h1 className="text-[clamp(2.75rem,6vw,4.75rem)] leading-[1.15]">
            {t("title1")}
            <br />
            <span className="text-cinnamon">{t("title2")}</span>
          </h1>
          <p className="max-w-xl text-[clamp(1.125rem,1.5vw,1.25rem)] leading-relaxed">
            {t("lead")}
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a href="#start" className={cta}>
              {nav("cta")}
              <ArrowRight aria-hidden size={20} weight="bold" className="icon-directional" />
            </a>
            <a
              href={teacherHref}
              className="inline-flex min-h-14 items-center font-bold text-ocean underline underline-offset-4"
            >
              {t("secondary")}
            </a>
          </div>
        </div>
        <ReadyCard />
      </div>
    </section>
  );
}

/** Hoopo perched on the "3 of 4 learners are ready" card. */
function ReadyCard() {
  const t = useTranslations("Home.hero.card");
  const tones = ["bg-cinnamon-soft", "bg-[#eef0f6]", "bg-[#fde3cf]", "bg-teal-soft"];
  return (
    <div className="relative mx-auto flex w-full max-w-130 flex-[1_1_440px] flex-col items-center pt-8">
      <div className="relative z-10 -mb-10 motion-safe:animate-[bob_3.2s_ease-in-out_infinite]">
        <span
          aria-hidden="true"
          className="absolute start-[22%] top-[10%] h-1/3 w-[56%] rounded-pill bg-sand/40 blur-xl"
        />
        <Mascot state="open" className="relative size-48 sm:size-57" />
      </div>
      <div className="relative z-20 flex w-full flex-col gap-3 rounded-[22px] border border-hairline bg-white p-6 shadow-[0_1px_2px_rgb(27_37_64/0.06),0_16px_40px_rgb(27_37_64/0.1)]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-extrabold text-teal">{t("kicker")}</span>
          <span className="text-xs">
            {t("class")}{" "}
            <bdi dir="ltr" className="font-['Lexend'] font-bold">
              {t("level")}
            </bdi>
          </span>
        </div>
        <b className="text-[17px] leading-relaxed text-ocean">{t("ready")}</b>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex gap-1" aria-hidden="true">
              {t("initials")
                .split(" ")
                .map((letter, i) => (
                  <span
                    key={letter}
                    className={`grid size-8 place-items-center rounded-full text-sm font-bold text-ocean ${tones[i]} ${i === 3 ? "opacity-50" : ""}`}
                  >
                    {letter}
                  </span>
                ))}
            </span>
            <span className="text-[13px]">{t("pending")}</span>
          </div>
          <span className="rounded-xl bg-ocean px-3.5 py-2 text-[13px] font-extrabold text-white">
            {t("remind")}
          </span>
        </div>
      </div>
    </div>
  );
}

export function LoopSection() {
  const t = useTranslations("Home.loop");
  return (
    <section id="loop" className="scroll-mt-20 border-y border-hairline bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-14 px-4 py-28">
        <div className="flex max-w-3xl flex-col items-center gap-4 text-center">
          <Kicker soon>{t("eyebrow")}</Kicker>
          <h2 className={h2}>
            {t("title1")}
            <br />
            <span className="text-cinnamon">{t("title2")}</span>
          </h2>
          <p className="max-w-155 text-[19px] leading-relaxed">{t("lead")}</p>
        </div>
        <LearningLoop />
      </div>
    </section>
  );
}

const BARS = [
  { key: "teaching", color: "bg-ocean", before: 45.5, after: 45.5 },
  { key: "scheduling", color: "bg-cinnamon", before: 20.5, after: 4.5 },
  { key: "payments", color: "bg-sand", before: 15.9, after: 2.3 },
  { key: "homework", color: "bg-teal", before: 18.2, after: 4.5 },
] as const;

export function TimeSection() {
  const t = useTranslations("Home.time");
  const bar = (when: "before" | "after") => (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <b className="text-ocean">{t(`chart.${when}`)}</b>
        <span className="font-['Lexend'] text-[15px] font-bold">{t(`chart.${when}Hours`)}</span>
      </div>
      <div className="flex h-11 gap-[3px] overflow-hidden rounded-xl">
        {BARS.map((b) => (
          <div
            key={b.key}
            title={t(`chart.${b.key}`)}
            style={{ width: `${b[when]}%` }}
            className={`${b.color} flex items-center justify-center overflow-hidden text-xs font-bold whitespace-nowrap text-white`}
          >
            {b.key === "teaching" || when === "before" ? t(`chart.${b.key}`) : null}
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <section id="time" className="scroll-mt-20">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-16 px-4 py-28">
        <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-5.5">
          <Says state="neutral">{t("quote")}</Says>
          <Heading
            kicker={t("eyebrow")}
            first={t("title1")}
            second={t("title2")}
            lead={t("lead")}
            soon
          />
          <Points
            items={[
              {
                icon: <Bell aria-hidden size={16} weight="bold" />,
                title: t("i1.title"),
                body: t("i1.body"),
              },
              {
                icon: <LinkIcon aria-hidden size={16} weight="bold" />,
                title: t("i2.title"),
                body: t("i2.body"),
              },
              {
                icon: <NotePencil aria-hidden size={16} weight="bold" />,
                title: t("i3.title"),
                body: t("i3.body"),
              },
            ]}
          />
        </div>
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5.5 rounded-[28px] border border-hairline bg-white p-8">
          <div className="flex items-center justify-between gap-3">
            <b className="text-lg text-ocean">{t("chart.title")}</b>
            <span className="text-[13px]">{t("chart.unit")}</span>
          </div>
          {bar("before")}
          {bar("after")}
          <ul className="flex flex-wrap gap-x-5.5 gap-y-2.5 border-t border-hairline pt-4 text-sm">
            {BARS.map((b) => (
              <li key={b.key} className="flex items-center gap-2">
                <i aria-hidden="true" className={`size-3 rounded ${b.color}`} />
                {t(`chart.${b.key}`)}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3.5 rounded-2xl bg-cinnamon-soft px-4.5 py-3.5">
            <b className="font-['Lexend'] text-3xl text-cinnamon-ink">{t("chart.saved")}</b>
            <span className="text-[15px] leading-relaxed text-ocean">{t("chart.savedBody")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MoneySection() {
  const t = useTranslations("Home.money");
  const days = [
    { key: "d1", icon: <PaperPlaneTilt aria-hidden size={18} /> },
    { key: "d2", icon: <Bell aria-hidden size={18} /> },
    { key: "d3", icon: <CheckCircle aria-hidden size={18} /> },
    { key: "d4", icon: <ChartBar aria-hidden size={18} /> },
  ] as const;
  return (
    <section id="money" className="border-y border-hairline bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap-reverse items-center gap-16 px-4 py-28">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5 rounded-[28px] border border-hairline bg-white p-8 shadow-[0_16px_40px_-24px_rgb(27_37_64/0.25)]">
          <div className="flex flex-col gap-1">
            <span className="text-[13px]">{t("card.label")}</span>
            <b className="font-['Lexend'] text-[34px] text-ocean">{t("card.amount")}</b>
            <span className="text-sm font-bold text-[#1f7a4d]">{t("card.pending")}</span>
          </div>
          <ol className="flex flex-col border-t border-hairline pt-5">
            {days.map((d, i) => (
              <li key={d.key} className="flex items-stretch gap-4">
                <div className="flex w-10 flex-none flex-col items-center">
                  <span className="grid size-10 place-items-center rounded-full bg-ocean text-white">
                    {d.icon}
                  </span>
                  {i < days.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="min-h-4.5 w-0.5 flex-1 bg-[repeating-linear-gradient(to_bottom,#d6dbe8_0_4px,transparent_4px_8px)]"
                    />
                  )}
                </div>
                <div className="flex flex-col pb-4.5 leading-relaxed">
                  <span className="text-xs font-bold text-cinnamon-ink">{t(`${d.key}.day`)}</span>
                  <b className="text-ocean">{t(`${d.key}.title`)}</b>
                  <span className="text-sm">{t(`${d.key}.body`)}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-5.5">
          <Says state="closed">{t("quote")}</Says>
          <Heading
            kicker={t("eyebrow")}
            first={t("title1")}
            second={t("title2")}
            lead={t("lead")}
            soon
          />
          <Points
            items={[
              {
                icon: <Bell aria-hidden size={16} weight="bold" />,
                title: t("i1.title"),
                body: t("i1.body"),
              },
              {
                icon: <Receipt aria-hidden size={16} weight="bold" />,
                title: t("i2.title"),
                body: t("i2.body"),
              },
              {
                icon: <Wallet aria-hidden size={16} weight="bold" />,
                title: t("i3.title"),
                body: t("i3.body"),
              },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const CURRENT_LEVEL = 2;

export function ProgressSection() {
  const t = useTranslations("Home.progress");
  return (
    <section id="progress">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5">
            <Says state="open">{t("quote")}</Says>
            <Heading kicker={t("eyebrow")} first={t("title1")} second={t("title2")} soon />
          </div>
          <p className="flex-[1_1_360px] text-lg leading-relaxed">{t("lead")}</p>
        </div>
        <div className="flex flex-col gap-8 rounded-[28px] border border-hairline bg-white p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-11 place-items-center rounded-full bg-cinnamon-soft font-bold text-cinnamon-ink"
              >
                {t("card.initial")}
              </span>
              <div className="flex flex-col leading-normal">
                <b className="text-[17px] text-ocean">{t("card.title")}</b>
                <span className="text-[13px]">{t("card.goal")}</span>
              </div>
            </div>
            <span className="rounded-pill bg-cinnamon-soft px-3.5 py-1.5 text-[13px] font-extrabold text-cinnamon-ink">
              {t("card.current")}
            </span>
          </div>
          <ol dir="ltr" className="relative flex justify-between">
            <span
              aria-hidden="true"
              className="absolute inset-x-5 top-5 h-1 rounded-pill bg-hairline"
            />
            <span
              aria-hidden="true"
              style={{ width: `calc(${(CURRENT_LEVEL / (LEVELS.length - 1)) * 100}% - 2.5rem)` }}
              className="absolute start-5 top-5 h-1 rounded-pill bg-cinnamon"
            />
            {LEVELS.map((level, i) => (
              <li
                key={level}
                className={`relative grid size-11 place-items-center rounded-full font-['Lexend'] text-sm font-bold ${
                  i < CURRENT_LEVEL
                    ? "bg-cinnamon text-ocean"
                    : i === CURRENT_LEVEL
                      ? "border-2 border-cinnamon bg-cinnamon-soft text-cinnamon-ink shadow-[0_0_0_6px_var(--color-cinnamon-soft)]"
                      : "border-2 border-line bg-white text-body"
                }`}
              >
                {level}
              </li>
            ))}
          </ol>
          <div className="grid gap-4 border-t border-hairline pt-6 sm:grid-cols-3">
            {(["week", "practice", "next"] as const).map((key) => (
              <div key={key} className="flex flex-col">
                <span className="text-[13px]">{t(`card.${key}`)}</span>
                <b className="text-[15px] text-ocean">{t(`card.${key}Value`)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PageSection({ teacherHref }: { teacherHref: string }) {
  const t = useTranslations("Home.page");
  return (
    <section id="page" className="border-t border-hairline bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-stretch gap-6 px-4 py-28">
        <div className="flex min-w-0 flex-[3_1_520px] flex-col gap-8 rounded-[28px] bg-surface p-8">
          <Heading
            kicker={t("eyebrow")}
            first={t("title1")}
            second={t("title2")}
            lead={t("lead")}
          />
          <a
            href={teacherHref}
            className="block overflow-hidden rounded-[18px] border border-hairline bg-white"
          >
            <span dir="ltr" className="flex items-center gap-2 border-b border-hairline px-3 py-2">
              <span className="size-2.5 rounded-full bg-hairline" />
              <span className="size-2.5 rounded-full bg-hairline" />
              <span className="mx-auto font-['Lexend'] text-xs">{t("url")}</span>
            </span>
            <span className="flex flex-wrap items-center justify-between gap-3 px-5 py-4.5">
              <span className="flex flex-col leading-normal">
                <b dir="ltr" className="text-start font-['Lexend'] text-lg text-ocean">
                  {t("brand")}
                </b>
                <span className="text-sm">{t("tagline")}</span>
              </span>
              <span className="rounded-xl bg-cinnamon px-3.5 py-2 text-sm font-extrabold text-ocean">
                {t("book")}
              </span>
            </span>
          </a>
        </div>
        <figure className="m-0 flex min-w-0 flex-[2_1_340px] flex-col gap-4 rounded-[28px] bg-ocean p-8 text-room-ink">
          <Quotes aria-hidden size={44} weight="fill" className="text-room-cinnamon" />
          <blockquote className="m-0 text-[22px] leading-loose font-bold">{t("quote")}</blockquote>
          <figcaption className="mt-auto flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-12 place-items-center rounded-full bg-room-card font-bold"
            >
              {t("initial")}
            </span>
            <span className="flex flex-col leading-normal">
              <b>{t("name")}</b>
              <span className="text-sm text-room-muted">{t("role")}</span>
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

export function LearnersSection({ teacherHref }: { teacherHref: string }) {
  const t = useTranslations("Home.learners");
  return (
    <section id="learners" className="scroll-mt-20 bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-24">
        <div className="flex flex-wrap items-center gap-8 rounded-[32px] bg-cinnamon-soft p-[clamp(1.75rem,5vw,3.5rem)]">
          <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-4">
            <Kicker>{t("eyebrow")}</Kicker>
            <h2 className={h2}>{t("title")}</h2>
            <p className="max-w-140 text-lg text-ocean">{t("lead")}</p>
            <div className="flex flex-wrap gap-2.5">
              <a
                href={`${teacherHref}#book`}
                className="inline-flex min-h-13 items-center rounded-card bg-ocean px-6 font-extrabold text-white"
              >
                {t("level")}
              </a>
              <Link
                href="/login"
                className="inline-flex min-h-13 items-center rounded-card border-2 border-ocean px-6 font-extrabold text-ocean"
              >
                {t("login")}
              </Link>
            </div>
          </div>
          <div className="flex flex-[1_1_200px] justify-center motion-safe:animate-[bob_3.2s_ease-in-out_infinite]">
            <Mascot state="open" className="size-45" />
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQ = ["data", "ai", "install", "pay"] as const;

export function HomeFaq() {
  const t = useTranslations("Home.faq");
  return (
    <section id="faq" className="scroll-mt-20 border-t border-hairline bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-12 px-4 py-28">
        <div className="flex-[1_1_300px]">
          <Heading kicker={t("eyebrow")} first={t("title1")} second={t("title2")} />
        </div>
        <div className="flex min-w-0 flex-[999_1_560px] flex-col">
          {FAQ.map((key) => (
            <details key={key} className="group border-b border-hairline">
              <summary className="flex min-h-18 cursor-pointer list-none items-center justify-between gap-4 text-lg font-extrabold text-ocean [&::-webkit-details-marker]:hidden">
                {t(`items.${key}.q`)}
                <span
                  aria-hidden="true"
                  className="grid size-8 flex-none place-items-center rounded-full bg-cinnamon-soft text-cinnamon-ink transition group-open:rotate-45"
                >
                  <Plus size={16} weight="bold" />
                </span>
              </summary>
              <p className="mb-6 max-w-170">{t(`items.${key}.a`)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StartSection() {
  const t = useTranslations("Home.start");
  return (
    <section id="start" className="scroll-mt-20 bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-24">
        <div className="flex flex-col items-center gap-6 rounded-[32px] bg-ocean p-[clamp(1.75rem,5vw,4rem)] text-center">
          <Mascot
            state="open"
            className="size-24 motion-safe:animate-[bob_3.2s_ease-in-out_infinite]"
          />
          <h2 className={`${h2} text-white`}>
            {t("title1")}
            <br />
            <span className="text-room-cinnamon-ink">{t("title2")}</span>
          </h2>
          <p className="max-w-xl text-lg text-room-muted">{t("lead")}</p>
          <div className="w-full max-w-2xl rounded-card bg-white p-6">
            <RequestAccess />
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeFooter() {
  const t = useTranslations("Home.footer");
  const nav = useTranslations("Home.nav");
  const faq = useTranslations("Home.faq");
  const locale = useLocale() as Locale;
  const year = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : "en", {
    year: "numeric",
  }).format(new Date());
  const link = "inline-flex min-h-touch items-center hover:text-white";
  return (
    <footer className="bg-room pb-safe text-room-muted">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-10 px-4 pt-14 pb-8">
        <div className="flex max-w-sm flex-col gap-3">
          <Logo variant="dark" className="text-2xl" />
          <p className="text-[15px]">{t("about")}</p>
        </div>
        <nav aria-label={t("product")} className="flex flex-col">
          <p className="mb-1 font-extrabold text-white">{t("product")}</p>
          <a href="#time" className={link}>
            {nav("features")}
          </a>
          <a href="#loop" className={link}>
            {nav("loop")}
          </a>
        </nav>
        <nav aria-label={t("support")} className="flex flex-col">
          <p className="mb-1 font-extrabold text-white">{t("support")}</p>
          <a href="#faq" className={link}>
            {faq("eyebrow")}
          </a>
          <a href="#learners" className={link}>
            {nav("learners")}
          </a>
        </nav>
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-room-line px-4 py-6 text-sm">
        <p>{t("rights", { year })}</p>
        <LanguageSwitcher tone="dark" />
      </div>
    </footer>
  );
}
