import type { ComboItem } from "@/components/ui/combobox";
import type { Locale } from "@/i18n/routing";
import { learnerNames } from "@/lib/names";
import { formatPhone } from "@/lib/phone";

export type Candidate = {
  id: string;
  fullNameFa: string;
  fullNameEn: string | null;
  phone: string;
  status: "lead" | "active" | "paused" | "left";
};

/** Learners as searchable items: name in the page's language first, then phone · status. */
export function learnerItems(
  people: Candidate[],
  locale: Locale,
  statusLabel: (s: Candidate["status"]) => string,
  taken: (id: string) => string | null = () => null,
): ComboItem[] {
  return people.map((p) => {
    const { primary, secondary } = learnerNames(p, locale);
    const tag = taken(p.id);
    return {
      id: p.id,
      primary,
      secondary,
      keywords: p.phone,
      meta: `${formatPhone(p.phone)} · ${statusLabel(p.status)}`,
      disabled: !!tag,
      tag: tag ?? statusLabel(p.status),
    };
  });
}
