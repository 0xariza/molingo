import { Key } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { FormSkeleton } from "@/components/ui/form-skeleton";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/server/auth/current";
import { homePathFor } from "@/server/auth/policy";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("loginPageTitle"), robots: { index: false } };
}

export default function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const t = useTranslations("Auth");
  return (
    <>
      <h1 className="text-4xl sm:text-5xl">{t("loginTitle")}</h1>
      <p className="mt-2 mb-7">{t("loginLead")}</p>
      {/* A skeleton, not a second form: a tap on a fallback form during the swap would submit natively. */}
      <Suspense fallback={<FormSkeleton />}>
        <LoginFormForRequest searchParams={searchParams} />
      </Suspense>
      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-mist px-4 py-3 text-sm">
        <Key aria-hidden size={20} weight="duotone" className="mt-0.5 shrink-0 text-brand" />
        <p>
          <span className="font-bold text-ocean">{t("forgotTitle")}</span> {t("forgot")}
        </p>
      </div>
      <p className="mt-6 border-t border-mist pt-5 text-center text-sm">
        {t("noAccount")}{" "}
        <Link href={{ pathname: "/", hash: "book" }} className="font-bold text-brand underline">
          {t("bookFree")}
        </Link>
      </p>
    </>
  );
}

async function LoginFormForRequest({
  searchParams,
}: Pick<PageProps<"/[locale]/login">, "searchParams">) {
  const [locale, query, user] = await Promise.all([getLocale(), searchParams, getCurrentUser()]);
  if (user) redirect({ href: homePathFor(user.role), locale });
  const next = typeof query.next === "string" ? query.next : undefined;
  return <LoginForm next={next} />;
}
