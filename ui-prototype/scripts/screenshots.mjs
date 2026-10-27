#!/usr/bin/env node
/**
 * Walks through the prototype like its users do and saves the screenshots in
 * ../ui-mockups/admin and ../ui-mockups/parent. It also checks the end-to-end
 * scenario of the lesson, homework and parent portal brief:
 *
 *   1. A servant (Daniel, 3rd Class) opens Sunday School › 3rd Class › Lessons,
 *      prepares "The Good Samaritan" for Sunday 15 November and publishes two
 *      homework tasks.
 *   2. A parent (Hoda) signs in, picks Mina, opens the homework and marks it
 *      done.
 *   3. The servant sees the completion in the stage's homework overview.
 *
 * Then it takes the MVP screens. An administrator deletes a service that
 * never met and creates a new one. Then someone registers, waits for approval
 * and is approved; the main screens are taken again in German, Arabic and dark
 * mode; and at the very end a family's request to erase a child's data is
 * recorded and carried out.
 *
 * It starts its own production server with a fresh in-memory data set and the
 * demo clock frozen at Sunday 8 November 2026, 12:08, so every run produces
 * the same pictures. Run `pnpm build` first, then `pnpm screenshots`.
 */
import { spawn } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { chromium } from "@playwright/test"

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const out = {
  admin: path.resolve(app, "../ui-mockups/admin"),
  parent: path.resolve(app, "../ui-mockups/parent"),
  auth: path.resolve(app, "../ui-mockups/auth"),
  languages: path.resolve(app, "../ui-mockups/languages"),
  dark: path.resolve(app, "../ui-mockups/dark"),
}
const PORT = Number(process.env.SCREENSHOT_PORT ?? 3210)
const BASE = `http://localhost:${PORT}`

if (!existsSync(path.join(app, ".next", "BUILD_ID"))) {
  console.error("No production build found. Run `pnpm build` first.")
  process.exit(1)
}
for (const dir of Object.values(out)) mkdirSync(dir, { recursive: true })

// ------------------------------------------------------------------ server

const server = spawn(
  process.execPath,
  [path.join(app, "node_modules/next/dist/bin/next"), "start", "-p", String(PORT)],
  {
    cwd: app,
    env: { ...process.env, KHMK_DEMO_CLOCK: "frozen", NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  }
)
let serverLog = ""
server.stdout.on("data", (d) => (serverLog += d))
server.stderr.on("data", (d) => (serverLog += d))

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`${BASE}/sign-in`)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`The server did not start:\n${serverLog}`)
}

// ----------------------------------------------------------------- helpers

const desktop = {
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: "en-GB",
  timezoneId: "Europe/Berlin",
  colorScheme: "light",
  reducedMotion: "reduce",
}
const phone = {
  ...desktop,
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
}

const problems = []
let browser

function check(condition, message) {
  if (!condition) throw new Error(`Check failed: ${message}`)
}

/**
 * Next.js keeps recently visited pages mounted but hidden (React Activity), so
 * label and text lookups only consider what is visible.
 */
const label = (page, text, options) => page.getByLabel(text, options).filter({ visible: true })
const text = (scope, value, options) => scope.getByText(value, options).filter({ visible: true })

/** A browser session in one language (and light or dark), not signed in. */
async function openBrowser(name, options = desktop, { locale = "en", dark = false } = {}) {
  const context = await browser.newContext({ ...options, colorScheme: dark ? "dark" : "light" })
  await context.addCookies([{ name: "khmk-locale", value: locale, url: BASE }])
  const page = await context.newPage()
  page.on("pageerror", (e) => problems.push(`${name}: ${e.message}`))
  page.on("console", (m) => m.type() === "error" && problems.push(`${name}: ${m.text()}`))
  return page
}

/** A browser session signed in as one demo account (the prototype's quick sign-in). */
async function signIn(name, options = desktop, preferences = {}) {
  const page = await openBrowser(name, options, preferences)
  await page.goto(`${BASE}/sign-in/demo`)
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).click()
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"))
  await settle(page)
  return page
}

async function settle(page) {
  await page.waitForLoadState("networkidle")
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
}

/**
 * Saves a screenshot. Pages are captured from the top, without a hover state
 * or a lingering toast; `locator` captures just that part of the full page.
 */
