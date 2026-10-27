import { desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { teacherLeads } from "@/db/schema";
import { locales } from "@/i18n/routing";
import { toLatinDigits } from "@/lib/format";
import { phoneField } from "../forms";

/** Error keys map to `Home.start.errors`. */
export const teacherLeadSchema = z.object({
  name: z.string().trim().min(2, "name").max(80, "name"),
  phone: phoneField,
  learners: z
    .string()
    .transform((v) => (v.trim() === "" ? NaN : Number(toLatinDigits(v.trim()))))
    .pipe(z.number("learners").int("learners").min(0, "learners").max(5000, "learners")),
  locale: z.enum(locales),
});

/** A teacher asks for early access (no self sign-up until Stage 3). */
export async function createTeacherLead(input: z.output<typeof teacherLeadSchema>) {
  await db.insert(teacherLeads).values(input);
}

/** Newest first, for the owner. */
export async function listTeacherLeads() {
  return db.select().from(teacherLeads).orderBy(desc(teacherLeads.createdAt)).limit(200);
}
