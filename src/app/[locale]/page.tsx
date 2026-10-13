import { useTranslations } from "next-intl";
import { AboutMona } from "@/components/landing/about-mona";
import { AiAssistant } from "@/components/landing/ai-assistant";
import { Booking } from "@/components/landing/booking";
import { ClassFormats } from "@/components/landing/class-formats";
import { Faq } from "@/components/landing/faq";
import { Hero } from "@/components/landing/hero";
import { Highlights } from "@/components/landing/highlights";
import { Roadmap } from "@/components/landing/roadmap";
import { SiteFooter } from "@/components/landing/site-footer";
import { Week } from "@/components/landing/week";
import { SiteHeader } from "@/components/site-header";

const SECTIONS = ["roadmap", "ai", "classes", "mona", "faq"] as const;

export default function HomePage() {
  const nav = useTranslations("Landing.nav");
  return (
    <>
      <SiteHeader tone="ocean">
        {SECTIONS.map((id) => (
          <a key={id} href={`#${id}`} className="hover:text-white">
            {nav(id)}
          </a>
        ))}
      </SiteHeader>
      <main id="main" className="flex-1">
        <Hero />
        <Highlights />
        <Roadmap />
        <AiAssistant />
        <Week />
        <ClassFormats />
        <Booking />
        <AboutMona />
        <Faq />
      </main>
      <SiteFooter />
    </>
  );
}
