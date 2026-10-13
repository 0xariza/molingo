import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes, URL-safe. Used for session cookies and one-time links. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only the SHA-256 of a token is stored, so a database leak can't be replayed. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