async function shot(page, folder, name, { full = true, locator } = {}) {
  await settle(page)
  await page.mouse.move(0, 0)
  await page
    .waitForFunction(() => !document.querySelector("[data-sonner-toast]"), null, {
      timeout: 10_000,
    })
    .catch(() => {})
  const dialogOpen = await page.locator("[role=dialog], [role=alertdialog]").count()
  if (!dialogOpen) await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(150)
  const file = path.join(out[folder], `${name}.png`)
  if (locator) {
    const box = await locator.boundingBox()
    const pad = 24
    await page.screenshot({
      path: file,
      fullPage: true,
      clip: {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width: box.width + 2 * pad,
        height: box.height + 2 * pad,
      },
    })
  } else if (full) {
    // Grow the window to the page's height first, so the sidebar and other
    // full-height parts reach the bottom of the picture, as they do on screen.
    const viewport = page.viewportSize()
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    if (height > viewport.height) {
      await page.setViewportSize({ width: viewport.width, height })
      await page.waitForTimeout(200)
    }
    await page.screenshot({ path: file, fullPage: true })
    await page.setViewportSize(viewport)
  } else await page.screenshot({ path: file })
  console.log(`  ${folder}/${name}.png`)
}

async function go(page, url) {
  await page.goto(`${BASE}${url}`)
  await settle(page)
}

async function clickAndWait(page, locator, url) {
  await Promise.all([page.waitForURL(url), locator.click()])
  await settle(page)
}

// ---------------------------------------------------------------- scenario

async function servantPreparesTheLesson() {
  console.log("Servant prepares “The Good Samaritan”")
  const page = await signIn("Daniel Michael")

  // Services › Sunday School › 3rd Class › Lessons, the way the brief describes it.
  await clickAndWait(
    page,
    page.getByRole("link", { name: "Services", exact: true }).first(),
    /\/services$/
  )
  await clickAndWait(
    page,
    page.getByRole("link", { name: "Sunday School", exact: true }).first(),
    /\/services\/[^/]+$/
  )
  await clickAndWait(
    page,
    page
      .locator("a[href*='/stages/']")
      .filter({ hasText: /^3rd Class/ })
      .first(),
    /\/stages\/[^/]+$/
  )
  await clickAndWait(page, page.getByRole("link", { name: /^Lessons/ }).first(), /\/lessons$/)
  const stageUrl = page
    .url()
    .replace(BASE, "")
    .replace(/\/lessons$/, "")

  await clickAndWait(page, page.getByRole("link", { name: "New lesson" }), /\/lessons\/new$/)
  await label(page, "Title").fill("The Good Samaritan")
  await label(page, "Summary").fill(
    "A teacher of the law asks who his neighbour is. Jesus answers with the story of a Samaritan who helps a wounded stranger."
  )
  await label(page, "Biblical passage").fill("Luke 10:25–37")
  await label(page, "Memory verse").fill(
    "You shall love the Lord your God with all your heart, with all your soul, with all your strength, and with all your mind, and your neighbour as yourself. (Luke 10:27)"
  )
  await label(page, "Objectives").fill(
    "The children can retell the story and name one way to help someone this week."
  )
  await label(page, "Main teaching points").fill(
    "Loving God and loving our neighbour belong together.\nA neighbour is anyone who needs our help.\nThe Samaritan helped although it cost him time and money.\nJesus is the Good Samaritan who heals us."
  )
  await label(page, "Activities").fill(
    "Act out the story with three volunteers.\nDraw a road from Jerusalem to Jericho.\nSing “Love one another”."
  )
  await label(page, "Material 1", { exact: true }).fill("Felt board figures")
  await page.getByRole("button", { name: "Add material" }).click()
  await label(page, "Material 2", { exact: true }).fill("Story video for children")
  await label(page, "Link for material 2").fill("https://example.org/good-samaritan")
  await label(page, "Notes for the servants").fill(
    "Christine brings the felt board. Kiro likes to act; give him the role of the innkeeper."
  )
  const meeting = label(page, "Meeting")
  const value = await meeting.evaluate(
    (select) => [...select.options].find((o) => o.value.endsWith(":2026-11-15"))?.value
  )
  check(value, "Sunday 15 November is offered as a meeting date")
  await meeting.selectOption(value)
  await shot(page, "admin", "lesson-editor")

  await clickAndWait(
    page,
    page.getByRole("button", { name: "Mark ready" }),
    /\/lessons\/[0-9a-f-]+$/
  )
  const lessonUrl = page.url()

  for (const template of ["Learn the memory verse", "Read the Bible story"]) {
    await clickAndWait(
      page,
      page.getByRole("link", { name: "Add homework" }),
      /\/homework\/new\?lesson=/
    )
    await page.getByRole("button", { name: template, exact: true }).click()
    await page.getByRole("button", { name: /^One week after the lesson/ }).click()
    if (template === "Learn the memory verse") await shot(page, "admin", "homework-editor")
    await clickAndWait(page, page.getByRole("button", { name: "Publish to parents" }), lessonUrl)
  }
  check(
    (await text(page, "Published", { exact: true }).count()) >= 2,
    "both homework tasks are published"
  )
  await shot(page, "admin", "lesson-details")

  await go(page, `${stageUrl}/homework`)
  await shot(page, "admin", "homework-management")
  await go(page, `${stageUrl}/lessons`)
  check(await text(page, "The Good Samaritan").first().isVisible(), "the lesson is listed")
  await shot(page, "admin", "lessons-overview")
  return { page, stageUrl, lessonUrl }
}

