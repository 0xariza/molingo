import { useTranslations } from "next-intl";
import type { LearnerStatus } from "@/server/students/learners";

const tones: Record<LearnerStatus, string> = {
  active: "bg-[#ddf5e8] text-[#14613a]",
  lead: "bg-mist text-brand",
  paused: "bg-[#fcefd3] text-[#8a520e]",
  left: "bg-[#edf0f3] text-[#4a5866]",
};

export function StatusBadge({ status }: { status: LearnerStatus }) {
  const t = useTranslations("Admin.learners.status");
  return (
    <span
      className={`inline-flex shrink-0 rounded-pill px-3 py-0.5 text-sm font-bold whitespace-nowrap ${tones[status]}`}
    >
      {t(status)}
    </span>
  );
}
