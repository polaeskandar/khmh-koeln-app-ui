import { type Message, msg } from "@/i18n/message"
import { cleanName } from "@/lib/domain/names"
import { can, type Permission } from "@/lib/domain/policy"
import { isValidLocalDate, isValidLocalTime } from "@/lib/domain/time"
import type { User, Uuid } from "@/lib/domain/types"
import { forbidden, invalid, notFound, type Thing } from "@/server/errors"

export type Scope = Uuid | { serviceId: Uuid; stageId?: Uuid | null } | null | undefined

/** Throws 403 unless the user holds the permission (in the service or stage, for scoped permissions). */
export function authorize(
  user: User,
  permission: Permission,
  scope?: Scope,
  detail?: Message
): void {
  const serviceId = typeof scope === "object" && scope !== null ? scope.serviceId : scope
  const stageId = typeof scope === "object" && scope !== null ? scope.stageId : null
  if (!can(user, permission, serviceId, stageId)) throw forbidden(detail)
}

export function found<T>(value: T | undefined, what: Thing): T {
  if (value === undefined) throw notFound(what)
  return value
}

/** Collects field errors and throws one 422 with all of them, like Symfony's validator. */
export class Violations {
  private readonly errors: Record<string, Message> = {}

  add(field: string, message: Message): this {
    this.errors[field] ??= message
    return this
  }

  has(field: string): boolean {
    return field in this.errors
  }

  /** A required, cleaned name with a maximum length. Returns the cleaned value. */
  name(field: string, value: string | null | undefined, max: number, required: Message): string {
    const clean = cleanName(value ?? "")
    if (clean === "") this.add(field, required)
    else if (clean.length > max) this.add(field, msg("errors.validation.tooLong", { max }))
    return clean
  }

  optionalText(field: string, value: string | null | undefined, max: number): string | null {
    const clean = (value ?? "").trim()
    if (clean.length > max) this.add(field, msg("errors.validation.tooLong", { max }))
    return clean === "" ? null : clean
  }

  date(field: string, value: string | null | undefined, required = true): string | null {
    const v = (value ?? "").trim()
    if (v === "") {
      if (required) this.add(field, msg("errors.validation.chooseDate"))
      return null
    }
    if (!isValidLocalDate(v)) this.add(field, msg("errors.validation.invalidDate"))
    return v
  }

  time(field: string, value: string | null | undefined, required = true): string | null {
    const v = (value ?? "").trim()
    if (v === "") {
      if (required) this.add(field, msg("errors.validation.chooseTime"))
      return null
    }
    if (!isValidLocalTime(v)) this.add(field, msg("errors.validation.invalidTime"))
    return v
  }

  throwIfAny(): void {
    if (Object.keys(this.errors).length > 0) throw invalid({ ...this.errors })
  }
}
