import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { formatTime } from "@/lib/format";
import { classTitle } from "@/lib/names";
import type { SessionUser } from "@/server/auth/sessions";
import { roomFor } from "@/server/live/room";
import { Classroom } from "./classroom";
import { ClosedRoom } from "./closed-room";

/**
 * Both classroom routes: checks the join rule for this user now, then shows the pre-join and
 * room, or why the room isn't open. Leaving goes back to the dashboard (learners) or the class
 * page (Mona).
 */
export async function ClassroomPage({ user, sessionId }: { user: SessionUser; sessionId: string }) {
  const [t, locale, access] = await Promise.all([
    getTranslations("Classroom"),
    getLocale() as Promise<Locale>,
    roomFor(user, sessionId),
  ]);
  const teacher = user.role !== "student";
  if (!access.ok) {
    if (access.error === "notFound") notFound();
    return (
      <ClosedRoom
        message={t(`errors.${access.error}`, {
          time: access.opensAt ? formatTime(access.opensAt, locale) : "",
        })}
        backHref={teacher ? "/admin/classes" : "/app"}
        backLabel={teacher ? t("backClass") : t("backHome")}
      />
    );
  }
  const { room } = access;
  return (
    <Classroom
      info={{
        sessionId: room.sessionId,
        role: room.role,
        title: t("withLevel", { name: classTitle(room, locale), level: room.level }),
        when: t("when", {
          from: formatTime(room.startsAt, locale),
          to: formatTime(room.endsAt, locale),
        }),
        startsAt: room.startsAt,
        backHref: teacher ? `/admin/classes/${room.classId}` : "/app",
      }}
    />
  );
}

/** Dark placeholder while the session check runs. */
export function ClassroomSkeleton() {
  return <div aria-hidden="true" className="min-h-dvh animate-pulse bg-page" />;
}
