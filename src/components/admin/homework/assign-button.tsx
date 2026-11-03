"use client";

import { Plus } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import type { AssignTarget } from "@/server/homework/assignments";
import { AssignDialog } from "./assign-dialog";

/** "Assign homework" on the Homework page: pick a class, then one of its held sessions. */
export function AssignButton({ targets }: { targets: AssignTarget[] }) {
  const t = useTranslations("Admin.homework");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary")}>
        <Plus aria-hidden size={18} weight="bold" />
        {t("assign")}
      </button>
      {open && <AssignDialog targets={targets} onClose={() => setOpen(false)} />}
    </>
  );
}
