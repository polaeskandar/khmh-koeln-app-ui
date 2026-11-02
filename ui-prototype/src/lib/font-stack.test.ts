import { describe, expect, test } from "vitest"

import { fontStack } from "./font-stack"

const font = (fontFamily: string) => ({ style: { fontFamily } })

describe("the font stack", () => {
  test("puts the Arabic font before the Latin font's Arial stand-in", () => {
    expect(
      fontStack(font("'Oxanium', 'Oxanium Fallback'"), font("'Vazirmatn', 'Vazirmatn Fallback'"))
    ).toBe(
      "'Oxanium', 'Vazirmatn', 'Oxanium Fallback', 'Vazirmatn Fallback', ui-sans-serif, system-ui, sans-serif"
    )
  })

  test("works for fonts without a stand-in", () => {
    expect(fontStack(font("'Geist'"), font("'Vazirmatn'"))).toBe(
      "'Geist', 'Vazirmatn', ui-sans-serif, system-ui, sans-serif"
    )
  })
})
