# KHMK Köln UI

The design side of the KHMK Köln app: a clickable prototype and the screenshots taken from it. The product is built
through tickets in the `frontend` and `backend` repositories; this repository is their reference for screens, wording and
behaviour.

| Folder | What it is |
| --- | --- |
| [`ui-prototype`](ui-prototype) | The clickable prototype (Next.js, in-memory demo data). Every screen works, and its mock layer checks the rules the API will enforce. |
| [`ui-mockups`](ui-mockups) | Screenshots of the prototype for every screen, desktop and phone, in English, German and Arabic, with the route of each. |

## The app after the board's decisions of November 2026

The church office creates every account (members, servants, parents) with a username and a temporary password, which
is changed at the first sign-in; there is no registration and the app sends no email. What an account may do comes from
roles given for a place in the church: roles build on other roles, places sit inside places (church › service › stage ›
schedule, lessons, sessions, tasks), and a role given for a place applies to everything in it. Roles are given and
removed only in Administration › Access, by administrators and by people whose role explicitly lets them give certain
roles within their own place, never more than they hold; [`docs/authorization.md`](docs/authorization.md) describes the
model. The sidebar is Home, Administration (Accounts, Access, Data), Organization (Services), Lessons (Preparation,
Tasks) and Attendance, with Settings at the bottom.

Services have stages or not. Each stage, or each service without stages, has one schedule, planned a whole year at a
time: the preview suggests canceling the service's days without sessions (Coptic feasts chosen by the system or days
marked by hand), and confirming creates every session of the year. Sessions are named after their service and stage,
and attendance is taken on them by hand. Servants prepare lessons and give tasks (formerly homework); parents and
members read the published lessons and mark tasks done. Children are members. Requests to see or delete personal data
are handled in Administration › Data. The app speaks English, German and Arabic (right to left) and has a dark mode.

The implementation tickets are polaeskandar/khmh-koeln-app-backend#353–#457 and
polaeskandar/khmh-koeln-app-frontend#406–#467; [`docs/authorization.md`](docs/authorization.md#implementation) maps the
access work to them.

## Trying the prototype

```bash
cd ui-prototype
pnpm install
pnpm dev                 # http://localhost:3000, sign in with a demo account (password khmk-demo)
```

It needs Node.js 22 or newer and pnpm 12. After changing a screen, regenerate the mockups with
`pnpm build && pnpm screenshots` in `ui-prototype` (Playwright's Chromium once: `pnpm exec playwright install chromium`).
The prototype's README lists the demo accounts, the scenarios and the decisions still to confirm.

Earlier versions (the QR-first concept, the registration and email flows of the first MVP) are in this repository's
history.
