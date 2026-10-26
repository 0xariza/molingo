import type { RoomRole } from "@/server/live/room";

/** What the classroom pages hand the client: one session's room, already allowed. */
export type ClassroomInfo = {
  sessionId: string;
  role: RoomRole;
  /** Class name and level, in the page's language. */
  title: string;
  /** "18:00–19:30 · Tehran time". */
  when: string;
  startsAt: Date;
  /** Where "back" and leaving go: the dashboard, or Mona's class page. */
  backHref: string;
};

/** What the person chose on the pre-join screen. */
export type JoinChoices = {
  audio: boolean;
  video: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
  audioOutputId?: string;
  /** Weak network: receive audio only, send no video. */
  audioOnly: boolean;
};
