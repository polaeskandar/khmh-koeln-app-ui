import "server-only"

import { notFound } from "next/navigation"

import { fold, initials } from "@/lib/domain/names"
import { OWNERSHIP } from "@/lib/domain/policy"
import {
  appliesAt,
  CHURCH,
  configOf,
  groupPermissions,
  inCatalogOrder,
  isAccessPermission,
  liesUnder,
  type Permission,
  type PermissionGroup,
  permissions,
  refKey,
  type ResourceRef,
  type ResourceType,
  sameRef,
  scopeTypes,
} from "@/lib/domain/resources"
import { includedRoles, permissionOrigins } from "@/lib/domain/roles"
import type { Account, Role, RoleAssignment, Uuid } from "@/lib/domain/types"
import type {
  AccessPerson,
  AccessRow,
  AssignmentChipView,
  AssignmentPreview,
  AssignOptions,
  ExplorerNode,
  ExplorerPage,
  InheritedGroup,
  PermissionState,
  ResourceAccessView,
  ResourceLabel,
  RevocationPreview,
  RoleDetail,
  RoleFormRole,
  RoleGroup,
  RoleLevel,
  RoleOption,
  RoleSummary,
  RoleTreeNode,
} from "@/lib/view-models"
import type { ProblemError } from "@/server/errors"
import {
  can,
  canSeeService,
  canSeeUnit,
  delegationOf,
  effectiveOf,
  heldBy,
  roleOf,
} from "@/server/mock/access"
import { today } from "@/server/mock/clock"
import {
  grantOptions,
  grantProblem,
  managementRoots,
  managesAnywhere,
  revokeProblem,
  rolesAt,
  scopesFor,
} from "@/server/mock/delegation"
import {
  ancestry,
  childTypesOf,
  descendants,
  isArchived,
  resourceDetails,
  resourcesUnder,
} from "@/server/mock/resources"
import { accountOf, personOf, stageOf } from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

import { accountName } from "./present"

const PAGE = 10
const SEARCH_LIMIT = 20

/** The one page where access to a resource is managed. */
export function accessHref(resource: ResourceRef): string {
  return `/admin/access?tab=resources&r=${refKey(resource)}`
}

function translate(ctx: Context, problem: ProblemError): string {
  const t = ctx.t as unknown as (key: string, values?: Record<string, unknown>) => string
  const message = Object.values(problem.problem.fieldErrors ?? {})[0] ?? problem.problem.detail

  return message ? t(message.key, message.values) : t("errors.forbidden")
}

// ---------------------------------------------------------------------------------------------
// Labels

export function labelOf(ctx: Context, ref: ResourceRef): ResourceLabel {
  const { state: s, f, t } = ctx
  const details = resourceDetails(s, ref)
  const date = details?.date ? f.mediumDate(details.date) : null
  const tt = t as unknown as (key: string) => string

  if (ref.type === "church") {
    return { ...ref, name: tt("access.explorer.church"), detail: null }
  }

  if (ref.type === "schedule") {
    return { ...ref, name: tt("access.explorer.schedule"), detail: null }
  }

  if (ref.type === "session") {
    return { ...ref, name: date ?? "", detail: details?.time ?? null }
  }

  return { ...ref, name: details?.name ?? "", detail: date }
}

/** "Sunday School › 3rd Class › Schedule", without the church. */
export function pathText(ctx: Context, ref: ResourceRef): string {
  return (ancestry(ctx.state, ref) ?? [])
    .filter((r) => r.type !== "church")
    .reverse()
    .map((r) => labelOf(ctx, r).name)
    .join(" › ")
}

function scopeText(ctx: Context, ref: ResourceRef): string {
  return ref.type === "church" ? labelOf(ctx, ref).name : pathText(ctx, ref)
}

function personOfAccount(s: State, account: Account): AccessPerson {
  const person = personOf(s, account.personId)

  return {
    id: account.id,
    name: accountName(s, account),
    username: account.username,
    initials: person ? initials(person) : account.username.slice(0, 2).toUpperCase(),
  }
}

// ---------------------------------------------------------------------------------------------
// Who may open what

/** The tabs of Administration › Access the account may open; none means no Access page. */
export function accessTabs(s: State, account: Account) {
  return {
    resources: managesAnywhere(s, account),
    roles: can(s, account, "role.read"),
    guardians: can(s, account, "guardianship.read"),
  }
}

