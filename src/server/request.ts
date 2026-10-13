import "server-only";
import { headers } from "next/headers";

/** Client IP for rate limiting. Caddy sets X-Forwarded-For; the left-most entry is the client. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