async function parentCompletesTheHomework() {
  console.log("Parent marks the homework as done")
  const page = await signIn("Hoda Farag")
  check(page.url().endsWith("/parent"), "a parent lands in the parent portal")
  await clickAndWait(page, page.getByRole("link", { name: /^Mina 3rd Class/ }), /\/parent\?child=/)
  await shot(page, "parent", "parent-dashboard")

  await clickAndWait(
    page,
    page.getByRole("link", { name: "My children" }).first(),
    /\/parent\/children$/
  )
  await shot(page, "parent", "my-children")

  await clickAndWait(
    page,
    page.getByRole("link", { name: /^Mina Hanna/ }),
    /\/parent\/homework\?child=/
  )
  await shot(page, "parent", "homework-list")

  await clickAndWait(
    page,
    page.getByRole("link", { name: /Learn the memory verse/ }),
    /\/parent\/homework\/[0-9a-f-]+\?child=/
  )
  check(
    await text(page, "Luke 10:27").first().isVisible(),
    "the memory verse is shown with the homework"
  )
  check(
    (await text(page, "Christine brings the felt board").count()) === 0,
    "servant notes never reach parents"
  )
  await shot(page, "parent", "homework-details")

  await page.getByRole("button", { name: "Mark as done" }).click()
  await page
    .getByRole("status")
    .getByText(/You reported it today at 12:08/)
    .waitFor()
  await shot(page, "parent", "homework-completed")

  const mobile = await signIn("Hoda Farag", phone)
  await clickAndWait(
    mobile,
    mobile.getByRole("link", { name: /^Mina 3rd Class/ }),
    /\/parent\?child=/
  )
  await shot(mobile, "parent", "parent-dashboard-mobile", { full: false })
}

async function servantSeesTheCompletion(page, stageUrl) {
  console.log("Servant sees the completion")
  await go(page, `${stageUrl}/homework`)
  check(
    await text(page, "1 of 14 reported done").first().isVisible(),
    "the homework list counts the completion"
  )
  await clickAndWait(
    page,
    page.getByRole("link", { name: "Learn the memory verse" }),
    /\/homework\/[0-9a-f-]+$/
  )
  const row = page.getByRole("row", { name: /Mina Hanna/ })
  check(await text(row, "Done", { exact: true }).first().isVisible(), "Mina is reported done")
  check(
    await text(row, /Hoda Farag/)
      .first()
      .isVisible(),
    "the report names the parent"
  )
  await shot(page, "admin", "homework-completion-overview")
}

// ------------------------------------------- servants manage their homework

/**
 * Homework tasks are the servants' to create, edit, publish, take back,
 * archive, restore and (as long as parents never saw them) delete.
 */
