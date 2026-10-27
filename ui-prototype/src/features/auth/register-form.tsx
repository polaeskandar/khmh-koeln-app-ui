"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { TextAreaField, TextField } from "@/components/form-fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { useServerAction } from "@/hooks/use-server-action"
import { registerAction } from "@/server/actions/auth"

import { PasswordField } from "./password-input"

type As = "parent" | "servant"

export function RegisterForm({
  services,
  minPasswordLength,
}: {
  services: { id: string; name: string }[]
  minPasswordLength: number
}) {
  const t = useTranslations("auth.register")
  const router = useRouter()
  const ids = { service: useId(), privacy: useId() }
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    as: "parent" as As,
    details: "",
    serviceId: "",
    acceptPrivacy: false,
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))
  const submit = useServerAction(registerAction, {
    toastOnSuccess: false,
    onSuccess: () => router.push("/register/done"),
  })
  const errors = submit.fieldErrors
  const kinds: { value: As; title: string; description: string }[] = [
    { value: "parent", title: t("asParent"), description: t("asParentHint") },
    { value: "servant", title: t("asServant"), description: t("asServantHint") },
  ]

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault()
        submit.execute({
          ...form,
          serviceId: form.as === "servant" && form.serviceId ? form.serviceId : null,
        })
      }}
    >
      <FieldGroup>
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            label={t("firstName")}
            autoComplete="given-name"
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            error={errors.firstName}
          />
          <TextField
            label={t("lastName")}
            autoComplete="family-name"
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            error={errors.lastName}
          />
        </div>
        <TextField
          label={t("email")}
          type="email"
          autoComplete="email"
          inputMode="email"
          dir="ltr"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          description={t("emailHint")}
          error={errors.email}
        />
        <PasswordField
          label={t("password")}
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          description={t("passwordHint", { min: minPasswordLength })}
          error={errors.password}
        />
      </FieldGroup>

      <FieldSet>
        <FieldLegend>{t("as")}</FieldLegend>
        <RadioGroup
          value={form.as}
          onValueChange={(v) => set("as", v as As)}
          className="grid gap-3 sm:grid-cols-2"
        >
          {kinds.map((k) => (
            <FieldLabel
              key={k.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 border p-4 text-sm font-normal tracking-normal normal-case transition-colors hover:bg-muted/50",
                form.as === k.value && "border-primary bg-primary/5"
              )}
            >
              <RadioGroupItem value={k.value} className="mt-0.5" />
              <span className="flex flex-col gap-1">
                <span className="font-medium">{k.title}</span>
                <span className="text-xs text-muted-foreground">{k.description}</span>
              </span>
            </FieldLabel>
          ))}
        </RadioGroup>
      </FieldSet>

      <FieldGroup>
        {form.as === "servant" ? (
          <Field data-invalid={errors.serviceId ? true : undefined}>
            <FieldLabel htmlFor={ids.service}>{t("service")}</FieldLabel>
            <NativeSelect
              id={ids.service}
              className="w-full"
              value={form.serviceId}
              onChange={(e) => set("serviceId", e.target.value)}
              aria-invalid={errors.serviceId ? true : undefined}
            >
              <NativeSelectOption value="">{t("chooseService")}</NativeSelectOption>
              {services.map((s) => (
                <NativeSelectOption key={s.id} value={s.id}>
                  {s.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {errors.serviceId ? <FieldError>{errors.serviceId}</FieldError> : null}
          </Field>
        ) : null}
        <TextAreaField
          label={form.as === "parent" ? t("children") : t("whereYouServe")}
          description={form.as === "parent" ? t("childrenHint") : t("whereYouServeHint")}
          rows={3}
          value={form.details}
          onChange={(e) => set("details", e.target.value)}
          error={errors.details}
        />
      </FieldGroup>

      <Field orientation="horizontal" data-invalid={errors.acceptPrivacy ? true : undefined}>
        <Checkbox
          id={ids.privacy}
          checked={form.acceptPrivacy}
          onCheckedChange={(v) => set("acceptPrivacy", v === true)}
          aria-invalid={errors.acceptPrivacy ? true : undefined}
        />
        <FieldContent>
          <FieldLabel
            htmlFor={ids.privacy}
            className="text-sm font-normal tracking-normal normal-case"
          >
            {/* One span, so the label's flex gap doesn't separate the link from its sentence. */}
            <span>
              {t.rich("privacy", {
                link: (chunks) => (
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="font-medium underline underline-offset-4"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </FieldLabel>
          <FieldDescription>{t("privacyHint")}</FieldDescription>
          {errors.acceptPrivacy ? <FieldError>{errors.acceptPrivacy}</FieldError> : null}
        </FieldContent>
      </Field>

      <div className="flex flex-col gap-4">
        <Button type="submit" size="lg" disabled={submit.pending}>
          {submit.pending ? <Spinner data-icon="inline-start" /> : null}
          {t("submit")}
        </Button>
        <p className="text-sm text-muted-foreground">
          {t.rich("haveAccount", {
            link: (chunks) => (
              <Link
                href="/sign-in"
                className="font-medium text-foreground underline underline-offset-4"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </form>
  )
}
