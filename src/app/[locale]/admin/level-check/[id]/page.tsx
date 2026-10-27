import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ClassroomSkeleton, LevelCheckPage } from "@/components/classroom/classroom-page";
import { requireTeacher } from "@/server/auth/current";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Classroom.levelCheck");
  return { title: t("title") };
}

export default function TeacherLevelCheck({
  params,
}: PageProps<"/[locale]/admin/level-check/[id]">) {
  return (
    <Suspense fallback={<ClassroomSkeleton />}>
      <Room params={params} />
    </Suspense>
  );
}

async function Room({ params }: { params: Promise<{ id: string }> }) {
  const { teacherId } = await requireTeacher();
  const { id } = await params;
  return <LevelCheckPage slotId={id} teacherId={teacherId} />;
}
