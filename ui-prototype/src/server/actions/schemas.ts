import { z } from "zod"

export const uuid = z.uuid()

export const scope = z.discriminatedUnion("type", [
  z.object({ type: z.literal("church") }),
  z.object({ type: z.literal("service"), serviceId: z.uuid() }),
  z.object({ type: z.literal("stage"), serviceId: z.uuid(), stageId: z.uuid() }),
])

export const unit = z.object({ serviceId: z.uuid(), stageId: z.uuid().nullable() })

export const shortText = z.string().max(300)
export const longText = z.string().max(10000)
export const nullableText = z.string().max(10000).nullable()

export const link = z.object({ label: z.string().max(300), url: z.string().max(2000).nullable() })
