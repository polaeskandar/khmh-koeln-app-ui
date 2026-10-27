import { useLocale } from "next-intl"

import { directionOf } from "./config"

/** "rtl" in Arabic, "ltr" otherwise. */
export function useDirection(): "ltr" | "rtl" {
  return directionOf(useLocale())
}

/**
 * The physical side where lines end: right in English and German, left in
 * Arabic. For props that only take "left" or "right", such as the side a sheet
 * slides in from or a sidebar tooltip opens towards.
 */
export function useInlineEnd(): "left" | "right" {
  return useDirection() === "rtl" ? "left" : "right"
}

/** The physical side where lines start: left in English and German, right in Arabic. */
export function useInlineStart(): "left" | "right" {
  return useDirection() === "rtl" ? "right" : "left"
}
