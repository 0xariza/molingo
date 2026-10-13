import { useLocale, useTranslations } from "next-intl";
import { logoutAction } from "@/server/auth/actions";

export function LogoutButton() {
  const t = useTranslations("Common");
  const locale = useLocale();
  return (
    <form action={logoutAction}>
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        className="inline-flex min-h-touch items-center rounded-pill px-4 text-sm font-semibold text-body hover:bg-mist hover:text-ocean"
      >
        {t("logout")}
      </button>
    </form>
  );
}
