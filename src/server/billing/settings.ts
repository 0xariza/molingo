import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, type Db } from "@/db";
import { paymentSettings } from "@/db/schema";
import { toLatinDigits } from "@/lib/format";

export type PaymentSettings = typeof paymentSettings.$inferSelect;

const DEFAULTS = {
  cardNumber: null,
  cardHolder: null,
  sheba: null,
  dueDays: 7,
  graceDays: 3,
  roundTo: 1000,
  autoIssue: false,
  smsBefore: true,
  smsOverdue: true,
  smsApproved: true,
  smsRejected: true,
  smsManual: false,
} as const;

type Exec = Pick<Db, "select">;

/** The teacher's settings; a teacher who never saved any gets the defaults. */
export async function getSettings(exec: Exec, teacherId: string): Promise<PaymentSettings> {
  const [row] = await exec
    .select()
    .from(paymentSettings)
    .where(eq(paymentSettings.teacherId, teacherId));
  return row ?? { teacherId, updatedAt: new Date(), ...DEFAULTS };
}

const digits = (v: string) => toLatinDigits(v).replace(/[\s-]/g, "");

export const settingsSchema = z.object({
  cardNumber: z
    .string()
    .transform(digits)
    .refine((v) => v === "" || /^\d{16}$/.test(v), "card"),
  cardHolder: z.string().trim().max(80),
  sheba: z
    .string()
    .transform((v) => digits(v).toUpperCase())
    .refine((v) => v === "" || /^IR\d{24}$/.test(v), "sheba"),
  dueDays: z.coerce.number().pipe(z.union([z.literal(3), z.literal(7), z.literal(14)])),
  graceDays: z.coerce.number().pipe(z.union([z.literal(0), z.literal(3), z.literal(7)])),
  roundTo: z.coerce.number().pipe(z.union([z.literal(1000), z.literal(10000)])),
  autoIssue: z.boolean(),
  smsBefore: z.boolean(),
  smsOverdue: z.boolean(),
  smsApproved: z.boolean(),
  smsRejected: z.boolean(),
  smsManual: z.boolean(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export async function saveSettings(teacherId: string, input: SettingsInput) {
  const values = {
    ...input,
    cardNumber: input.cardNumber || null,
    cardHolder: input.cardHolder || null,
    sheba: input.sheba || null,
  };
  await db
    .insert(paymentSettings)
    .values({ teacherId, ...values })
    .onConflictDoUpdate({ target: paymentSettings.teacherId, set: values });
}
