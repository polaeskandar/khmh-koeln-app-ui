# KHMK Köln UI mockups

Screenshots of the clickable prototype in [`../ui-prototype`](../ui-prototype), taken by its
`pnpm screenshots` script while it plays the end-to-end scenario. They show the revised MVP on the demo day,
Sunday 8 November 2026 at 12:08. All names and data are fictional.

Desktop screenshots are 1440 px wide at 2×, phone screenshots 390 × 844 at 3×. `admin/` holds the staff app,
`parent/` the parent portal, `auth/` the pages before signing in, `languages/` the main screens in German and
Arabic (right to left), and `dark/` a few screens in dark mode. To regenerate them, see the prototype's README.

## Staff app

`…/stages/:stage` stands for `/services/:service/stages/:stage`. Screens 02 and 03 show an administrator:
only administrators create, archive and delete services, while a service leader edits the services they lead.

| Screen | Screenshot | Route in the prototype |
| --- | --- | --- |
| 01 Dashboard | [01-dashboard](admin/01-dashboard.png) | `/` |
| 02 Services overview | [02-services-overview](admin/02-services-overview.png), [actions](admin/menu-service-actions.png), [new service](admin/dialog-new-service.png), [edit](admin/dialog-edit-service.png), [archive](admin/dialog-archive-service.png), [delete](admin/dialog-delete-service.png) | `/services` |
| 03 Service details | [03-service-details](admin/03-service-details.png), [a new service](admin/service-details-new.png) | `/services/:service` |
| 04 Stage management | [04-stage-management](admin/04-stage-management.png) | `/services/:service/stages` |
| 05 Meeting schedules | [05-meeting-schedules](admin/05-meeting-schedules.png), [new schedule](admin/dialog-new-schedule.png) | `/meetings/schedules` |
| 06 Meeting sessions | [06-meeting-sessions](admin/06-meeting-sessions.png), [cancel a session](admin/dialog-cancel-session.png) | `/meetings`, `/meetings/sessions/:session` |
| 07 Manual attendance | [07-manual-attendance](admin/07-manual-attendance.png), [close attendance](admin/dialog-close-attendance.png) | `/attendance/:session` |
| 08 Attendance summary | [08-attendance-summary](admin/08-attendance-summary.png) | `/attendance/:session/summary` |
| 09 Members | [09-member-management](admin/09-member-management.png) | `/members` |
| 10 Attendance on the phone | [10-mobile-attendance](admin/10-mobile-attendance.png) | `/attendance/:session` at phone width |
| Settings: account requests | [account-requests](admin/account-requests.png), [approve a parent](admin/dialog-approve-account.png) | `/settings` |
| Settings: parent access | [parent-access](admin/parent-access.png) | `/settings` |
| Data protection requests | [data-requests](admin/data-requests.png), [record a request](admin/dialog-record-data-request.png) | `/settings/data-requests` |
| A request to erase data | [review](admin/data-request-review.png), [erase](admin/dialog-erase-data.png), [done](admin/data-request-done.png) | `/settings/data-requests/:request` |
| Your account | [account](admin/account.png) | `/account` |
| S01 Lessons | [lessons-overview](admin/lessons-overview.png) | `…/stages/:stage/lessons` |
| S02 Lesson editor | [lesson-editor](admin/lesson-editor.png) | `…/lessons/new`, `…/lessons/:lesson/edit` |
| S03 Lesson | [lesson-details](admin/lesson-details.png) | `…/lessons/:lesson` |
| S04 Homework | [homework-management](admin/homework-management.png), [actions](admin/menu-homework-actions.png), [archive](admin/dialog-archive-homework.png), [restore](admin/dialog-restore-homework.png), [delete a draft](admin/dialog-delete-homework.png) | `…/stages/:stage/homework` |
| S05 Homework editor | [homework-editor](admin/homework-editor.png), [edit](admin/homework-edit.png) | `…/homework/new?lesson=:lesson`, `…/homework/:homework/edit` |
| S06 Homework progress | [homework-completion-overview](admin/homework-completion-overview.png) | `…/homework/:homework` |

