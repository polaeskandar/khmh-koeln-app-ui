import { msg } from "@/i18n/message"
import {
  type Action,
  ACTIONS,
  actionsFor,
  type ResourceRef,
  type ResourceType,
  sameRef,
} from "@/lib/domain/resources"
import type { Account, Grant, Uuid } from "@/lib/domain/types"
import { forbidden, invalid, notFound, ProblemError, ruleViolation } from "@/server/errors"

import { holds, isAdministrator, managesAccess } from "../access"
import { now, nowMs } from "../clock"
import { found } from "../guard"
import { uuidv7 } from "../ids"
import { ancestry, exists, isArchived } from "../resources"
import { accountOf } from "../selectors"
import type { State } from "../state"

import type { Actor } from "./accounts"

/**
 * Giving and removing access. Whoever manages access within a resource (an administrator, or a
 * member an administrator chose for that resource) may give other members permissions there and
 * below it — only actions they have there themselves — and remove them. Only administrators
 * choose who manages access. Nobody changes their own access.
 */

export type GrantInput = {
  accountId: Uuid
  resource: ResourceRef
  type: ResourceType
  actions: Action[]
}

const existing = (s: State, input: Pick<GrantInput, "accountId" | "resource" | "type">) =>
  s.grants.find(
    (g) =>
      g.accountId === input.accountId &&
      g.type === input.type &&
      sameRef(g.resource, input.resource)
  )

/** Why the actor may not give these permissions; null when they may. `accountId` null: anyone. */
export function grantProblem(
  s: State,
  actor: Account,
  input: Omit<GrantInput, "accountId"> & { accountId: Uuid | null }
): ProblemError | null {
  const chain = ancestry(s, input.resource)

  if (chain === null) {
    return invalid({ resource: msg("errors.access.unknownPlace") })
  }

  if (input.accountId === actor.id) {
    return forbidden(msg("errors.access.ownAccess"))
  }

  if (!managesAccess(s, actor, input.resource)) {
    return forbidden(msg("errors.access.notHere"))
  }

  const possible = actionsFor(input.resource.type, input.type)

  if (input.actions.length === 0 || input.actions.some((a) => !possible.includes(a))) {
    return invalid({ actions: msg("errors.access.chooseActions") })
  }

  if (isArchived(s, chain)) {
    return ruleViolation(msg("errors.access.archivedPlace"))
  }

  const before = input.accountId ? (existing(s, input as GrantInput)?.actions ?? []) : []
  const added = input.actions.filter((a) => !before.includes(a))

  if (added.some((a) => !holds(s, actor, input.type, a, input.resource))) {
    return forbidden(msg("errors.access.beyondOwn"))
  }

  if (input.accountId !== null && !accountOf(s, input.accountId)) {
    return notFound("account")
  }

  return null
}

/** Gives a member permissions for one type at one resource, or changes the ones given there. */
export function saveGrant({ state: s, viewer }: Actor, input: GrantInput): Grant {
  const problem = grantProblem(s, viewer, input)

  if (problem) {
    throw problem
  }

  const actions = ACTIONS.filter((a) => input.actions.includes(a))
  const grant = existing(s, input)

  if (grant) {
    grant.actions = actions

    return grant
  }

  const created: Grant = {
    id: uuidv7(nowMs()),
    accountId: input.accountId,
    resource: input.resource,
    type: input.type,
    actions,
    createdAt: now(),
    createdBy: viewer.id,
  }
  s.grants.push(created)

  return created
}

/** Why the actor may not remove this permission; null when they may. */
export function revokeProblem(s: State, actor: Account, grant: Grant): ProblemError | null {
  if (grant.accountId === actor.id) {
    return forbidden(msg("errors.access.ownAccess"))
  }

  if (!managesAccess(s, actor, grant.resource)) {
    return forbidden(msg("errors.access.notHere"))
  }

  return null
}

export function revokeGrant({ state: s, viewer }: Actor, grantId: Uuid): void {
  const grant = found(
    s.grants.find((g) => g.id === grantId),
    "grant"
  )
  const problem = revokeProblem(s, viewer, grant)

  if (problem) {
    throw problem
  }

  s.grants.splice(s.grants.indexOf(grant), 1)
}

/** Only administrators choose who manages access; managing the whole church is administering. */
export function addManager(
  { state: s, viewer }: Actor,
  accountId: Uuid,
  resource: ResourceRef
): void {
  if (!isAdministrator(s, viewer)) {
    throw forbidden(msg("errors.access.administratorsOnly"))
  }

  if (accountId === viewer.id) {
    throw forbidden(msg("errors.access.ownAccess"))
  }

  if (!exists(s, resource)) {
    throw invalid({ resource: msg("errors.access.unknownPlace") })
  }

  found(accountOf(s, accountId), "account")

  if (s.managers.some((m) => m.accountId === accountId && sameRef(m.resource, resource))) {
    throw ruleViolation(msg("errors.access.alreadyManages"))
  }

  s.managers.push({
    id: uuidv7(nowMs()),
    accountId,
    resource,
    createdAt: now(),
    createdBy: viewer.id,
  })
}

/** Someone always administers the church. */
export function ensureAdministratorRemains(
  s: State,
  change: { removedManagerId?: Uuid; removedAccountId?: Uuid }
): void {
  const remains = s.managers.some(
    (m) =>
      m.id !== change.removedManagerId &&
      m.accountId !== change.removedAccountId &&
      m.resource.type === "church" &&
      accountOf(s, m.accountId) !== undefined
  )

  if (!remains) {
    throw ruleViolation(msg("errors.access.lastAdministrator"))
  }
}

export function removeManager({ state: s, viewer }: Actor, managerId: Uuid): void {
  const manager = found(
    s.managers.find((m) => m.id === managerId),
    "grant"
  )

  if (!isAdministrator(s, viewer)) {
    throw forbidden(msg("errors.access.administratorsOnly"))
  }

  if (manager.accountId === viewer.id) {
    throw forbidden(msg("errors.access.ownAccess"))
  }

  ensureAdministratorRemains(s, { removedManagerId: manager.id })
  s.managers.splice(s.managers.indexOf(manager), 1)
}

/** Deleted resources take their permissions with them; call after deleting anything. */
export function removeOrphanedAccess(s: State): void {
  s.grants = s.grants.filter((g) => exists(s, g.resource))
  s.managers = s.managers.filter((m) => exists(s, m.resource))
}
