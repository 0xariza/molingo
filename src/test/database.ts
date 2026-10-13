import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@/db/schema";

export type TestDb = PostgresJsDatabase<typeof schema>;

/**
 * Drops and recreates a dedicated test database, then applies all migrations.
 * Refuses names that don't end in `_test` / `_e2e`, so it can never touch dev or production data.
 */
export async function recreateDatabase(url: string): Promise<void> {
  const parsed = new URL(url);
  const name = parsed.pathname.slice(1);
  if (!/_(test|e2e)$/.test(name))
    throw new Error(`Refusing to recreate non-test database "${name}"`);

  parsed.pathname = "/postgres";
  const admin = postgres(parsed.toString(), { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists "${name}" with (force)`);
  await admin.unsafe(`create database "${name}"`);
  await admin.end();

  const client = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
}

export function connectTestDb(url: string): { db: TestDb; close: () => Promise<void> } {
  const client = postgres(url, { max: 2, onnotice: () => {} });
  return { db: drizzle(client, { schema, casing: "snake_case" }), close: () => client.end() };
}