/** Whether Administration › Access appears in the navigation; cheap, checked on every page. */
export function opensAccess(s: State, account: Account): boolean {
  const tabs = accessTabs(s, account)

  return tabs.resources || tabs.roles || tabs.guardians
}

type Visibility = {
  manageable: (ref: ResourceRef) => boolean
  visible: (ref: ResourceRef) => boolean
}

/**
 * Permission-aware visibility: the viewer sees the resources where they manage access and
 * everything below them, plus the places above that lead there (shown, but not opened).
 */
function visibility(s: State, viewer: Account): Visibility {
  const roots = managementRoots(s, viewer)
  const rootKeys = new Set(roots.map(refKey))
  const leading = new Set(roots.flatMap((r) => (ancestry(s, r) ?? []).map(refKey)))
  const memo = new Map<string, boolean>()
  const manageable = (ref: ResourceRef) => {
    const key = refKey(ref)

    if (!memo.has(key)) {
      memo.set(
        key,
        (ancestry(s, ref) ?? []).some((r) => rootKeys.has(refKey(r)))
      )
    }

    return memo.get(key)!
  }

  return { manageable, visible: (ref) => leading.has(refKey(ref)) || manageable(ref) }
}

/** "Sunday School" for a service leader; null for someone who manages the whole church. */
export function managedPlaces(ctx: Context): string | null {
  const roots = managementRoots(ctx.state, ctx.viewer)

  if (roots.length === 0 || roots.some((r) => r.type === "church")) {
    return null
  }

  return ctx.f.list([...new Set(roots.map((r) => scopeText(ctx, r)))])
}

// ---------------------------------------------------------------------------------------------
// The explorer

function visibleUnder(ctx: Context, vis: Visibility, parent: ResourceRef, type: ResourceType) {
  return resourcesUnder(ctx.state, parent, type, today()).filter(vis.visible)
}

function resourceNode(ctx: Context, vis: Visibility, ref: ResourceRef): ExplorerNode {
  const label = labelOf(ctx, ref)

  return {
    key: refKey(ref),
    kind: "resource",
    type: ref.type,
    name: label.name,
    detail: label.detail,
    count: null,
    expandable: childTypesOf(ctx.state, ref, today()).some(
      (t) => visibleUnder(ctx, vis, ref, t).length > 0
    ),
    manageable: vis.manageable(ref),
    direct: ctx.state.assignments.filter((a) => sameRef(a.resource, ref)).length,
  }
}

function groupKey(parent: ResourceRef, type: ResourceType) {
  return `group:${type}:${refKey(parent)}`
}

function parseGroupKey(key: string): { parent: ResourceRef; type: ResourceType } | null {
  const match = /^group:([^:]+):([^:]+):(.+)$/.exec(key)

  return match
    ? { type: match[1] as ResourceType, parent: { type: match[2] as ResourceType, id: match[3] } }
    : null
}

/** The rows directly under a resource or a group: resources, or groups of many resources. */
export function explorerChildren(ctx: Context, key: string, offset = 0): ExplorerPage {
  const vis = visibility(ctx.state, ctx.viewer)
  const group = parseGroupKey(key)

  if (group) {
    if (!vis.visible(group.parent)) {
      return { nodes: [], next: null }
    }

    const all = visibleUnder(ctx, vis, group.parent, group.type)
    const page = all.slice(offset, offset + PAGE)

    return {
      nodes: page.map((r) => resourceNode(ctx, vis, r)),
      next: offset + PAGE < all.length ? offset + PAGE : null,
    }
  }

  const at = key.indexOf(":")
  const parent = { type: key.slice(0, at), id: key.slice(at + 1) } as ResourceRef

  if (!configOf(parent.type) || !vis.visible(parent) || ancestry(ctx.state, parent) === null) {
    return { nodes: [], next: null }
  }

  const tt = ctx.t as unknown as (key: string, values?: Record<string, unknown>) => string
  const nodes = childTypesOf(ctx.state, parent, today()).flatMap((type): ExplorerNode[] => {
    const children = visibleUnder(ctx, vis, parent, type)

    if (children.length === 0) {
      return []
    }

    if (!configOf(type).listed) {
      return children.map((r) => resourceNode(ctx, vis, r))
    }

    return [
      {
        key: groupKey(parent, type),
        kind: "group",
        type,
        name: tt(`access.types.${type}.other`),
        detail: null,
        count: children.length,
        expandable: true,
        manageable: vis.manageable(parent),
        direct: 0,
      },
    ]
  })

  return { nodes, next: null }
}

