# Authorization

One model, two hierarchies, one evaluator, one place to manage it.

- **Roles** form a hierarchy: a role includes the roles it builds on.
- **Resources** form a hierarchy: a lesson sits in a stage, a stage in a service, a service in the church.
- **Assignments** give one role to one account on one resource. They apply there and below.
- **Delegation** is explicit: a role lists which roles its holders may give, and where.

The two hierarchies are independent. Role inheritance answers "what does this role allow?"; resource inheritance
answers "where does it allow it?".

The prototype in `ui-prototype` is the reference implementation: `src/lib/domain/resources.ts` (registry),
`src/lib/domain/roles.ts` (role hierarchy), `src/server/mock/access.ts` (evaluator),
`src/server/mock/delegation.ts` (delegation), `src/server/mock/resources.ts` (resource adapters),
`src/server/mock/commands/access.ts` (role and assignment commands), `src/server/queries/access.ts` (Access screens) and
`src/server/mock/authorization.test.ts` (the scenarios below as tests). The backend and frontend issues listed in
[Implementation](#implementation) build it for real.

## Concepts

```text
Resource type   registered once: parent types, actions, scope?, listed?
Resource        { type, id } with exactly one authorization parent (null for the church)
Permission      "<type>.<action>"   lesson.update, lesson.publish, session.takeAttendance, schedule.confirm
                "access.assign" | "access.revoke"   managing access, limited by delegation rules
                "portal.parent" | "portal.member"   entering a portal
Role            id, name, description, inherits[], permissions[] (own), assignableAt[] (scope types),
                delegation[] ({ role, at: scope types }), protected
Assignment      id, account, role, resource, origin (granted | owner), created at/by
Access event    granted | revoked, actor, account, role, resource, at   (audit trail)
```

## Resource hierarchy

| Type | Authorization parent | Actions | Scope | In the explorer |
| --- | --- | --- | --- | --- |
| church | — | — | yes | root |
| service | church | create, read, update, delete | yes | inline |
| stage | service | create, read, update, delete | yes | inline |
| schedule | stage, or service without stages | read, plan, confirm | yes | inline |
| session | schedule | create, read, update, delete, takeAttendance, correctAttendance | yes | grouped, paged |
| lesson | stage, or service without stages | create, read, update, delete, publish | yes | grouped, paged |
| task | lesson | create, read, update, delete | yes | grouped, paged |
| event (fictional, see I) | service or church | create, read, update, delete | yes | grouped, paged |
| account, role, guardianship, dataRequest | church | CRUD subsets | no | — |

**Authorization-parent policy.** Every resource has exactly one authorization parent at a time, read from storage by
the type's adapter. Other relationships never grant access: a lesson linked to a session, a person's memberships, a
guardian link. Stage-less services hold their schedule and lessons directly.

**Registration.** A type is a registry row (parent types, actions, `scope`, `listed`) plus one adapter (find the
parent, archived?, list the children under a parent, name one) plus its labels. The evaluator, delegation, the role
editor and the explorer read the registry; none of them names a type. `authorization.test.ts` registers a `retreat`
type at runtime and runs the whole model against it.

**Moving.** Moving a resource is, for authorization, deleting it where it is and creating it where it goes: the actor
needs `T.delete` on the resource and `T.create` on the new parent. Its own assignments move with it; what reaches it
from above is read from the new place. Nobody can take a resource out of a place they don't control into one they do.

## Role hierarchy

A role's **effective permissions** are its own plus those of every role it includes, transitively. Its **effective
delegation** is merged the same way. Inheritance is a directed acyclic graph: multiple inheritance is allowed,
loops are refused (`roles.loop`, with the path), and a role can't include itself or a protected role.

The **protected role** (Administrator) holds every staff permission, also of types registered later, may give every
role everywhere, can't include or be included, can't be deleted, and only its name and description change. Someone
always keeps it for the whole church (`access.lastAdministrator`).

`assignableAt` lists the scope types the role may be given on. Each must be a type where some effective permission
takes effect; a role with administration or portal permissions can only be given for the church.

Default roles (data, editable):

| Role | Includes | Own permissions | Given for | May give |
| --- | --- | --- | --- | --- |
| Administrator (protected) | — | everything | church | every role |
| Session helper | — | session read, take attendance | schedule, session | — |
| Servant | Session helper | service, stage, schedule read; lesson create | service, stage | — |
| Lesson editor | — | lesson read, update, delete, publish; task CRUD | lesson, stage, service | — |
| Service leader | Servant, Lesson editor | stage CRUD; schedule plan, confirm; session create, update, delete, correct attendance; access assign, revoke | service | Servant (service, stage), Lesson editor (lesson), Session helper (schedule, session) |
| Parent | — | portal.parent | church | — |
| Member | — | portal.member | church | — |
| Church office (demo church) | — | service, stage read; accounts; parental links; data requests; access assign, revoke | church | Parent, Member (church) |
| Event coordinator (demo church) | — | event CRUD | event, service, church | — |

**Ownership policy** (board decision: a servant edits only the lessons they write): whoever creates a lesson gets
Lesson editor for it, as an ordinary assignment marked "created it", visible and removable in Access.

## Evaluation

```text
can(account, permission, target)
  chain = target, its authorization parent, …, church        unknown resource or loop → deny
  if the chain holds an archived resource and the action isn't read → deny
  allow if some assignment of the account
        is on a resource in the chain, and
        has a role whose effective permissions hold the permission
```

Rules, all enforced by the evaluator:

1. **Containment.** A grant on X reaches X and every resource below it, never a sibling: Sunday School never reaches
   Youth Gathering.
2. **Type.** A permission acts only on its own type. `lesson.update` given for Sunday School changes its lessons, not
   the service; `service.update` would be needed for that. This is why permissions don't blindly propagate.
3. **Create on the parent.** `T.create` is checked on the would-be parent: a lesson in 3rd Class needs `lesson.create`
   on 3rd Class (or above).
4. **Administration on the church.** Accounts, roles, parental links, data requests and portal entry only count when
   given for the church.
5. **Archived is read-only.**
6. **No deny rules.** Access is the union of grants; restricting is done by giving narrower roles on narrower places.

`explain` is the same walk returning the grants (assignment, role, the included role that holds the permission); the
Access screens show it as "Assigned here" and "Through a broader place: from Sunday School".

## Delegation

Managing access is explicit. Editing a resource never implies giving access to it, and holding a role never implies
giving it to others. To give role R to account A on resource X, the actor:

1. names an existing resource of a scope type (`access.unknownPlace`, 422);
2. isn't A (`access.ownAssignments`, 403);
3. holds `access.assign` through an assignment on X or above it (`access.notHere`, 403);
4. gives a protected role only if they may give every role (`access.protectedRole`, 403);
5. has R in the delegation rules of that assignment's role (`access.notDelegated`, 403);
6. gives R on a type R can be given on (`access.wrongPlace`, 422);
7. on a type the delegation rule allows (`access.notDelegatedHere`, 403);
8. **never gives more than they hold on X**: every permission of R that takes effect on X must be the actor's on X,
   and R may not delegate further than the actor may (`access.exceedsOwn`, 403); portal entry doesn't count;
9. on a resource that isn't archived (`access.archivedPlace`, 409);
10. to an existing account that doesn't have R on X (`access.alreadyAssigned`) or on a place above X
    (`access.alreadyCovered`), 409.

Removing an assignment of R on X needs rules 2, 3 (with `access.revoke`), 4, 5 and 7. Overlapping assignments are
independent: removing one never removes access another one gives.

Rule 8 is why **changing a role can't silently widen delegation**: if an administrator adds a permission to a role
that a Service leader may give, Service leaders stop being able to give it until the leader role holds that permission
too. The role editor warns about it before saving.

**Accounts stay separate.** Delegation picks existing accounts only. Creating an account remains the church office's
and administrators' (`account.create`); there is no registration and no email.

## Relationships that aren't roles

- **Parents.** The Parent role only opens the parent portal. Which children a parent sees comes from parental links
  (Administration › Access › Parental access): `canActForChild(account, person)` = `portal.parent` and an active link.
- **Members.** The Member role opens the member portal; content follows memberships and publication state (published
  lessons, published tasks of the member's groups).

Both are checked by the same authorization layer (backend: voters next to the resource voter), not by a separate
system.

## Administration › Access

| Tab | Who | What |
| --- | --- | --- |
| Resource management | holders of `access.assign` or `access.revoke` | A searchable tree of the church: services, stages, schedules; lessons, sessions, tasks and events grouped and paged. Only places where the viewer manages access, and the places leading there, are listed. The selected place shows its path, who has a role given exactly there (grouped by role, large groups counted until opened), who reaches it from above (grouped by where it was given, changeable only there), what each role allows there, and recent changes. "Assign role": person (existing accounts), role (only those the viewer may give, with why others can't), where (this place or a broader one the viewer controls), review (new permissions, those already held, overlaps), confirm. Removing shows what the person loses and what stays. |
| Roles & permissions | `role.read` (`role.create`/`update`/`delete` to change) | Roles grouped by where they are given, each with what it builds on. A role: its inheritance tree, where it can be given, permissions by resource type (own, or "from Servant"), whom it may give and where, who has it. The editor computes inheritance, loops, valid places and effects on other roles and delegators while editing. |
| Parental access | `guardianship.read` (`create`/`delete` to change) | Parents and the children they follow; link and unlink. |

## Symfony integration (backend 8.1.11)

Symfony's `role_hierarchy` is static configuration of role names; it doesn't give database-managed roles, resource
scopes, resource inheritance or delegation. The backend keeps `ROLE_USER` for authentication only and builds the model
as an application-level `Access` context:

- `ResourceTypeRegistry` + one tagged `ResourceAdapter` per type (`parent()`, `isArchived()`, `children()`, `label()`);
  `ResourceAncestry` resolves the chain (cached per request).
- `RoleGraph` (effective permissions and delegation, loop detection) over `access.role`, `access.role_parent`,
  `access.role_permission`, `access.role_delegation`.
- `AccessEvaluator::can(user, permission, resource)` and `explain()`; `ResourceVoter` exposes it to Symfony Security, so
  controllers use `#[IsGranted('lesson.update', 'lesson')]` and workflows use `AuthorizationCheckerInterface::isGranted()`.
  `isGrantedForUser()` checks another account (previews), `getAccessDecision()` and the voter's `Vote` reasons explain
  refusals. Voters implement `CacheableVoterInterface` (`supportsAttribute`/`supportsType`).
- `DelegationPolicy::canGrant(actor, account, role, resource)` / `canRevoke(actor, assignment)` returning the refusal
  code; `RoleAssignments` commands use it under the existing administration advisory lock.
- `GuardianVoter` (existing, finally used) and a `MemberContentVoter` for the relationship rules.
- No framework upgrade is needed: Symfony 8.2's role-hierarchy wildcards and `debug:roles` only concern static roles.

## Scenarios

| | Scenario | Test (`authorization.test.ts`) | Mockups |
| --- | --- | --- | --- |
| A | The administrator sees the whole church, manages every role; protected access stays protected | A | `access/01` |
| B | Christine (Service leader, Sunday School) gives Daniel Servant for 3rd Class | B and H | `access/08`–`13` |
| C | Daniel works in 1st and 3rd Class only, sees only his lessons; his access shows where it was given | C | `access/19`, `23` |
| D | Maria gets Lesson editor for one lesson; she edits it and no sibling | D | `access/15`–`17` |
| E | Service leader includes Servant and Lesson editor; inherited permissions say where they come from; no loops | E | `access/03`–`05` |
| F | A Sunday School grant reaches its stages, schedules, sessions and lessons, never Youth Gathering | F | `access/19` |
| G | Removing Daniel's Sunday School role keeps his 1st and 3rd Class roles | G | `access/18`, `20` |
| H | Christine can't give Administrator, Service leader, roles outside Sunday School, or at levels her rules don't allow | B and H | `access/10`, `14` |
| I | Events, a type added through the registry, take roles; a runtime-registered type works end to end | I | `access/02` |

## Migration from the current backend

The backend today has a flat catalog (4 actions × 10 resources), roles with a `church | assignedGroups` scope,
account-level `staff_assignment` rows (service or stage) that apply to every `assignedGroups` role of the account, and
anyone with `roles:update` may give any role. The replacement keeps user access valid and never passes through an
insecure state:

1. Create the `access` schema next to the old tables; nothing reads it yet.
2. Copy roles: `administrator` → protected; others keep their ids. Map old permissions to new ones (`services:read` →
   `service.read`, `lessons:update` → `lesson.update` …; `attendance:create` → `session.takeAttendance`,
   `attendance:update` → `session.correctAttendance`, `homework:*` → `task.*`, `users:*` → `account.*`,
   `roles:*` → `role.*`, `parentPortal:read` → `portal.parent`; `members:*` has no counterpart: rosters follow
   `session.read`/`stage.read`, person records follow `account.*`).
3. Copy assignments: a `church` role → one assignment on the church; an `assignedGroups` role × each staff assignment
   of the account → one assignment on that service or stage. Report accounts with an `assignedGroups` role and no group
   (they had nothing and keep nothing).
4. Seed delegation rules equivalent to today's practical rights (administrators: all; Service leader: Servant on
   service and stage), and `access.assign`/`access.revoke` only where it existed (`roles:update`, `stages:update`).
5. Switch `AccessCheck` call sites to the voter workflow by workflow behind a parity test that runs both evaluators on
   every seeded case and fails on any difference that grants more.
6. Switch `/api/me` and the Access endpoints; the frontend follows.
7. Drop `role.scope`, `staff_assignment`, the old voter and the old permission enum in a final migration.

## Open decisions

1. When someone loses their stage role, should their Lesson editor roles there end too? Default: no, assignments are
   independent.
2. Should servants read colleagues' lessons? One permission on Servant (`lesson.read`); default no (board decision).
3. Assignment expiry (e.g. for helpers) is not in the model; it would be a `valid_until` on assignments.

## References

- Symfony: [Security](https://symfony.com/doc/current/security.html), [Voters](https://symfony.com/doc/current/security/voters.html),
  [Role hierarchy wildcards and debugging in 8.2](https://symfony.com/blog/new-in-symfony-8-2-role-hierarchy-wildcards-and-debugging)
- NIST RBAC (hierarchical RBAC, separation of duty): https://csrc.nist.gov/projects/role-based-access-control
- Kubernetes RBAC escalation prevention (no granting what you don't hold): https://kubernetes.io/docs/reference/access-authn-authz/rbac/#privilege-escalation-prevention-and-bootstrapping
- Azure RBAC scopes and inheritance: https://learn.microsoft.com/azure/role-based-access-control/scope-overview
- OpenFGA parent-child relations: https://openfga.dev/docs/modeling/parent-child
