import { useId } from "react";

/** Crest angles: closed while listening, half-open by default, fanned out on success. */
const CRESTS = {
  closed: { angles: [38, 50, 62, 74, 86], top: 30 },
  neutral: { angles: [-34, -17, 0, 17, 34], top: 18 },
  open: { angles: [-54, -27, 0, 27, 54], top: 18 },
} as const;

/**
 * Hoopo the hoopoe (Hoopo design system). Its colours never change with the theme. Decorative:
 * the text next to it says what it means.
 */
export function Mascot({
  state = "neutral",
  className = "size-21",
}: {
  state?: keyof typeof CRESTS;
  className?: string;
}) {
  const clip = useId();
  const { angles, top } = CRESTS[state];
  // Listening: the eyes look up; otherwise they look at you.
  const pupil = state === "closed" ? { dx: 0, dy: -4 } : { dx: 4, dy: 3 };
  return (
    <svg aria-hidden="true" viewBox="0 0 240 240" className={className}>
      <defs>
        <clipPath id={clip}>
          <ellipse cx="160" cy="164" rx="22" ry="34" transform="rotate(-24 160 164)" />
        </clipPath>
      </defs>
      {angles.map((a) => (
        <g key={a} transform={`rotate(${a} 120 104)`}>
          <rect x="112" y={top} width="16" height={104 - top} rx="8" fill="#e27a3f" />
          <rect x="112" y={top + 16} width="16" height="5.6" fill="#fff" />
          <path d={`M112 ${top + 16}V${top + 8}a8 8 0 0 1 16 0V${top + 16}Z`} fill="#1b2540" />
        </g>
      ))}
      <circle cx="120" cy="146" r="70" fill="#e27a3f" />
      <ellipse cx="116" cy="174" rx="40" ry="32" fill="#f8cfaa" />
      <g clipPath={`url(#${clip})`}>
        <rect x="128" y="110" width="70" height="100" fill="#fff" />
        {[134, 154, 174].map((y) => (
          <rect key={y} x="128" y={y} width="70" height="10" fill="#1b2540" />
        ))}
      </g>
      {[98, 142].map((x) => (
        <g key={x}>
          <circle cx={x} cy="132" r="18" fill="#fff" />
          <circle cx={x + pupil.dx} cy={132 + pupil.dy} r="9" fill="#1b2540" />
          <circle cx={x + pupil.dx + 3} cy={128 + pupil.dy} r="3" fill="#fff" />
        </g>
      ))}
      <path d="M110 152Q120 146 130 152Q127 165 118 175Q119 162 110 152Z" fill="#1b2540" />
      <path d="M104 214v10M136 214v10" stroke="#1b2540" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
