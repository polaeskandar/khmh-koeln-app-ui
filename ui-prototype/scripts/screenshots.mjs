#!/usr/bin/env node
import { spawn } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { chromium } from "@playwright/test"

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const mockups = path.resolve(app, "../ui-mockups")
const FOLDERS = [
  "auth",
  "home",
  "admin",
  "access",
  "services",
  "schedule",
  "attendance",
  "lessons",
  "settings",
  "parent",
  "member",
  "languages",
  "dark",
]
const out = Object.fromEntries(FOLDERS.map((f) => [f, path.join(mockups, f)]))
const PORT = Number(process.env.SCREENSHOT_PORT ?? 3210)
const BASE = `http://localhost:${PORT}`
const TEMPORARY = "olive-cedar-lamp-27"
const CHOSEN = "Psalm 23 is my favourite"

if (!existsSync(path.join(app, ".next", "BUILD_ID"))) {
  console.error("No production build found. Run `pnpm build` first.")
  process.exit(1)
}

for (const entry of readdirSync(mockups, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    rmSync(path.join(mockups, entry.name), { recursive: true, force: true })
  }
}

for (const dir of Object.values(out)) {
  mkdirSync(dir, { recursive: true })
}

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
    const ok = await fetch(`${BASE}/sign-in`)
      .then((res) => res.ok)
      .catch(() => false)

    if (ok) {
      return
    }

    await new Promise((r) => setTimeout(r, 500))
  }

  throw new Error(`The server did not start:\n${serverLog}`)
}

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
  if (!condition) {
    throw new Error(`Check failed: ${message}`)
  }
}

const visible = (locator) => locator.filter({ visible: true })
const button = (page, name, options = {}) =>
  visible(page.getByRole("button", { name, ...options })).first()
const link = (page, name, options = {}) =>
  visible(page.getByRole("link", { name, ...options })).first()
const field = (page, name, options = {}) => visible(page.getByLabel(name, options)).first()
const dialog = (page) => visible(page.locator("[role=dialog], [role=alertdialog]")).last()
const shows = (locator, timeout = 5000) =>
  visible(locator)
    .first()
    .waitFor({ timeout })
    .then(() => true)
    .catch(() => false)

async function openBrowser(name, options = desktop, { locale = "en", dark = false } = {}) {
  const context = await browser.newContext({ ...options, colorScheme: dark ? "dark" : "light" })
  await context.addCookies([{ name: "khmk-locale", value: locale, url: BASE }])
  const page = await context.newPage()
  page.on("pageerror", (e) => problems.push(`${name}: ${e.message}`))
  page.on("console", (m) => m.type() === "error" && problems.push(`${name}: ${m.text()}`))

  return page
}

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
  await page.waitForTimeout(250)
}

