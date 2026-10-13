import { CheckCircle } from "@phosphor-icons/react/dist/ssr";

export function FormSuccess({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="flex items-start gap-3 rounded-2xl bg-mist px-5 py-4 font-semibold text-ocean"
    >
      <CheckCircle aria-hidden size={24} weight="fill" className="shrink-0 text-brand" />
      {children}
    </p>
  );
}
