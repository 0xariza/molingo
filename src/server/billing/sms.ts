import { eq } from "drizzle-orm";
import { db } from "@/db";
import { smsMessages } from "@/db/schema";

type Sms = {
  teacherId: string;
  studentId: string | null;
  /** E.164, as stored on the user. */
  phone: string;
  kind: string;
  body: string;
  /** Sent once per key (reminders). */
  dedupeKey?: string;
};

/** "+989121234567" → "09121234567". */
const local = (e164: string) => e164.replace(/^\+98/, "0");

async function deliver(to: string, text: string): Promise<void> {
  const { SMS_PROVIDER, SMS_USERNAME, SMS_API_KEY, SMS_SENDER } = process.env;
  if (SMS_PROVIDER === "melipayamak") {
    const res = await fetch("https://rest.payamak-panel.com/api/SendSMS/SendSMS", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: SMS_USERNAME ?? "",
        password: SMS_API_KEY ?? "",
        to,
        from: SMS_SENDER ?? "",
        text,
        isflash: "false",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => null)) as {
      Value?: string;
      RetStatus?: number;
    } | null;
    // A long id in Value is success; a short number is an error code even when RetStatus is 1.
    if (!res.ok || json?.RetStatus !== 1 || !/^\d{5,}$/.test(String(json?.Value ?? ""))) {
      throw new Error(`melipayamak ${res.status} ${json?.Value ?? ""}`.trim());
    }
  } else if (SMS_PROVIDER === "kavenegar") {
    const res = await fetch(`https://api.kavenegar.com/v1/${SMS_API_KEY}/sms/send.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ receptor: to, message: text, sender: SMS_SENDER ?? "" }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => null)) as { return?: { status?: number } } | null;
    if (!res.ok || json?.return?.status !== 200) throw new Error(`kavenegar ${res.status}`);
  } else {
    throw new Error("no_provider");
  }
}

/**
 * Records the message and, when a provider is set in the environment, sends it. Never throws: a
 * failed SMS must not undo the money change that caused it. Without a provider the message is only
 * logged, so development never texts anyone.
 */
export async function sendSms(m: Sms): Promise<void> {
  try {
    const [row] = await db
      .insert(smsMessages)
      .values({
        teacherId: m.teacherId,
        studentId: m.studentId,
        phone: m.phone,
        kind: m.kind,
        body: m.body,
        status: "logged",
        dedupeKey: m.dedupeKey,
      })
      .onConflictDoNothing()
      .returning({ id: smsMessages.id });
    if (!row || !process.env.SMS_PROVIDER) return;
    try {
      await deliver(local(m.phone), m.body);
      await db.update(smsMessages).set({ status: "sent" }).where(eq(smsMessages.id, row.id));
    } catch (e) {
      const error = e instanceof Error ? e.message.slice(0, 200) : "error";
      await db
        .update(smsMessages)
        .set({ status: "failed", error })
        .where(eq(smsMessages.id, row.id));
    }
  } catch (e) {
    console.error("sms log failed", e);
  }
}