async function servantManagesHomework(page, stageUrl, lessonUrl) {
  console.log("Servant edits, archives and restores homework")
  const PRAYER = "Pray together"
  await go(page, `${stageUrl}/homework`)
  const menuOf = async (title) => {
    await page
      .getByRole("button", { name: `Actions for ${title}` })
      .first()
      .click()
    await page.getByRole("menu").waitFor()
  }
  await menuOf("Read the Bible story")
  await shot(page, "admin", "menu-homework-actions", { full: false })
  await clickAndWait(page, page.getByRole("menuitem", { name: "Edit" }), /\/edit$/)
  await shot(page, "admin", "homework-edit")

  await go(page, `${stageUrl}/homework`)
  await menuOf("Read the Bible story")
  await page.getByRole("menuitem", { name: "Archive" }).click()
  let confirm = page.getByRole("alertdialog")
  await confirm.waitFor()
  await shot(page, "admin", "dialog-archive-homework", { full: false })
  await confirm.getByRole("button", { name: "Archive" }).click()
  await confirm.waitFor({ state: "detached" })
  await settle(page)

  await page.getByRole("tab", { name: /^Archived/ }).click()
  await menuOf("Read the Bible story")
  await page.getByRole("menuitem", { name: "Restore" }).click()
  confirm = page.getByRole("alertdialog")
  await confirm.waitFor()
  check(
    await text(confirm, /Parents of the class will see it again/)
      .first()
      .isVisible(),
    "restoring published homework warns that parents see it again"
  )
  await shot(page, "admin", "dialog-restore-homework", { full: false })
  await confirm.getByRole("button", { name: "Restore" }).click()
  await confirm.waitFor({ state: "detached" })
  await settle(page)

  // A draft parents never saw can be deleted; published homework can only be archived.
  await go(page, lessonUrl.replace(BASE, ""))
  await clickAndWait(
    page,
    page.getByRole("link", { name: "Add homework" }),
    /\/homework\/new\?lesson=/
  )
  await page.getByRole("button", { name: PRAYER, exact: true }).click()
  await clickAndWait(page, page.getByRole("button", { name: "Save draft" }), lessonUrl)
  await go(page, `${stageUrl}/homework`)
  await page.getByRole("tab", { name: /^Drafts/ }).click()
  await menuOf(PRAYER)
  await page.getByRole("menuitem", { name: "Delete draft" }).click()
  confirm = page.getByRole("alertdialog")
  await confirm.waitFor()
  await shot(page, "admin", "dialog-delete-homework", { full: false })
  await confirm.getByRole("button", { name: "Delete draft" }).click()
  await confirm.waitFor({ state: "detached" })
  await settle(page)
  check(
    (await page.getByRole("button", { name: `Actions for ${PRAYER}` }).count()) === 0,
    "the deleted draft is gone"
  )
}

// -------------------------------------------------------- the MVP screens

