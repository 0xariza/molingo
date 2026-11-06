import { Plus } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** "Assign homework" on the Homework page: opens the form page. */
export async function AssignButton() {
  const t = await getTranslations("Admin.homework");
  return (
    <Link href="/admin/homework/new" className={buttonClass("primary")}>
      <Plus aria-hidden size={18} weight="bold" />
      {t("assign")}
    </Link>
  );
}
