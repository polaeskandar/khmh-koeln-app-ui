import { msg } from "@/i18n/message"
import { cleanName, nameKey } from "@/lib/domain/names"
import type { Service, ServiceStructure, Stage, Uuid } from "@/lib/domain/types"
import { invalid, ruleViolation } from "@/server/errors"

import { authorize, requireIn } from "../access"
import { now, nowMs } from "../clock"
import { found, Violations } from "../guard"
import { uuidv7 } from "../ids"
import { serviceOf, stageOf, stagesOf } from "../selectors"
import type { State } from "../state"

import { removeOrphanedAccess } from "./access"
import type { Actor } from "./accounts"

export type StageInput = { name: string; description: string | null }

function checkServiceName(s: State, v: Violations, name: string, except: Uuid | null): string {
  const clean = v.name("name", name, 80, msg("errors.services.nameRequired"))

  if (s.services.some((x) => x.id !== except && nameKey(x.name) === nameKey(clean))) {
    v.add("name", msg("errors.services.nameTaken"))
  }

  return clean
}

function checkStages(v: Violations, stages: StageInput[]) {
  const keys = new Set<string>()

  stages.forEach((stage, index) => {
    const clean = v.name(`stages.${index}`, stage.name, 80, msg("errors.stages.nameRequired"))

    if (clean && keys.has(nameKey(clean))) {
      v.add(`stages.${index}`, msg("errors.stages.nameTaken"))
    }

    keys.add(nameKey(clean))
  })
}

function nextTone(s: State): number {
  const used = new Set(Object.values(s.serviceTones))

  for (let tone = 1; tone <= 8; tone++) {
    if (!used.has(tone)) {
      return tone
    }
  }

  return (s.services.length % 8) + 1
}

export function addStageRow(s: State, service: Service, input: StageInput): Stage {
  const stage: Stage = {
    id: uuidv7(nowMs()),
    serviceId: service.id,
    name: cleanName(input.name),
    description: input.description?.trim() || null,
    position: stagesOf(s, service.id, true).length + 1,
    archivedAt: null,
    createdAt: now(),
  }
  s.stages.push(stage)
  s.schedules.push({
    id: uuidv7(nowMs()),
    serviceId: service.id,
    stageId: stage.id,
    createdAt: now(),
  })

  return stage
}

export function createService(
  { state: s, viewer }: Actor,
  input: {
    name: string
    description: string | null
    structure: ServiceStructure
    stages: StageInput[]
  }
) {
  authorize(s, viewer, "service.create")
  const v = new Violations()
  const name = checkServiceName(s, v, input.name, null)
  const description = v.optionalText("description", input.description, 500)

  if (input.structure === "stages") {
    checkStages(v, input.stages)

    if (input.stages.length === 0) {
      v.add("stages", msg("errors.stages.atLeastOne"))
    }
  }

  v.throwIfAny()
  const service: Service = {
    id: uuidv7(nowMs()),
    name: cleanName(name),
    description,
    structure: input.structure,
    archivedAt: null,
    createdAt: now(),
  }
  s.services.push(service)
  s.serviceTones[service.id] = nextTone(s)

  if (input.structure === "single") {
    s.schedules.push({
      id: uuidv7(nowMs()),
      serviceId: service.id,
      stageId: null,
      createdAt: now(),
    })
  } else {
    input.stages.forEach((stage) => addStageRow(s, service, stage))
  }

  return service
}

export function updateService(
  { state: s, viewer }: Actor,
  serviceId: Uuid,
  input: { name: string; description: string | null }
) {
  authorize(s, viewer, "service.update", { type: "service", id: serviceId })
  const service = found(serviceOf(s, serviceId), "service")
  const v = new Violations()
  const name = checkServiceName(s, v, input.name, service.id)
  const description = v.optionalText("description", input.description, 500)
  v.throwIfAny()
  service.name = cleanName(name)
  service.description = description
}

function hasHistory(s: State, serviceId: Uuid): boolean {
  return (
    s.sessions.some((x) => x.serviceId === serviceId) ||
    s.memberships.some((m) => m.serviceId === serviceId) ||
    s.lessons.some((l) => l.serviceId === serviceId)
  )
}

