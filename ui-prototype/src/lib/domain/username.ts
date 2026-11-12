export const USERNAME_MIN = 3
export const USERNAME_MAX = 32
export const PASSWORD_MIN = 10

export type UsernameProblem = "required" | "length" | "characters" | "start" | "end" | "separators"

const ALLOWED = /^[a-z0-9._-]+$/
const SEPARATOR_RUN = /[._-]{2,}/

export function normalizeUsername(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase()
}

export function usernameProblem(normalized: string): UsernameProblem | null {
  if (normalized === "") {
    return "required"
  }

  if (normalized.length < USERNAME_MIN || normalized.length > USERNAME_MAX) {
    return "length"
  }

  if (!ALLOWED.test(normalized)) {
    return "characters"
  }

  if (!/^[a-z]/.test(normalized)) {
    return "start"
  }

  if (!/[a-z0-9]$/.test(normalized)) {
    return "end"
  }

  return SEPARATOR_RUN.test(normalized) ? "separators" : null
}

const TRANSLITERATION: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" }

export function suggestUsername(firstName: string, lastName: string): string {
  const part = (value: string) =>
    value
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => TRANSLITERATION[c] ?? c)
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "")

  return [part(firstName), part(lastName)].filter(Boolean).join(".").slice(0, USERNAME_MAX)
}
