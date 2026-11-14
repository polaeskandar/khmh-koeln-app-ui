import "server-only"

import { notFound } from "next/navigation"

import { initials } from "@/lib/domain/names"
import {
  actionsFor,
  CHURCH,
  isGrouped,
  type ResourceRef,
  type ResourceType,
  refKey,
  sameRef,
  typesWithin,
} from "@/lib/domain/resources"
import type { Account, Uuid } from "@/lib/domain/types"
import type {
  AccessLine,
  AccessPerson,
  AccessSummary,
  AccessView,
  MemberAccess,
  ResourceLabel,
  TreeNode,
  TreePage,
} from "@/lib/view-models"
import {
  can,
  canSeeService,
  canSeeUnit,
  holds,
  isAdministrator,
  managedResources,
  managesAccess,
} from "@/server/mock/access"
import { today } from "@/server/mock/clock"
import {
  ancestry,
  childTypesOf,
  isArchived,
  resourceDetails,
  resourcesUnder,
} from "@/server/mock/resources"
import { accountOf, personOf, stageOf } from "@/server/mock/selectors"
import type { State } from "@/server/mock/state"
import type { Context } from "@/server/viewer"

import { accountName } from "./present"

const PAGE = 10

type Lookup = (key: string, values?: Record<string, unknown>) => string

/** The Access page for a resource, or a group of one type within it. */
export function accessHref(resource: ResourceRef, type: ResourceType | null = null): string {
  return `/admin/access?r=${refKey(resource)}${type ? `&type=${type}` : ""}`
}

export function labelOf(ctx: Context, ref: ResourceRef): ResourceLabel {
  const details = resourceDetails(ctx.state, ref)
  const date = details?.date ? ctx.f.mediumDate(details.date) : null

  if (ref.type === "church") {
    return { ...ref, name: (ctx.t as unknown as Lookup)("access.church"), detail: null }
  }

  if (ref.type === "session") {
    return { ...ref, name: date ?? "", detail: details?.time ?? null }
  }

  return { ...ref, name: details?.name ?? "", detail: date }
}

/** "Sunday School › 3rd Class", without the church. */
export function pathText(ctx: Context, ref: ResourceRef): string {
  if (ref.type === "church") {
    return labelOf(ctx, ref).name
  }

  return (ancestry(ctx.state, ref) ?? [])
    .filter((r) => r.type !== "church")
    .reverse()
    .map((r) => labelOf(ctx, r).name)
    .join(" › ")
}

function person(s: State, account: Account): AccessPerson {
  const p = personOf(s, account.personId)

  return {
    id: account.id,
    name: accountName(s, account),
    username: account.username,
    initials: p ? initials(p) : account.username.slice(0, 2).toUpperCase(),
  }
}

/** Administration › Access appears for administrators and for members who manage access somewhere. */
export function opensAccess(s: State, account: Account): boolean {
  return managedResources(s, account).length > 0
}

/**
 * The viewer sees the resources where they manage access and everything below them, plus the
 * resources above that lead there (shown, but not opened).
 */
function visibility(s: State, viewer: Account) {
  const roots = managedResources(s, viewer).map(refKey)
  const leading = new Set(
    managedResources(s, viewer).flatMap((r) => (ancestry(s, r) ?? []).map(refKey))
  )

  return {
    manageable: (ref: ResourceRef) => managesAccess(s, viewer, ref),
    visible: (ref: ResourceRef) =>
      leading.has(refKey(ref)) || (roots.length > 0 && managesAccess(s, viewer, ref)),
  }
}

type Visibility = ReturnType<typeof visibility>

function visibleUnder(ctx: Context, vis: Visibility, parent: ResourceRef, type: ResourceType) {
  return resourcesUnder(ctx.state, parent, type, today()).filter(vis.visible)
}

function resourceNode(ctx: Context, vis: Visibility, ref: ResourceRef): TreeNode {
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
    href: accessHref(ref),
  }
}

function groupKey(parent: ResourceRef, type: ResourceType) {
  return `group:${type}:${refKey(parent)}`
}

function parseKey(key: string): { parent: ResourceRef; type: ResourceType | null } {
  const group = /^group:([^:]+):([^:]+):(.+)$/.exec(key)

  if (group) {
    return {
      type: group[1] as ResourceType,
      parent: { type: group[2] as ResourceType, id: group[3] },
    }
  }

  const at = key.indexOf(":")

  return { type: null, parent: { type: key.slice(0, at) as ResourceType, id: key.slice(at + 1) } }
}

