import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SetPasswordBody } from "@/components/auth/set-password-page";
import { FormSkeleton } from "@/components/ui/form-skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("activatePageTitle"), robots: { index: false }, referrer: "no-referrer" };
}

export default function ActivatePage({ params }: PageProps<"/[locale]/activate/[token]">) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <SetPasswordBody params={params} kind="activation" />
    </Suspense>
  );
}
