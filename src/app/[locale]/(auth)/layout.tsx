import { SiteHeader } from "@/components/site-header";

export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <SiteHeader showLogin={false} />
      <main
        id="main"
        className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:py-16"
      >
        <div className="w-full max-w-md rounded-card bg-white p-6 shadow-sm sm:p-10">
          {children}
        </div>
      </main>
    </>
  );
}
