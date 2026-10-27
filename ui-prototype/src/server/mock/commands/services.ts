import "server-only"

import { nameKey } from "@/lib/domain/names"
import { toInstant } from "@/lib/domain/time"
import type { Service, Stage, User, Uuid } from "@/lib/domain/types"
import { msg } from "@/i18n/message"
import { ruleViolation } from "@/server/errors"

import { nowMs } from "../clock"
import { authorize, found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import { isArchived, serviceOf, stageOf, stagesOf } from "../selectors"
import type { State } from "../state"

export type ServiceInput = { name: string; description?: string | null }
export type StageInput = { name: string; description?: string | null }

// ---------------------------------------------------------------- services

function checkServiceName(s: State, v: Violations, name: string, exceptId?: Uuid) {
  const clash = s.services.find((x) => x.id !== exceptId && nameKey(x.name) === nameKey(name))
  if (!clash) return
  v.add(
    "name",
    isArchived(clash)
      ? msg("errors.services.nameTakenArchived", { name: clash.name })
      : msg("errors.services.nameTaken", { name: clash.name })
  )
}

/** The colour slot fewest services use, so a new service stands out; the lowest slot wins a tie. */
function freeTone(s: State): number {
  const used = Array.from({ length: 8 }, () => 0)
  for (const x of s.services) {
    const tone = s.serviceTones[x.id]
    if (tone) used[tone - 1] += 1
  }
  return used.indexOf(Math.min(...used)) + 1
}

export function createService(s: State, actor: User, input: ServiceInput): Service {
  authorize(actor, "CREATE_SERVICE", null, msg("errors.services.adminOnlyCreate"))
  const v = new Violations()
  const name = v.name("name", input.name, 120, msg("errors.services.nameRequired"))
  const description = v.optionalText("description", input.description, 2000)
  if (!v.has("name")) checkServiceName(s, v, name)
  v.throwIfAny()
  const ms = nowMs()
  const service: Service = {
    id: uuidv7(ms),
    name,
    description,
    archivedAt: null,
    createdAt: toInstant(ms),
    updatedAt: toInstant(ms),
  }
  s.serviceTones[service.id] = freeTone(s)
  s.services.push(service)
  return service
}

export function updateService(s: State, actor: User, id: Uuid, input: ServiceInput): Service {
  const service = found(serviceOf(s, id), "service")
  authorize(actor, "EDIT_SERVICE", service.id)
  const v = new Violations()
  const name = v.name("name", input.name, 120, msg("errors.services.nameRequired"))
  const description = v.optionalText("description", input.description, 2000)
  if (!v.has("name")) checkServiceName(s, v, name, service.id)
  v.throwIfAny()
  service.name = name
  service.description = description
  service.updatedAt = toInstant(nowMs())
  return service
}

/** What archiving or deleting a service would affect; shown in the confirmation dialogs. */
export function serviceImpact(s: State, id: Uuid) {
  const sessions = s.sessions.filter((x) => x.serviceId === id)
  const upcoming = sessions.filter(
    (x) => x.status === "scheduled" && Date.parse(x.startsAt) > nowMs()
  )
  return {
    sessions: sessions.length,
    activeSessions: sessions.filter((x) => x.status === "active").length,
    upcomingSessions: upcoming.length,
    stages: stagesOf(s, id, true).length,
    schedules: s.schedules.filter((x) => x.serviceId === id).length,
    activeSchedules: s.schedules.filter((x) => x.serviceId === id && x.active).length,
    members: new Set(
      s.memberships.filter((m) => m.serviceId === id && m.endsOn === null).map((m) => m.personId)
    ).size,
  }
}

export function archiveService(s: State, actor: User, id: Uuid): Service {
  const service = found(serviceOf(s, id), "service")
  authorize(actor, "ARCHIVE_SERVICE", service.id, msg("errors.services.adminOnlyArchive"))
  if (isArchived(service)) {
    throw ruleViolation(msg("errors.services.alreadyArchived", { name: service.name }))
  }
  if (serviceImpact(s, id).activeSessions > 0) {
    throw ruleViolation(msg("errors.services.takingAttendance", { name: service.name }))
  }
  const at = toInstant(nowMs())
  service.archivedAt = at
  service.updatedAt = at
  return service
}

export function restoreService(s: State, actor: User, id: Uuid): Service {
  const service = found(serviceOf(s, id), "service")
  authorize(actor, "ARCHIVE_SERVICE", service.id, msg("errors.services.adminOnlyRestore"))
  if (!isArchived(service)) {
    throw ruleViolation(msg("errors.services.notArchived", { name: service.name }))
  }
  service.archivedAt = null
  service.updatedAt = toInstant(nowMs())
  return service
}

/**
 * Deleting is only allowed while nothing refers to the service's history:
 * once a session exists, the database's RESTRICT foreign keys refuse the
 * delete and the service must be archived instead.
 */
export function deleteService(s: State, actor: User, id: Uuid): Service {
  const service = found(serviceOf(s, id), "service")
  authorize(actor, "ARCHIVE_SERVICE", service.id, msg("errors.services.adminOnlyDelete"))
  const impact = serviceImpact(s, id)
  if (impact.sessions > 0) {
    throw ruleViolation(
      msg("errors.services.hasHistory", { name: service.name, count: impact.sessions })
    )
  }
  const stageIds = new Set(s.stages.filter((x) => x.serviceId === id).map((x) => x.id))
  s.services = s.services.filter((x) => x.id !== id)
  delete s.serviceTones[id]
  s.stages = s.stages.filter((x) => x.serviceId !== id)
  s.schedules = s.schedules.filter((x) => x.serviceId !== id)
  s.memberships = s.memberships.filter(
    (x) => x.serviceId !== id && !(x.stageId && stageIds.has(x.stageId))
  )
  for (const u of s.users) u.roles = u.roles.filter((r) => r.serviceId !== id)
  return service
}

// ------------------------------------------------------------------ stages

function checkStageName(s: State, v: Violations, serviceId: Uuid, name: string, exceptId?: Uuid) {
  const clash = s.stages.find(
    (x) => x.serviceId === serviceId && x.id !== exceptId && nameKey(x.name) === nameKey(name)
  )
  if (!clash) return
  v.add(
    "name",
    isArchived(clash)
      ? msg("errors.stages.nameTakenArchived", { name: clash.name })
      : msg("errors.stages.nameTaken", { name: clash.name })
  )
}

function editableService(s: State, actor: User, serviceId: Uuid): Service {
  const service = found(serviceOf(s, serviceId), "service")
  authorize(actor, "MANAGE_STRUCTURE", service.id)
  if (isArchived(service)) {
    throw ruleViolation(msg("errors.services.archivedNoStageChanges", { name: service.name }))
  }
  return service
}

export function createStage(s: State, actor: User, serviceId: Uuid, input: StageInput): Stage {
  const service = editableService(s, actor, serviceId)
  const v = new Violations()
  const name = v.name("name", input.name, 80, msg("errors.stages.nameRequired"))
  const description = v.optionalText("description", input.description, 500)
  if (!v.has("name")) checkStageName(s, v, service.id, name)
  v.throwIfAny()
  const siblings = s.stages.filter((x) => x.serviceId === service.id)
  const active = siblings.filter((x) => !isArchived(x))
  // New stages go after the active ones; archived stages keep sorting last.
  for (const archived of siblings.filter(isArchived)) archived.position += 1
  const ms = nowMs()
  const stage: Stage = {
    id: uuidv7(ms),
    serviceId: service.id,
    name,
    description,
    position: active.length === 0 ? 0 : Math.max(...active.map((x) => x.position)) + 1,
    archivedAt: null,
    createdAt: toInstant(ms),
  }
  s.stages.push(stage)
  return stage
}

export function updateStage(s: State, actor: User, stageId: Uuid, input: StageInput): Stage {
  const stage = found(stageOf(s, stageId), "stage")
  editableService(s, actor, stage.serviceId)
  const v = new Violations()
  const name = v.name("name", input.name, 80, msg("errors.stages.nameRequired"))
  const description = v.optionalText("description", input.description, 500)
  if (!v.has("name")) checkStageName(s, v, stage.serviceId, name, stage.id)
  v.throwIfAny()
  stage.name = name
  stage.description = description
  return stage
}

/** Sets the display order of a service's active stages. */
export function reorderStages(s: State, actor: User, serviceId: Uuid, orderedIds: Uuid[]): Stage[] {
  const service = editableService(s, actor, serviceId)
  const active = stagesOf(s, service.id)
  const expected = new Set(active.map((x) => x.id))
  if (orderedIds.length !== expected.size || !orderedIds.every((id) => expected.has(id))) {
    throw ruleViolation(msg("errors.stages.reorderStale"))
  }
  orderedIds.forEach((id, index) => {
    stageOf(s, id)!.position = index
  })
  stagesOf(s, service.id, true)
    .filter(isArchived)
    .forEach((x, i) => (x.position = orderedIds.length + i))
  return stagesOf(s, service.id)
}

export function stageImpact(s: State, stageId: Uuid) {
  const sessions = s.sessions.filter((x) => x.stageId === stageId)
  return {
    sessions: sessions.length,
    activeSessions: sessions.filter((x) => x.status === "active").length,
    members: new Set(
      s.memberships.filter((m) => m.stageId === stageId && m.endsOn === null).map((m) => m.personId)
    ).size,
    schedules: s.schedules.filter((x) => x.stageId === stageId).length,
  }
}

export function archiveStage(s: State, actor: User, stageId: Uuid): Stage {
  const stage = found(stageOf(s, stageId), "stage")
  editableService(s, actor, stage.serviceId)
  if (isArchived(stage)) {
    throw ruleViolation(msg("errors.stages.alreadyArchived", { name: stage.name }))
  }
  if (stageImpact(s, stageId).activeSessions > 0) {
    throw ruleViolation(msg("errors.stages.takingAttendance", { name: stage.name }))
  }
  stage.archivedAt = toInstant(nowMs())
  const siblings = stagesOf(s, stage.serviceId, true)
  siblings.forEach((x, i) => (x.position = i))
  return stage
}

export function restoreStage(s: State, actor: User, stageId: Uuid): Stage {
  const stage = found(stageOf(s, stageId), "stage")
  editableService(s, actor, stage.serviceId)
  if (!isArchived(stage)) {
    throw ruleViolation(msg("errors.stages.notArchived", { name: stage.name }))
  }
  const active = stagesOf(s, stage.serviceId)
  stage.archivedAt = null
  stage.position = active.length
  stagesOf(s, stage.serviceId, true).forEach((x, i) => (x.position = i))
  return stage
}

/**
 * A stage can be deleted while it has no sessions and nobody is currently in
 * it. Otherwise it is archived, so past rosters stay readable.
 */
export function deleteStage(s: State, actor: User, stageId: Uuid): Stage {
  const stage = found(stageOf(s, stageId), "stage")
  editableService(s, actor, stage.serviceId)
  const impact = stageImpact(s, stageId)
  if (impact.sessions > 0) {
    throw ruleViolation(
      msg("errors.stages.hasHistory", { name: stage.name, count: impact.sessions })
    )
  }
  if (impact.members > 0) {
    throw ruleViolation(
      msg("errors.stages.hasMembers", { name: stage.name, count: impact.members })
    )
  }
  s.stages = s.stages.filter((x) => x.id !== stageId)
  s.schedules = s.schedules.filter((x) => x.stageId !== stageId)
  s.memberships = s.memberships.filter((x) => x.stageId !== stageId)
  stagesOf(s, stage.serviceId, true).forEach((x, i) => (x.position = i))
  return stage
}
