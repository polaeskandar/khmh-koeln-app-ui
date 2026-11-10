# KHMK Köln UI

The design side of the KHMK Köln app: a clickable prototype of the MVP and the mockups taken from it. The
product is built through tickets in the `frontend` and `backend` repositories; this repository is their
reference for screens, wording and behaviour.

| Folder | What it is |
| --- | --- |
| [`ui-prototype`](ui-prototype) | The clickable prototype (Next.js, in-memory demo data). Every screen of the MVP works, and its mock layer checks the rules the API will enforce. Its Emails section (`/emails`) shows the emails the backend sends. |
| [`ui-mockups`](ui-mockups) | Screenshots of the prototype for every screen and every email, desktop and phone, with the route of each. |

## The MVP

Servants run their services (Sunday School, Youth Meeting, …): they plan recurring meetings, take attendance
by hand on a laptop or phone, prepare lessons and give small homework tasks. Parents follow their
children's homework in a parent portal and tick it off. People register themselves and an administrator approves each
account; roles are defined by the church itself (it starts with Administrator, Service leader, Servant and Parent
and adds its own, such as a church office): each is a name and permissions, an action on a resource, and holds
everywhere in the church or only in the services and stages an account is assigned to (servants and service
leaders). Requests to see or delete personal data (DSGVO) are handled in the app. After the launch, members get
accounts of their own too (a youth, an adult in the Coptic course; under 16 only with a parent's agreement): a
member portal shows their groups, the next meetings and their homework, which they tick off themselves. The app speaks English,
German and Arabic (right to left) and has a dark mode. QR check-in, follow-up, visitation, events,
pastoral care, appointments and welfare are not part of the MVP; the earlier QR-first concept is kept in
this repository's history (see the mockups' README).

## Trying the prototype

```bash
cd ui-prototype
pnpm install
pnpm dev                 # http://localhost:3000, sign in with a demo account (password khmk-demo)
```

It needs Node.js 22 or newer and pnpm 12 (`brew install pnpm`; pnpm 11 switches to it by itself). After changing a screen, regenerate the
mockups with `pnpm build && pnpm screenshots` in `ui-prototype`. The script needs Playwright's Chromium
once: `pnpm exec playwright install chromium`.

## Related repositories

- `frontend`: the Next.js web app, also packaged as iOS and Android apps with Capacitor.
- `backend`: the Symfony API. Its `docs/` hold the architecture decisions and the data model the
  prototype's mock layer follows.
