import { z } from "zod"

import { type ResourceType, resourceTypes } from "@/lib/domain/resources"

export const uuid = z.uuid()

/** A resource: the church, or one resource of a type. */
export const resource = z.union([
  z.object({ type: z.literal("church"), id: z.literal("church") }),
  z.object({
    type: z.enum(
      resourceTypes().filter((t) => t !== "church") as [ResourceType, ...ResourceType[]]
    ),
    id: z.uuid(),
  }),
])

export const unit = z.object({ serviceId: z.uuid(), stageId: z.uuid().nullable() })

export const shortText = z.string().max(300)
export const longText = z.string().max(10000)
export const nullableText = z.string().max(10000).nullable()

export const link = z.object({ label: z.string().max(300), url: z.string().max(2000).nullable() })
