import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ClassroomPage, ClassroomSkeleton } from "@/components/classroom/classroom-page";
import { requireStudent } from "@/server/auth/current";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Classroom");
  return { title: t("title") };
}

export default function LearnerClassroom({ params }: PageProps<"/[locale]/app/classroom/[id]">) {
  return (
    <Suspense fallback={<ClassroomSkeleton />}>
      <Room params={params} />
    </Suspense>
  );
}

async function Room({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  const { id } = await params;
  return <ClassroomPage user={user} sessionId={id} />;
}
