"use client"

import { useState } from "react"
import { Check, Copy, Dices, Eye, EyeOff, KeyRound } from "lucide-react"
import { useTranslations } from "next-intl"

import { TextField } from "@/components/form-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { FieldDescription, FieldError, FieldLabel, Field } from "@/components/ui/field"

const WORDS = [
  "olive",
  "cedar",
  "river",
  "lamp",
  "bread",
  "dove",
  "stone",
  "harp",
  "grape",
  "palm",
  "light",
  "wheat",
  "star",
  "fig",
  "salt",
  "cloud",
  "bell",
  "honey",
  "garden",
  "anchor",
]

export function generatePassword(): string {
  const values = new Uint32Array(4)
  crypto.getRandomValues(values)
  const word = (n: number) => WORDS[n % WORDS.length]

  return `${word(values[0])}-${word(values[1])}-${word(values[2])}-${10 + (values[3] % 90)}`
}

export function TemporaryPasswordField({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  const t = useTranslations("accounts.credentials")
  const [visible, setVisible] = useState(true)

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor="temporary-password">{t("temporaryPassword")}</FieldLabel>
      <InputGroup>
        <InputGroupAddon>
          <KeyRound />
        </InputGroupAddon>
        <InputGroupInput
          id="temporary-password"
          dir="ltr"
          autoComplete="new-password"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={visible ? t("hide") : t("show")}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff /> : <Eye />}
          </InputGroupButton>
          <InputGroupButton
            size="icon-xs"
            aria-label={t("generate")}
            onClick={() => onChange(generatePassword())}
          >
            <Dices />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error ? (
        <FieldError>{error}</FieldError>
      ) : (
        <FieldDescription>{t("temporaryHint")}</FieldDescription>
      )}
    </Field>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const t = useTranslations("accounts.credentials")
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex items-center justify-between gap-3 border bg-muted/40 px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="truncate font-mono text-base font-semibold" dir="ltr">
          {value}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await navigator.clipboard?.writeText(value).catch(() => undefined)
          setCopied(true)
        }}
      >
        {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
        {copied ? t("copied") : t("copy")}
      </Button>
    </div>
  )
}

export function HandOverDialog({
  open,
  onDone,
  name,
  username,
  password,
}: {
  open: boolean
  onDone: () => void
  name: string
  username: string
  password: string
}) {
  const t = useTranslations("accounts.credentials")

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onDone())}>
      <DialogContent showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t("handOverTitle", { name })}</DialogTitle>
          <DialogDescription>{t("handOverHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <CopyRow label={t("username")} value={username} />
          <CopyRow label={t("temporaryPassword")} value={password} />
        </div>
        <ul className="flex list-disc flex-col gap-1 ps-5 text-sm text-muted-foreground">
          <li>{t("handOverOnce")}</li>
          <li>{t("handOverChange")}</li>
          <li>{t("handOverPrivately")}</li>
        </ul>
        <DialogFooter>
          <Button onClick={onDone}>{t("handedOver")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UsernameField({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  const t = useTranslations("accounts.credentials")

  return (
    <TextField
      label={t("username")}
      dir="ltr"
      autoComplete="off"
      spellCheck={false}
      autoCapitalize="none"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      description={t("usernameHint")}
    />
  )
}
