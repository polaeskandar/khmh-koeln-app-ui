/** A font as next/font returns it: `style.fontFamily` is "'Oxanium', 'Oxanium Fallback'". */
type NextFont = { style: { fontFamily: string } }

/**
 * A font stack with every font's own face before any stand-in. next/font gives each font a
 * stand-in made from the device's Arial, to keep the layout steady while the font loads. On
 * Macs and Windows, Arial has Arabic letters: a stand-in right after Oxanium would draw every
 * Arabic letter, and the Arabic font would never be used.
 */
export function fontStack(...fonts: NextFont[]): string {
  const families = fonts.map((font) =>
    font.style.fontFamily
      .split(",")
      .map((family) => family.trim())
      .filter(Boolean)
  )
  return [
    ...families.map(([face]) => face),
    ...families.flatMap(([, ...standIns]) => standIns),
    "ui-sans-serif",
    "system-ui",
    "sans-serif",
  ].join(", ")
}
