"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import {
  addStage,
  changeStructure,
  createService,
  deleteService,
  moveStage,
  setServiceArchived,
  setStageArchived,
  updateService,
  updateStage,
} from "@/server/mock/commands/services"

import { run } from "./run"
import { nullableText, shortText, uuid } from "./schemas"

const stage = z.object({ name: shortText, description: nullableText })
const structure = z.enum(["stages", "single"])

const newService = z.object({
  name: shortText,
  description: nullableText,
  structure,
  stages: z.array(stage).max(30),
})

export async function createServiceAction(input: z.input<typeof newService>) {
  const data = newService.parse(input)

  return run(
    (ctx) => createService(ctx, data).id,
    msg("toast.serviceCreated", { name: data.name.trim() })
  )
}

export async function updateServiceAction(
  serviceId: string,
  input: { name: string; description: string | null }
) {
  const id = uuid.parse(serviceId)
  const data = z.object({ name: shortText, description: nullableText }).parse(input)

  return run((ctx) => updateService(ctx, id, data), msg("toast.serviceSaved"))
}

export async function changeStructureAction(
  serviceId: string,
  value: "stages" | "single",
  firstStage: { name: string; description: string | null } | null
) {
  const id = uuid.parse(serviceId)
  const next = structure.parse(value)
  const stageValue = stage.nullable().parse(firstStage)

  return run((ctx) => changeStructure(ctx, id, next, stageValue), msg("toast.structureChanged"))
}

export async function setServiceArchivedAction(serviceId: string, archived: boolean) {
  const id = uuid.parse(serviceId)
  const value = z.boolean().parse(archived)

  return run(
    (ctx) => setServiceArchived(ctx, id, value),
    msg(value ? "toast.serviceArchived" : "toast.serviceRestored")
  )
}

export async function deleteServiceAction(serviceId: string) {
  const id = uuid.parse(serviceId)

  return run((ctx) => deleteService(ctx, id), msg("toast.serviceDeleted"))
}

export async function addStageAction(serviceId: string, input: z.input<typeof stage>) {
  const id = uuid.parse(serviceId)
  const data = stage.parse(input)

  return run((ctx) => addStage(ctx, id, data).id, msg("toast.stageAdded"))
}

export async function updateStageAction(stageId: string, input: z.input<typeof stage>) {
  const id = uuid.parse(stageId)
  const data = stage.parse(input)

  return run((ctx) => updateStage(ctx, id, data), msg("toast.stageSaved"))
}

export async function setStageArchivedAction(stageId: string, archived: boolean) {
  const id = uuid.parse(stageId)
  const value = z.boolean().parse(archived)

  return run(
    (ctx) => setStageArchived(ctx, id, value),
    msg(value ? "toast.stageArchived" : "toast.stageRestored")
  )
}

export async function moveStageAction(stageId: string, direction: -1 | 1) {
  const id = uuid.parse(stageId)
  const value = z.union([z.literal(-1), z.literal(1)]).parse(direction)

  return run((ctx) => moveStage(ctx, id, value))
}
