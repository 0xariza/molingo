import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** Public pages are open; every signed-in area, form flow and API route is not for search. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/j/",
        "/b/",
        "/*/admin",
        "/*/app",
        "/*/owner",
        "/*/login",
        "/*/activate/",
        "/*/reset/",
        "/*/l/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
