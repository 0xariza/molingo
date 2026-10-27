import type { ReactNode } from "react";

/** Small coloured label above a section title. */
export function Eyebrow({
  children,
  className = "text-cinnamon-ink",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={`text-[15px] font-extrabold ${className}`}>{children}</p>;
}

type TitleProps = {
  first: ReactNode;
  second: ReactNode;
  /** Colour class for the second line, which carries the point. */
  accent?: string;
  className?: string;
  id?: string;
};

/** Section title on two lines (Hoopo teacher page). */
export function SectionTitle({
  first,
  second,
  accent = "text-cinnamon-ink",
  className = "",
  id,
}: TitleProps) {
  return (
    <h2 id={id} className={`text-4xl leading-snug sm:text-5xl lg:text-[3.5rem] ${className}`}>
      {first}
      <br />
      <span className={accent}>{second}</span>
    </h2>
  );
}
