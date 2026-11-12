import { msg } from "@/i18n/message"
import type { Uuid } from "@/lib/domain/types"
import { ruleViolation } from "@/server/errors"

import { authorize, can } from "../access"
import { now, nowMs } from "../clock"
import { found } from "../guard"
import { uuidv7 } from "../ids"
import { accountOf, personOf } from "../selectors"
import type { State } from "../state"

import type { Actor } from "./accounts"

export function linkChild({ state: s, viewer }: Actor, accountId: Uuid, memberId: Uuid) {
  authorize(s, viewer, "guardians.manage")
  const parent = found(accountOf(s, accountId), "account")
  const member = found(personOf(s, memberId), "person")
  const memberAccount = s.accounts.find((a) => a.personId === member.id)

  if (!can(s, parent, "portal.parent")) {
    throw ruleViolation(msg("errors.guardians.notParent"))
  }

  if (member.id === parent.personId) {
    throw ruleViolation(msg("errors.guardians.self"))
  }

  if (!memberAccount || !can(s, memberAccount, "portal.member")) {
    throw ruleViolation(msg("errors.guardians.notMember"))
  }

  if (s.guardianships.some((g) => g.accountId === parent.id && g.childId === member.id)) {
    throw ruleViolation(msg("errors.guardians.alreadyLinked"))
  }

  s.guardianships.push({
    id: uuidv7(nowMs()),
    accountId: parent.id,
    childId: member.id,
    createdAt: now(),
    createdBy: viewer.id,
  })
}

export function unlinkChild({ state: s, viewer }: Actor, guardianshipId: Uuid) {
  authorize(s, viewer, "guardians.manage")
  const link = found(
    s.guardianships.find((g) => g.id === guardianshipId),
    "guardianship"
  )
  s.guardianships.splice(s.guardianships.indexOf(link), 1)
}

export function isGuardian(s: State, accountId: Uuid, personId: Uuid): boolean {
  return s.guardianships.some((g) => g.accountId === accountId && g.childId === personId)
}
