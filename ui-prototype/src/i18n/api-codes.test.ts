/**
 * Every code the API can send (`api-codes.json`, copied from the backend's `docs/api.md` code catalog with
 * the params each one carries) has an `errors.<code>` message in English, German and Arabic that uses
 * exactly those params, so a problem never shows a raw code or a missing value. A frontend PR that first
 * consumes a new code adds it to the JSON and its texts here.
 */
import { type MessageFormatElement, parse, TYPE } from "@formatjs/icu-messageformat-parser"
import { describe, expect, test } from "vitest"

import ar from "../../messages/ar.json"
import de from "../../messages/de.json"
import en from "../../messages/en.json"
import codes from "./api-codes.json"

type Catalog = { [key: string]: string | Catalog }

function messageAt(catalog: Catalog, path: string): string | undefined {
  let node: string | Catalog | undefined = catalog
  for (const part of path.split(".")) node = typeof node === "object" ? node[part] : undefined
  return typeof node === "string" ? node : undefined
}

function argumentNames(message: string): string[] {
  const found = new Set<string>()
  const walk = (elements: MessageFormatElement[]) => {
    for (const e of elements) {
      if (
        e.type === TYPE.argument ||
        e.type === TYPE.number ||
        e.type === TYPE.date ||
        e.type === TYPE.time
      )
        found.add(e.value)
      else if (e.type === TYPE.plural || e.type === TYPE.select) {
        found.add(e.value)
        for (const option of Object.values(e.options)) walk(option.value)
      } else if (e.type === TYPE.tag) walk(e.children)
    }
  }
  walk(parse(message))
  return [...found].sort()
}

describe.each([
  ["English", en],
  ["German", de],
  ["Arabic", ar],
])("the %s catalog", (_, catalog) => {
  test("has a message for every API code", () => {
    const missing = Object.keys(codes).filter(
      (code) => !messageAt(catalog as Catalog, `errors.${code}`)
    )
    expect(missing).toEqual([])
  })

  test("uses exactly the params of each code", () => {
    const different = Object.entries(codes).flatMap(([code, params]) => {
      const message = messageAt(catalog as Catalog, `errors.${code}`)
      if (message === undefined) return []
      const got = argumentNames(message).join(", ")
      const want = [...params].sort().join(", ")
      return got === want ? [] : [`${code}: {${got}} instead of {${want}}`]
    })
    expect(different).toEqual([])
  })
})