async function mvpScreens() {
  console.log("MVP screens")
  const leader = await signIn("Christine Adel")
  await shot(leader, "admin", "01-dashboard")
  check(
    await leader.locator("section[aria-labelledby='today'] article").count(),
    "the dashboard lists today’s meetings under Today"
  )

  // Services are created, archived and deleted by administrators; service
  // leaders only edit their own. The data-changing steps come at the end.
  const admin = await signIn("Mariam Fahmy")
  await clickAndWait(
    admin,
    admin.getByRole("link", { name: "Services", exact: true }).first(),
    /\/services$/
  )
  await shot(admin, "admin", "02-services-overview")
  await admin.getByRole("button", { name: "Actions for Youth Meeting" }).click()
  await admin.getByRole("menu").waitFor()
  await shot(admin, "admin", "menu-service-actions", { full: false })
  await admin.getByRole("menuitem", { name: "Edit name and description" }).click()
  await admin.getByRole("dialog").waitFor()
  await admin.keyboard.press("End") // the dialog selects the name when it opens
  await shot(admin, "admin", "dialog-edit-service", { full: false })
  await admin.keyboard.press("Escape")
  await admin.getByRole("dialog").waitFor({ state: "detached" })
  await admin.getByRole("button", { name: "Actions for Youth Meeting" }).click()
  await admin.getByRole("menuitem", { name: "Archive" }).click()
  await admin.getByRole("alertdialog").waitFor()
  await shot(admin, "admin", "dialog-archive-service", { full: false })
  await admin.keyboard.press("Escape")
  await admin.getByRole("alertdialog").waitFor({ state: "detached" })
  await clickAndWait(
    admin,
    admin.getByRole("link", { name: "Sunday School", exact: true }).first(),
    /\/services\/[^/]+$/
  )
  await shot(admin, "admin", "03-service-details")
  const serviceUrl = admin.url().replace(BASE, "")

  await go(leader, `${serviceUrl}/stages`)
  await shot(leader, "admin", "04-stage-management")
  const thirdClass = await leader
    .locator("a[href*='/stages/']")
    .filter({ hasText: /^3rd Class/ })
    .first()
    .getAttribute("href")

  await go(leader, "/meetings/schedules")
  await shot(leader, "admin", "05-meeting-schedules")
  await leader.getByRole("button", { name: "New schedule" }).click()
  await leader.getByRole("dialog").waitFor()
  await shot(leader, "admin", "dialog-new-schedule", { full: false })
  await leader.keyboard.press("Escape")

  await go(leader, "/meetings")
  await shot(leader, "admin", "06-meeting-sessions")
  await clickAndWait(
    leader,
    leader.getByRole("link", { name: /4th Class/ }).first(),
    /\/meetings\/sessions\//
  )
  await leader.getByRole("button", { name: "Change this session" }).click()
  await leader.getByRole("menuitem", { name: "Cancel this session" }).click()
  await leader.getByRole("alertdialog").waitFor()
  await shot(leader, "admin", "dialog-cancel-session", { full: false })
  await leader.keyboard.press("Escape")

  // Last Sunday's 3rd Class: closed, reopened for a correction and closed again.
  await go(leader, `${thirdClass}/meetings`)
  await clickAndWait(
    leader,
    leader.locator("section[aria-labelledby='past'] a").first(),
    /\/attendance\/[^/]+\/summary$/
  )
  await shot(leader, "admin", "08-attendance-summary")

  await go(leader, "/members")
  await shot(leader, "admin", "09-member-management")

  const servant = await signIn("Daniel Michael")
  await clickAndWait(
    servant,
    servant.getByRole("link", { name: "Attendance", exact: true }).first(),
    /\/attendance$/
  )
  await clickAndWait(
    servant,
    servant.getByRole("link", { name: "Take attendance" }).last(),
    /\/attendance\/[0-9a-f-]+$/
  )
  const boardUrl = servant.url().replace(BASE, "")
  for (const name of ["Mina Hanna", "Rita Henein"]) {
    const button = servant.getByRole("button", { name: `Mark ${name} present` })
    if (await button.count()) {
      await button.click()
      await servant.getByRole("button", { name: `Undo: ${name} not present` }).waitFor()
    }
  }
  await shot(servant, "admin", "07-manual-attendance")
  await servant.getByRole("button", { name: "Close attendance" }).click()
  await servant.getByRole("alertdialog").waitFor()
  await shot(servant, "admin", "dialog-close-attendance", { full: false })
  await servant.keyboard.press("Escape")

  const phoneServant = await signIn("Daniel Michael", phone)
  await go(phoneServant, boardUrl)
  await shot(phoneServant, "admin", "10-mobile-attendance", { full: false })

  await go(admin, "/settings")
  await shot(admin, "admin", "parent-access", {
    locator: admin.locator("section[aria-labelledby='parents']"),
  })

  // Delete a service that never met, then create one.
  await go(admin, "/services")
  await admin.getByRole("button", { name: "Actions for Choir" }).click()
  await admin.getByRole("menuitem", { name: "Delete" }).click()
  const confirmDelete = admin.getByRole("alertdialog")
  await confirmDelete.waitFor()
  await shot(admin, "admin", "dialog-delete-service", { full: false })
  await confirmDelete.getByRole("button", { name: "Delete" }).click()
  await confirmDelete.waitFor({ state: "detached" })
  await settle(admin)
  check(
    (await admin.getByRole("link", { name: "Choir", exact: true }).count()) === 0,
    "the deleted service is gone from the list"
  )

  await admin.getByRole("button", { name: "New service" }).click()
  const form = admin.getByRole("dialog")
  await form.getByLabel("Name").fill("Family Meeting")
  await form
    .getByLabel(/^Description/)
    .fill("Monthly evening for young families, with childcare for the little ones.")
  await shot(admin, "admin", "dialog-new-service", { full: false })
  await clickAndWait(
    admin,
    form.getByRole("button", { name: "Create service" }),
    /\/services\/[0-9a-f-]+$/
  )
  check(
    await admin.getByRole("heading", { name: "Family Meeting", level: 1 }).count(),
    "the new service opens after it is created"
  )
  await shot(admin, "admin", "service-details-new")
  return { boardUrl, serviceUrl }
}

// ------------------------------------------------- registration and approval

