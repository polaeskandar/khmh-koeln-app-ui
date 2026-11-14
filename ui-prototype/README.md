# KHMK Köln UI prototype

A clickable prototype of the app as the church board decided it in November 2026: accounts created by the church
office and signed in with a username, a simple sidebar, services with or without stages, a schedule planned a whole year
at a time (with Coptic feast days), sessions and attendance, lesson preparation and tasks, and lesson and task views for
parents and members. In English, German and Arabic, light or dark. Every button works on fictional demo data kept in
memory. It is the reference for the tickets; the product is built in the `frontend` and `backend` repositories.

```bash
pnpm install
pnpm dev                 # http://localhost:3000, sign in with a demo account (password khmk-demo)
pnpm test                # Vitest: domain rules, the mock layer's rules, the message catalogs
pnpm lint
pnpm typecheck
pnpm build               # production build
pnpm screenshots         # after a build: plays the scenarios and rewrites ../ui-mockups
```

Node.js 22 or newer and pnpm 12 (`brew install pnpm`). `pnpm screenshots` needs Playwright's Chromium once:
`pnpm exec playwright install chromium`. If a running `pnpm dev` shows a page without some of its styles, restart it
(Turbopack keeps the Tailwind output of new classes too long); a production build is not affected.

## What is real and what is simulated

