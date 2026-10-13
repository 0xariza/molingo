"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState, type InputHTMLAttributes } from "react";
import { Field } from "./field";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  hint?: string;
  error?: string;
};

export function PasswordField(props: Props) {
  const t = useTranslations("Auth");
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      dir="ltr"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          aria-pressed={visible}
          className="inline-flex size-11 items-center justify-center rounded-full text-body hover:text-ocean"
        >
          {visible ? <EyeSlash aria-hidden size={22} /> : <Eye aria-hidden size={22} />}
        </button>
      }
    />
  );
}
