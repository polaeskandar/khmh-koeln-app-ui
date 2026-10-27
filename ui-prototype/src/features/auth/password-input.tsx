"use client"

import { useId, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { useTranslations } from "next-intl"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

/** A password field with a button to show what was typed (easier on phones than typing it twice). */
export function PasswordField({
  label,
  description,
  error,
  labelExtra,
  ...props
}: React.ComponentProps<typeof InputGroupInput> & {
  label: string
  description?: React.ReactNode
  error?: string
  /** Shown opposite the label, e.g. "Forgot your password?". */
  labelExtra?: React.ReactNode
}) {
  const t = useTranslations("auth.password")
  const id = useId()
  const [visible, setVisible] = useState(false)
  return (
    <Field data-invalid={error ? true : undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {labelExtra}
      </div>
      <InputGroup>
        <InputGroupInput
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : description ? `${id}-hint` : undefined}
          dir="ltr"
          {...props}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={visible ? t("hide") : t("show")}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {description && !error ? (
        <FieldDescription id={`${id}-hint`}>{description}</FieldDescription>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  )
}
