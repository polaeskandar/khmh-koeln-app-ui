# KHMK Köln UI mockups

Screenshots of the clickable prototype in [`../ui-prototype`](../ui-prototype), taken by its
`pnpm screenshots` script while it plays the end-to-end scenario. They show the revised MVP on the demo day,
Sunday 8 November 2026 at 12:08. All names and data are fictional.

Desktop screenshots are 1440 px wide at 2×, phone screenshots 390 × 844 at 3×. `admin/` holds the staff app,
`parent/` the parent portal, `member/` the member portal (planned after the launch), `auth/` the pages before
signing in, `languages/` the main screens in German and Arabic (right to left), `dark/` a few screens in
dark mode, and `emails/` the emails the backend sends. To regenerate them, see the prototype's README.

## Staff app

`…/stages/:stage` stands for `/services/:service/stages/:stage`. Screens 02 and 03 show an administrator:
the Administrator role creates, archives and deletes services, while a service leader edits them. Roles hold
everywhere in the church, so a servant sees and works in every service.

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
| Settings: account requests | [account-requests](admin/account-requests.png), [approve a parent](admin/dialog-approve-account.png), [approve a member](admin/dialog-approve-member.png) | `/settings` |
| Settings: parent access | [parent-access](admin/parent-access.png) | `/settings` |
| Settings: member accounts | [member-accounts](admin/member-accounts.png), [remove a link](admin/dialog-remove-member-link.png) | `/settings` |
| Settings: roles | [roles](admin/roles.png), [delete a role](admin/dialog-delete-role.png) | `/settings` |
| A role | [new role](admin/role-editor.png), [Church office](admin/role-church-office.png), [the last way to change roles](admin/role-locks-out.png) | `/settings/roles/new`, `/settings/roles/:role` |
| Settings: staff accounts and roles | [staff-roles](admin/staff-roles.png), [give a role](admin/dialog-give-role.png), [approve a servant with roles](admin/dialog-approve-servant.png) | `/settings` |
| Settings as the church office | [settings-church-office](admin/settings-church-office.png) | `/settings`, signed in as Sara Wissa |
| Data protection requests | [data-requests](admin/data-requests.png), [record a request](admin/dialog-record-data-request.png) | `/settings/data-requests` |
| A request to erase data | [review](admin/data-request-review.png), [erase](admin/dialog-erase-data.png), [done](admin/data-request-done.png) | `/settings/data-requests/:request` |
| Your account | [account](admin/account.png) | `/account` |
| S01 Lessons | [lessons-overview](admin/lessons-overview.png) | `…/stages/:stage/lessons` |
| S02 Lesson editor | [lesson-editor](admin/lesson-editor.png) | `…/lessons/new`, `…/lessons/:lesson/edit` |
| S03 Lesson | [lesson-details](admin/lesson-details.png) | `…/lessons/:lesson` |
| S04 Homework | [homework-management](admin/homework-management.png), [actions](admin/menu-homework-actions.png), [archive](admin/dialog-archive-homework.png), [restore](admin/dialog-restore-homework.png), [delete a draft](admin/dialog-delete-homework.png) | `…/stages/:stage/homework` |
| S05 Homework editor | [homework-editor](admin/homework-editor.png), [edit](admin/homework-edit.png) | `…/homework/new?lesson=:lesson`, `…/homework/:homework/edit` |
| S06 Homework progress | [homework-completion-overview](admin/homework-completion-overview.png), [members with their own account](admin/homework-progress-own-accounts.png) | `…/homework/:homework` |

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
| P08 Menu with "My groups" | [menu-my-groups](parent/menu-my-groups.png) | the account menu, for a parent whose own record is in a group |

## Member portal

For people on a roster with an account of their own: a youth, an adult in the Coptic course, an older child
whose parents agreed. An administrator links the account to the member's record. Members see their groups,
when and where they meet, the last lesson's passage and memory verse, and the homework of their stages, which
they tick off themselves. Planned after the launch.

