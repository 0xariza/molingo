/** Soft wave where a dark ocean band melts into the page background (the brand's sea motif). Decorative. */
const WAVE = "M0 50C120 20 240 20 360 50S600 80 720 50 960 20 1080 50 1320 80 1440 50V90H0Z";

/** Along the bottom of a band. */
export function WaveEdge({ className = "h-14 sm:h-20" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`block w-full ${className}`}
    >
      <path fill="var(--color-surface)" d={WAVE} />
    </svg>
  );
}

/**
 * Along the inline-end side of a band (right in English, left in Persian). Parent: `relative`.
 * The colour (`text-*`) is the area beyond the edge.
 */
export function SideWaveEdge({ className = "text-surface" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 90 1440"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`absolute inset-y-0 -end-px h-full w-16 rtl:-scale-x-100 ${className}`}
    >
      {/* The bottom-edge wave turned on its side: x and y swapped, surface on the outer (end) side. */}
      <path
        fill="currentColor"
        d="M50 0C20 120 20 240 50 360S80 600 50 720 20 960 50 1080 80 1320 50 1440H90V0Z"
      />
    </svg>
  );
}
