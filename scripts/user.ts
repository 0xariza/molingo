/**
 * Account helper for the command line. The owner adds teachers on /owner and teachers add their
 * learners; this creates the owner account and makes fresh links for any login.
 *
 *   pnpm user create --role owner --phone 09121234567 --name "Reza" [--locale fa]
 *   pnpm user link --phone 09121234567 [--reset]
 *
 * Prints a one-time activation (or reset) link to send over WhatsApp/Telegram.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { parseArgs } from "node:util";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    role: { type: "string", default: "owner" },
    phone: { type: "string" },
    name: { type: "string" },
    locale: { type: "string", default: "fa" },
    reset: { type: "boolean", default: false },
  },
});

async function main() {
  // Imported after dotenv so DATABASE_URL is set.
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const { users } = await import("../src/db/schema");
  const { normalizePhone } = await import("../src/lib/phone");
  const { issueAuthToken } = await import("../src/server/auth/tokens");

  const [command] = positionals;
  const phone = values.phone && normalizePhone(values.phone);
  if (!phone) throw new Error("--phone is missing or not a valid number");
  const locale = values.locale === "en" ? "en" : "fa";
  const base = process.env.APP_URL ?? "http://localhost:3000";

  let userId: string;
  let kind: "activation" | "reset" = "activation";

  if (command === "create") {
    // Teachers are added on the owner's page, learners by their teacher; this makes the owner.
    if (values.role !== "owner") throw new Error("--role must be owner");
    if (!values.name) throw new Error("--name is required");
    const [user] = await db
      .insert(users)
      .values({ phone, role: "owner", displayName: values.name, locale })
      .returning({ id: users.id });
    userId = user.id;
    console.log(`Created owner ${values.name} (${phone}).`);
  } else if (command === "link") {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
    if (!user) throw new Error(`No user with phone ${phone}`);
    userId = user.id;
    if (values.reset) kind = "reset";
  } else {
    throw new Error("Usage: pnpm user create|link --phone … (see scripts/user.ts)");
  }

  const { token, expiresAt } = await issueAuthToken(userId, kind);
  const path = kind === "activation" ? "activate" : "reset";
  console.log(
    `\n${kind} link (valid until ${expiresAt.toISOString()}):\n${base}/${locale}/${path}/${token}\n`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
