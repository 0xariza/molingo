import type { MetadataRoute } from "next";

/**
 * One manifest for both languages (a manifest can't vary per locale). "/" sends the user to the
 * saved locale, then the proxy sends signed-in users to their area.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hoopo | هوپو",
    short_name: "Hoopo",
    description:
      "Live English classes with a personal roadmap. کلاس‌های زنده‌ی انگلیسی با نقشه‌ی مسیر شخصی.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1B2540",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
