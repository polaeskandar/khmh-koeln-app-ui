"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import * as commands from "@/server/mock/commands/learning"

import { id, run } from "./run"
import { isolate } from "@/lib/bidi"

const material = z.object({ label: z.string().max(500), url: z.string().max(2000).nullable() })
const optional = z.string().max(10_000).nullable().optional()

const lessonInput = z.object({
  title: z.string().max(1000),
  meeting: z.string().max(200),
  summary: optional,
  passage: optional,
  objectives: optional,
  teachingPoints: optional,
  memoryVerse: optional,
  activities: optional,
  materials: z.array(material).max(20).optional(),
  notes: optional,
  responsibleId: id,
  collaboratorIds: z.array(id).max(20).optional(),
})

const homeworkInput = z.object({
  title: z.string().max(1000),
  instructions: z.string().max(10_000),
  dueDate: z.string().max(20).nullable(),
  resources: z.array(material).max(20).optional(),
})

export async function createLessonAction(
  stageId: string,
  input: z.input<typeof lessonInput>,
  ready: boolean
) {
  return run(
    ({ state, viewer }) => {
      const lesson = commands.createLesson(
        state,
        viewer,
        id.parse(stageId),
        lessonInput.parse(input),
        ready ? "ready" : "draft"
      )
      return { id: lesson.id, title: lesson.title, status: lesson.status }
    },
    (r) =>
      r.status === "ready"
        ? msg("toast.lessonReady", { title: isolate(r.title) })
        : msg("toast.lessonDraftSaved", { title: isolate(r.title) })
  )
}

export async function updateLessonAction(
  lessonId: string,
  input: z.input<typeof lessonInput>,
  status?: "draft" | "ready"
) {
  return run(
    ({ state, viewer }) => {
      const lesson = commands.updateLesson(
        state,
        viewer,
        id.parse(lessonId),
        lessonInput.parse(input)
      )
      if (status && status !== lesson.status && lesson.status !== "completed")
        commands.setLessonStatus(state, viewer, lesson.id, status)
      return { id: lesson.id, status: lesson.status }
    },
    (r) => (r.status === "ready" ? msg("toast.lessonSavedReady") : msg("toast.saved"))
  )
}

export async function setLessonStatusAction(
  lessonId: string,
  status: "draft" | "ready" | "completed"
) {
  return run(
    ({ state, viewer }) =>
      commands.setLessonStatus(
        state,
        viewer,
        id.parse(lessonId),
        z.enum(["draft", "ready", "completed"]).parse(status)
      ).status,
    (s) =>
      s === "completed"
        ? msg("toast.lessonTaught")
        : s === "ready"
          ? msg("toast.lessonMarkedReady")
          : msg("toast.lessonBackToDraft")
  )
}

export async function archiveLessonAction(lessonId: string) {
  return run(
    ({ state, viewer }) => commands.archiveLesson(state, viewer, id.parse(lessonId)).title,
    (title) => msg("toast.archivedTitle", { title })
  )
}

export async function restoreLessonAction(lessonId: string) {
  return run(
    ({ state, viewer }) => commands.restoreLesson(state, viewer, id.parse(lessonId)).title,
    (title) => msg("toast.restoredTitle", { title })
  )
}

export async function deleteLessonAction(lessonId: string) {
  return run(
    ({ state, viewer }) => commands.deleteLesson(state, viewer, id.parse(lessonId)).title,
    (title) => msg("toast.deletedTitle", { title })
  )
}

export async function createHomeworkAction(
  lessonId: string,
  input: z.input<typeof homeworkInput>,
  publish: boolean
) {
  return run(
    ({ state, viewer }) => {
      const hw = commands.createHomework(
        state,
        viewer,
        id.parse(lessonId),
        homeworkInput.parse(input),
        z.boolean().parse(publish)
      )
      return { id: hw.id, status: hw.status }
    },
    (r) =>
      r.status === "published" ? msg("toast.homeworkPublishedNew") : msg("toast.homeworkDraftSaved")
  )
}

export async function updateHomeworkAction(
  homeworkId: string,
  input: z.input<typeof homeworkInput>,
  publish?: boolean
) {
  return run(
    ({ state, viewer }) => {
      let hw = commands.updateHomework(
        state,
        viewer,
        id.parse(homeworkId),
        homeworkInput.parse(input)
      )
      if (publish && hw.status === "draft") hw = commands.publishHomework(state, viewer, hw.id)
      return { id: hw.id, status: hw.status }
    },
    (r) =>
      r.status === "published"
        ? msg("toast.homeworkSavedPublished")
        : msg("toast.homeworkSavedDraft")
  )
}

export async function publishHomeworkAction(homeworkId: string) {
  return run(
    ({ state, viewer }) => commands.publishHomework(state, viewer, id.parse(homeworkId)).title,
    (title) => msg("toast.homeworkPublished", { title })
  )
}

export async function unpublishHomeworkAction(homeworkId: string) {
  return run(
    ({ state, viewer }) => commands.unpublishHomework(state, viewer, id.parse(homeworkId)).title,
    (title) => msg("toast.homeworkUnpublished", { title })
  )
}

export async function archiveHomeworkAction(homeworkId: string) {
  return run(
    ({ state, viewer }) => commands.archiveHomework(state, viewer, id.parse(homeworkId)).title,
    (title) => msg("toast.homeworkArchived", { title })
  )
}

export async function restoreHomeworkAction(homeworkId: string) {
  return run(
    ({ state, viewer }) => {
      const hw = commands.restoreHomework(state, viewer, id.parse(homeworkId))
      return { title: hw.title, status: hw.status }
    },
    (r) =>
      r.status === "published"
        ? msg("toast.homeworkRestoredPublished", { title: isolate(r.title) })
        : msg("toast.homeworkRestoredDraft", { title: isolate(r.title) })
  )
}

export async function deleteHomeworkAction(homeworkId: string) {
  return run(
    ({ state, viewer }) => commands.deleteHomework(state, viewer, id.parse(homeworkId)).title,
    (title) => msg("toast.deletedTitle", { title })
  )
}

/** Parent portal: report a child's homework as completed. Safe to call twice. */
export async function completeHomeworkAction(homeworkId: string, childId: string) {
  return run(({ state, viewer }) => {
    const c = commands.completeHomework(state, viewer, id.parse(homeworkId), id.parse(childId))
    return { completedAt: c.completedAt }
  })
}

export async function undoCompletionAction(homeworkId: string, childId: string) {
  return run(({ state, viewer }) => {
    commands.undoCompletion(state, viewer, id.parse(homeworkId), id.parse(childId))
    return null
  })
}

export async function linkGuardianAction(userId: string, personId: string) {
  return run(({ state, viewer }) => {
    commands.linkGuardian(state, viewer, id.parse(userId), id.parse(personId))
    return null
  }, msg("toast.accessGiven"))
}

export async function approveGuardianAction(linkId: string) {
  return run(({ state, viewer }) => {
    commands.approveGuardian(state, viewer, id.parse(linkId))
    return null
  }, msg("toast.approved"))
}

export async function revokeGuardianAction(linkId: string) {
  return run(({ state, viewer }) => {
    commands.revokeGuardian(state, viewer, id.parse(linkId))
    return null
  }, msg("toast.accessRemoved"))
}
