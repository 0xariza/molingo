/** Pill button styles for links and buttons. One source so every CTA looks the same. */
const base =
  "inline-flex min-h-touch items-center justify-center gap-2 rounded-[14px] px-6 text-base font-bold transition active:translate-y-px disabled:opacity-70";

const variants = {
  /** Main action on light backgrounds: cinnamon with a navy label, never white. */
  primary: "bg-cinnamon text-navy hover:bg-[#d56d33]",
  /** Main action on navy backgrounds: the dark-theme cinnamon. */
  sand: "bg-room-cinnamon text-navy hover:bg-[#f29a62]",
  /** Secondary action on ocean backgrounds. */
  ghostLight: "border border-whale/60 text-white hover:border-white hover:bg-white/10",
  /** Main action on light-blue or sand panels. */
  ocean: "bg-ocean text-white hover:bg-deep",
  /** Secondary action on light backgrounds. */
  ghost: "border border-brand text-brand hover:bg-mist",
  /** Destructive confirmation (e.g. cancel a session). */
  danger: "bg-red-700 text-white hover:bg-red-800",
} as const;

export type ButtonVariant = keyof typeof variants;

export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`.trim();
}
