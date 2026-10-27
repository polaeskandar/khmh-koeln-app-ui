import type { Person } from "./types"

/** Mirrors App\Shared\Domain\NameKey: collapse whitespace and trim. */
export function cleanName(value: string): string {
  return value.replace(/\s+/gu, " ").trim()
}

/** The comparison key for unique names: "  3rd  class" and "3rd Class" collide. */
export function nameKey(value: string): string {
  return cleanName(value).toLocaleLowerCase("de-DE")
}

export function fullName(p: Pick<Person, "firstName" | "lastName">): string {
  return `${p.firstName} ${p.lastName}`
}

/** What people call the person day to day: the display name if set, otherwise first and last name. */
export function preferredName(p: Pick<Person, "firstName" | "lastName" | "displayName">): string {
  return p.displayName ? `${p.displayName} ${p.lastName}` : fullName(p)
}

export function initials(p: Pick<Person, "firstName" | "lastName" | "displayName">): string {
  const first = (p.displayName ?? p.firstName).trim()
  return `${first.charAt(0)}${p.lastName.trim().charAt(0)}`.toLocaleUpperCase("de-DE")
}

/** Accent-insensitive match on every word, like the backend's name search. */
export function matchesQuery(
  p: Pick<Person, "firstName" | "lastName" | "displayName">,
  query: string
): boolean {
  const words = fold(query).split(" ").filter(Boolean)
  if (words.length === 0) return true
  const haystack = fold(`${p.firstName} ${p.lastName} ${p.displayName ?? ""}`)
  return words.every((w) => haystack.includes(w))
}

export function fold(value: string): string {
  return cleanName(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("de-DE")
}
