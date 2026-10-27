import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { formatTime } from "@/lib/format";
import { classTitle } from "@/lib/names";
import type { SessionUser } from "@/server/auth/sessions";
import {
  joinLevelCheckAction,
  joinRoomAction,
  teacherJoinLevelCheckAction,
} from "@/server/live/actions";
import { teacherLevelCheck, visitorLevelCheck } from "@/server/live/level-check";
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
      join={joinRoomAction.bind(null, room.sessionId)}
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
        backLabel: teacher ? t("backClass") : t("backHome"),
        moderation: true,
      }}
    />
  );
}

/**
 * A booked level check's 1:1 room: the visitor comes with the code from their link, Mona (already
 * checked by her page) with the slot id. Same pre-join and room as a class, without moderation.
 */
export async function LevelCheckPage(props: { code: string } | { slotId: string }) {
  const visitor = "code" in props;
  const [t, locale, access] = await Promise.all([
    getTranslations("Classroom"),
    getLocale() as Promise<Locale>,
    visitor ? visitorLevelCheck(props.code) : teacherLevelCheck(props.slotId),
  ]);
  const backHref = visitor ? "/" : "/admin/schedule";
  const backLabel = visitor ? t("levelCheck.backSite") : t("levelCheck.backSchedule");
  if (!access.ok) {
    if (access.error === "notFound") notFound();
    return (
      <ClosedRoom
        message={t(`errors.${access.error}`, {
          time: access.opensAt ? formatTime(access.opensAt, locale) : "",
        })}
        backHref={backHref}
        backLabel={backLabel}
      />
    );
  }
  const { room } = access;
  return (
    <Classroom
      join={
        visitor
          ? joinLevelCheckAction.bind(null, props.code)
          : teacherJoinLevelCheckAction.bind(null, props.slotId)
      }
      info={{
        sessionId: room.slotId,
        role: room.role,
        title: visitor ? t("levelCheck.title") : t("levelCheck.titleWith", { name: room.name }),
        when: t("when", {
          from: formatTime(room.startsAt, locale),
          to: formatTime(room.endsAt, locale),
        }),
        startsAt: room.startsAt,
        backHref,
        backLabel,
        moderation: false,
        visitor: visitor ? undefined : access.visitor,
      }}
    />
  );
}

/** Dark placeholder while the session check runs. */
export function ClassroomSkeleton() {
  return <div aria-hidden="true" className="min-h-dvh animate-pulse bg-page" />;
}