/** The rows under a resource (its resources, and a group for each many-of type), or a group's page. */
export function treeChildren(ctx: Context, key: string, offset = 0): TreePage {
  const vis = visibility(ctx.state, ctx.viewer)
  const { parent, type } = parseKey(key)

  if (ancestry(ctx.state, parent) === null || !vis.visible(parent)) {
    return { nodes: [], next: null }
  }

  if (type) {
    const all = visibleUnder(ctx, vis, parent, type)

    return {
      nodes: all.slice(offset, offset + PAGE).map((r) => resourceNode(ctx, vis, r)),
      next: offset + PAGE < all.length ? offset + PAGE : null,
    }
  }

  const tt = ctx.t as unknown as Lookup
  const nodes = childTypesOf(ctx.state, parent, today()).flatMap((t): TreeNode[] => {
    const children = visibleUnder(ctx, vis, parent, t)

    if (children.length === 0) {
      return []
    }

    if (!isGrouped(t)) {
      return children.map((r) => resourceNode(ctx, vis, r))
    }

    return [
      {
        key: groupKey(parent, t),
        kind: "group",
        type: t,
        name: tt(`access.types.${t}.other`),
        detail: null,
        count: children.length,
        expandable: true,
        manageable: vis.manageable(parent),
        href: accessHref(parent, t),
      },
    ]
  })

  return { nodes, next: null }
}

/** The tree opened along the path to the selected resource or group. */
export function treeStart(ctx: Context, selected: ResourceRef | null, type: ResourceType | null) {
  const { state: s, viewer } = ctx
  const vis = visibility(s, viewer)
  const focus = selected ?? managedResources(s, viewer)[0] ?? CHURCH
  const chain = (ancestry(s, focus) ?? [CHURCH]).slice().reverse()
  const pages: Record<string, TreePage> = {}
  const expanded: string[] = []
  const open = (key: string, page: TreePage) => {
    pages[key] = page
    expanded.push(key)
  }

  chain.forEach((ref, i) => {
    open(refKey(ref), treeChildren(ctx, refKey(ref)))
    const child = chain[i + 1] ?? null
    const groupType =
      child && isGrouped(child.type) ? child.type : i === chain.length - 1 ? type : null

    if (groupType) {
      const all = visibleUnder(ctx, vis, ref, groupType)
      const index = child ? all.findIndex((r) => sameRef(r, child)) : 0
      const shown = Math.max(PAGE, Math.ceil((index + 1) / PAGE) * PAGE)
      open(groupKey(ref, groupType), {
        nodes: all.slice(0, shown).map((r) => resourceNode(ctx, vis, r)),
        next: shown < all.length ? shown : null,
      })
    }
  })

  return {
    root: resourceNode(ctx, vis, CHURCH),
    pages,
    expanded,
    selected: type ? groupKey(focus, type) : refKey(focus),
    focus,
  }
}

/** The page of a resource itself, for the types that have one, when the viewer may read it. */
function openHref(s: State, viewer: Account, ref: ResourceRef): string | null {
  switch (ref.type) {
    case "service":
      return canSeeService(s, viewer, ref.id) ? `/services/${ref.id}` : null
    case "stage": {
      const stage = stageOf(s, ref.id)

      return stage && canSeeUnit(s, viewer, { serviceId: stage.serviceId, stageId: stage.id })
        ? `/services/${stage.serviceId}/stages/${stage.id}`
        : null
    }
    case "session":
      return can(s, viewer, "session.read", ref) ? `/attendance/${ref.id}` : null
    case "lesson":
      return can(s, viewer, "lesson.read", ref) ? `/lessons/${ref.id}` : null
    case "task":
      return can(s, viewer, "task.read", ref) ? `/lessons/tasks/${ref.id}` : null
    default:
      return null
  }
}

/**
 * Who has access to a resource (or to one type within it), with what, and whether it was given
 * there or on a resource above. Null when the viewer doesn't manage access there.
 */
