import type { Icon } from "@phosphor-icons/react";

const tones = {
  blue: "bg-mist text-brand",
  sand: "bg-[#fcefd3] text-[#8a520e]",
  green: "bg-[#ddf5e8] text-[#14613a]",
} as const;

/** One number at a glance on a dashboard. */
export function StatCard({
  icon: IconComponent,
  tone,
  label,
  value,
  detail,
}: {
  icon: Icon;
  tone: keyof typeof tones;
  label: string;
  value: string;
  /** A short line of context under the number. */
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-card border border-hairline bg-white p-5">
      <span className={`grid size-13 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}>
        <IconComponent aria-hidden size={24} />
      </span>
      <div className="leading-tight">
        <p className="text-sm">{label}</p>
        <p className="font-heading text-4xl text-ocean">{value}</p>
        {detail && <p className="mt-1 text-sm">{detail}</p>}
      </div>
    </div>
  );
}
