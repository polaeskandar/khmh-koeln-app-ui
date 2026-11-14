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
| Data | In memory in the Next.js server, built from a fixed seed. The account menu has "Reset demo data" and "Start with an empty church" (only the administrator, the roles and the church calendar). |
| Accounts | Created only by the church office (Administration › Accounts): an existing person or a new one, roles and where they apply, groups for members, the members a parent follows, a username and a temporary password that is shown once. No registration, no email, no password links. Accounts are deleted, never deactivated; a deleted account's records stay without it. |
| Sign-in | Username and password (case-insensitive usernames, `a–z 0–9 . _ -`, 3–32 characters, ASCII only so look-alike letters can't be used). One answer for every failure. An account with a temporary password reaches nothing but `/change-password`: the server actions and pages refuse everything else, not only the navigation. |
| Roles and access | One hierarchical, resource-based model (`../docs/authorization.md`). Resource types are registered once in `src/lib/domain/resources.ts` (church › service › stage › schedule › session; stage or service › lesson › task; a fictional event type), each with its actions (CRUD plus publish, take or correct attendance, plan or confirm a year). Roles build on other roles (Service leader includes Servant and Lesson editor; Servant includes Session helper), are given for one place and apply to everything in it, never to a sibling. Giving roles is explicit: a role lists which roles its holders may give and where, and nobody gives more than they hold there, gives to themselves, or touches the protected Administrator. Creators of lessons get Lesson editor for them. Administration › Access is a resource explorer (who has access here, from where, and what it allows), a role hierarchy editor, and parental access. |
| Members and children | A child is just a member: a person with a member account and groups. Parents are linked to members in Access › Parental access, and may report tasks for them. |
| Schedules | One schedule per stage, or per service when it has no stages, and each is planned on its own, a year at a time: weekday, start, optional end, optional first and last date, place. The preview marks the service's days without sessions; nothing exists until the plan is confirmed, which creates all sessions of the year. A confirmed plan changes only from a date on, and never touches past sessions, sessions with attendance or sessions changed by hand. Single sessions are canceled, restored, rescheduled, and one-off sessions added. |
| Calendar | Coptic feasts are calculated (Coptic date or Julian Easter, `src/lib/domain/calendar.ts`, checked against copticchurch.net for 2026–2028) and only used once the church marked the year as checked. Each service has, per year, days without sessions: chosen by the system (major feasts of the Lord and Holy Week) or marked by hand on a year calendar. Church events can cancel sessions everywhere. |
| Session names | Never typed: `Service` or `Service - Stage`, from the current names. |
| Lessons and tasks | Lessons are drafts, ready or published. A servant sees, changes and deletes only the lessons and tasks they created or were added to as Editor (the role given to creators of lessons and tasks); service leaders see and change every lesson of their service. Whether servants also read colleagues' lessons is one permission of the Servant role (lesson read). Parents and members see only published lessons, and only the summary, objectives, teaching points and shared materials, never the preparation notes or internal materials. Tasks (formerly homework) are published to a group; members and linked parents mark them done. |
| Data protection | Administration › Data records requests to see or erase personal data; a copy is a download, an erasure keeps attendance totals as numbers. Everyone downloads their own data and asks for deletion in Settings. |
| Clock | Starts at Sunday 8 November 2026, 12:08 in Cologne. `KHMK_DEMO_CLOCK=frozen` keeps it there (screenshots, tests). |

## Demo accounts

All use the password `khmk-demo`; `/sign-in/demo` signs in with one click.

| Username | Who | Good for |
| --- | --- | --- |
| `mariam.fahmy` | Administrator | Accounts, Access, Data, services, the church calendar |
| `sara.wissa` | Church office (a role of the church's own); Event coordinator for the parish picnic | Accounts for parents and members, parental access, data requests |
| `christine.adel` | Service leader for Sunday School | Planning 2027, days without sessions, one-off sessions, attendance, Access for Sunday School |
| `daniel.michael` | Servant in Sunday School › 1st Class and in Youth Gathering (Christine adds 3rd Class in the scenarios) | Today's sessions, attendance, lesson preparation, tasks |
| `youssef.kamel` | Servant in Sunday School › 3rd Class | A colleague whose lessons Daniel doesn't see |
| `maria.hanna` | Member of University Students, no staff role yet | Getting Lesson editor for one lesson |
| `mark.shenouda` | Service leader for Youth Gathering | A 2027 draft plan |
| `irene.wahba` | Service leader for the Coptic Language Course | A year already confirmed for 2027 |
| `rebecca.habib` | Servant who hasn't signed in yet | The mandatory password change |
| `hoda.farag` | Parent of Mina (3rd Class) and Mimi (1st Class) | The parent portal |
| `nevine.boulos` | Member of the Coptic Language Course › Level 1 | The member portal |

Andrew Samir is in the records (Servants' Meeting) without an account: the scenario creates his.

## The scenarios

`pnpm screenshots` starts its own server with fresh data and the frozen clock, plays these scenarios, fails if a step
or a check doesn't work, and writes the pictures:

- **A** Mariam creates a servant account for Andrew Samir (existing record, Servant in 2nd Class, temporary password),
  hands it over; Andrew signs in, can open nothing before changing the password, changes it and sees today's class, but
  not Marina's lesson for the same class.
- **B, C** In an empty church Mariam creates Sunday School with three stages (Stages and Schedule tabs) and Youth
  Gathering without stages (only the schedule).
- **D** Christine is reminded that 2027 isn't planned, marks 1 August by hand as a day without sessions, plans
  Kindergarten (Sundays 12:00–13:15), keeps Pentecost, can't keep the parish festival the church canceled, and confirms;
  the other classes stay unplanned until each gets its own plan.
- **E** Christine adds a one-off session to 3rd Class, opens its attendance page, reschedules a session and checks a change
  of the plan from a date.
- **Access A, E, I** Mariam sees the whole church in Resource management, gives Mark "Event coordinator" for the Summer
  camp (an event type added through the registry), opens Service leader in Roles & permissions (built on Servant and
  Lesson editor, inherited permissions marked), sees that Session helper can't build on Service leader (a loop), starts
  a new role built on Servant, and opens Parental access.
- **Access B, D, G, H** Christine sees only Sunday School; she gives Daniel Servant for 3rd Class in four steps (person,
  role with the reasons other roles aren't offered, where, review), can't open Youth Gathering, gives Maria Lesson editor
  for "The Good Samaritan" (Maria edits it and sees no other lesson), gives Daniel Servant for all of Sunday School (the
  review names his narrower roles), and removes it again: his 1st and 3rd Class roles stay.
- **Access C** Daniel sees only his stages and plans nothing; Christine plans 3rd Class.
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
| `src/server/mock/` | The in-memory "backend": seed, the authorization evaluator (`access.ts`), delegation (`delegation.ts`), resource adapters (`resources.ts`), commands with their rules, annual planning. `authorization.test.ts` plays the access scenarios. |
| `src/lib/domain/` | Types, the resource registry (`resources.ts`), the role hierarchy (`roles.ts`), default roles (`policy.ts`), usernames, annual planning, the Coptic calendar, dates and times. |
| `messages/` | English (`en.json`, the reference the code is type-checked against), German and Arabic. Tests check that they match. `src/i18n/api-codes.json` lists the error codes proposed for the API. |
| `scripts/screenshots.mjs` | The scenarios and the screenshots. |
