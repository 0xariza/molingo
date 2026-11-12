import { useTranslations } from "next-intl";
import type { InvoiceState } from "@/server/billing/pricing";

const tone: Record<InvoiceState, string> = {
  draft: "bg-mist text-brand",
  open: "bg-[#e9f6f6] text-[#0e7c7f]",
  partial: "bg-[#fdf3dc] text-[#6b4e00]",
  overdue: "bg-[#fdecea] text-[#b42318]",
  paid: "bg-[#e7f4ec] text-[#1f7a4d]",
  void: "bg-mist text-body",
};

/** An invoice's state as a pill; an overdue invoice that is partly paid says so. */
export function StatusTag({ state, partial = false }: { state: InvoiceState; partial?: boolean }) {
  const t = useTranslations("Admin.finance.state");
  return (
    <span
      className={`inline-flex shrink-0 rounded-pill px-3 py-0.5 text-sm font-bold ${tone[state]}`}
    >
      {state === "overdue" && partial ? t("overduePartial") : t(state)}
    </span>
  );
}
