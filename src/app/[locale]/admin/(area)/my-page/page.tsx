import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MyPageForm } from "@/components/admin/my-page-form";
import { FormSkeleton } from "@/components/ui/form-skeleton";
import { requireTeacher } from "@/server/auth/current";
import { myPage } from "@/server/teachers/teachers";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.myPage");
  return { title: t("title") };
}

export default async function MyPage() {
  const t = await getTranslations("Admin.myPage");
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
      <Suspense fallback={<FormSkeleton />}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  const { teacherId } = await requireTeacher();
  const page = await myPage(teacherId);
  if (!page) notFound();
  const url = `${process.env.APP_URL ?? ""}/${page.slug}`;
  return <MyPageForm url={url} brandName={page.brandName} bio={page.bio ?? ""} />;
}