async function registrationAndApproval() {
  console.log("Registration, approval and sign-in")
  const visitor = await openBrowser("visitor")
  await go(visitor, "/sign-in")
  await shot(visitor, "auth", "01-sign-in")
  await clickAndWait(
    visitor,
    visitor.getByRole("link", { name: "Create an account" }),
    /\/register$/
  )
  await label(visitor, "First name").fill("Marianne")
  await label(visitor, "Last name").fill("Fanous")
  await label(visitor, "Email address").fill("marianne.fanous@example.org")
  await label(visitor, "Password", { exact: true }).fill("our family in Cologne")
  await label(visitor, "Your children").fill("Demiana Fanous, 2nd Class")
  await label(visitor, /I have read the privacy notice/).check()
  await shot(visitor, "auth", "02-register")
  await clickAndWait(
    visitor,
    visitor.getByRole("button", { name: "Create account" }),
    /\/register\/done$/
  )
  await shot(visitor, "auth", "03-registered")

  // Signing in before the approval explains what happens next.
  await go(visitor, "/sign-in")
  await label(visitor, "Email address").fill("marianne.fanous@example.org")
  await label(visitor, "Password", { exact: true }).fill("our family in Cologne")
  await clickAndWait(
    visitor,
    visitor.getByRole("button", { name: "Sign in" }),
    /\/sign-in\/pending$/
  )
  await shot(visitor, "auth", "04-waiting-for-approval")

  await go(visitor, "/forgot-password")
  await label(visitor, "Email address").fill("marianne.fanous@example.org")
  await visitor.getByRole("button", { name: "Send link" }).click()
  await text(visitor, /we’ve sent it a link/)
    .first()
    .waitFor()
  await shot(visitor, "auth", "05-forgot-password")

  await go(visitor, "/privacy")
  await shot(visitor, "auth", "06-privacy-notice")

  // The administrator links Demiana and approves the account.
  const admin = await signIn("Mariam Fahmy")
  await go(admin, "/settings")
  await shot(admin, "admin", "account-requests", {
    locator: admin.locator("section[aria-labelledby='account-requests']"),
  })
  const request = admin.locator("li").filter({ hasText: "Marianne Fanous" })
  await request.getByRole("button", { name: "Approve…" }).click()
  const dialog = admin.getByRole("dialog")
  await dialog.waitFor()
  check(
    await dialog.getByRole("checkbox", { name: /Demiana Fanous/ }).isChecked(),
    "the child named in the registration is chosen already"
  )
  await shot(admin, "admin", "dialog-approve-account", { full: false })
  await dialog.getByRole("button", { name: "Approve account" }).click()
  await dialog.waitFor({ state: "detached" })

  // Now the email and password open the parent portal.
  await go(visitor, "/sign-in")
  await label(visitor, "Email address").fill("marianne.fanous@example.org")
  await label(visitor, "Password", { exact: true }).fill("our family in Cologne")
  await clickAndWait(visitor, visitor.getByRole("button", { name: "Sign in" }), /\/parent$/)
  check(await text(visitor, "Demi").first().isVisible(), "the approved parent sees Demiana")

  const leader = await signIn("Christine Adel")
  await go(leader, "/account")
  await shot(leader, "admin", "account")
}

// ------------------------------------------------------ languages and dark

