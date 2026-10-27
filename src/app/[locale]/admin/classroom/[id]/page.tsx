import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ClassroomPage, ClassroomSkeleton } from "@/components/classroom/classroom-page";
import { requireTeacher } from "@/server/auth/current";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Classroom");
  return { title: t("title") };
}

export default function TeacherClassroom({ params }: PageProps<"/[locale]/admin/classroom/[id]">) {
  return (
    <Suspense fallback={<ClassroomSkeleton />}>
      <Room params={params} />
    </Suspense>
  );
}

async function Room({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireTeacher();
  const { id } = await params;
  return <ClassroomPage user={user} sessionId={id} />;
}
