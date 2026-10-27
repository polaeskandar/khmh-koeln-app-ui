import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

/**
 * Password hashing for the prototype's sign-in. The real backend uses
 * Symfony's password hasher; the mock keeps the same idea (salted, slow hash,
 * constant-time comparison) so the screens behave like the real thing.
 */

/** The password of every demo account. Shown on the sign-in page: the data is fictional. */
export const DEMO_PASSWORD = "khmk-demo"

export const MIN_PASSWORD_LENGTH = 10

const KEY_LENGTH = 32

export function hashPassword(password: string, salt: Buffer = randomBytes(16)): string {
  const hash = scryptSync(password, salt, KEY_LENGTH)
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`
}

export function verifyPassword(password: string, stored: string | null): boolean {
  const [scheme, salt, hash] = (stored ?? "").split("$")
  if (scheme !== "scrypt" || !salt || !hash) {
    // Same work as a real check, so the answer time doesn't tell whether the account exists.
    scryptSync(password, "no-account", KEY_LENGTH)
    return false
  }
  const expected = Buffer.from(hash, "hex")
  return timingSafeEqual(scryptSync(password, Buffer.from(salt, "hex"), expected.length), expected)
}

let demoHash: string | null = null

/** One hash shared by all demo accounts, so building the demo data stays fast. */
export function demoPasswordHash(): string {
  demoHash ??= hashPassword(DEMO_PASSWORD, Buffer.from("khmk-demo-accounts"))
  return demoHash
}
