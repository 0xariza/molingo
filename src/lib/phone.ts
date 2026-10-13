import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { toLatinDigits } from "./format";

/**
 * Normalizes user input to E.164. Iranian numbers may be typed as 0912…, 912…, +98…, 0098…,
 * with Persian or Arabic digits and spaces/dashes. Foreign numbers need a + prefix.
 * Returns null for anything that isn't a valid number.
 */
export function normalizePhone(input: string): string | null {
  const cleaned = toLatinDigits(input)
    .replace(/[\s\-().‌‎‏]/g, "")
    .replace(/^00/, "+");
  if (!/^\+?\d{7,15}$/.test(cleaned)) return null;
  const parsed = parsePhoneNumberFromString(cleaned, "IR");
  return parsed?.isValid() ? parsed.number : null;
}
