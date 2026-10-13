/** Pill button styles for links and buttons. One source so every CTA looks the same. */
const base =
  "inline-flex min-h-touch items-center justify-center gap-2 rounded-pill px-6 text-base font-bold transition active:translate-y-px disabled:opacity-70";

const variants = {
  /** Main action on light backgrounds. */
  primary: "bg-brand text-white hover:bg-deep",
  /** Main action on ocean backgrounds (sand on navy passes AA). */
  sand: "bg-sand text-ocean hover:bg-[#f5d18a]",
  /** Secondary action on ocean backgrounds. */
  ghostLight: "border border-whale/60 text-white hover:border-white hover:bg-white/10",
  /** Main action on light-blue or sand panels. */
  ocean: "bg-ocean text-white hover:bg-deep",
  /** Secondary action on light backgrounds. */
  ghost: "border border-brand text-brand hover:bg-mist",
} as const;

export function buttonClass(variant: keyof typeof variants = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`.trim();
}