export function getAccessView(
  ctx: Context,
  resource: ResourceRef,
  type: ResourceType | null
): AccessView | null {
  const { state: s, viewer } = ctx
  const chain = ancestry(s, resource)

  if (chain === null || !managesAccess(s, viewer, resource)) {
    return null
  }

  if (type !== null && !typesWithin(resource.type).includes(type)) {
    return null
  }

  const relevant = (t: ResourceType) =>
    type === null ? typesWithin(resource.type).includes(t) : t === type
  const source = (ref: ResourceRef) =>
    sameRef(ref, resource)
      ? null
      : { ...labelOf(ctx, ref), href: managesAccess(s, viewer, ref) ? accessHref(ref) : null }
  const lines = new Map<Uuid, AccessLine[]>()
  const add = (accountId: Uuid, line: AccessLine) =>
    lines.set(accountId, [...(lines.get(accountId) ?? []), line])
  const order = (ref: ResourceRef) => chain.findIndex((r) => sameRef(r, ref))

  for (const m of s.managers.filter((x) => order(x.resource) >= 0)) {
    add(m.accountId, {
      id: m.id,
      kind: "manager",
      type: null,
      actions: [],
      from: source(m.resource),
      editable:
        sameRef(m.resource, resource) && isAdministrator(s, viewer) && m.accountId !== viewer.id,
    })
  }

  for (const g of s.grants.filter((x) => order(x.resource) >= 0 && relevant(x.type))) {
    add(g.accountId, {
      id: g.id,
      kind: "grant",
      type: g.type,
      actions: g.actions,
      from: source(g.resource),
      editable: sameRef(g.resource, resource) && g.accountId !== viewer.id,
    })
  }

  const members: MemberAccess[] = [...lines]
    .flatMap(([accountId, list]) => {
      const account = accountOf(s, accountId)

      return account
        ? [
            {
              person: person(s, account),
              administrator: isAdministrator(s, account),
              lines: list.sort(
                (a, b) =>
                  Number(a.from !== null) - Number(b.from !== null) ||
                  Number(a.kind !== "manager") - Number(b.kind !== "manager")
              ),
            },
          ]
        : []
    })
    .sort(
      (a, b) =>
        Number(a.lines.every((l) => l.from !== null)) -
          Number(b.lines.every((l) => l.from !== null)) ||
        a.person.name.localeCompare(b.person.name, "de")
    )
  const admin = isAdministrator(s, viewer)

  return {
    resource: { ...labelOf(ctx, resource), archived: isArchived(s, chain) },
    type,
    path: chain
      .slice(1)
      .reverse()
      .map((r) => ({
        ...labelOf(ctx, r),
        href: managesAccess(s, viewer, r) ? accessHref(r) : null,
      })),
    openHref: openHref(s, viewer, resource),
    members,
    canManage: true,
    canChooseManagers: admin && type === null,
    options: typesWithin(resource.type)
      .filter(relevant)
      .map((t) => ({
        type: t,
        actions: actionsFor(resource.type, t).map((action) => ({
          action,
          allowed: admin || holds(s, viewer, t, action, resource),
        })),
      }))
      .filter((o) => o.actions.length > 0),
    people: s.accounts
      .filter((a) => a.id !== viewer.id)
      .map((a) => person(s, a))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
  }
}

/** The places where the viewer manages access, for the hint under the tree; null for administrators. */
export function managedPlaces(ctx: Context): string | null {
  const { state: s, viewer } = ctx

  if (isAdministrator(s, viewer)) {
    return null
  }

  return ctx.f.list(managedResources(s, viewer).map((r) => pathText(ctx, r)))
}

/** An account's permissions as sentences, for the account page and the accounts list. */
export function accessSummary(ctx: Context, accountId: Uuid): AccessSummary {
  const { state: s, viewer } = ctx
  const account = accountOf(s, accountId)
  const tt = ctx.t as unknown as Lookup
  const link = (ref: ResourceRef) => (managesAccess(s, viewer, ref) ? accessHref(ref) : null)

  if (!account) {
    notFound()
  }

  return {
    administrator: isAdministrator(s, account),
    lines: [
      ...s.managers
        .filter((m) => m.accountId === accountId && m.resource.type !== "church")
        .map((m) => ({
          id: m.id,
          text: tt("access.summary.manages", { place: pathText(ctx, m.resource) }),
          href: link(m.resource),
        })),
      ...s.grants
        .filter((g) => g.accountId === accountId)
        .map((g) => ({
          id: g.id,
          text: tt("access.summary.grant", {
            place: pathText(ctx, g.resource),
            type: tt(`access.types.${g.type}.${g.type === g.resource.type ? "one" : "other"}`),
            actions: ctx.f.list(g.actions.map((a) => tt(`access.actions.${a}`))),
          }),
          href: link(g.resource),
        })),
    ],
  }
}
