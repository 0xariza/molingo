import { CalendarCheck, NotePencil, Path } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { Link } from "@/i18n/navigation";

const ITEMS = [
  { key: "classes", Icon: CalendarCheck },
  { key: "homework", Icon: NotePencil },
  { key: "roadmap", Icon: Path },
] as const;

/**
 * Brand side of the login, activation and reset pages: what waits behind the login.
 * On phones it shrinks to the logo and a two-line welcome above the form.
 */
export function AuthPanel() {
  const t = useTranslations("Auth.panel");
  return (
    <aside
      aria-labelledby="auth-panel-title"
      className="flex flex-col gap-5 bg-ocean px-4 pt-4 pb-7 text-room-muted lg:flex-[1_1_520px] lg:gap-12 lg:px-14 lg:py-10"
    >
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex min-h-touch items-center">
          <Logo variant="dark" className="text-xl lg:text-[1.75rem]" />
        </Link>
        <LanguageSwitcher tone="dark" />
      </div>
      <div className="flex max-w-110 flex-col gap-5 lg:my-auto">
        <p className="hidden text-sm font-semibold text-room-teal lg:block">{t("eyebrow")}</p>
        <p
          id="auth-panel-title"
          className="font-heading text-3xl text-white lg:text-5xl lg:leading-[1.15]"
        >
          {t("title1")}
          <br />
          <span className="text-room-teal">{t("title2")}</span>
        </p>
        <p className="hidden text-[17px] lg:block">{t("body")}</p>
        <ul className="mt-2 hidden flex-col gap-2.5 lg:flex">
          {ITEMS.map(({ key, Icon }) => (
            <li
              key={key}
              className="flex items-center gap-3.5 rounded-card bg-white/6 p-3.5 font-medium text-white"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-room-teal-soft text-room-teal">
                <Icon aria-hidden size={20} />
              </span>
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