/**
 * What the explorer shows first: the church, opened along the path to the selected resource (or
 * to where the viewer's management starts), with the pages that contain the selected resource.
 */
export function explorerStart(ctx: Context, selected: ResourceRef | null) {
  const { state: s, viewer } = ctx
  const vis = visibility(s, viewer)
  const roots = managementRoots(s, viewer)
  const focus = selected ?? roots.find((r) => r.type === "church") ?? roots[0] ?? CHURCH
  const chain = (ancestry(s, focus) ?? [CHURCH]).slice().reverse()
  const pages: Record<string, ExplorerPage> = {}
  const expanded: string[] = []

  for (let i = 0; i < chain.length - 1; i++) {
    const parent = chain[i]
    const child = chain[i + 1]
    const key = refKey(parent)
    pages[key] = explorerChildren(ctx, key)
    expanded.push(key)

    if (configOf(child.type).listed) {
      const gKey = groupKey(parent, child.type)
      const all = visibleUnder(ctx, vis, parent, child.type)
      const index = all.findIndex((r) => sameRef(r, child))
      const shown = Math.max(PAGE, Math.ceil((index + 1) / PAGE) * PAGE)
      pages[gKey] = {
        nodes: all.slice(0, shown).map((r) => resourceNode(ctx, vis, r)),
        next: shown < all.length ? shown : null,
      }
      expanded.push(gKey)
    }
  }

  const last = refKey(chain[chain.length - 1])

  if (vis.manageable(chain[chain.length - 1]) || selected === null) {
    pages[last] = explorerChildren(ctx, last)
    expanded.push(last)
  }

  return {
    root: resourceNode(ctx, vis, CHURCH),
    pages,
    expanded,
    focus: refKey(focus),
  }
}

/** Resources the viewer may see whose name or date matches, with where they are. */
export function searchExplorer(ctx: Context, query: string) {
  const { state: s, viewer } = ctx
  const words = fold(query).split(" ").filter(Boolean)

  if (words.length === 0) {
    return []
  }

  const vis = visibility(s, viewer)
  const roots = managementRoots(s, viewer)
  const starts = roots.some((r) => r.type === "church") ? [CHURCH] : roots
  const seen = new Set<string>()
  const results: (ResourceLabel & { key: string; path: string })[] = []

  for (const start of starts) {
    for (const ref of [start, ...descendants(s, start, today())]) {
      const key = refKey(ref)

      if (seen.has(key) || !vis.manageable(ref)) {
        continue
      }

      seen.add(key)
      const label = labelOf(ctx, ref)
      const path = pathText(ctx, ref)
      const haystack = fold(`${label.name} ${label.detail ?? ""} ${path}`)

      if (words.every((w) => haystack.includes(w))) {
        results.push({ ...label, key, path })

        if (results.length >= SEARCH_LIMIT) {
          return results
        }
      }
    }
  }

  return results
}

// ---------------------------------------------------------------------------------------------
// One resource

/** The page of a resource itself, for the types that have one, when the viewer may read it. */
const PAGES: Partial<
  Record<ResourceType, (s: State, viewer: Account, id: string) => string | null>
> = {
  service: (s, viewer, id) => (canSeeService(s, viewer, id) ? `/services/${id}` : null),
  stage: (s, viewer, id) => {
    const stage = stageOf(s, id)

    return stage && canSeeUnit(s, viewer, { serviceId: stage.serviceId, stageId: stage.id })
      ? `/services/${stage.serviceId}/stages/${stage.id}`
      : null
  },
  session: (s, viewer, id) =>
    can(s, viewer, "session.read", { type: "session", id }) ? `/attendance/${id}` : null,
  lesson: (s, viewer, id) =>
    can(s, viewer, "lesson.read", { type: "lesson", id }) ? `/lessons/${id}` : null,
  task: (s, viewer, id) =>
    can(s, viewer, "task.read", { type: "task", id }) ? `/lessons/tasks/${id}` : null,
}

