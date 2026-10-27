type LogoProps = {
  /** `light` = for light backgrounds, `dark` = for dark backgrounds. */
  variant?: "light" | "dark";
  /** Sets the size (font-size); the wordmark is 1.4em tall. */
  className?: string;
};

/** One crest feather, turned about the crest's base. */
function Feather({ angle }: { angle: number }) {
  return (
    <g transform={`rotate(${angle} 247.5 74)`}>
      <rect x="238.5" y="14" width="18" height="60" rx="9" className="fill-cinnamon" />
      <rect x="238.5" y="32" width="18" height="6.3" fill="#ffffff" />
      <path d="M238.5 32V23a9 9 0 0 1 18 0v9Z" fill="currentColor" />
    </g>
  );
}

/**
 * The Hoopo wordmark (Hoopo design system): lowercase "hoopo" whose middle o's are the bird's
 * eyes, under a three-feather cinnamon crest. Always Latin and LTR. Navy strokes on light
 * backgrounds, white on dark ones; the crest stays cinnamon.
 */
export function Logo({ variant = "light", className = "text-[1.75rem]" }: LogoProps) {
  return (
    <span
      dir="ltr"
      role="img"
      aria-label="Hoopo"
      className={`inline-flex items-center ${className}`}
    >
      <svg
        viewBox="0 0 610 220"
        aria-hidden="true"
        className={`h-[1.4em] w-auto ${variant === "light" ? "text-ocean" : "text-white"}`}
      >
        <Feather angle={-30} />
        <Feather angle={0} />
        <Feather angle={30} />
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M40 40V160M40 120a40 40 0 0 1 80 0V160" />
          <circle cx="195" cy="120" r="40" />
          <circle cx="300" cy="120" r="40" />
          <path d="M382 80V200" />
          <circle cx="422" cy="120" r="40" />
          <circle cx="535" cy="120" r="40" />
        </g>
        <circle cx="205" cy="124" r="14" fill="currentColor" />
        <circle cx="310" cy="124" r="14" fill="currentColor" />
      </svg>
    </span>
  );
}
