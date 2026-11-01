# KHMK Köln UI prototype

A clickable prototype of the MVP: attendance, lessons, homework and the parent portal, with sign-in,
registration and the data protection requests around them, in English, German and Arabic, light or dark. It
also shows the member portal planned after the launch, for members with an account of their own.
Every button works, on fictional demo data that the prototype keeps in memory. It is documentation for the tickets, not the
product: the product is built in the `frontend` and `backend` repositories.

The screenshots in [`../ui-mockups`](../ui-mockups) are taken from this app by a script that also checks
the end-to-end scenario below. The mockups' README lists every screen with its route here.

```bash
pnpm install
pnpm dev                 # http://localhost:3000, sign in with a demo account (password khmk-demo)
pnpm test                # unit tests (Vitest): formatting and the rules of the mock layer
pnpm lint
pnpm typecheck
pnpm build               # production build
pnpm screenshots         # after a build: walks the scenario and rewrites ../ui-mockups
```

Node.js 22 or newer and pnpm 12, pinned in `package.json` (`brew install pnpm`; pnpm 11 switches to the pinned
version by itself, pnpm 10 can't). `pnpm screenshots` uses the Chromium that Playwright installs
(`pnpm exec playwright install chromium` once).

## What is real and what is simulated

| | In the prototype |
| --- | --- |
| Data | In memory in the Next.js server, created from a fixed seed. Changes last until the server restarts or someone chooses "Reset demo data" (account menu or Settings). Nothing is written to a database. |
| Rules and permissions | Checked in the mock layer (`src/server/mock`) on every action, the way the API will check them: permissions from roles, parent access, status changes, validation. Errors come back as problem details (403, 404, 409, 422). |
| Roles | RBAC as in the backend (polaeskandar/khmh-koeln-app-backend#130): a permission is an action (create, read, update, delete) on a resource (users, roles, services, stages, sessions, attendance, members, lessons, homework, parentPortal), 40 in all (`PERMISSIONS` in `src/lib/domain/policy.ts`); a role is a name and some of them; an account has roles and may do what any of them allows. Roles are global: no service or stage, a role holds in every service. The church starts with the backend's defaults, Administrator, Service leader, Servant and Parent (`DEFAULT_ROLES`, same ids and permissions), which are ordinary roles: renamed, changed and deleted like the church's own. Settings › Roles lists them; `/settings/roles/new` and `/settings/roles/:role` show the See / Add / Change / Delete grid. Someone active must always keep "Roles: Change": a change that would leave nobody is refused (409 `roles.lastRoleManager`). The mock keeps each account's permissions in sync with its roles; the API resolves them on every request. |
| Sign-in | Email and password, checked against salted hashes in the mock layer; the session is a cookie with the account id. Every demo account uses the password `khmk-demo`, and `/sign-in/demo` signs in without typing. The account menu ("Prototype: view the app as") switches accounts. |
| Registration | Real flow on mock data: anyone can register as a parent, member or servant; the account can't be used until the office approves it in Settings (linking the children and giving roles, linking the member's own record after an age check, or giving roles). Declining deletes it. No emails are sent (confirmation, approval, password links). |
| Data protection | Requests to see or erase personal data (Settings › Data protection), with the one-month deadline, a review of what the app stores, a JSON copy, and erasure that keeps past attendance totals as anonymous numbers. Everyone can download their data and ask for deletion on their account page. The privacy notice is a draft. |
| Languages and appearance | English, German and Arabic (right to left), and light, dark or like the device, chosen in the account menu or on the account page. The language is a cookie and is also stored on the account. |
| Clock | Starts at Sunday 8 November 2026, 12:08 in Cologne and then runs in real time. `KHMK_DEMO_CLOCK=frozen` keeps it at the start (used for the screenshots). |
| Session generator | Simulated. The backend job does not exist yet. The prototype runs the planned logic once per hour (at minute 5) on the demo clock, when a page is loaded. |
| Emails, notifications, file uploads | Not in the prototype. Material links point to example addresses. |

## Demo accounts

| Account | Role | Good for |
| --- | --- | --- |
| Christine Adel | Service leader (leads Sunday School) | Dashboard, services, stages, schedules, reopening attendance |
| Daniel Michael | Servant (serves in Sunday School › 3rd Class) | Taking attendance, preparing lessons, giving homework |
| Mariam Fahmy | Administrator | Creating, archiving and deleting services; roles and who has them; parent access; account requests; data protection requests |
| Sara Wissa | Church office (a role of the church's own) | Account requests, roles for accounts, parent access, member accounts, data protection requests and the member list; she doesn't see the roles |
| Hoda Farag | Parent of Mina (3rd Class) and Mimi (1st Class), and in the Coptic course herself | The parent portal; "My groups" in its menu opens her member portal |
| Nadia Mansour | Parent, access to Sophia still waiting for approval | The parent portal before approval |
| Nevine Boulos | Member: Bible Study and Coptic Language Course › Level 1 | The member portal: her groups, next meetings and homework |
| Irene Wahba | Service leader (leads the Coptic Language Course) | Homework progress where members reported with their own account |

All of them sign in with their email address (for example `christine.adel@example.org`) and the password
`khmk-demo`. `/sign-in/demo` lists every account, including the other servants and leaders. Two people have
registered but wait for approval: Sandra (a parent) and Fady (a servant); their password is the same, and
signing in shows the waiting page.

An account belongs to a member when an administrator links it to the person's own record (Settings › Member
accounts). Staff and parents whose record is in a group (the servants are in the Servants' Preparation) get
"My groups" in their account menu. Members see only their own groups, when and where they meet, the last
lesson's passage and memory verse, and the homework of their stages; never attendance, servants' notes,
cancel reasons or other members.

## The scenario

`pnpm screenshots` starts its own server with a fresh data set and the clock frozen, then plays the brief's
end-to-end scenario and fails if a step does not work:

1. Daniel opens Services › Sunday School › 3rd Class › Lessons and prepares "The Good Samaritan"
   (Luke 10:25–37) for Sunday 15 November. He marks it ready and publishes two homework tasks: learning the
   memory verse (Luke 10:27) and reading the Bible story.
2. Hoda signs in to the parent portal, chooses Mina, opens the memory verse task and marks it as done.
3. Daniel sees "1 of 14 reported done" in the stage's homework, with Mina reported by Hoda Farag.

4. Daniel edits a homework task, archives it and restores it, and deletes a draft parents never saw.

It then takes the MVP screens as Christine (leader), Daniel (servant, also on the phone) and Mariam
(administrator); Mariam deletes a service that never met and creates a new one. After that:

5. Marianne registers as a parent, tries to sign in and lands on the waiting page. Mariam approves the
   account, with Demiana, the child Marianne named, already chosen. Marianne signs in to the parent portal.
6. The main screens are taken again in German and Arabic, and some in dark mode.
7. Samir asks the church office to erase his son Kirollos's data. Mariam records the request, reviews what
   the app stores (including a lesson note that names "Kiro"), and erases it. The attendance totals stay
   the same.
8. Nevine signs in to the member portal, sees that Wednesday's Bible Study is canceled (without the
   servants' reason), opens "Write the first eight letters" and marks it as done; Irene sees that she
   reported it with her own account. Hoda opens "My groups" from the parent portal.
9. Mina, a youth who shares his name with a child in 3rd Class, registers as a member. Mariam chooses the
   right record of the two, notes that his mother agreed because he is under 16, and approves the account;
   Mina signs in to the member portal and sees the Youth Meeting and the Deacons' School.
10. Mariam adds "Attendance helper" (Services: See, Attendance: See and Add), gives it to Sara, chooses
    Servant when approving Fady, and deletes "Lesson preparation", which nobody has. Unticking "Roles:
    Change" on the Administrator role warns that nobody else could change roles. Sara (church office) sees
    account requests and data protection in Settings, but no roles.

Desktop screenshots are 1440 px wide at 2×, phone screenshots 390 × 844 at 3×.

If a build shows styles from before a change in `globals.css`, delete `.next` and build again: Turbopack's
cache has kept old CSS once.

## Where things live

| Path | Contents |
| --- | --- |
| `src/app/(app)/` | Staff app routes. Each route folder has a `loading.tsx` for instant navigation. |
| `src/app/parent/` | Parent portal routes, with its own layout and navigation. |
| `src/app/member/` | Member portal routes, with its own layout and navigation. |
| `src/app/sign-in/`, `register/`, `forgot-password/`, `privacy/` | The pages before signing in. |
| `src/features/` | Screen parts by area: attendance, meetings, stages, lessons, homework, parent, member, settings, … |
| `src/components/` | Shared parts: app shell, data table, dialogs, form panels, status badges. `ui/` holds the shadcn/ui components of preset `b3a10z1gt0`. |
| `src/server/actions/` | Server actions: validate input with zod, call the mock layer, return a result or a problem. |
| `src/server/queries/` | Read models for the pages, with permissions resolved for the signed-in account. |
| `src/server/mock/` | The in-memory "backend": seed, commands with their rules, selectors, simulated session generator. |
| `src/lib/domain/` | Types, permission policy, recurrence and time helpers shared by both sides. |
| `src/lib/format.ts` | Dates in English, German and Arabic, spelled out from tables so server and browser agree, including the Coptic date and schedule patterns ("Every other Sunday"). |
| `messages/` | The texts in English (`en.json`, the reference the code is type-checked against), German and Arabic. A test checks that all three have the same messages with the same arguments. |
| `src/i18n/` | Language setup (next-intl, without language prefixes in the URL), direction, and helpers for server components. |
| `scripts/screenshots.mjs` | The scenario and screenshot run. |
| `reference/` | Two premium blocks kept unchanged for comparison; see its README. |

Larger components are adapted from shadcnblocks blocks; the comment at the top of each file names the block.
Premium blocks are added with the shadcn CLI and the `SHADCNBLOCKS_API_KEY` from `.env.local`, which is
git-ignored. Never commit the key or put it into source code or `NEXT_PUBLIC_*` variables.