function rowOf(ctx: Context, a: RoleAssignment, here: boolean): AccessRow {
  const { state: s, viewer } = ctx
  const account = accountOf(s, a.accountId)!
  const role = roleOf(s, a.roleId)!
  const problem = here ? revokeProblem(s, viewer, a) : null
  const creator = a.createdBy ? accountOf(s, a.createdBy) : undefined

  return {
    id: a.id,
    person: personOfAccount(s, account),
    role: { id: role.id, name: role.name, protected: role.protected },
    origin: a.origin,
    createdAt: a.createdAt,
    createdBy: creator ? accountName(s, creator) : null,
    revocable: here && problem === null,
    locked: problem ? translate(ctx, problem) : null,
  }
}

const byPerson = (a: AccessRow, b: AccessRow) => a.person.name.localeCompare(b.person.name, "de")

/** Whether holders of the role may give some role on this type of resource or below it. */
function delegatesAtOrBelow(s: State, roleId: Uuid, at: ResourceType): boolean {
  const delegation = delegationOf(s, roleId)

  return (
    delegation === "all" ||
    [...delegation.values()].some((types) => [...types].some((t) => liesUnder(t, at)))
  )
}

/**
 * What a role allows on a resource of this type and below it. Managing access counts only where
 * the role's delegation rules let its holders give something.
 */
function relevantAt(s: State, roleId: Uuid, at: ResourceType): Permission[] {
  return [...effectiveOf(s, roleId)].filter((p) =>
    isAccessPermission(p) ? delegatesAtOrBelow(s, roleId, at) : appliesAt(p, at)
  )
}

function capabilitiesAt(s: State, roleId: Uuid, at: ResourceType) {
  return groupPermissions(relevantAt(s, roleId, at))
}

function assignOptions(ctx: Context, resource: ResourceRef): AssignOptions | null {
  const { state: s, viewer } = ctx
  const grantable = rolesAt(s, viewer, resource)

  if (grantable.length === 0) {
    return null
  }

  return {
    people: s.accounts
      .filter((a) => a.id !== viewer.id)
      .map((a) => personOfAccount(s, a))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
    roles: grantable.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      includes: includedRoles(s.roles, role.id).map((r) => r.name),
      capabilities: capabilitiesAt(s, role.id, resource.type),
      scopes: scopesFor(s, viewer, role, resource).map((r) => ({
        ...labelOf(ctx, r),
        path: scopeText(ctx, r),
      })),
    })),
    unavailable: s.roles
      .filter((r) => !grantable.includes(r))
      .map((role) => ({
        id: role.id,
        name: role.name,
        reason: translate(ctx, grantProblem(s, viewer, null, role, resource)!),
      })),
  }
}

/**
 * Who has access to a resource: roles given on it, and roles given on a place above it that allow
 * something here, grouped by where they come from. Plus what the viewer may give here; the
 * commands check again. Null when the viewer doesn't manage access there.
 */
