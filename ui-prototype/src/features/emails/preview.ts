/**
 * Prepares an email for a preview frame: links open in a new tab, and the colors are the ones
 * chosen on the page instead of the device's (the email itself follows `prefers-color-scheme`).
 */
export function previewHtml(html: string, colors: "light" | "dark") {
  return html
    .replace("<head>", '<head>\n<base target="_blank">')
    .replace(
      "@media (prefers-color-scheme:dark)",
      colors === "dark" ? "@media all" : "@media not all"
    )
}
