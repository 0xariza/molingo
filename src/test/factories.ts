import { sql } from "drizzle-orm";
import { authTokens, leads, levelCheckSlots, users } from "@/db/schema";
import { generateToken, hashToken } from "@/server/auth/crypto";
import { hashPassword } from "@/server/auth/password";
import type { TestDb } from "./database";

/** Empties every application table (keeps the schema). */
export async function resetDb(db: TestDb) {
  await db.execute(sql`
    do $$ declare r record; begin
      for r in select tablename from pg_tables where schemaname = 'public' loop
        execute 'truncate table ' || quote_ident(r.tablename) || ' restart identity cascade';
      end loop;
    end $$;`);
}

export async function createUser(
  db: TestDb,
  overrides: Partial<typeof users.$inferInsert> & { password?: string } = {},
) {
  const { password, ...rest } = overrides;
  const [user] = await db
    .insert(users)
    .values({
      phone: "+989121234567",
      role: "student",
      displayName: "Sara",
      passwordHash: password ? await hashPassword(password) : null,
      ...rest,
    })
    .returning();
  return user;
}

/** Inserts a one-time link token directly and returns the raw token for the URL. */
export async function createAuthToken(
  db: TestDb,
  userId: string,
  kind: "activation" | "reset",
  expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000),
) {
  const token = generateToken();
  await db.insert(authTokens).values({ id: hashToken(token), userId, kind, expiresAt });
  return token;
}

/** Opens a free-session time; with `bookedBy`, it is already taken by a lead with that name. */
export async function createLevelCheckSlot(
  db: TestDb,
  startsAt: Date,
  bookedBy?: { name: string; phone: string },
) {
  const [lead] = bookedBy
    ? await db
        .insert(leads)
        .values({ ...bookedBy, locale: "en", status: "scheduled" })
        .returning()
    : [];
  const [slot] = await db
    .insert(levelCheckSlots)
    .values({ startsAt, leadId: lead?.id })
    .returning();
  return slot;
}