export function changeStructure(
  { state: s, viewer }: Actor,
  serviceId: Uuid,
  structure: ServiceStructure,
  firstStage: StageInput | null
) {
  authorize(s, viewer, "service.update", { type: "service", id: serviceId })
  const service = found(serviceOf(s, serviceId), "service")

  if (service.structure === structure) {
    return
  }

  if (hasHistory(s, service.id)) {
    throw ruleViolation(msg("errors.services.structureLocked"))
  }

  if (structure === "stages" && !firstStage) {
    throw invalid({ stage: msg("errors.stages.atLeastOne") })
  }

  s.schedules = s.schedules.filter((x) => x.serviceId !== service.id)
  s.plans = s.plans.filter((p) => s.schedules.some((x) => x.id === p.scheduleId))
  s.stages = s.stages.filter((x) => x.serviceId !== service.id)
  removeOrphanedAccess(s)
  service.structure = structure

  if (structure === "single") {
    s.schedules.push({
      id: uuidv7(nowMs()),
      serviceId: service.id,
      stageId: null,
      createdAt: now(),
    })
  } else {
    const v = new Violations()
    checkStages(v, [firstStage!])
    v.throwIfAny()
    addStageRow(s, service, firstStage!)
  }
}

export function setServiceArchived(
  { state: s, viewer }: Actor,
  serviceId: Uuid,
  archived: boolean
) {
  authorize(s, viewer, "service.update", { type: "service", id: serviceId })
  const service = found(serviceOf(s, serviceId), "service")

  if (archived && s.sessions.some((x) => x.serviceId === service.id && x.status === "open")) {
    throw ruleViolation(msg("errors.services.openSession"))
  }

  service.archivedAt = archived ? now() : null
}

export function deleteService({ state: s, viewer }: Actor, serviceId: Uuid) {
  authorize(s, viewer, "service.delete", { type: "service", id: serviceId })
  const service = found(serviceOf(s, serviceId), "service")

  if (hasHistory(s, service.id)) {
    throw ruleViolation(msg("errors.services.hasHistory"))
  }

  s.services = s.services.filter((x) => x.id !== service.id)
  s.stages = s.stages.filter((x) => x.serviceId !== service.id)
  removeOrphanedAccess(s)
  s.schedules = s.schedules.filter((x) => x.serviceId !== service.id)
  s.plans = s.plans.filter((p) => s.schedules.some((x) => x.id === p.scheduleId))
  s.daysOff = s.daysOff.filter((d) => d.serviceId !== service.id)
  delete s.serviceTones[service.id]
}

function managedStage({ state: s, viewer }: Actor, stageId: Uuid): Stage {
  const stage = found(stageOf(s, stageId), "stage")
  requireIn(s, viewer, "stage.update", { serviceId: stage.serviceId, stageId: stage.id }, "stage")

  return stage
}

export function addStage({ state: s, viewer }: Actor, serviceId: Uuid, input: StageInput) {
  const service = found(serviceOf(s, serviceId), "service")
  requireIn(s, viewer, "stage.create", { serviceId: service.id, stageId: null })

  if (service.structure !== "stages") {
    throw ruleViolation(msg("errors.services.noStages"))
  }

  const v = new Violations()
  const clean = v.name("name", input.name, 80, msg("errors.stages.nameRequired"))

  if (stagesOf(s, service.id, true).some((x) => nameKey(x.name) === nameKey(clean))) {
    v.add("name", msg("errors.stages.nameTaken"))
  }

  v.optionalText("description", input.description, 500)
  v.throwIfAny()

  return addStageRow(s, service, input)
}

export function updateStage(actor: Actor, stageId: Uuid, input: StageInput) {
  const stage = managedStage(actor, stageId)
  const s = actor.state
  const v = new Violations()
  const clean = v.name("name", input.name, 80, msg("errors.stages.nameRequired"))

  if (
    stagesOf(s, stage.serviceId, true).some(
      (x) => x.id !== stage.id && nameKey(x.name) === nameKey(clean)
    )
  ) {
    v.add("name", msg("errors.stages.nameTaken"))
  }

  const description = v.optionalText("description", input.description, 500)
  v.throwIfAny()
  stage.name = cleanName(clean)
  stage.description = description
}

export function setStageArchived(actor: Actor, stageId: Uuid, archived: boolean) {
  const stage = managedStage(actor, stageId)

  if (archived && actor.state.sessions.some((x) => x.stageId === stage.id && x.status === "open")) {
    throw ruleViolation(msg("errors.stages.openSession"))
  }

  stage.archivedAt = archived ? now() : null
}

export function moveStage(actor: Actor, stageId: Uuid, direction: -1 | 1) {
  const stage = managedStage(actor, stageId)
  const ordered = stagesOf(actor.state, stage.serviceId)
  const index = ordered.findIndex((x) => x.id === stage.id)
  const other = ordered[index + direction]

  if (!other) {
    return
  }

  ;[stage.position, other.position] = [other.position, stage.position]
}
