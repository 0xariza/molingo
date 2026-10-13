import { notFound } from "next/navigation";

// Always a 404, so skip instant-navigation validation for this segment.
export const instant = false;

// Unknown paths under a locale render the localized not-found page.
export default function CatchAll() {
  notFound();
}
