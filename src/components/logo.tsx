/* eslint-disable react/jsx-no-literals -- the wordmark is the brand name, not translatable UI text */
type LogoProps = {
  /** `light` = for light backgrounds, `dark` = for dark backgrounds. */
  variant?: "light" | "dark";
  /** Sets the size (font-size); the mark scales with it. */
  className?: string;
};

/**
 * A whale tail rising from curling waves, next to the MOLINGO wordmark. Always Latin and LTR.
 * Brand blue on light backgrounds; Whale light and white on dark ones.
 */
export function Logo({ variant = "light", className = "text-[1.75rem]" }: LogoProps) {
  const mark = variant === "light" ? "text-brand" : "text-whale";
  const word = variant === "light" ? "text-brand" : "text-white";
  return (
    <span
      dir="ltr"
      role="img"
      aria-label="Molingo"
      className={`inline-flex items-center gap-[0.35em] ${className}`}
    >
      <svg viewBox="90 50 280 250" aria-hidden="true" className={`h-[1.6em] w-auto ${mark}`}>
        <g fill="currentColor">
          <path d="M196 218C198 196 200 174 204 152C176 150 134 136 98 110C128 108 166 114 204 140C222 118 248 98 276 70C274 108 252 140 222 154C220 176 222 198 226 218Z" />
          <circle cx="104" cy="176" r="7" />
        </g>
        <g fill="none" stroke="currentColor" strokeLinecap="round">
          <circle cx="304" cy="64" r="8" strokeWidth="7" />
          <circle cx="302" cy="106" r="13" strokeWidth="7" />
          <path
            strokeWidth="14"
            d="M112 222C100 192 118 170 144 170C168 170 178 192 164 204C154 212 140 204 146 194"
          />
          <path
            strokeWidth="14"
            d="M130 228C160 222 186 214 206 214C236 214 262 200 282 186C298 175 316 172 332 176"
          />
          <path strokeWidth="12" d="M122 250C170 268 250 264 318 220" />
          <path strokeWidth="10" d="M170 274C220 286 276 276 318 250" />
        </g>
      </svg>
      <span
        aria-hidden="true"
        className={`font-wordmark font-semibold uppercase leading-none tracking-[0.18em] ${word}`}
      >
        Molingo
      </span>
    </span>
  );
}
