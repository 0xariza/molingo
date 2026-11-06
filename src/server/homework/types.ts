/** Homework types, in the order the teacher picks them. */
export const HOMEWORK_TYPES = ["listening", "writing", "speaking", "reading"] as const;
export type HomeworkType = (typeof HOMEWORK_TYPES)[number];
