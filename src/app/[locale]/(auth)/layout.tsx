import { AuthPanel } from "@/components/auth/auth-panel";
import { SiteHeader } from "@/components/site-header";

/** Brand panel beside the form on desktop; a short welcome band above it on phones. */
export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <SiteHeader tone="ocean" showLogin={false} />
      <main
        id="main"
        className="grid flex-1 content-start lg:grid-cols-[1fr_1.1fr] lg:content-normal lg:bg-white"
      >
        <AuthPanel />
        <div className="flex justify-center px-4 pb-12 lg:items-center lg:py-16">
          <div className="-mt-4 w-full max-w-md rounded-[2rem] border border-mist bg-white p-6 sm:p-10 lg:mt-0">
            {children}
          </div>
        </div>
      </main>
    </>
  );
}
