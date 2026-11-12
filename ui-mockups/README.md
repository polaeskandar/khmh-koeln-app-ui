# KHMK Köln UI mockups

Screenshots of the clickable prototype in [`../ui-prototype`](../ui-prototype), taken by its `pnpm screenshots`
script while it plays the scenarios of the board's November 2026 decisions. They show the demo day, Sunday 8 November
2026 at 12:08. All names and data are fictional; the 2027 feast dates are calculated and checked against the Coptic
Orthodox Church's published table, and the "Parish festival (sample)" is invented.

Desktop pictures are 1440 px wide at 2×, phone pictures 390 × 844 at 3×. To regenerate them:
`pnpm build && pnpm screenshots` in `ui-prototype`.

## Signing in (`auth/`)

| Screen | Screenshot | Route |
| --- | --- | --- |
| Sign in with a username | [01](auth/01-sign-in.png), [refused](auth/02-sign-in-refused.png), [phone](auth/06-sign-in-mobile.png) | `/sign-in` |
| Demo accounts | [03](auth/03-demo-accounts.png) | `/sign-in/demo` |
| Mandatory password change | [04](auth/04-change-password.png) | `/change-password` |
| Privacy notice (draft) | [05](auth/05-privacy-notice.png) | `/privacy` |

## Home (`home/`)

| Screen | Screenshot | Route |
| --- | --- | --- |
| A servant's day | [01](home/01-servant.png), [phone](home/04-servant-mobile.png) | `/` |
| A service leader, reminded to plan 2027 | [02](home/02-leader-with-reminder.png) | `/` |
| No sessions today | [03](home/03-no-sessions-today.png) | `/` |
| A new servant after the first sign-in | [05](home/05-new-servant-home.png) | `/` |

## Administration (`admin/`)

| Screen | Screenshot | Route |
| --- | --- | --- |
| Accounts | [01](admin/01-accounts.png) | `/admin/accounts` |
| New account: person, roles, sign-in, hand-over | [02](admin/02-new-account-person.png), [03](admin/03-new-account-roles.png), [04](admin/04-new-account-sign-in.png), [05](admin/05-hand-over.png) | `/admin/accounts` |
| An account, reset password, delete | [06](admin/06-account.png), [07](admin/07-reset-password.png), [08](admin/08-delete-account.png) | `/admin/accounts/:id` |
| Access: roles & permissions | [10](admin/10-access-roles.png), [a role](admin/11-role.png), [new role](admin/12-new-role.png) | `/admin/access`, `/admin/access/roles/:id` |
| Access: assignments, give a role for Sunday School | [13](admin/13-assignments.png), [14](admin/14-give-role.png), [15](admin/15-assignments-after.png) | `/admin/access?tab=assignments` |
| Access: parental access, link a member | [16](admin/16-parental-access.png), [17](admin/17-link-member.png) | `/admin/access?tab=parents` |
| Data requests | [20](admin/20-data-requests.png), [an erasure](admin/21-data-request.png) | `/admin/data`, `/admin/data/:id` |

## Services (`services/`)

| Screen | Screenshot | Route |
| --- | --- | --- |
| Directory | [01](services/01-directory.png) | `/services` |
| A service with stages: Stages and Schedule tabs | [02](services/02-service-stages.png), [03](services/03-service-schedule-2026.png) | `/services/:id` |
| A service without stages: only the schedule | [07](services/07-service-without-stages.png) | `/services/:id` |
| Days without sessions (year calendar) | [05](services/05-days-without-sessions.png), [a day marked by hand](services/08-days-marked-by-hand.png) | `/services/:id/days?year=2027` |
| Church calendar, add a church event | [04](services/04-church-calendar.png), [06](services/06-church-event.png) | `/services/calendar` |
| An empty church: creating Sunday School (with stages) and Youth Gathering (without) | [10](services/10-empty-church.png), [11](services/11-new-service-basics.png), [12](services/12-new-service-stages.png), [13](services/13-created-with-stages.png), [14](services/14-created-schedule-tab.png), [15](services/15-new-service-without-stages.png), [16](services/16-created-without-stages.png) | `/services` |

## Schedule (`schedule/`)