## Parent portal

| Screen | Screenshot | Route in the prototype |
| --- | --- | --- |
| P01 Home | [parent-dashboard](parent/parent-dashboard.png) | `/parent` |
| P02 My children | [my-children](parent/my-children.png) | `/parent/children` |
| P03 Homework | [homework-list](parent/homework-list.png) | `/parent/homework?child=:child` |
| P04 Homework task | [homework-details](parent/homework-details.png) | `/parent/homework/:homework?child=:child` |
| P05 Task reported done | [homework-completed](parent/homework-completed.png) | the same page after "Mark as done" |
| P06 Home on the phone | [parent-dashboard-mobile](parent/parent-dashboard-mobile.png) | `/parent` at phone width |
| P07 Account and data | [account](parent/account.png) | `/parent/account` |

## Signing in and registering

New accounts wait for an administrator: parents are linked to their children, servants get a role. Until
then the email and password only lead to the waiting page.

| Screen | Screenshot | Route in the prototype |
| --- | --- | --- |
| Sign in | [01-sign-in](auth/01-sign-in.png) | `/sign-in` (demo accounts: `/sign-in/demo`) |
| Register | [02-register](auth/02-register.png) | `/register` |
| Registered | [03-registered](auth/03-registered.png) | `/register/done` |
| Waiting for approval | [04-waiting-for-approval](auth/04-waiting-for-approval.png) | `/sign-in/pending` |
| Forgot password | [05-forgot-password](auth/05-forgot-password.png) | `/forgot-password` |
| Privacy notice (draft) | [06-privacy-notice](auth/06-privacy-notice.png) | `/privacy` |

## German and Arabic

The same screens in German (`de-…`) and Arabic (`ar-…`, right to left): dashboard, meetings, a new schedule,
attendance on desktop and phone, the parent portal, settings and sign-in.

| Screen | German | Arabic |
| --- | --- | --- |
| Dashboard | [de-01](languages/de-01-dashboard.png) | [ar-01](languages/ar-01-dashboard.png) |
| Meetings | [de-02](languages/de-02-meetings.png) | [ar-02](languages/ar-02-meetings.png) |
| New schedule | [de-03](languages/de-03-dialog-new-schedule.png) | [ar-03](languages/ar-03-dialog-new-schedule.png) |
| Attendance | [de-04](languages/de-04-attendance.png) | [ar-04](languages/ar-04-attendance.png) |
| Attendance on the phone | [de-05](languages/de-05-attendance-mobile.png) | [ar-05](languages/ar-05-attendance-mobile.png) |
| Parent portal | [de-06](languages/de-06-parent-dashboard.png) | [ar-06](languages/ar-06-parent-dashboard.png) |
| Settings | [de-07](languages/de-07-settings.png) | [ar-07](languages/ar-07-settings.png) |
| Sign in | [de-08](languages/de-08-sign-in.png) | [ar-08](languages/ar-08-sign-in.png) |

## Dark mode

[Dashboard](dark/01-dashboard.png), [attendance](dark/02-attendance.png),
[parent portal](dark/03-parent-dashboard.png), [parent portal in Arabic on the phone](dark/04-parent-dashboard-arabic-mobile.png)
and [sign-in](dark/05-sign-in.png). Everyone chooses light, dark or "like the device" in the account menu.

## Earlier mockups

The first concept was built around QR check-in. Its 30 screens and two contact sheets are in this repository's
history, in the commit "docs: add the mockups exported from the QR-first prototype". To look at them:

```bash
git log --diff-filter=A --oneline -- ui-mockups/contact-sheet-mvp.png   # the commit that added them
mkdir -p /tmp/qr-mockups
git archive <commit> ui-mockups | tar -x -C /tmp/qr-mockups
```
