/* eslint-disable react/jsx-no-literals -- the wordmark is the brand name, not translatable UI text */
type LogoProps = {
  /** `light` = for light backgrounds, `dark` = for dark backgrounds. */
  variant?: "light" | "dark";
  className?: string;
};

/**
 * Typographic wordmark: "mo" + "lingo". Always Latin and LTR, in both locales.
 * "mo" uses Brand blue on light backgrounds (Whale light is too pale there)
 * and Whale light on dark backgrounds.
 */
export function Logo({ variant = "light", className = "" }: LogoProps) {
  const mo = variant === "light" ? "text-brand" : "text-whale";
  const lingo = variant === "light" ? "text-ocean" : "text-white";
  return (
    <span
      dir="ltr"
      role="img"
      aria-label="Molingo"
      className={`inline-flex items-baseline font-wordmark text-2xl font-bold lowercase leading-none tracking-[0.12em] ${className}`}
    >
      <span aria-hidden="true" className={mo}>
        mo
      </span>
      <span aria-hidden="true" className={lingo}>
        lingo
      </span>
    </span>
  );
}
