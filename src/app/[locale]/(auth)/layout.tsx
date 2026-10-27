import { AuthPanel } from "@/components/auth/auth-panel";

/** Navy brand panel beside the form on desktop, a short navy band above it on phones (design: Log in). */
export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="flex flex-1 flex-col bg-surface lg:flex-row">
      <AuthPanel />
      <main
        id="main"
        className="flex flex-1 justify-center px-4 pb-12 lg:flex-[1_1_520px] lg:items-center lg:px-6 lg:py-10"
      >
        <div className="-mt-3 w-full max-w-105 self-start rounded-card border border-hairline bg-white p-6 sm:p-9 lg:mt-0 lg:self-center">
          {children}
        </div>
      </main>
    </div>
  );
}
