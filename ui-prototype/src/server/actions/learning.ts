"use server"

import { z } from "zod"

import { msg } from "@/i18n/message"
import {
  createLesson,
  createTask,
  deleteLesson,
  deleteTask,
  setLessonStatus,
  setTaskDone,
  setTaskStatus,
  updateLesson,
  updateTask,
} from "@/server/mock/commands/learning"

import { run } from "./run"
import { link, nullableText, shortText, unit, uuid } from "./schemas"

const lesson = z.object({
  sessionId: uuid.nullable(),
  date: z.string().max(10).nullable(),
  title: shortText,
  summary: nullableText,
  objectives: nullableText,
  teachingPoints: nullableText,
  materials: z.array(link.extend({ shared: z.boolean() })).max(30),
  notes: nullableText,
})

export async function createLessonAction(
  where: z.input<typeof unit>,
  input: z.input<typeof lesson>
) {
  const target = unit.parse(where)
  const data = lesson.parse(input)

  return run((ctx) => createLesson(ctx, target, data).id, msg("toast.lessonSaved"))
}

export async function updateLessonAction(lessonId: string, input: z.input<typeof lesson>) {
  const id = uuid.parse(lessonId)
  const data = lesson.parse(input)

  return run((ctx) => updateLesson(ctx, id, data).id, msg("toast.lessonSaved"))
}

export async function setLessonStatusAction(
  lessonId: string,
  status: "draft" | "ready" | "published"
) {
  const id = uuid.parse(lessonId)
  const value = z.enum(["draft", "ready", "published"]).parse(status)

  return run((ctx) => setLessonStatus(ctx, id, value), msg(`toast.lessonStatus.${value}`))
}

export async function deleteLessonAction(lessonId: string) {
  const id = uuid.parse(lessonId)

  return run((ctx) => deleteLesson(ctx, id), msg("toast.lessonDeleted"))
}

const task = z.object({
  title: shortText,
  instructions: z.string().max(10000),
  dueDate: z.string().max(10).nullable(),
  resources: z.array(link).max(20),
})

export async function createTaskAction(
  lessonId: string,
  input: z.input<typeof task>,
  publish: boolean
) {
  const id = uuid.parse(lessonId)
  const data = task.parse(input)
  const value = z.boolean().parse(publish)

  return run(
    (ctx) => createTask(ctx, id, data, value).id,
    msg(value ? "toast.taskPublished" : "toast.taskSaved")
  )
}

export async function updateTaskAction(taskId: string, input: z.input<typeof task>) {
  const id = uuid.parse(taskId)
  const data = task.parse(input)

  return run((ctx) => updateTask(ctx, id, data).id, msg("toast.taskSaved"))
}

export async function setTaskStatusAction(
  taskId: string,
  status: "draft" | "published" | "archived"
) {
  const id = uuid.parse(taskId)
  const value = z.enum(["draft", "published", "archived"]).parse(status)

  return run((ctx) => setTaskStatus(ctx, id, value), msg(`toast.taskStatus.${value}`))
}

export async function deleteTaskAction(taskId: string) {
  const id = uuid.parse(taskId)

  return run((ctx) => deleteTask(ctx, id), msg("toast.taskDeleted"))
}

export async function setTaskDoneAction(taskId: string, personId: string, done: boolean) {
  const id = uuid.parse(taskId)
  const person = uuid.parse(personId)
  const value = z.boolean().parse(done)

  return run(
    (ctx) => setTaskDone(ctx, id, person, value),
    msg(value ? "toast.taskDone" : "toast.taskNotDone")
  )
}
