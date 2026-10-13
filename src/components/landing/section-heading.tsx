import type { ReactNode } from "react";

/** Small label above a section title, led by a short rule. */
export function Eyebrow({
  children,
  className = "text-brand",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`flex items-center gap-3 text-sm font-extrabold sm:text-base ${className}`}>
      <span aria-hidden="true" className="h-0.5 w-8 shrink-0 bg-current" />
      {children}
    </p>
  );
}

type TitleProps = {
  first: ReactNode;
  second: ReactNode;
  /** How the second line stands out: a highlighter stroke, or a colour class. */
  accent?: "mark" | string;
  className?: string;
  id?: string;
};

/** Section title on two lines; the second line carries the point. */
export function SectionTitle({ first, second, accent = "mark", className = "", id }: TitleProps) {
  return (
    <h2 id={id} className={`text-5xl lg:text-6xl ${className}`}>
      {first}
      <br />
      <span className={accent === "mark" ? "mark" : accent}>{second}</span>
    </h2>
  );
}

/** Card titles use the body face, which reads better than the display face at small sizes. */
export const cardTitle =
  "font-sans text-xl font-extrabold normal-case tracking-normal leading-snug";
