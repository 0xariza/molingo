import { CalendarCheck, NotePencil, Path } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { SideWaveEdge, WaveEdge } from "@/components/wave-edge";

const ITEMS = [
  { key: "classes", Icon: CalendarCheck },
  { key: "homework", Icon: NotePencil },
  { key: "roadmap", Icon: Path },
] as const;

/**
 * Brand side of the login, activation and reset pages: what waits behind the login.
 * On phones it shrinks to a short welcome band above the form.
 */
export function AuthPanel() {
  const t = useTranslations("Auth.panel");
  return (
    <section
      aria-labelledby="auth-panel-title"
      className="relative bg-ocean pt-8 text-mist lg:flex lg:flex-col lg:justify-center lg:py-16 lg:pe-16"
    >
      <div className="mx-auto w-full max-w-md space-y-4 px-6 pb-4 lg:space-y-6 lg:px-10 lg:pb-0">
        <p className="flex items-center gap-3 text-sm font-extrabold text-whale">
          <span aria-hidden="true" className="h-0.5 w-8 bg-current" />
          {t("eyebrow")}
        </p>
        <p id="auth-panel-title" className="font-heading text-4xl text-white lg:text-6xl">
          {t("title1")}
          <br />
          <span className="text-whale">{t("title2")}</span>
        </p>
        <p className="hidden text-lg lg:block">{t("body")}</p>
        <ul className="hidden space-y-3 pt-2 lg:block">
          {ITEMS.map(({ key, Icon }) => (
            <li key={key} className="flex items-center gap-4 rounded-2xl bg-white/5 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-deep">
                <Icon aria-hidden size={22} weight="duotone" className="text-whale" />
              </span>
              <span className="font-semibold text-white">{t(key)}</span>
            </li>
          ))}
        </ul>
      </div>
      <WaveEdge className="h-12 lg:hidden" />
      <SideWaveEdge className="hidden text-white lg:block" />
    </section>
  );
}
