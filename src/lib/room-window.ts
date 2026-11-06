/** How early each side may enter, and how long Mona may stay after the end. */
export const LEARNER_EARLY_MINUTES = 5;
export const TEACHER_EARLY_MINUTES = 10;
export const TEACHER_LATE_MINUTES = 30;

const MINUTE = 60_000;

export type RoomRole = "teacher" | "student";

/** When this side may be in the room: learners from 5 min before to the end, Mona from 10. */
export function roomWindow(role: RoomRole, s: { startsAt: Date; endsAt: Date }) {
  return role === "teacher"
    ? {
        opensAt: new Date(s.startsAt.getTime() - TEACHER_EARLY_MINUTES * MINUTE),
        closesAt: new Date(s.endsAt.getTime() + TEACHER_LATE_MINUTES * MINUTE),
      }
    : {
        opensAt: new Date(s.startsAt.getTime() - LEARNER_EARLY_MINUTES * MINUTE),
        closesAt: s.endsAt,
      };
}