export function getResourceAccess(ctx: Context, resource: ResourceRef): ResourceAccessView | null {
  const { state: s, viewer } = ctx
  const chain = ancestry(s, resource)

  if (chain === null || !visibility(s, viewer).manageable(resource)) {
    return null
  }

  const vis = visibility(s, viewer)
  const appliesHere = (a: RoleAssignment) => relevantAt(s, a.roleId, resource.type).length > 0
  const directRows = s.assignments
    .filter((a) => sameRef(a.resource, resource) && accountOf(s, a.accountId))
    .map((a) => rowOf(ctx, a, true))
  const direct: RoleGroup[] = [...new Set(directRows.map((r) => r.role.id))]
    .map((roleId) => {
      const role = roleOf(s, roleId)!

      return {
        role: {
          id: role.id,
          name: role.name,
          protected: role.protected,
          description: role.description,
        },
        rows: directRows.filter((r) => r.role.id === roleId).sort(byPerson),
      }
    })
    .sort(
      (a, b) =>
        Number(b.role.protected) - Number(a.role.protected) ||
        a.rows.length - b.rows.length ||
        a.role.name.localeCompare(b.role.name)
    )
  const inherited: InheritedGroup[] = chain
    .slice(1)
    .map((source) => ({
      source: {
        ...labelOf(ctx, source),
        href: vis.manageable(source) ? accessHref(source) : null,
      },
      rows: s.assignments
        .filter((a) => sameRef(a.resource, source) && appliesHere(a) && accountOf(s, a.accountId))
        .map((a) => rowOf(ctx, a, false))
        .sort((a, b) => a.role.name.localeCompare(b.role.name) || byPerson(a, b)),
    }))
    .filter((g) => g.rows.length > 0)
  const roleIds = new Set([
    ...direct.map((g) => g.role.id),
    ...inherited.flatMap((g) => g.rows.map((r) => r.role.id)),
  ])
  const people = new Set([
    ...directRows.map((r) => r.person.id),
    ...inherited.flatMap((g) => g.rows.map((r) => r.person.id)),
  ])

  return {
    resource: { ...labelOf(ctx, resource), archived: isArchived(s, chain) },
    path: chain
      .slice(1)
      .reverse()
      .map((r) => ({ ...labelOf(ctx, r), href: vis.manageable(r) ? accessHref(r) : null })),
    openHref:
      resource.type === "church" ? null : (PAGES[resource.type]?.(s, viewer, resource.id) ?? null),
    people: people.size,
    direct,
    inherited,
    capabilities: Object.fromEntries(
      [...roleIds].map((id) => [id, capabilitiesAt(s, id, resource.type)])
    ),
    history: s.accessEvents
      .filter((e) => sameRef(e.resource, resource))
      .slice(-5)
      .reverse()
      .map((e) => {
        const actor = e.actorId ? accountOf(s, e.actorId) : undefined
        const person = accountOf(s, e.accountId)

        return {
          id: e.id,
          at: e.at,
          kind: e.kind,
          actor: actor ? accountName(s, actor) : null,
          person: person ? accountName(s, person) : "",
          role: e.roleName,
        }
      }),
    assign: assignOptions(ctx, resource),
  }
}

/** What the viewer would give: the new permissions, those already held, and overlaps. */
export function previewAssignment(
  ctx: Context,
  accountId: Uuid,
  roleId: Uuid,
  scope: ResourceRef
): AssignmentPreview {
  const { state: s, viewer } = ctx
  const role = roleOf(s, roleId)
  const account = accountOf(s, accountId)

  if (!role || !account) {
    return {
      ok: false,
      problem: (ctx.t as unknown as (k: string) => string)("errors.notFound.role"),
    }
  }

  const problem = grantProblem(s, viewer, accountId, role, scope)

  if (problem) {
    return { ok: false, problem: translate(ctx, problem) }
  }

  const chain = ancestry(s, scope)!
  const before = new Set<Permission>()
  const overlaps: { role: string; scope: string; relation: "above" | "below" }[] = []

  for (const h of heldBy(s, accountId)) {
    const at = h.assignment.resource
    const above = chain.some((r) => sameRef(r, at))
    const below = !above && (ancestry(s, at) ?? []).some((r) => sameRef(r, scope))

    if (above) {
      effectiveOf(s, h.role.id).forEach((p) => before.add(p))
    }

    const related = above || (below && h.role.id === role.id)

    if (related && [...effectiveOf(s, h.role.id)].some((p) => appliesAt(p, scope.type))) {
      overlaps.push({
        role: h.role.name,
        scope: scopeText(ctx, at),
        relation: above ? "above" : "below",
      })
    }
  }

  const granted = [...effectiveOf(s, role.id)].filter((p) => appliesAt(p, scope.type))
  const delegation = delegationOf(s, role.id)

  return {
    ok: true,
    person: accountName(s, account),
    role: role.name,
    scope: scopeText(ctx, scope),
    gains: groupPermissions(granted.filter((p) => !before.has(p))),
    already: groupPermissions(granted.filter((p) => before.has(p))),
    includes: includedRoles(s.roles, role.id).map((r) => r.name),
    delegation:
      delegation === "all"
        ? []
        : [...delegation].map(([id, at]) => ({ role: roleOf(s, id)?.name ?? "", at: [...at] })),
    overlaps,
  }
}

