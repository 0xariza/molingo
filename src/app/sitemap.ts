import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { platformHomeReady, siteUrl } from "@/lib/site";
import { listTeacherSlugs } from "@/server/teachers/teachers";

/** Public pages only, each with every language as an alternate (including itself). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = [
    ...(process.env.PLATFORM_HOME === "on" && platformHomeReady ? [""] : []),
    ...(await listTeacherSlugs()).map((slug) => `/${slug}`),
  ];
  const languages = (path: string) =>
    Object.fromEntries(routing.locales.map((l) => [l, `${siteUrl}/${l}${path}`]));
  return paths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${siteUrl}/${locale}${path}`,
      alternates: { languages: languages(path) },
    })),
  );
}