| Screen | Screenshot | Route in the prototype |
| --- | --- | --- |
| M01 Home | [member-home](member/member-home.png), [a youth without homework](member/member-home-youth.png), [a parent in the Coptic course](member/member-home-parent.png) | `/member` |
| M02 Homework | [homework-list](member/homework-list.png) | `/member/homework` |
| M03 Homework task | [homework-details](member/homework-details.png) | `/member/homework/:homework` |
| M04 Task reported done | [homework-completed](member/homework-completed.png) | the same page after "Mark as done" |
| M05 Home on the phone | [member-home-mobile](member/member-home-mobile.png) | `/member` at phone width |
| M06 Account and data | [account](member/account.png) | `/member/account` |

## Signing in and registering

A new registration reaches the office once its email address is confirmed with the link from the email (valid
7 days). Then it waits for the office: parents are linked to their children and get the Parent role, members are
linked to their own record, servants get their roles. Until then the email and password only lead to the
page that asks for the link, then to the waiting page.

| Screen | Screenshot | Route in the prototype |
| --- | --- | --- |
| Sign in | [01-sign-in](auth/01-sign-in.png) | `/sign-in` (demo accounts: `/sign-in/demo`) |
| Register | [02-register](auth/02-register.png), [as a member](auth/07-register-as-member.png) | `/register` |
| Registered | [03-registered](auth/03-registered.png) | `/register/done` |
| Confirm the email address first | [08-confirm-email-first](auth/08-confirm-email-first.png) | `/sign-in/unconfirmed` |
| Email address confirmed | [09-email-confirmed](auth/09-email-confirmed.png), [link invalid or expired](auth/10-confirmation-link-invalid.png) | `/confirm-email#token=…` |
| Waiting for approval | [04-waiting-for-approval](auth/04-waiting-for-approval.png) | `/sign-in/pending` |
| Forgot password | [05-forgot-password](auth/05-forgot-password.png) | `/forgot-password` |
| Privacy notice (draft) | [06-privacy-notice](auth/06-privacy-notice.png) | `/privacy` |

## Emails

The emails the backend sends through Mailgun (polaeskandar/khmh-koeln-app-backend#17), in the account's
language, as a mail client draws them: 720 px wide at 2× (the email is a 560 px card), phones 390 px at 3×.
The prototype's Emails section shows them with every option; its README describes how they are built.

| Email | Screenshots | Template and ticket | Route in the prototype |
| --- | --- | --- | --- |
| Password link | [password-link](emails/password-link.png), [German](emails/password-link-de.png), [Arabic](emails/password-link-ar.png), [phone](emails/password-link-phone.png), [dark](emails/password-link-dark.png), [plain text](emails/password-link-text.png) | `password_link`, backend #30 (at the launch, 24-hour links from the office) and #97 (1-hour links from the sign-in page) | `/emails/password-link` |
| Account approved | [account-approved](emails/account-approved.png), [German](emails/account-approved-de.png), [Arabic](emails/account-approved-ar.png), [phone](emails/account-approved-phone.png), [dark](emails/account-approved-dark.png) | `account_approved`, backend #97 (after the launch) | `/emails/account-approved` |
| The Emails section | [emails](emails/emails.png), [one email with its options](emails/viewer.png) | | `/emails`, `/emails/:email` |

## German and Arabic

The same screens in German (`de-…`) and Arabic (`ar-…`, right to left): dashboard, meetings, a new schedule,
attendance on desktop and phone, the parent portal, settings, sign-in, the member portal and a role.

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
| Member portal | [de-09](languages/de-09-member-home.png) | [ar-09](languages/ar-09-member-home.png) |
| A role (Servant) | [de-10](languages/de-10-role-editor.png) | [ar-10](languages/ar-10-role-editor.png) |

## Dark mode

[Dashboard](dark/01-dashboard.png), [attendance](dark/02-attendance.png),
[parent portal](dark/03-parent-dashboard.png), [parent portal in Arabic on the phone](dark/04-parent-dashboard-arabic-mobile.png),
[sign-in](dark/05-sign-in.png) and [member portal in Arabic on the phone](dark/06-member-home-arabic-mobile.png). Everyone chooses light, dark or "like the device" in the account menu.

## Earlier mockups

The first concept was built around QR check-in. Its 30 screens and two contact sheets are in this repository's
history, in the commit "docs: add the mockups exported from the QR-first prototype". To look at them:

```bash
git log --diff-filter=A --oneline -- ui-mockups/contact-sheet-mvp.png   # the commit that added them
mkdir -p /tmp/qr-mockups
git archive <commit> ui-mockups | tar -x -C /tmp/qr-mockups
```