| | In the prototype |
| --- | --- |
| Data | In memory in the Next.js server, built from a fixed seed. The account menu has "Reset demo data" and "Start with an empty church" (only the administrator and the church calendar). |
| Accounts | Created only by administrators (Administration › Accounts): an existing person or a new one, groups for members, the children a parent follows, a username and a temporary password that is shown once; access is given afterwards in Administration › Access. No registration, no email, no password links. Accounts are deleted, never deactivated; a deleted account's records stay without it. |
| Sign-in | Username and password (case-insensitive usernames, `a–z 0–9 . _ -`, 3–32 characters, ASCII only so look-alike letters can't be used). One answer for every failure. An account with a temporary password reaches nothing but `/change-password`: the server actions and pages refuse everything else, not only the navigation. |
| Access | One generic permission system (`../docs/authorization.md`): a member gets Create, Read, Update or Delete for a type of resource within a resource (the church, a service, a stage, a lesson…), which counts there and below it; creating is checked on the parent. Resources are read from the demo data through `src/server/mock/resources.ts`. Administrators manage access everywhere and choose who manages access within a resource; nobody gives more than they may do, or changes their own access. No roles. Administration › Access is a tree of the church and the selected place's access. |
| Members and children | A child is just a member: a person with an account and groups. Parents are linked to children on the parent's account page, and may report tasks for them. |
| Schedules | One schedule per stage, or per service when it has no stages, and each is planned on its own, a year at a time: weekday, start, optional end, optional first and last date, place. The preview marks the service's days without sessions; nothing exists until the plan is confirmed, which creates all sessions of the year. A confirmed plan changes only from a date on, and never touches past sessions, sessions with attendance or sessions changed by hand. Single sessions are canceled, restored, rescheduled, and one-off sessions added. |
| Calendar | Coptic feasts are calculated (Coptic date or Julian Easter, `src/lib/domain/calendar.ts`, checked against copticchurch.net for 2026–2028) and only used once the church marked the year as checked. Each service has, per year, days without sessions: chosen by the system (major feasts of the Lord and Holy Week) or marked by hand on a year calendar. Church events can cancel sessions everywhere. |
| Session names | Never typed: `Service` or `Service - Stage`, from the current names. |
| Lessons and tasks | Lessons are drafts, ready or published. Who reads, changes, publishes or deletes a lesson or task follows the permissions for lessons and tasks: for a whole stage or service, or for one lesson. The responsible servant of a lesson is chosen among those who may update it, and being responsible gives no access. Parents and members see only published lessons, and only the summary, objectives, teaching points and shared materials, never the preparation notes or internal materials. Tasks (formerly homework) are published to a group; members and linked parents mark them done. |
| Data protection | Administration › Data records requests to see or erase personal data; a copy is a download, an erasure keeps attendance totals as numbers. Everyone downloads their own data and asks for deletion in Settings. |
| Clock | Starts at Sunday 8 November 2026, 12:08 in Cologne. `KHMK_DEMO_CLOCK=frozen` keeps it there (screenshots, tests). |

## Demo accounts

All use the password `khmk-demo`; `/sign-in/demo` signs in with one click.

| Username | Who | Good for |
| --- | --- | --- |
| `mariam.fahmy` | Administrator | Accounts, Access, Data, services, the church calendar |
| `sara.wissa` | Administrator (church office) | Accounts, parent links, data requests |
| `christine.adel` | Manages access within Sunday School, may do everything there | Planning 2027, days without sessions, one-off sessions, attendance, Access for Sunday School |
| `daniel.michael` | Permissions in Sunday School › 1st Class, sessions of 3rd Class, Youth Gathering | Today's sessions, attendance, lesson preparation, tasks |
| `youssef.kamel` | Permissions in Sunday School › 3rd Class | Lessons of 3rd Class |
| `maria.hanna` | Member of University Students, no permissions yet | Getting access to one lesson |
| `mark.shenouda` | Manages access within Youth Gathering, may do everything there | A 2027 draft plan |
| `irene.wahba` | Manages access within the Coptic Language Course, may do everything there | A year already confirmed for 2027 |
| `rebecca.habib` | Servant who hasn't signed in yet | The mandatory password change |
| `hoda.farag` | Parent of Mina (3rd Class) and Mimi (1st Class) | The parent portal |
| `nevine.boulos` | Member of the Coptic Language Course › Level 1 | The member portal |

Andrew Samir is in the records (Servants' Meeting) without an account: the scenario creates his.

## The scenarios

`pnpm screenshots` starts its own server with fresh data and the frozen clock, plays these scenarios, fails if a step
or a check doesn't work, and writes the pictures:

- **A** Mariam creates an account for Andrew Samir (existing record, temporary password), hands it over and lets him
  read and update the sessions of 2nd Class; Andrew signs in, can open nothing before changing the password, changes it
  and sees today's class.
- **B, C** In an empty church Mariam creates Sunday School with three stages (Stages and Schedule tabs) and Youth
  Gathering without stages (only the schedule).
- **D** Christine is reminded that 2027 isn't planned, marks 1 August by hand as a day without sessions, plans
  Kindergarten (Sundays 12:00–13:15), keeps Pentecost, can't keep the parish festival the church canceled, and confirms;
  the other classes stay unplanned until each gets its own plan.
- **E** Christine adds a one-off session to 3rd Class, opens its attendance page, reschedules a session and checks a change
  of the plan from a date.
- **Access** Mariam sees the whole church and its administrators, opens Sunday School (Christine manages access
  there) and lets Marina manage access in 2nd Class. Christine sees only Sunday School; she lets Daniel create and
  read lessons in 3rd Class, can't give what she can't do herself, can't open Youth Gathering, lets Maria read and
  update "The Good Samaritan" (Maria edits it and sees no other lesson) and removes it again. Daniel sees only his
  stages, reads 3rd Class's lessons without changing them, and plans nothing; Christine plans 3rd Class.
- **H** Daniel prepares and publishes "The Ten Commandments".
- **I** Daniel publishes a task for "Noah's ark"; Hoda opens the lesson for Mimi (no servants' notes), marks the task done;
  Daniel sees it.
- **J** Nevine reads a lesson of her group as a member (no notes, no internal materials) and marks its task done.

Then attendance, settings, the screens in German and Arabic, and some in dark mode. Desktop pictures are 1440 px wide
at 2×, phone pictures 390 × 844 at 3×.

## Decisions to confirm with the board

The prototype assumes these; they are recorded in polaeskandar/khmh-koeln-app-backend#353.

- The planning year is the calendar year (January–December), not the Coptic year (from 11 September) or the school year.
- The system's days without sessions are the major feasts of the Lord and Holy Week; everything else is marked by hand.
- The reminder to plan the next year appears from 1 October.
- Temporary passwords don't expire.
- Members see the next sessions of their groups.

## Where things live

| Path | Contents |
| --- | --- |
| `src/app/(app)/` | Staff app: Home, `admin/` (accounts, access, data), `services/` (directory, a service, a stage, the plan editor, days without sessions, the church calendar), `lessons/` (preparation, tasks), `attendance/`, `settings/`. |
| `src/app/parent/`, `src/app/member/` | The portals, each with its own frame. |
| `src/app/sign-in/`, `change-password/`, `privacy/` | Before and right after signing in. |
| `src/features/` | Screen parts by area: accounts, access, services, schedule, calendar, attendance, lessons, tasks, privacy, settings, auth, home. |
| `src/components/` | Shared parts: app shell, portal frame, session card, year calendar, status badges, dialogs, form fields; `ui/` holds the shadcn/ui components of preset `b3a10z1gt0`. |
| `src/server/actions/` | Server actions: validate input with zod, run a command, return a result or a problem. |
| `src/server/queries/` | Read models for the pages, with permissions resolved for the signed-in account. |
| `src/server/mock/` | The in-memory "backend": seed, the permission check (`access.ts`), reading resources (`resources.ts`), commands with their rules, annual planning. `authorization.test.ts` holds the access rules as tests. |
| `src/lib/domain/` | Types, resource types and permissions (`resources.ts`), usernames, annual planning, the Coptic calendar, dates and times. |
| `messages/` | English (`en.json`, the reference the code is type-checked against), German and Arabic. Tests check that they match. `src/i18n/api-codes.json` lists the error codes proposed for the API. |
| `scripts/screenshots.mjs` | The scenarios and the screenshots. |
