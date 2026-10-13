import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

export type RateLimitResult = { allowed: boolean; count: number; retryAfterSec: number };

/** Fixed-window counter: increments `key` and reports whether it is still within `limit`. */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const window = sql`make_interval(secs => ${windowSec})`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart: sql`now()`, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} < now() - ${window} then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${rateLimits.windowStart} < now() - ${window} then now() else ${rateLimits.windowStart} end`,
      },
    })
    .returning({
      count: rateLimits.count,
      retryAfterSec: sql<number>`greatest(0, ceil(extract(epoch from (${rateLimits.windowStart} + ${window} - now()))))::int`,
    });
  return { allowed: row.count <= limit, count: row.count, retryAfterSec: row.retryAfterSec };
}

export async function resetRateLimit(key: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}
