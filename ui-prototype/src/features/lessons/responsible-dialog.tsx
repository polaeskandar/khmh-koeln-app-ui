"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { useServerAction } from "@/hooks/use-server-action"
import { setResponsibleAction } from "@/server/actions/learning"

export function ResponsibleDialog({
  lessonId,
  current,
  choices,
}: {
  lessonId: string
  current: string | null
  choices: { id: string; name: string; username: string }[]
}) {
  const t = useTranslations("access.lesson")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState(current ?? choices[0]?.id ?? "")
  const { execute, pending, fieldErrors } = useServerAction(setResponsibleAction, {
    onSuccess: () => setOpen(false),
  })

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t("change")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("responsibleTitle")}</DialogTitle>
            <DialogDescription>{t("responsibleDescription")}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="lesson-responsible">{t("responsible")}</FieldLabel>
            <NativeSelect
              id="lesson-responsible"
              className="w-full"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {choices.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {fieldErrors.responsibleId ? (
              <FieldError>{fieldErrors.responsibleId}</FieldError>
            ) : null}
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button disabled={pending || !accountId} onClick={() => execute(lessonId, accountId)}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
