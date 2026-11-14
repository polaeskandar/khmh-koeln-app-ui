import { msg } from "@/i18n/message"
import type { Uuid } from "@/lib/domain/types"
import { forbidden, ruleViolation } from "@/server/errors"

import { isAdministrator } from "../access"
import { now, nowMs } from "../clock"
import { found } from "../guard"
import { uuidv7 } from "../ids"
import { accountOf, personOf } from "../selectors"
import type { State } from "../state"

import type { Actor } from "./accounts"

/** Parental links are managed by administrators, like accounts. */
function administrator(s: State, viewer: Actor["viewer"]) {
  if (!isAdministrator(s, viewer)) {
    throw forbidden()
  }
}

export function linkChild({ state: s, viewer }: Actor, accountId: Uuid, memberId: Uuid) {
  administrator(s, viewer)
  const parent = found(accountOf(s, accountId), "account")
  const member = found(personOf(s, memberId), "person")

  if (member.id === parent.personId) {
    throw ruleViolation(msg("errors.guardians.self"))
  }

  if (!s.accounts.some((a) => a.personId === member.id)) {
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
  administrator(s, viewer)
  const link = found(
    s.guardianships.find((g) => g.id === guardianshipId),
    "guardianship"
  )
  s.guardianships.splice(s.guardianships.indexOf(link), 1)
}
