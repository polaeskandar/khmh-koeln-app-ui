import { type MessageFormatElement, parse, TYPE } from "@formatjs/icu-messageformat-parser"
import { describe, expect, test } from "vitest"

export type Catalog = { [key: string]: string | Catalog }

export function flatten(catalog: Catalog, prefix = ""): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") out.set(path, value)
    else for (const [k, v] of flatten(value, path)) out.set(k, v)
  }
  return out
}

/** "count: number", "name: text", "<link>" … Plurals count as numbers. */
export function argumentsOf(message: string): string[] {
  const found = new Set<string>()
  const walk = (elements: MessageFormatElement[]) => {
    for (const e of elements) {
      if (e.type === TYPE.argument) found.add(`${e.value}: text`)
      else if (e.type === TYPE.number) found.add(`${e.value}: number`)
      else if (e.type === TYPE.date || e.type === TYPE.time) found.add(`${e.value}: date`)
      else if (e.type === TYPE.plural) {
        found.add(`${e.value}: number`)
        for (const option of Object.values(e.options)) walk(option.value)
      } else if (e.type === TYPE.select) {
        found.add(`${e.value}: select`)
        for (const option of Object.values(e.options)) walk(option.value)
      } else if (e.type === TYPE.tag) {
        found.add(`<${e.value}>`)
        walk(e.children)
      }
    }
  }
  walk(parse(message))
  return [...found].sort()
}

/**
 * Checks that each translation carries every English message, with the same arguments used the
 * same way, so nothing shows a raw key or drops a name or a count. English is the reference.
 */
export function checkTranslations(
  what: string,
  english: Catalog,
  translations: [string, Catalog][]
) {
  const reference = flatten(english)

  describe.each(translations)(`the %s ${what}`, (_, catalog) => {
    const translated = flatten(catalog)

    test("has every English message and no others", () => {
      expect([...translated.keys()].filter((k) => !reference.has(k))).toEqual([])
      expect([...reference.keys()].filter((k) => !translated.has(k))).toEqual([])
    })

    test("uses the same arguments in every message", () => {
      const different = [...reference]
        .filter(([key]) => translated.has(key))
        .flatMap(([key, message]) => {
          const want = argumentsOf(message).join(", ")
          const got = argumentsOf(translated.get(key)!).join(", ")
          return want === got ? [] : [`${key}: ${got} instead of ${want}`]
        })
      expect(different).toEqual([])
    })

    test("has no empty messages", () => {
      expect([...translated].filter(([, m]) => m.trim() === "").map(([k]) => k)).toEqual([])
    })
  })
}
