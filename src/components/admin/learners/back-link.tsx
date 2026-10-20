import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** "‹ Learners" (or back to a profile), above a learner page's title. */
export function BackLink({ href, label }: { href: string; label?: string }) {
  const t = useTranslations("Admin.learners");
  return (
    <Link
      href={href}
      className="inline-flex min-h-touch items-center gap-1.5 font-bold text-brand hover:underline"
    >
      <CaretLeft aria-hidden size={18} className="icon-directional" />
      {label ?? t("back")}
    </Link>
  );
}
