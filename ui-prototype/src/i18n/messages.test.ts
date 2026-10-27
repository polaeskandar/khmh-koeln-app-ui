/**
 * The German and Arabic catalogs carry every English message, with the same
 * arguments used the same way, so no screen shows a raw key or drops a name
 * or a count. English is the reference: its keys and arguments are what the
 * code is type-checked against.
 */
import { type MessageFormatElement, parse, TYPE } from "@formatjs/icu-messageformat-parser"
import { describe, expect, test } from "vitest"

import ar from "../../messages/ar.json"
import de from "../../messages/de.json"
import en from "../../messages/en.json"

type Catalog = { [key: string]: string | Catalog }

function flatten(catalog: Catalog, prefix = ""): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") out.set(path, value)
    else for (const [k, v] of flatten(value, path)) out.set(k, v)
  }
  return out
}

/** "count: number", "name: text", "<link>" … Plurals count as numbers. */
function argumentsOf(message: string): string[] {
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

const english = flatten(en)

describe.each([
  ["German", de],
  ["Arabic", ar],
])("the %s catalog", (_, catalog) => {
  const translated = flatten(catalog as Catalog)

  test("has every English message and no others", () => {
    expect([...translated.keys()].filter((k) => !english.has(k))).toEqual([])
    expect([...english.keys()].filter((k) => !translated.has(k))).toEqual([])
  })

  test("uses the same arguments in every message", () => {
    const different = [...english]
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