/** What removing an assignment takes away there, and which other roles keep giving access. */
export function previewRevocation(ctx: Context, assignmentId: Uuid): RevocationPreview {
  const { state: s, viewer } = ctx
  const assignment = s.assignments.find((a) => a.id === assignmentId)
  const tt = ctx.t as unknown as (k: string) => string

  if (!assignment) {
    return { ok: false, problem: tt("errors.notFound.assignment") }
  }

  const problem = revokeProblem(s, viewer, assignment)

  if (problem) {
    return { ok: false, problem: translate(ctx, problem) }
  }

  const scope = assignment.resource
  const chain = ancestry(s, scope) ?? []
  const applies = (p: Permission) => appliesAt(p, scope.type)
  const before = new Set<Permission>()
  const after = new Set<Permission>()
  const keeps: { role: string; scope: string; relation: "above" | "here" | "below" }[] = []

  for (const h of heldBy(s, assignment.accountId)) {
    const at = h.assignment.resource
    const reaches = chain.some((r) => sameRef(r, at))
    const below = !reaches && (ancestry(s, at) ?? []).some((r) => sameRef(r, scope))
    const perms = [...effectiveOf(s, h.role.id)].filter(applies)

    if (reaches) {
      perms.forEach((p) => before.add(p))
    }

    if (h.assignment.id === assignment.id) {
      continue
    }

    if (reaches) {
      perms.forEach((p) => after.add(p))
    }

    if ((reaches || (below && h.role.id === assignment.roleId)) && perms.length > 0) {
      keeps.push({
        role: h.role.name,
        scope: scopeText(ctx, at),
        relation: below ? "below" : sameRef(at, scope) ? "here" : "above",
      })
    }
  }

  return {
    ok: true,
    person: accountName(s, accountOf(s, assignment.accountId)!),
    role: roleOf(s, assignment.roleId)?.name ?? "",
    scope: scopeText(ctx, scope),
    loses: groupPermissions([...before].filter((p) => !after.has(p))),
    keeps,
  }
}

// ---------------------------------------------------------------------------------------------
// Accounts

/** An account's roles and where they apply, for the account page and the accounts list. */
export function assignmentsOf(ctx: Context, accountId: Uuid): AssignmentChipView[] {
  const { state: s, viewer } = ctx
  const vis = visibility(s, viewer)

  return heldBy(s, accountId)
    .map((h) => ({
      id: h.assignment.id,
      role: h.role.name,
      scope: scopeText(ctx, h.assignment.resource),
      href: vis.manageable(h.assignment.resource) ? accessHref(h.assignment.resource) : null,
    }))
    .sort((a, b) => a.role.localeCompare(b.role) || a.scope.localeCompare(b.scope))
}

/** Roles with the resources among `candidates` where the viewer may give them (onboarding). */
export function roleOptions(ctx: Context, candidates: ResourceRef[]): RoleOption[] {
  return grantOptions(ctx.state, ctx.viewer, candidates).map((o) => ({
    role: { id: o.role.id, name: o.role.name },
    resources: o.resources.map((r) => ({ ...labelOf(ctx, r), name: scopeText(ctx, r) })),
  }))
}

// ---------------------------------------------------------------------------------------------
// Roles & permissions

function levelOf(role: Role): RoleLevel {
  if (role.assignableAt.every((t) => t === "church")) {
    return "church"
  }

  return role.assignableAt.some((t) => t === "service" || t === "stage") ? "unit" : "item"
}

function holderCount(s: State, roleId: Uuid) {
  return new Set(s.assignments.filter((a) => a.roleId === roleId).map((a) => a.accountId)).size
}

function summaryOf(s: State, role: Role): RoleSummary {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    protected: role.protected,
    level: levelOf(role),
    includes: role.inherits.flatMap((id) => {
      const r = roleOf(s, id)

      return r ? [{ id: r.id, name: r.name }] : []
    }),
    includedBy: s.roles
      .filter((r) => r.inherits.includes(role.id))
      .map((r) => ({ id: r.id, name: r.name })),
    holders: holderCount(s, role.id),
    permissions: effectiveOf(s, role.id).size,
  }
}

function treeOf(s: State, role: Role, seen = new Set<Uuid>()): RoleTreeNode {
  const repeated = seen.has(role.id)
  seen.add(role.id)

  return {
    id: role.id,
    name: role.name,
    repeated,
    children: repeated
      ? []
      : role.inherits.flatMap((id) => {
          const r = roleOf(s, id)

          return r ? [treeOf(s, r, seen)] : []
        }),
  }
}

