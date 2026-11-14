# Access

One generic permission system that answers three questions: **who has access, to which resource, and what can
they do?** There are no roles, no role hierarchies and no presets.

The prototype in `ui-prototype` implements it: `src/lib/domain/resources.ts` (resource types),
`src/server/mock/resources.ts` (reading resources from the app's data), `src/server/mock/access.ts` (the check),
`src/server/mock/commands/access.ts` (giving and removing access), `src/server/queries/access.ts` (the Access page)
and `src/server/mock/authorization.test.ts` (the rules as tests).

## Resources

Every resource has a **type**, an **id** and a **parent** (none for the church). The types and their possible parents
are listed once; the resources themselves are read from the app's data, never kept in a separate list.

```text
Church
└── Service                      (Sunday School, Youth Gathering, …)
    ├── Stage                    (1st Class, 3rd Class, …)       only in services with stages
    │   ├── Sessions › Session
    │   └── Lessons  › Lesson
    │                  └── Tasks › Task
    ├── Sessions › Session                                        in services without stages
    └── Lessons  › Lesson › Tasks › Task
```

"Sessions", "Lessons" and "Tasks" are groups: many resources of one type under one parent, shown ten at a time.
Adding a type of resource is one line (its parent types) and one reader (find a resource's parent, list the resources
under a parent, name one); the permission check, the commands and the Access page don't change.
`authorization.test.ts` adds a `retreat` type during a test to prove it.

## Permissions

A permission is: **a member, a resource, a type of resource, and some of Create, Read, Update, Delete.**

| Example | Member | Resource | Type | Actions |
| --- | --- | --- | --- | --- |
| Daniel creates and reads lessons in 3rd Class | Daniel | 3rd Class | Lesson | Create, Read |
| Maria reads and updates one lesson | Maria | "The Good Samaritan" | Lesson | Read, Update |
| Christine changes Sunday School itself | Christine | Sunday School | Service | Read, Update |

Rules:

1. A permission counts on its resource and on everything below it, never on a sibling or a parent: lessons of 3rd
   Class, not of 2nd Class or Youth Gathering; one lesson, not the other lessons of its stage.
2. It counts only for its type: lesson permissions don't change the stage.
3. Read, Update and Delete are checked on the resource itself. **Create is checked on the parent the new resource will
   get**, because it doesn't exist yet: creating a lesson in 3rd Class needs Create for lessons on 3rd Class or above.
   On a resource itself there is nothing to create, so a permission for the resource's own type is Read, Update and
   Delete only.
4. A resource that doesn't exist gives nothing. Inside an archived service or stage only reading is possible, and no
   access is given there; the service or stage itself can still be changed, so that it can be restored.

The check, for every type:

```text
may member M do action A with type T at resource R?
  yes if M is an administrator
  yes if M has a permission (T, A) on R or on a parent of R
  no otherwise; no for an unknown R; only Read inside an archived service or stage
```

What the app's actions mean in these terms:

- taking and correcting attendance, cancelling, restoring and rescheduling a session: Update on the session;
- planning a year, confirming it and adding a one-off session: Create sessions in the stage (or in the service without
  stages);
- a service's days without sessions: Update on the service, or Create sessions in it;
- publishing a lesson, choosing its responsible servant: Update on the lesson; the responsible servant must be able to
  update it, and being responsible gives no access;
- creating a stage: Create stages in the service;
- the church calendar (church events, checking a year's feasts) and keeping a session on a day the church cancelled:
  Update services for the whole church.

## Who manages access

- **Administrators** give and remove permissions everywhere, and only they choose who manages access. An administrator
  is someone who manages access within the whole church; someone always stays administrator.
- An administrator can let a member **manage access within one resource**: Christine manages access within Sunday
  School. She gives and removes permissions in Sunday School and below it (Daniel for 3rd Class), never in Youth
  Gathering, never administrator access, and only what she may do herself there.
- Nobody changes their own access.
- Managing access is itself a permission, checked by the server on every change.
- Creating accounts is separate and stays with administrators (Administration › Accounts), like linking parents to
  their children and data requests (Administration › Data). Access is only given to existing accounts.

Parents and members are relationships, not permissions: a parent sees the children linked to their account
(Administration › Accounts › an account › Children); a member sees their own groups.

## Administration › Access

One page. On the left, the church as a tree: only the places where the viewer manages access, and the places above
them greyed out. On the right, the selected place (or a group, such as "3rd Class › Lessons"):

- who has access there: each member with their permissions, marked "Given here" or "From Sunday School";
- **Give access**: choose an existing person, what it is for (this place, or one type of resource in it), and the
  permissions; administrators can also let the person manage access here;
- change or remove what was given here; what comes from a place above is changed there.

## Decision to confirm

Servants now see every lesson of the stages where they may read lessons. The earlier rule "servants see only the
lessons they write" needs a permission given automatically to whoever creates a lesson; it isn't part of this design,
as no such automatic permission was requested.
