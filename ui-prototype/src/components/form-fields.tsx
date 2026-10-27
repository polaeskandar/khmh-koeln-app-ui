"use client"

import { useId } from "react"
import { useTranslations } from "next-intl"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

/** " (optional)" after a field label. */
export function OptionalNote() {
  const t = useTranslations("common")
  return <span className="font-normal text-muted-foreground"> {t("optionalNote")}</span>
}

/** Label, control, hint and server-side error in one place, wired for screen readers. */
export function TextField({
  label,
  description,
  error,
  optional,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string
  description?: React.ReactNode
  error?: string
  optional?: boolean
}) {
  const id = useId()
  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional ? <OptionalNote /> : null}
      </FieldLabel>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : description ? `${id}-hint` : undefined}
        {...props}
      />
      {description && !error ? (
        <FieldDescription id={`${id}-hint`}>{description}</FieldDescription>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  )
}

export function TextAreaField({
  label,
  description,
  error,
  optional,
  className,
  ...props
}: React.ComponentProps<typeof Textarea> & {
  label: string
  description?: React.ReactNode
  error?: string
  optional?: boolean
}) {
  const id = useId()
  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional ? <OptionalNote /> : null}
      </FieldLabel>
      <Textarea id={id} aria-invalid={error ? true : undefined} {...props} />
      {description && !error ? <FieldDescription>{description}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}