function deleteBlocked(ctx: Context, role: Role): string | null {
  const { state: s } = ctx
  const tt = ctx.t as unknown as (key: string, values?: Record<string, unknown>) => string

  if (role.protected || Object.values(OWNERSHIP).includes(role.id)) {
    return tt("errors.roles.protected", { role: role.name })
  }

  if (s.assignments.some((a) => a.roleId === role.id)) {
    return tt("errors.roles.inUse")
  }

  const including = s.roles.filter((r) => r.inherits.includes(role.id))

  return including.length > 0
    ? tt("errors.roles.included", { roles: including.map((r) => r.name).join(", ") })
    : null
}

export function getRoles(ctx: Context, selectedId: string | undefined) {
  const { state: s, viewer } = ctx

  if (!can(s, viewer, "role.read")) {
    notFound()
  }

  const roles = s.roles.map((r) => summaryOf(s, r))
  const selected = s.roles.find((r) => r.id === selectedId) ?? s.roles[0]

  return {
    roles,
    canCreate: can(s, viewer, "role.create"),
    selected: selected ? roleDetail(ctx, selected) : null,
  }
}

export function roleDetail(ctx: Context, role: Role): RoleDetail {
  const { state: s, viewer } = ctx
  const origins = permissionOrigins(s.roles, role.id)
  const name = (id: Uuid) => roleOf(s, id)?.name ?? ""
  const groups = new Map<PermissionGroup, PermissionState[]>()

  for (const p of permissions()) {
    const group = groupPermissions([p])[0].group
    const from = (origins.get(p) ?? []).filter((id) => id !== role.id)
    const state: PermissionState["state"] = (origins.get(p) ?? []).includes(role.id)
      ? "direct"
      : from.length > 0
        ? "inherited"
        : "none"
    groups.set(group, [
      ...(groups.get(group) ?? []),
      { action: p.slice(p.indexOf(".") + 1), state, from: from.map(name) },
    ])
  }

  const delegation = delegationOf(s, role.id)
  const vis = visibility(s, viewer)
  const holders = s.assignments.filter((a) => a.roleId === role.id && accountOf(s, a.accountId))

  return {
    ...summaryOf(s, role),
    assignableAt: role.assignableAt,
    tree: treeOf(s, role),
    permissionGroups: [...groups].map(([group, actions]) => ({ group, actions })),
    delegation:
      delegation === "all"
        ? "all"
        : [...delegation].map(([id, at]) => {
            const own = role.delegation.some((d) => d.roleId === id)
            const from = own
              ? null
              : includedRoles(s.roles, role.id).find((r) =>
                  r.delegation.some((d) => d.roleId === id)
                )

            return { role: name(id), at: [...at], from: from ? from.name : null }
          }),
    holderRows: holders.slice(0, 12).map((a) => ({
      id: a.id,
      person: personOfAccount(s, accountOf(s, a.accountId)!),
      scope: scopeText(ctx, a.resource),
      href: vis.manageable(a.resource) ? accessHref(a.resource) : null,
    })),
    ownership: (Object.keys(OWNERSHIP) as ResourceType[]).filter((t) => OWNERSHIP[t] === role.id),
    canEdit: can(s, viewer, "role.update"),
    canDelete: can(s, viewer, "role.delete"),
    deleteBlocked: deleteBlocked(ctx, role),
    updatedAt: role.updatedAt,
  }
}

/** The role editor: the role, every other role (to compute inheritance live) and their holders. */
export function getRoleForm(ctx: Context, roleId: Uuid | null) {
  const { state: s, viewer } = ctx

  if (!can(s, viewer, roleId ? "role.update" : "role.create")) {
    notFound()
  }

  const role = roleId ? roleOf(s, roleId) : null

  if (roleId && !role) {
    notFound()
  }

  const formRole = (r: Role): RoleFormRole => ({
    id: r.id,
    name: r.name,
    description: r.description,
    inherits: r.inherits,
    permissions: inCatalogOrder(r.permissions),
    assignableAt: r.assignableAt,
    delegation: r.delegation,
    protected: r.protected,
  })

  return {
    role: role ? formRole(role) : null,
    roles: s.roles.map(formRole),
    holders: Object.fromEntries(s.roles.map((r) => [r.id, holderCount(s, r.id)])),
    scopeTypes: scopeTypes(),
    ownership: role
      ? (Object.keys(OWNERSHIP) as ResourceType[]).filter((t) => OWNERSHIP[t] === role.id)
      : [],
  }
}
