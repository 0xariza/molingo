import {
  BookOpen,
  ChatCircleDots,
  Headphones,
  PencilSimpleLine,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { HomeworkType } from "@/server/homework/types";

/** One icon and tone per homework type, shared by the teacher's and learners' pages. */
export const TYPE_LOOK: Record<HomeworkType, { icon: Icon; tone: string }> = {
  listening: { icon: Headphones, tone: "bg-mist text-brand" },
  writing: { icon: PencilSimpleLine, tone: "bg-[#eef1f7] text-ocean" },
  speaking: { icon: ChatCircleDots, tone: "bg-cinnamon-soft text-cinnamon-ink" },
  reading: { icon: BookOpen, tone: "bg-[#f3efe3] text-[#6b4e00]" },
};
