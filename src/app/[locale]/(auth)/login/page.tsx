import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { FormSkeleton } from "@/components/ui/form-skeleton";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/server/auth/current";
import { homePathFor } from "@/server/auth/policy";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("loginTitle"), robots: { index: false } };
}

export default function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const t = useTranslations("Auth");
  return (
    <>
      <h1 className="text-4xl">{t("loginTitle")}</h1>
      <p className="mt-2 mb-6">{t("loginLead")}</p>
      {/* A skeleton, not a second form: a tap on a fallback form during the swap would submit natively. */}
      <Suspense fallback={<FormSkeleton />}>
        <LoginFormForRequest searchParams={searchParams} />
      </Suspense>
      <p className="mt-6 text-sm">{t("forgot")}</p>
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
