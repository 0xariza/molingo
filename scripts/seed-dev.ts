/**
 * Local development data: Mona (admin) and Sara (student), both with the password below.
 * Refuses to run in production. Usage: pnpm db:seed
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

const DEV_PASSWORD = "dev-pass-2026";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("seed-dev must not run in production");
  const { db } = await import("../src/db");
  const { students, teachers, users } = await import("../src/db/schema");
  const { hashPassword } = await import("../src/server/auth/password");

  const passwordHash = await hashPassword(DEV_PASSWORD);
  await db.transaction(async (tx) => {
    const [mona] = await tx
      .insert(users)
      .values({ phone: "+989120000001", role: "admin", displayName: "Mona", passwordHash })
      .onConflictDoNothing()
      .returning({ id: users.id });
    if (mona) await tx.insert(teachers).values({ userId: mona.id });

    const [sara] = await tx
      .insert(users)
      .values({ phone: "+989120000002", role: "student", displayName: "Sara", passwordHash })
      .onConflictDoNothing()
      .returning({ id: users.id });
    if (sara)
      await tx.insert(students).values({
        userId: sara.id,
        fullName: "Sara",
        phone: "+989120000002",
        status: "active",
      });
  });
  console.log("Dev accounts ready: 09120000001 (admin), 09120000002 (student).");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
