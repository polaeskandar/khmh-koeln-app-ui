"use client"

/**
 * Confirmation and reason dialogs, adapted from the shadcnblocks examples
 * "alert-dialog-destructive-4" (consequence details) and "alert-dialog-form-2"
 * (inputs in an alert dialog). The dialog stays open while the action runs and
 * closes only when it succeeded.
 */
import { useId, useState } from "react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

type Controlled = { open?: boolean; onOpenChange?: (open: boolean) => void }

export function ConfirmDialog({
  trigger,
  title,
  description,
  consequences,
  note,
  confirmLabel,
  dismissLabel,
  tone = "default",
  onConfirm,
  open: controlledOpen,
  onOpenChange,
}: Controlled & {
  trigger?: React.ReactNode
  title: string
  description?: React.ReactNode
  consequences?: React.ReactNode[]
  note?: React.ReactNode
  confirmLabel: string
  /** The button that closes without doing anything; say what it keeps when "Cancel" would be ambiguous. */
  dismissLabel?: string
  tone?: "default" | "destructive"
  /** Return true to close the dialog. */
  onConfirm: () => Promise<boolean>
}) {
  const t = useTranslations("common")
  const [innerOpen, setInnerOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const open = controlledOpen ?? innerOpen
  const setOpen = onOpenChange ?? setInnerOpen
  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {consequences && consequences.length > 0 ? (
          <ul
            className={cn(
              "flex list-disc flex-col gap-1 py-4 ps-8 pe-4 text-sm marker:text-muted-foreground",
              tone === "destructive" ? "bg-destructive/10 text-destructive" : "bg-muted"
            )}
          >
            {consequences.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        ) : null}
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{dismissLabel ?? t("cancel")}</AlertDialogCancel>
          <Button
            variant={tone === "destructive" ? "destructive" : "default"}
            disabled={pending}
            onClick={async () => {
              setPending(true)
              const close = await onConfirm()
              setPending(false)
              if (close) setOpen(false)
            }}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function ReasonDialog({
  trigger,
  title,
  description,
  reasonLabel,
  reasonHint,
  placeholder,
  confirmLabel,
  dismissLabel,
  tone = "default",
  requireReason = false,
  onConfirm,
  open: controlledOpen,
  onOpenChange,
  children,
}: Controlled & {
  trigger?: React.ReactNode
  title: string
  description?: React.ReactNode
  reasonLabel?: string
  reasonHint?: string
  placeholder?: string
  confirmLabel: string
  dismissLabel?: string
  tone?: "default" | "destructive"
  requireReason?: boolean
  onConfirm: (reason: string | null) => Promise<boolean>
  children?: React.ReactNode
}) {
  const t = useTranslations("common")
  const id = useId()
  const [innerOpen, setInnerOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [reason, setReason] = useState("")
  const open = controlledOpen ?? innerOpen
  const setOpen = (next: boolean) => {
    if (pending) return
    if (!next) setReason("")
    ;(onOpenChange ?? setInnerOpen)(next)
  }
  const blocked = requireReason && reason.trim() === ""
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children}
        <Field>
          <FieldLabel htmlFor={id}>
            {reasonLabel ?? t("reason")}
            {requireReason ? null : (
              <span className="font-normal text-muted-foreground"> {t("optionalNote")}</span>
            )}
          </FieldLabel>
          <Textarea
            id={id}
            value={reason}
            maxLength={200}
            placeholder={placeholder}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-20"
          />
          {reasonHint ? <FieldDescription>{reasonHint}</FieldDescription> : null}
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{dismissLabel ?? t("cancel")}</AlertDialogCancel>
          <Button
            variant={tone === "destructive" ? "destructive" : "default"}
            disabled={pending || blocked}
            onClick={async () => {
              setPending(true)
              const close = await onConfirm(reason.trim() === "" ? null : reason.trim())
              setPending(false)
              if (close) {
                setReason("")
                ;(onOpenChange ?? setInnerOpen)(false)
              }
            }}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
