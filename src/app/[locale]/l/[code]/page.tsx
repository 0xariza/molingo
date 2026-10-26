import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { ClassroomSkeleton, LevelCheckPage } from "@/components/classroom/classroom-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Classroom.levelCheck");
  // The code in the URL is the visitor's key: keep the page out of search results.
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The visitor's level-check room: no login, the link's code is the key (PLAN decisions log). */
export default function VisitorLevelCheck({ params }: PageProps<"/[locale]/l/[code]">) {
  return (
    <Suspense fallback={<ClassroomSkeleton />}>
      <Room params={params} />
    </Suspense>
  );
}

async function Room({ params }: { params: Promise<{ code: string }> }) {
  // No cookie is read here, so ask for request time explicitly: the room depends on now.
  await connection();
  const { code } = await params;
  return <LevelCheckPage code={code} />;
}
