import { z } from "zod";
import { db } from "@/db";
import { waitlistEmails } from "@/db/schema";
import { locales } from "@/i18n/routing";

export const waitlistInputSchema = z.object({
  email: z.string().trim().toLowerCase().max(254, "email").pipe(z.email("email")),
  locale: z.enum(locales),
});

/**
 * Adds an email to the AI-tutor waitlist. Joining twice is not an error, and the caller can't
 * tell whether the address was already there (no list-membership leak).
 */
export async function joinWaitlist(input: z.output<typeof waitlistInputSchema>): Promise<void> {
  await db
    .insert(waitlistEmails)
    .values(input)
    .onConflictDoNothing({ target: waitlistEmails.email });
}