async function languagesAndDarkMode({ boardUrl }) {
  console.log("German, Arabic and dark mode")
  for (const locale of ["de", "ar"]) {
    const leader = await signIn("Christine Adel", desktop, { locale })
    await shot(leader, "languages", `${locale}-01-dashboard`)
    await go(leader, "/meetings")
    await shot(leader, "languages", `${locale}-02-meetings`)
    await go(leader, "/meetings/schedules")
    await leader
      .locator("main button")
      .filter({ has: leader.locator(".lucide-plus") })
      .first()
      .click()
    await leader.getByRole("dialog").waitFor()
    await shot(leader, "languages", `${locale}-03-dialog-new-schedule`, { full: false })
    await leader.keyboard.press("Escape")

    const servant = await signIn("Daniel Michael", desktop, { locale })
    await go(servant, boardUrl)
    await shot(servant, "languages", `${locale}-04-attendance`)
    const phoneServant = await signIn("Daniel Michael", phone, { locale })
    await go(phoneServant, boardUrl)
    await shot(phoneServant, "languages", `${locale}-05-attendance-mobile`, { full: false })

    const parent = await signIn("Hoda Farag", desktop, { locale })
    await shot(parent, "languages", `${locale}-06-parent-dashboard`)

    const admin = await signIn("Mariam Fahmy", desktop, { locale })
    await go(admin, "/settings")
    await shot(admin, "languages", `${locale}-07-settings`)

    const visitor = await openBrowser("visitor", desktop, { locale })
    await go(visitor, "/sign-in")
    await shot(visitor, "languages", `${locale}-08-sign-in`)
  }

  const leader = await signIn("Christine Adel", desktop, { dark: true })
  await shot(leader, "dark", "01-dashboard")
  const servant = await signIn("Daniel Michael", desktop, { dark: true })
  await go(servant, boardUrl)
  await shot(servant, "dark", "02-attendance")
  const parent = await signIn("Hoda Farag", desktop, { dark: true })
  await shot(parent, "dark", "03-parent-dashboard")
  const arabicParent = await signIn("Hoda Farag", phone, { locale: "ar", dark: true })
  await shot(arabicParent, "dark", "04-parent-dashboard-arabic-mobile", { full: false })
  const visitor = await openBrowser("visitor", desktop, { dark: true })
  await go(visitor, "/sign-in")
  await shot(visitor, "dark", "05-sign-in")
}

// ---------------------------------------------------------- data protection

async function dataProtection() {
  console.log("Data protection: erasing a child's data")
  const admin = await signIn("Mariam Fahmy")
  // The attendance overview (today's meetings and last Sunday's totals), before and after.
  const lastSunday = async () => {
    await go(admin, "/attendance")
    return admin.locator("main").innerText()
  }
  const before = await lastSunday()

  await go(admin, "/settings/data-requests")
  await shot(admin, "admin", "data-requests")
  await admin.getByRole("button", { name: "Record a request" }).click()
  const dialog = admin.getByRole("dialog")
  await dialog.waitFor()
  await dialog.getByLabel("Find a member by name").fill("Kirollos")
  await dialog.getByRole("radio", { name: /Kirollos Iskander/ }).click()
  await dialog.getByLabel("Asked by").fill("Samir Iskander, his father")
  await dialog.getByLabel("How it came").selectOption("in_person")
  await dialog
    .getByLabel(/^Note/)
    .fill("Asked after the liturgy; I know the family. He also wants a copy first.")
  await shot(admin, "admin", "dialog-record-data-request", { full: false })
  await clickAndWait(
    admin,
    dialog.getByRole("button", { name: "Record request" }),
    /\/settings\/data-requests\/[0-9a-f-]+$/
  )
  check(
    await text(admin, /Kiro likes to act/)
      .first()
      .isVisible(),
    "the servants' lesson note that names Kiro is listed for review"
  )
  await shot(admin, "admin", "data-request-review")
  await admin.getByRole("button", { name: "Erase data…" }).click()
  const confirm = admin.getByRole("alertdialog")
  await confirm.waitFor()
  await shot(admin, "admin", "dialog-erase-data", { full: false })
  await confirm.getByRole("button", { name: "Erase data" }).click()
  await confirm.waitFor({ state: "detached" })
  await settle(admin)
  await shot(admin, "admin", "data-request-done")
  check((await lastSunday()) === before, "attendance totals stay the same after the erasure")

  const parent = await signIn("Hoda Farag")
  await go(parent, "/parent/account")
  await shot(parent, "parent", "account")
}

// --------------------------------------------------------------------- run

try {
  await waitForServer()
  // en-GB also for the browser's own controls (date and time inputs).
  browser = await chromium.launch({
    args: ["--lang=en-GB"],
    env: { ...process.env, LANG: "en_GB.UTF-8" },
  })
  const { page, stageUrl, lessonUrl } = await servantPreparesTheLesson()
  await parentCompletesTheHomework()
  await servantSeesTheCompletion(page, stageUrl)
  await servantManagesHomework(page, stageUrl, lessonUrl)
  const urls = await mvpScreens()
  await registrationAndApproval()
  await languagesAndDarkMode(urls)
  await dataProtection()
  if (problems.length) {
    console.error(`\nThe browser reported ${problems.length} problem(s):\n${problems.join("\n")}`)
    process.exitCode = 1
  } else {
    console.log("\nScenario passed. Screenshots written.")
  }
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser?.close()
  server.kill()
}
