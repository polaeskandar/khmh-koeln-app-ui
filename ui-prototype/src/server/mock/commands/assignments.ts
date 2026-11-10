import "server-only"

import { msg } from "@/i18n/message"
import { toInstant } from "@/lib/domain/time"
import type { Group, StaffAssignment, User, Uuid } from "@/lib/domain/types"
import { forbidden, invalid, ruleViolation } from "@/server/errors"

import { nowMs } from "../clock"
import { found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import { assignmentsOf, canEverywhere, roleAllows } from "../reach"
import { serviceOf, stageOf, userOf } from "../selectors"
import type { State } from "../state"
import { checkPlacement } from "./people"

/**
 * Assignments: where a staff account serves (polaeskandar/khmh-koeln-app-backend#318). A service
 * assignment covers the service's own roster and all its stages; a stage assignment that stage.
 * Roles for assigned groups hold only there.
 *
 * An administrator (a church-wide role with "Users: Change") assigns anyone anywhere. A service
 * leader (a role for assigned groups with "Stages: Change", and an assignment to the whole
 * service) assigns within that service and its stages. Everyone else gets
 * `assignments.notAllowed`.
 */

export type AssignmentInput = { serviceId: Uuid | null; stageId: Uuid | null }

/** May the account assign people to this group, or take them out of it? */
export function mayAssign(s: State, actor: User, group: Group): boolean {
  if (canEverywhere(s, actor, "update", "users")) return true
  return (
    roleAllows(s, actor, "update", "stages", "assignedGroups") &&
    assignmentsOf(s, actor.id).some((a) => a.serviceId === group.serviceId && a.stageId === null)
  )
}

/** "Sunday School · 3rd Class", or "Sunday School" for the whole service. */
export function groupName(s: State, group: Group): string {
  const service = serviceOf(s, group.serviceId)?.name ?? ""
  const stage = stageOf(s, group.stageId)
  return stage ? `${service} · ${stage.name}` : service
}

/** Who and where, for messages: "Daniel Michael" and "Sunday School · 3rd Class". */
export function assignmentNames(s: State, assignment: StaffAssignment) {
  return {
    name: userOf(s, assignment.userId)?.displayName ?? "",
    where: groupName(s, assignment),
  }
}

/** Checks the groups of a request (422), and that the actor may assign to each of them (403). */
export function checkedGroups(s: State, actor: User, inputs: AssignmentInput[]): Group[] {
  const v = new Violations()
  const groups: Group[] = []
  for (const input of inputs) {
    if (!input.serviceId) {
      v.add("serviceId", msg("errors.meetings.chooseService"))
      continue
    }
    checkPlacement(s, v, input.serviceId, input.stageId)
    groups.push({ serviceId: input.serviceId, stageId: input.stageId })
  }
  v.throwIfAny()
  if (groups.some((g) => !mayAssign(s, actor, g))) {
    throw forbidden(msg("errors.assignments.notAllowed"))
  }
  return groups
}

function addAssignment(s: State, user: User, group: Group, ms: number): StaffAssignment {
  const taken = assignmentsOf(s, user.id).some(
    (a) => a.serviceId === group.serviceId && a.stageId === group.stageId
  )
  if (taken) {
    throw ruleViolation(
      msg("errors.assignments.alreadyAssigned", {
        name: user.displayName,
        where: groupName(s, group),
      })
    )
  }
  const assignment: StaffAssignment = {
    id: uuidv7(ms),
    userId: user.id,
    serviceId: group.serviceId,
    stageId: group.stageId,
    createdAt: toInstant(ms),
  }
  s.assignments.push(assignment)
  return assignment
}

/** Adds the groups an approval names. The caller has checked them with `checkedGroups`. */
export function addAssignments(s: State, user: User, groups: Group[], ms: number) {
  const unique = groups.filter(
    (g, i) => groups.findIndex((x) => x.serviceId === g.serviceId && x.stageId === g.stageId) === i
  )
  return unique.map((g) => addAssignment(s, user, g, ms))
}

/** Assigns an approved account to a service or a stage. */
export function assignGroup(
  s: State,
  actor: User,
  userId: Uuid,
  input: AssignmentInput
): StaffAssignment {
  const user = found(userOf(s, userId), "user")
  if (!user.approvedAt) throw ruleViolation(msg("errors.accounts.notApproved"))
  const [group] = checkedGroups(s, actor, [input])
  if (!group) throw invalid({ serviceId: msg("errors.meetings.chooseService") })
  return addAssignment(s, user, group, nowMs())
}

/** Takes an account out of a group; its roles for assigned groups no longer hold there. */
export function removeAssignment(s: State, actor: User, assignmentId: Uuid): StaffAssignment {
  const assignment = found(
    s.assignments.find((a) => a.id === assignmentId),
    "assignment"
  )
  if (!mayAssign(s, actor, assignment)) throw forbidden(msg("errors.assignments.notAllowed"))
  s.assignments = s.assignments.filter((a) => a.id !== assignment.id)
  return assignment
}
