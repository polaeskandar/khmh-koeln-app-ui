"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import * as commands from "@/server/mock/commands/services"

import { id, optionalText, run, text } from "./run"

const serviceInput = z.object({ name: text, description: optionalText })
const stageInput = z.object({ name: text, description: optionalText })

export async function createServiceAction(input: z.input<typeof serviceInput>) {
  return run(
    ({ state, viewer }) => {
      const service = commands.createService(state, viewer, serviceInput.parse(input))
      return { id: service.id, name: service.name }
    },
    (r) => msg("toast.created", { name: r.name })
  )
}

export async function updateServiceAction(serviceId: string, input: z.input<typeof serviceInput>) {
  return run(({ state, viewer }) => {
    const service = commands.updateService(
      state,
      viewer,
      id.parse(serviceId),
      serviceInput.parse(input)
    )
    return { id: service.id }
  }, msg("toast.saved"))
}

export async function archiveServiceAction(serviceId: string) {
  return run(
    ({ state, viewer }) => commands.archiveService(state, viewer, id.parse(serviceId)).name,
    (name) => msg("toast.serviceArchived", { name })
  )
}

export async function restoreServiceAction(serviceId: string) {
  return run(
    ({ state, viewer }) => commands.restoreService(state, viewer, id.parse(serviceId)).name,
    (name) => msg("toast.restored", { name })
  )
}

export async function deleteServiceAction(serviceId: string) {
  return run(
    ({ state, viewer }) => commands.deleteService(state, viewer, id.parse(serviceId)).name,
    (name) => msg("toast.deleted", { name })
  )
}

export async function createStageAction(serviceId: string, input: z.input<typeof stageInput>) {
  return run(
    ({ state, viewer }) => {
      const stage = commands.createStage(
        state,
        viewer,
        id.parse(serviceId),
        stageInput.parse(input)
      )
      return { id: stage.id, name: stage.name }
    },
    (r) => msg("toast.added", { name: r.name })
  )
}

export async function updateStageAction(stageId: string, input: z.input<typeof stageInput>) {
  return run(({ state, viewer }) => {
    commands.updateStage(state, viewer, id.parse(stageId), stageInput.parse(input))
    return null
  }, msg("toast.saved"))
}

export async function reorderStagesAction(serviceId: string, orderedIds: string[]) {
  return run(({ state, viewer }) => {
    commands.reorderStages(
      state,
      viewer,
      id.parse(serviceId),
      z.array(id).max(200).parse(orderedIds)
    )
    return null
  }, msg("toast.orderSaved"))
}

export async function archiveStageAction(stageId: string) {
  return run(
    ({ state, viewer }) => commands.archiveStage(state, viewer, id.parse(stageId)).name,
    (name) => msg("toast.archived", { name })
  )
}

export async function restoreStageAction(stageId: string) {
  return run(
    ({ state, viewer }) => commands.restoreStage(state, viewer, id.parse(stageId)).name,
    (name) => msg("toast.restored", { name })
  )
}

export async function deleteStageAction(stageId: string) {
  return run(
    ({ state, viewer }) => commands.deleteStage(state, viewer, id.parse(stageId)).name,
    (name) => msg("toast.deleted", { name })
  )
}