async function shot(page, folder, name, { full = true } = {}) {
  await settle(page)
  await page.mouse.move(0, 0)
  await page
    .waitForFunction(() => !document.querySelector("[data-sonner-toast]"), null, {
      timeout: 10_000,
    })
    .catch(() => {})
  const dialogOpen = await page.locator("[role=dialog], [role=alertdialog], [role=menu]").count()

  if (!dialogOpen) {
    await page.evaluate(() => window.scrollTo(0, 0))
  }

  await page.waitForTimeout(150)
  const file = path.join(out[folder], `${name}.png`)

  if (full && !dialogOpen) {
    const viewport = page.viewportSize()
    const height = await page.evaluate(() => document.documentElement.scrollHeight)

    if (height > viewport.height) {
      await page.setViewportSize({ width: viewport.width, height })
      await page.waitForTimeout(200)
    }

    await page.screenshot({ path: file, fullPage: true })
    await page.setViewportSize(viewport)
  } else {
    await page.screenshot({ path: file })
  }

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

async function accountMenu(page, item) {
  await visible(page.getByRole("button", { name: "Account menu" }))
    .first()
    .click()
  await visible(page.getByRole("menuitem", { name: item }))
    .first()
    .click()
  await settle(page)
}

async function signInPages() {
  console.log("Sign-in")
  const page = await openBrowser("visitor")
  await go(page, "/sign-in")
  await shot(page, "auth", "01-sign-in")
  await field(page, "Username").fill("Daniel.Michael")
  await field(page, "Password").fill("not-the-password")
  await button(page, "Sign in").click()
  await visible(page.getByText("The username or the password is not right")).waitFor()
  await shot(page, "auth", "02-sign-in-refused")
  await go(page, "/sign-in/demo")
  await shot(page, "auth", "03-demo-accounts")
  await go(page, "/privacy")
  await shot(page, "auth", "05-privacy-notice")
  const mobile = await openBrowser("visitor (phone)", phone)
  await go(mobile, "/sign-in")
  await shot(mobile, "auth", "06-sign-in-mobile")
}

async function servicesFromScratch() {
  console.log("Scenarios B and C: a new church creates Sunday School and Youth Gathering")
  const page = await signIn("Mariam Fahmy")
  await accountMenu(page, "Start with an empty church")
  await go(page, "/services")
  await shot(page, "services", "10-empty-church")

  await button(page, "New service").click()
  await field(page, "Name").fill("Sunday School")
  await field(page, /Description/).fill("Classes for children after the Divine Liturgy.")
  await page.getByRole("radio", { name: /Yes, it has stages/ }).click()
  await shot(page, "services", "11-new-service-basics")
  await button(page, "Next").click()
  await field(page, "Name of stage 1").fill("1st Class")
  await button(page, "Add a stage").click()
  await field(page, "Name of stage 2").fill("2nd Class")
  await button(page, "Add a stage").click()
  await field(page, "Name of stage 3").fill("3rd Class")
  await shot(page, "services", "12-new-service-stages")
  await clickAndWait(page, button(page, "Create service"), /\/services\/[^/]+$/)
  check(await link(page, /^Stages/).isVisible(), "a service with stages has a Stages tab")
  check(await link(page, "Schedule").isVisible(), "a service with stages has a Schedule tab")
  await shot(page, "services", "13-created-with-stages")
  await clickAndWait(page, link(page, "Schedule"), /tab=schedule/)
  await shot(page, "services", "14-created-schedule-tab")

  await go(page, "/services")
  await button(page, "New service").click()
  await field(page, "Name").fill("Youth Gathering")
  await page.getByRole("radio", { name: /No, one group/ }).click()
  await shot(page, "services", "15-new-service-without-stages")
  await clickAndWait(page, button(page, "Create service"), /\/services\/[^/]+$/)
  check(
    !(await visible(page.getByRole("link", { name: /^Stages/ })).count()),
    "no Stages tab without stages"
  )
  check(
    await visible(page.getByText("The schedule for 2026 hasn’t been prepared yet."))
      .first()
      .isVisible(),
    "only the schedule shows"
  )
  await shot(page, "services", "16-created-without-stages")

  await accountMenu(page, "Reset demo data")
  await page.context().close()
}

async function accountsAndFirstSignIn() {
  console.log(
    "Scenario A: the office creates a servant account; the servant signs in for the first time"
  )
  const page = await signIn("Mariam Fahmy")
  await go(page, "/admin/accounts")
  await shot(page, "admin", "01-accounts")
  await button(page, "New account").click()
  await page.getByRole("radio", { name: /Already in the church records/ }).click()
  await field(page, "Find a person").fill("Andrew")
  await page.getByRole("radio", { name: /Andrew Samir/ }).click()
  await shot(page, "admin", "02-new-account-person")
  await button(page, "Next").click()
  await button(page, "Servant").click()
  await field(page, "Where Servant applies").selectOption({ label: "Sunday School › 2nd Class" })
  await shot(page, "admin", "03-new-account-roles")
  await button(page, "Next").click()
  check(
    (await field(page, "Username", { exact: true }).inputValue()) === "andrew.samir",
    "the username is suggested from the name"
  )
  await field(page, "Temporary password", { exact: true }).fill(TEMPORARY)
  await shot(page, "admin", "04-new-account-sign-in")
  await button(page, "Create account").click()
  await visible(page.getByText("Hand these details to Andrew Samir")).waitFor()
  await shot(page, "admin", "05-hand-over")
  await clickAndWait(page, button(page, "Done"), /\/admin\/accounts\/[^/]+$/)
  check(
    await visible(page.getByText("Temporary: must be changed at the next sign-in"))
      .first()
      .isVisible(),
    "the account must change its password"
  )
  await shot(page, "admin", "06-account")
  await button(page, "Reset password").click()
  await shot(page, "admin", "07-reset-password")
  await page.keyboard.press("Escape")
  await button(page, "Delete account").click()
  await shot(page, "admin", "08-delete-account")
  await page.keyboard.press("Escape")

  const andrew = await openBrowser("Andrew")
  await go(andrew, "/sign-in")
  await field(andrew, "Username").fill("Andrew.Samir")
  await field(andrew, "Password").fill(TEMPORARY)
  await clickAndWait(andrew, button(andrew, "Sign in"), /\/change-password$/)
  await go(andrew, "/attendance")
  check(
    new URL(andrew.url()).pathname === "/change-password",
    "nothing else opens before the password is changed"
  )
  await shot(andrew, "auth", "04-change-password")
  await field(andrew, "Password from the church office").fill(TEMPORARY)
  await field(andrew, "New password", { exact: true }).fill(CHOSEN)
  await field(andrew, "New password again").fill(CHOSEN)
  await clickAndWait(andrew, button(andrew, "Save and continue"), (url) => url.pathname === "/")
  check(
    await visible(andrew.getByText("Sunday School - 2nd Class")).first().isVisible(),
    "Andrew sees his class today"
  )
  await shot(andrew, "home", "05-new-servant-home")
  await go(andrew, "/lessons")
  check(
    (await visible(andrew.getByText("David and Goliath")).count()) === 0,
    "a servant doesn't see a colleague's lesson of the same class"
  )
  await shot(andrew, "lessons", "10-servant-own-lessons")
  await andrew.context().close()
  await page.context().close()
}

async function homeScreens() {
  console.log("Home")
  const daniel = await signIn("Daniel Michael")
  check(
    await visible(daniel.getByText("Good afternoon, Daniel")).first().isVisible(),
    "the greeting uses the first name"
  )
  await shot(daniel, "home", "01-servant")
  const christine = await signIn("Christine Adel")
  check(
    await visible(christine.getByText("The schedule for 2027 hasn’t been prepared yet."))
      .first()
      .isVisible(),
    "the leader is reminded to plan 2027"
  )
  await shot(christine, "home", "02-leader-with-reminder")
  const peter = await signIn("Peter Girgis")
  await shot(peter, "home", "03-no-sessions-today")
  const onPhone = await signIn("Daniel Michael", phone)
  await shot(onPhone, "home", "04-servant-mobile")
  await daniel.context().close()
  await peter.context().close()
  await onPhone.context().close()

  return christine
}

async function serviceScreens() {
  console.log("Services")
  const page = await signIn("Mariam Fahmy")
  await go(page, "/services")
  await shot(page, "services", "01-directory")
  await clickAndWait(page, link(page, /^Sunday School/), /\/services\/[^/]+$/)
  const sundaySchool = new URL(page.url()).pathname
  await shot(page, "services", "02-service-stages")
  await go(page, `${sundaySchool}?tab=schedule&year=2026`)
  await shot(page, "services", "03-service-schedule-2026")
  await go(page, `${sundaySchool}/days?year=2027`)
  check(
    await visible(page.getByText("Second Day of Christmas")).first().isVisible(),
    "a hand-marked public holiday is listed"
  )
  await shot(page, "services", "05-days-without-sessions")
  await go(page, "/services/calendar?year=2027")
  await shot(page, "services", "04-church-calendar")
  await button(page, "Add church event").click()
  await shot(page, "services", "06-church-event")
  await page.keyboard.press("Escape")
  await go(page, "/services")
  await clickAndWait(page, link(page, /^Youth Gathering/), /\/services\/[^/]+$/)
  await shot(page, "services", "07-service-without-stages")
  await go(page, `${new URL(page.url()).pathname}?year=2027`)
  await shot(page, "schedule", "09-draft-2027")
  await page.context().close()

  return sundaySchool
}

async function annualPlanning(christine, sundaySchool) {
  console.log("Scenario D: Christine prepares 2027 for Sunday School")
  const page = christine
  await clickAndWait(page, link(page, "Prepare schedule"), /tab=schedule/)
  await shot(page, "schedule", "01-overview-not-planned")
  await clickAndWait(page, link(page, "Days without sessions"), /\/days/)
  await visible(page.getByRole("gridcell", { name: /^Sun 1 Aug/ }))
    .first()
    .click()
  await settle(page)
  check(
    await visible(page.getByText("Marked by hand")).first().isVisible(),
    "a day is marked by hand"
  )
  await shot(page, "services", "08-days-marked-by-hand")
  await go(page, `${sundaySchool}?tab=schedule&year=2027`)
  await clickAndWait(page, link(page, "Prepare 2027 for Kindergarten"), /\/stages\/.+\/plan/)
  await field(page, "Starts at").fill("12:00")
  await field(page, /^Ends at/).fill("13:15")
  await field(page, /^First date/).fill("2027-03-01")
  await button(page, /^Clear First date/).click()
  check(
    (await field(page, /^First date/).inputValue()) === "",
    "the optional first date can be emptied"
  )
  check(
    await visible(page.getByText("Palm Sunday")).first().isVisible(),
    "Palm Sunday is suggested"
  )
  check(
    await visible(page.getByText("Parish festival (sample)")).first().isVisible(),
    "the church event applies"
  )
  await page.getByRole("switch", { name: "Session on Sun 20 Jun" }).click()
  check(
    (await page
      .getByRole("switch", { name: "Session on Sun 1 Aug" })
      .getAttribute("aria-checked")) === "false",
    "the hand-marked day is suggested as canceled"
  )
  check(
    await page.getByRole("switch", { name: "Session on Sun 27 Jun" }).isDisabled(),
    "only administrators keep a church-decided day"
  )
  await shot(page, "schedule", "02-plan-editor")
  await button(page, "Confirm plan").click()
  await shot(page, "schedule", "03-confirm-plan")
  await clickAndWait(
    page,
    dialog(page).getByRole("button", { name: "Confirm plan" }),
    /\/stages\/[^/]+\?year=2027/
  )
  const kindergarten = new URL(page.url()).pathname
  check(
    (await visible(page.getByText("Pentecost")).count()) === 0,
    "Pentecost was kept as a session"
  )
  await shot(page, "schedule", "05-year-2027")
  await go(page, `${sundaySchool}?tab=schedule&year=2027`)
  check(
    (await visible(page.getByText("Not planned", { exact: true })).count()) === 4,
    "only Kindergarten is planned, each stage on its own"
  )
  check(
    await link(page, "Prepare 2027 for 1st Class").isVisible(),
    "every other stage keeps its own plan action"
  )
  await shot(page, "schedule", "04-overview-confirmed")
  await go(page, `${kindergarten}/plan?year=2027`)
  check(new URL(page.url()).pathname === kindergarten, "a confirmed plan can't be opened again")

  console.log("Scenario E: a one-off session")
  await go(page, `${sundaySchool}?tab=stages`)
  await clickAndWait(page, link(page, "3rd Class"), /\/stages\//)
  const stage = new URL(page.url()).pathname
  await shot(page, "schedule", "06-year-2026")
  await button(page, "Add one-off session").click()
  await field(page, "Date").fill("2026-12-19")
  await field(page, "Starts at").fill("15:00")
  await field(page, /^Ends at/).fill("17:00")
  await field(page, /^Place/).fill("Church hall")
  await shot(page, "schedule", "07-one-off-session")
  await dialog(page).getByRole("button", { name: "Add one-off session" }).click()
  await settle(page)
  check(
    await visible(page.getByText("One-off")).first().isVisible(),
    "the one-off session shows in the calendar"
  )
  await shot(page, "schedule", "08-one-off-in-calendar")
  const menu = visible(
    page.getByRole("button", { name: /Sunday School - 3rd Class, Sat 19 Dec/ })
  ).first()
  await menu.click()
  await shot(page, "schedule", "10-session-menu")
  await clickAndWait(
    page,
    visible(page.getByRole("menuitem", { name: "Attendance" })).first(),
    /\/attendance\//
  )
  await shot(page, "attendance", "06-one-off-session")
  check(
    await visible(page.getByText("Attendance opens on the day of the session."))
      .first()
      .isVisible(),
    "the one-off session takes attendance on its day"
  )
  await go(page, stage)
  await visible(page.getByRole("button", { name: /Sunday School - 3rd Class, Sun 22 Nov/ }))
    .first()
    .click()
  await visible(page.getByRole("menuitem", { name: "Reschedule" }))
    .first()
    .click()
  await shot(page, "schedule", "11-reschedule")
  await page.keyboard.press("Escape")
  await button(page, "Change from a date").click()
  await field(page, "Applies from").fill("2026-11-15")
  await field(page, "Starts at").fill("12:30")
  await button(page, "Check what changes").click()
  await visible(page.getByText(/replaced by/)).waitFor()
  await shot(page, "schedule", "12-change-plan")
  await page.keyboard.press("Escape")
  await page.context().close()
}

const tree = (page) => visible(page.getByRole("tree", { name: "Resources" })).first()
const treeItem = (page, name) => tree(page).getByRole("treeitem", { name }).first()

/** Opens a place in the resource explorer; a group (Lessons, Events) only opens its list. */
async function openPlace(page, name) {
  const before = page.url()
  await treeItem(page, name).click()
  await page.waitForURL((url) => url.href !== before)
  await settle(page)
}

async function openGroup(page, name, child) {
  await treeItem(page, name).click()
  await treeItem(page, child).waitFor()
}

/** Assign role, step by step; returns on the review step for a screenshot. */
async function assignSteps(page, { person, role, scope, shots = {} }) {
  await button(page, "Assign role", { exact: true }).click()
  await field(page, "Find by name or username").fill(person.split(" ")[0])
  await dialog(page).getByRole("radio", { name: person }).click()
  if (shots.person) await shot(page, "access", shots.person)
  await dialog(page).getByRole("button", { name: "Next" }).click()
  await dialog(page).getByRole("radio", { name: role, exact: true }).click()
  if (shots.role) {
    await dialog(page).getByText("Why can’t I give other roles?").click()
    await shot(page, "access", shots.role)
  }
  await dialog(page).getByRole("button", { name: "Next" }).click()
  await dialog(page).getByRole("radio", { name: scope }).click()
  if (shots.scope) await shot(page, "access", shots.scope)
  await dialog(page).getByRole("button", { name: "Next" }).click()
  await visible(dialog(page).getByText(/gets the role/)).waitFor()
}

async function confirmAssign(page) {
  await dialog(page).getByRole("button", { name: "Assign role", exact: true }).click()
  await page.locator("[role=dialog]").waitFor({ state: "detached" })
  await settle(page)
}

const directRows = (page) => page.getByRole("region", { name: "Assigned here" })

async function accessAsAdministrator() {
  console.log("Access A, E and I: the administrator, the role hierarchy and a new resource type")
  const page = await signIn("Mariam Fahmy")
  await clickAndWait(page, link(page, "Access", { exact: true }), /\/admin\/access/)
  check(await shows(treeItem(page, /^Youth Gathering/)), "the whole church is listed")
  check(
    await shows(directRows(page).getByText("Administrator", { exact: true })),
    "the church shows who administers it"
  )
  await shot(page, "access", "01-administrator-church")

  await openPlace(page, /^Youth Gathering/)
  const youth = new URL(page.url()).searchParams.get("r")
  await openGroup(page, /^Events/, /^Summer camp 2027/)
  await openPlace(page, /^Summer camp 2027/)
  await assignSteps(page, {
    person: "Mark Shenouda",
    role: "Event coordinator",
    scope: /^Summer camp 2027, as selected/,
  })
  await confirmAssign(page)
  check(
    await shows(directRows(page).getByText("Mark Shenouda")),
    "an event, a type added through the registry, takes roles like any other place"
  )
  await shot(page, "access", "02-event-coordinator")

  await go(page, "/admin/access?tab=roles&role=019a3f00-0000-7000-8000-000000000002")
  check(
    await visible(page.getByText("from Session helper")).first().isVisible(),
    "inherited permissions say where they come from"
  )
  await shot(page, "access", "03-role-hierarchy")
  await go(page, "/admin/access/roles/019a3f00-0000-7000-8000-000000000007")
  check(
    await visible(page.getByText("Service leader already includes this role.")).first().isVisible(),
    "a role can't build on a role that already includes it"
  )
  await shot(page, "access", "04-role-editor-no-loops")
  await go(page, "/admin/access/roles/new")
  await field(page, "Name").fill("Assistant leader")
  await page.getByRole("checkbox", { name: /^Servant/ }).click()
  await shot(page, "access", "05-new-role")
  await go(page, "/admin/access?tab=parents")
  await shot(page, "access", "06-parental-access")
  await button(page, "Link a member").click()
  await shot(page, "access", "07-link-member")
  await page.keyboard.press("Escape")
  await page.context().close()

  return youth
}

async function accessAsServiceLeader(youth) {
  console.log("Access B, D, G and H: Christine manages access within Sunday School")
  const page = await signIn("Christine Adel")
  await clickAndWait(page, link(page, "Access", { exact: true }), /\/admin\/access/)
  check(
    !(await visible(page.getByRole("link", { name: "Roles & permissions" })).count()),
    "a service leader doesn't edit roles"
  )
  check(
    !(await tree(page)
      .getByRole("treeitem", { name: /^Youth Gathering/ })
      .count()),
    "Youth Gathering isn't hers to manage"
  )
  await shot(page, "access", "08-leader-sunday-school")

  await openPlace(page, /^3rd Class/)
  await assignSteps(page, {
    person: "Daniel Michael",
    role: "Servant",
    scope: /^3rd Class, as selected/,
    shots: { person: "09-assign-person", role: "10-assign-role", scope: "11-assign-where" },
  })
  await shot(page, "access", "12-assign-review")
  await confirmAssign(page)
  check(await shows(directRows(page).getByText("Daniel Michael")), "Daniel now serves in 3rd Class")
  await shot(page, "access", "13-stage-after")

  await go(page, `/admin/access?tab=resources&r=${youth}`)
  check(
    await visible(page.getByText("This place is outside the area where you manage access."))
      .first()
      .isVisible(),
    "an address outside her area shows nothing of it"
  )
  await shot(page, "access", "14-outside-her-area")

  await go(page, "/admin/access")
  await treeItem(page, /^1st Class/).click()
  await page.waitForURL(/r=stage/)
  await settle(page)
  await openGroup(page, /^Lessons/, /^The Good Samaritan/)
  await openPlace(page, /^The Good Samaritan/)
  await assignSteps(page, {
    person: "Maria Hanna",
    role: "Lesson editor",
    scope: /^The Good Samaritan, as selected/,
  })
  await confirmAssign(page)
  await shot(page, "access", "15-one-lesson")
  const lesson = await link(page, "Open", { exact: true }).getAttribute("href")

  const maria = await signIn("Maria Hanna")
  await go(maria, lesson)
  check(await link(maria, "Edit").isVisible(), "Maria edits The Good Samaritan")
  await shot(maria, "access", "16-maria-edits-the-lesson")
  await go(maria, "/lessons")
  check(
    (await visible(maria.getByText("Noah's ark")).count()) === 0,
    "but no other lesson of 1st Class"
  )
  await shot(maria, "access", "17-maria-preparation")
  await maria.context().close()

  await go(page, "/admin/access")
  await assignSteps(page, {
    person: "Daniel Michael",
    role: "Servant",
    scope: /^Sunday School, as selected/,
  })
  check(
    await visible(dialog(page).getByText(/Also has Servant for Sunday School › 1st Class/))
      .first()
      .isVisible(),
    "the review names the narrower roles Daniel already has"
  )
  await shot(page, "access", "18-overlap-review")
  await confirmAssign(page)
  await openPlace(page, /^3rd Class/)
  await shot(page, "access", "19-inherited-and-direct")
  await go(page, "/admin/access")
  await button(page, "Remove Servant from Daniel Michael").click()
  await visible(dialog(page).getByText("Still in place")).waitFor()
  await shot(page, "access", "20-revoke-keeps-narrower")
  await dialog(page).getByRole("button", { name: "Remove role" }).click()
  await page.locator("[role=alertdialog]").waitFor({ state: "detached" })
  await settle(page)
  await page.context().close()

  const mobile = await signIn("Christine Adel", phone)
  await go(mobile, "/admin/access")
  await shot(mobile, "access", "21-access-mobile")
  await button(mobile, "Browse resources").click()
  await shot(mobile, "access", "22-access-mobile-browse")
  await mobile.context().close()
}

async function accessAsServant() {
  console.log("Access C: Daniel serves in 1st and 3rd Class")
  const daniel = await signIn("Daniel Michael")
  check(
    !(await visible(daniel.getByRole("link", { name: "Access", exact: true })).count()),
    "a servant manages nobody's access"
  )
  await go(daniel, "/services")
  await clickAndWait(daniel, link(daniel, /^Sunday School/), /\/services\/[^/]+$/)
  check(
    !(await visible(daniel.getByText("2nd Class")).count()),
    "he doesn't see the stages he doesn't serve in"
  )
  await shot(daniel, "access", "23-servant-sunday-school")
  await clickAndWait(daniel, link(daniel, "Schedule"), /tab=schedule/)
  await clickAndWait(daniel, link(daniel, "3rd Class"), /\/stages\//)
  check(
    !(await visible(daniel.getByRole("button", { name: "Add one-off session" })).count()),
    "a servant sees the schedule but doesn't plan it"
  )
  await go(daniel, "/services")
  await clickAndWait(daniel, link(daniel, /^Youth Gathering/), /\/services\/[^/]+$/)
  await shot(daniel, "schedule", "14-other-service-read-only")
  await daniel.context().close()

  const christine = await signIn("Christine Adel")
  await go(christine, "/services")
  await clickAndWait(christine, link(christine, /^Sunday School/), /\/services\/[^/]+$/)
  await clickAndWait(christine, link(christine, "Schedule"), /tab=schedule/)
  await clickAndWait(christine, link(christine, "3rd Class"), /\/stages\//)
  check(
    await button(christine, "Add one-off session").isVisible(),
    "the service leader plans her stages"
  )
  await shot(christine, "schedule", "13-scoped-leader-can-plan")
  await christine.context().close()
}

async function dataRequests() {
  console.log("Data protection requests")
  const page = await signIn("Mariam Fahmy")
  await go(page, "/admin/data")
  await shot(page, "admin", "20-data-requests")
  await clickAndWait(page, link(page, /Theresa Wadie/), /\/admin\/data\//)
  await shot(page, "admin", "21-data-request")
  await page.context().close()
}

async function lessonsAndTasks() {
  console.log("Scenario H: Daniel prepares a lesson")
  const page = await signIn("Daniel Michael")
  await go(page, "/lessons")
  check(
    (await visible(page.getByText("Joseph forgives his brothers")).count()) === 0,
    "a servant sees only the lessons he writes, not Youssef's in the same class"
  )
  await shot(page, "lessons", "01-preparation")
  await clickAndWait(
    page,
    visible(
      page
        .getByRole("region", { name: "Sunday School - 3rd Class" })
        .getByRole("link", { name: "New lesson" })
    ).first(),
    /\/lessons\/new/
  )
  await field(page, "Title").fill("The Ten Commandments")
  await field(page, "Summary").fill(
    "God gives Moses the Ten Commandments on Mount Sinai (Exodus 20:1–17)."
  )
  await field(page, "Learning objectives").fill(
    "The children can name the first commandments.\nThey understand that the commandments are a gift."
  )
  await field(page, "Teaching points").fill(
    "God speaks to His people.\nLove God first.\nLove your neighbour."
  )
  await button(page, "Add item").click()
  await field(page, "Name of item 1").fill("Exodus 20, read together")
  await visible(page.getByRole("checkbox", { name: "Share with parents and members" }))
    .first()
    .click()
  await button(page, "Add item").click()
  await field(page, "Name of item 2").fill("Stone tablets from the cupboard")
  await field(page, "Preparation notes").fill("Ask Sophia to read the fourth commandment aloud.")
  await shot(page, "lessons", "02-lesson-editor")
  await clickAndWait(page, button(page, "Save lesson"), /\/lessons\/[^/]+$/)
  await shot(page, "lessons", "03-lesson-draft")
  await button(page, "Publish").click()
  await shot(page, "lessons", "04-publish")
  await dialog(page).getByRole("button", { name: "Publish" }).click()
  await settle(page)
  await shot(page, "lessons", "05-lesson-published")

  console.log("Scenario I: a task for Noah's ark, completed by a parent")
  await go(page, "/lessons/tasks")
  await shot(page, "lessons", "06-tasks")
  await go(page, "/lessons")
  await clickAndWait(
    page,
    visible(page.locator('a[href^="/lessons/"]').filter({ hasText: "Noah" })).first(),
    /\/lessons\/[^/]+$/
  )
  await clickAndWait(page, link(page, "Add task"), /\/tasks\/new/)
  await field(page, "Title").fill("Learn Genesis 9:13 by heart")
  await field(page, "What to do").fill(
    "“I have set my rainbow in the clouds.” Say the verse to someone at home."
  )
  await shot(page, "lessons", "07-task-editor")
  await clickAndWait(page, button(page, "Publish"), /\/lessons\/tasks\/[^/]+$/)
  const taskUrl = new URL(page.url()).pathname
  await shot(page, "lessons", "08-task-progress")

  const hoda = await signIn("Hoda Farag")
  await clickAndWait(hoda, link(hoda, /^Mimi/), /child=/)
  await shot(hoda, "parent", "01-home")
  await clickAndWait(
    hoda,
    visible(hoda.locator('a[href*="/parent/lessons/"]').filter({ hasText: "Noah" })).first(),
    /\/parent\/lessons\//
  )
  check(
    !(await visible(hoda.getByText("cardboard ark")).count()),
    "the servants’ notes stay hidden"
  )
  check(
    !(await visible(hoda.getByText("Ark craft template")).count()),
    "internal materials stay hidden"
  )
  await shot(hoda, "parent", "02-lesson")
  await visible(
    hoda
      .locator("li")
      .filter({ hasText: "Learn Genesis 9:13 by heart" })
      .getByRole("button", { name: "Mark as done for Mimi" })
  )
    .first()
    .click()
  await settle(hoda)
  await shot(hoda, "parent", "03-task-done")
  await go(hoda, "/parent/tasks")
  await shot(hoda, "parent", "04-tasks")
  await go(hoda, "/parent/settings")
  await shot(hoda, "parent", "06-settings")
  const hodaPhone = await signIn("Hoda Farag", phone)
  await shot(hodaPhone, "parent", "05-home-mobile")
  await hodaPhone.context().close()
  await hoda.context().close()

  await go(page, taskUrl)
  check(
    await visible(page.getByText(/Reported by Hoda Farag/))
      .first()
      .isVisible(),
    "Daniel sees what Hoda reported"
  )
  await shot(page, "lessons", "09-task-progress-reported")
  await page.context().close()
}

async function memberPortal() {
  console.log("Scenario J: Nevine reads a lesson as a member")
  const page = await signIn("Nevine Boulos")
  await shot(page, "member", "01-home")
  await go(page, "/member/lessons")
  await clickAndWait(
    page,
    visible(
      page.locator('a[href*="/member/lessons/"]').filter({ hasText: "The first eight letters" })
    ).first(),
    /\/member\/lessons\//
  )
  check(
    !(await visible(page.getByText("pronunciation of")).count()),
    "the preparation notes stay hidden"
  )
  check(!(await visible(page.getByText("Answer key")).count()), "internal materials stay hidden")
  await shot(page, "member", "02-lesson")
  await visible(page.getByRole("button", { name: "Mark as done" }))
    .first()
    .click()
  await settle(page)
  await shot(page, "member", "03-task-done")
  const onPhone = await signIn("Nevine Boulos", phone)
  await shot(onPhone, "member", "04-home-mobile")
  await onPhone.context().close()
  await page.context().close()
}

async function attendance() {
  console.log("Attendance")
  const page = await signIn("Daniel Michael")
  await go(page, "/attendance")
  await shot(page, "attendance", "01-overview")
  await clickAndWait(
    page,
    visible(
      page
        .locator("article")
        .filter({ hasText: "3rd Class" })
        .getByRole("link", { name: "Continue attendance" })
    ).first(),
    /\/attendance\//
  )
  const sessionUrl = new URL(page.url()).pathname
  await visible(page.getByRole("button", { name: /^Mark .+ present$/ }))
    .first()
    .click()
  await settle(page)
  await shot(page, "attendance", "02-session")
  await button(page, "Close attendance").click()
  await shot(page, "attendance", "04-close")
  await dialog(page).getByRole("button", { name: "Close attendance" }).click()
  await settle(page)
  await shot(page, "attendance", "05-closed")
  const onPhone = await signIn("Christine Adel", phone)
  await go(onPhone, "/attendance")
  await clickAndWait(
    onPhone,
    visible(
      onPhone
        .locator("article")
        .filter({ hasText: "2nd Class" })
        .getByRole("link", { name: "Continue attendance" })
    ).first(),
    /\/attendance\//
  )
  await shot(onPhone, "attendance", "03-session-mobile")
  await onPhone.context().close()
  await go(page, "/settings")
  await shot(page, "settings", "01-settings")
  await page.context().close()

  return sessionUrl
}

async function languagesAndDarkMode(sundaySchool, sessionUrl) {
  console.log("German, Arabic and dark mode")

  for (const locale of ["de", "ar"]) {
    const page = await signIn("Christine Adel", desktop, { locale })
    await shot(page, "languages", `${locale}-01-home`)
    await go(page, "/services")
    await shot(page, "languages", `${locale}-02-services`)
    await go(page, `${sundaySchool}?tab=schedule&year=2028`)
    await clickAndWait(page, page.locator('a[href*="/plan?year=2028"]').first(), /\/plan/)
    await field(page, locale === "de" ? "Beginnt um" : "يبدأ الساعة").fill("12:00")
    await shot(page, "languages", `${locale}-03-plan-editor`)
    await go(page, "/admin/access")
    await shot(page, "languages", `${locale}-09-access-leader`)
    await go(page, sessionUrl)
    await shot(page, "languages", `${locale}-04-attendance`)
    await page.context().close()
    const admin = await signIn("Mariam Fahmy", desktop, { locale })
    await go(admin, "/admin/access")
    await shot(admin, "languages", `${locale}-05-access`)
    await go(admin, "/admin/accounts")
    await shot(admin, "languages", `${locale}-06-accounts`)
    await admin.context().close()
    const parent = await signIn("Hoda Farag", phone, { locale })
    await shot(parent, "languages", `${locale}-07-parent-mobile`)
    await parent.context().close()
    const visitor = await openBrowser(`visitor ${locale}`, desktop, { locale })
    await go(visitor, "/sign-in")
    await shot(visitor, "languages", `${locale}-08-sign-in`)
    await visitor.context().close()
  }

  const dark = await signIn("Daniel Michael", desktop, { dark: true })
  await shot(dark, "dark", "01-home")
  await go(dark, `${sundaySchool}?tab=stages`)
  await shot(dark, "dark", "02-service")
  await dark.context().close()
  const darkMember = await signIn("Nevine Boulos", phone, { locale: "ar", dark: true })
  await shot(darkMember, "dark", "03-member-arabic-mobile")
  await darkMember.context().close()
}

try {
  await waitForServer()
  browser = await chromium.launch({
    args: ["--lang=en-GB"],
    env: { ...process.env, LANG: "en_GB.UTF-8" },
  })
  await signInPages()
  await servicesFromScratch()
  await accountsAndFirstSignIn()
  const christine = await homeScreens()
  const sundaySchool = await serviceScreens()
  await annualPlanning(christine, sundaySchool)
  const youth = await accessAsAdministrator()
  await accessAsServiceLeader(youth)
  await accessAsServant()
  await dataRequests()
  await lessonsAndTasks()
  await memberPortal()
  const sessionUrl = await attendance()
  await languagesAndDarkMode(sundaySchool, sessionUrl)

  if (problems.length) {
    console.error(`\nThe browser reported ${problems.length} problem(s):\n${problems.join("\n")}`)
    process.exitCode = 1
  } else {
    console.log("\nAll scenarios passed. Screenshots written.")
  }
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser?.close()
  server.kill()
}
