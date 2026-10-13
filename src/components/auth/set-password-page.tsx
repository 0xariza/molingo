import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Link } from "@/i18n/navigation";
import { findValidAuthToken } from "@/server/auth/tokens";
import { SetPasswordForm } from "./set-password-form";

/** Shared body of /activate/[token] and /reset/[token]. */
export async function SetPasswordBody({
  params,
  kind,
}: {
  params: Promise<{ token: string }>;
  kind: "activation" | "reset";
}) {
  await connection(); // link validity depends on the current time
  const [{ token }, t] = await Promise.all([params, getTranslations("Auth")]);
  const target =
    token.length >= 20 && token.length <= 200 ? await findValidAuthToken(token, kind) : null;

  if (!target) {
    return (
      <>
        <h1 className="text-3xl">{t("linkInvalidTitle")}</h1>
        <p className="mt-3">{t("linkInvalidBody")}</p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-touch items-center rounded-pill bg-brand px-6 font-bold text-white"
        >
          {t("goToLogin")}
        </Link>
      </>
    );
  }

  const name = target.displayName;
  return (
    <>
      <h1 className="text-4xl">
        {kind === "activation" ? t("activateTitle", { name }) : t("resetTitle")}
      </h1>
      <p className="mt-2 mb-6">
        {kind === "activation" ? t("activateLead") : t("resetLead", { name })}
      </p>
      <SetPasswordForm token={token} kind={kind} phone={target.phone} />
    </>
  );
}