| Screen | Screenshot | Route |
| --- | --- | --- |
| 2027 not planned yet, for five classes | [01](schedule/01-overview-not-planned.png) | `/services/:id?tab=schedule&year=2027` |
| Plan editor with feast-day suggestions, confirm | [02](schedule/02-plan-editor.png), [03](schedule/03-confirm-plan.png) | `/services/:id/plan?year=2027` |
| Confirmed: all classes, one class's year | [04](schedule/04-overview-confirmed.png), [05](schedule/05-year-2027.png) | `/services/:id?tab=schedule`, `/services/:id/stages/:stage` |
| A year with history, a one-off session | [06](schedule/06-year-2026.png), [07](schedule/07-one-off-session.png), [08](schedule/08-one-off-in-calendar.png) | `/services/:id/stages/:stage` |
| A draft plan | [09](schedule/09-draft-2027.png) | `/services/:id?year=2027` |
| A session's actions, reschedule, change the plan from a date | [10](schedule/10-session-menu.png), [11](schedule/11-reschedule.png), [12](schedule/12-change-plan.png) | `/services/:id/stages/:stage` |
| A role for Sunday School only | [13](schedule/13-scoped-leader-can-plan.png), [14](schedule/14-other-service-read-only.png) | as Daniel |

## Attendance (`attendance/`)

| Screen | Screenshot | Route |
| --- | --- | --- |
| Today and recent sessions | [01](attendance/01-overview.png) | `/attendance` |
| A session: roster, close, closed | [02](attendance/02-session.png), [04](attendance/04-close.png), [05](attendance/05-closed.png), [phone](attendance/03-session-mobile.png) | `/attendance/:session` |
| A one-off session before its day | [06](attendance/06-one-off-session.png) | `/attendance/:session` |

## Lessons and tasks (`lessons/`)

| Screen | Screenshot | Route |
| --- | --- | --- |
| Preparation, grouped by class | [01](lessons/01-preparation.png) | `/lessons` |
| Lesson editor, draft, publish, published | [02](lessons/02-lesson-editor.png), [03](lessons/03-lesson-draft.png), [04](lessons/04-publish.png), [05](lessons/05-lesson-published.png) | `/lessons/new`, `/lessons/:id` |
| Tasks, task editor, progress | [06](lessons/06-tasks.png), [07](lessons/07-task-editor.png), [08](lessons/08-task-progress.png), [reported by a parent](lessons/09-task-progress-reported.png) | `/lessons/tasks`, `/lessons/tasks/:id` |

## Portals (`parent/`, `member/`) and settings (`settings/`)

| Screen | Screenshot | Route |
| --- | --- | --- |
| Parent: a child's tasks and lessons | [01](parent/01-home.png), [phone](parent/05-home-mobile.png) | `/parent?child=:id` |
| Parent: a lesson, a task marked done | [02](parent/02-lesson.png), [03](parent/03-task-done.png), [tasks](parent/04-tasks.png) | `/parent/lessons/:id`, `/parent/tasks` |
| Parent: settings | [06](parent/06-settings.png) | `/parent/settings` |
| Member: home, a lesson, a task done | [01](member/01-home.png), [02](member/02-lesson.png), [03](member/03-task-done.png), [phone](member/04-home-mobile.png) | `/member`, `/member/lessons/:id` |
| Personal settings | [01](settings/01-settings.png) | `/settings` |

## German, Arabic and dark mode (`languages/`, `dark/`)

| Screen | German | Arabic |
| --- | --- | --- |
| Home | [de-01](languages/de-01-home.png) | [ar-01](languages/ar-01-home.png) |
| Services | [de-02](languages/de-02-services.png) | [ar-02](languages/ar-02-services.png) |
| Plan editor | [de-03](languages/de-03-plan-editor.png) | [ar-03](languages/ar-03-plan-editor.png) |
| Attendance | [de-04](languages/de-04-attendance.png) | [ar-04](languages/ar-04-attendance.png) |
| Access | [de-05](languages/de-05-access.png) | [ar-05](languages/ar-05-access.png) |
| Accounts | [de-06](languages/de-06-accounts.png) | [ar-06](languages/ar-06-accounts.png) |
| Parent portal on the phone | [de-07](languages/de-07-parent-mobile.png) | [ar-07](languages/ar-07-parent-mobile.png) |
| Sign in | [de-08](languages/de-08-sign-in.png) | [ar-08](languages/ar-08-sign-in.png) |

Dark mode: [home](dark/01-home.png), [a service](dark/02-service.png), [member portal in Arabic on the phone](dark/03-member-arabic-mobile.png).

## Earlier mockups

The registration, approval and email screens of the first MVP and the QR-first concept before it are no longer part of
the app. They are kept only in this repository's history (`git log -- ui-mockups`).
