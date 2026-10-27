import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended Argon2id parameters (19 MiB, 2 iterations) — light enough for a 2 GB VPS.
const options = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const PASSWORD_MIN_LENGTH = 8;

const COMMON = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "87654321",
  "11111111",
  "00000000",
  "12341234",
  "password",
  "password1",
  "qwertyui",
  "qwerty123",
  "iloveyou",
  "11223344",
  "123123123",
  "abcd1234",
  "1q2w3e4r",
  "aa123456",
  "asdfghjk",
  "zxcvbnm1",
  "molingo1",
  "molingo123",
  "hoopo123",
  "hoopo1234",
]);

export type PasswordProblem = "too_short" | "too_common";

export function checkPasswordPolicy(password: string, phone?: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "too_short";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return "too_common";
  // Reject the user's own phone number (with or without the leading 0 / +98).
  if (phone) {
    const national = phone.replace(/^\+98/, "0");
    if ([phone, phone.slice(1), national, national.slice(1)].includes(password))
      return "too_common";
  }
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, options);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Verifying against this when the user doesn't exist keeps response times uniform.
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("not-a-real-password-" + Math.random());
  return dummyHash;
}
