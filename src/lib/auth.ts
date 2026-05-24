// Password hashing and token generation. Uses Node's built-in crypto — no
// external dependency. Server-only.

import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/** Hashes a password as "salt:hash" (both hex). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** Verifies a password against a stored "salt:hash" string. */
export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}

/** A random opaque token for sessions and sync devices. */
export function randomToken(): string {
  return randomBytes(32).toString("hex");
}
