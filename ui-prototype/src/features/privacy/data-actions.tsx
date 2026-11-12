"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCheck, Eraser, FilePlus2, XCircle } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog, ReasonDialog } from "@/components/confirm-dialog"
import { TextAreaField, TextField } from "@/components/form-fields"
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
import {
  completeCopyAction,
  declineRequestAction,
  eraseAction,
  recordRequestAction,
} from "@/server/actions/privacy"

export function RecordRequestDialog({
  people,
}: {
  people: { id: string; name: string; groups: string[] }[]
}) {
  const t = useTranslations("data.record")
  const tc = useTranslations("common")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<"copy" | "erasure">("copy")
  const [personId, setPersonId] = useState(people[0]?.id ?? "")
  const [requestedBy, setRequestedBy] = useState("")
  const [channel, setChannel] = useState<"letter" | "in_person">("in_person")
  const [note, setNote] = useState("")
  const { execute, pending, fieldErrors } = useServerAction(recordRequestAction, {
    onSuccess: (id) => router.push(`/admin/data/${id}`),
  })

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <FilePlus2 data-icon="inline-start" />
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="request-kind">{t("kind")}</FieldLabel>
              <NativeSelect
                id="request-kind"
                className="w-full"
                value={kind}
                onChange={(e) => setKind(e.target.value as "copy" | "erasure")}
              >
                <NativeSelectOption value="copy">{t("kinds.copy")}</NativeSelectOption>
                <NativeSelectOption value="erasure">{t("kinds.erasure")}</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="request-person">{t("person")}</FieldLabel>
              <NativeSelect
                id="request-person"
                className="w-full"
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
              >
                {people.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>
                    {p.groups.length > 0 ? `${p.name} (${p.groups.join(", ")})` : p.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {fieldErrors.personId ? <FieldError>{fieldErrors.personId}</FieldError> : null}
            </Field>
            <TextField
              label={t("requestedBy")}
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              error={fieldErrors.requestedBy}
              placeholder={t("requestedByPlaceholder")}
            />
            <Field>
              <FieldLabel htmlFor="request-channel">{t("channel")}</FieldLabel>
              <NativeSelect
                id="request-channel"
                className="w-full"
                value={channel}
                onChange={(e) => setChannel(e.target.value as "letter" | "in_person")}
              >
                <NativeSelectOption value="in_person">{t("channels.in_person")}</NativeSelectOption>
                <NativeSelectOption value="letter">{t("channels.letter")}</NativeSelectOption>
              </NativeSelect>
            </Field>
            <TextAreaField
              label={t("note")}
              optional
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              error={fieldErrors.note}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={pending}
              onClick={() => execute({ kind, personId, requestedBy, channel, note: note || null })}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function RequestActions({
  requestId,
  kind,
  name,
  impact,
  self,
}: {
  requestId: string
  kind: "copy" | "erasure"
  name: string
  impact: string[]
  self: boolean
}) {
  const t = useTranslations("data.actions")
  const complete = useServerAction(completeCopyAction)
  const erase = useServerAction(eraseAction)
  const decline = useServerAction(declineRequestAction)

  return (
    <div className="flex flex-wrap gap-2">
      {kind === "copy" ? (
        <>
          <Button asChild variant="outline">
            <a href={`/admin/data/${requestId}/copy`} download>
              {t("download")}
            </a>
          </Button>
          <Button onClick={() => complete.execute(requestId)} disabled={complete.pending}>
            <CheckCheck data-icon="inline-start" />
            {t("handedOver")}
          </Button>
        </>
      ) : (
        <ConfirmDialog
          trigger={
            <Button variant="destructive" disabled={self}>
              <Eraser data-icon="inline-start" />
              {t("erase")}
            </Button>
          }
          title={t("eraseTitle", { name })}
          description={t("eraseHint")}
          consequences={impact}
          confirmLabel={t("erase")}
          tone="destructive"
          onConfirm={async () => (await erase.execute(requestId)).ok}
        />
      )}
      <ReasonDialog
        trigger={
          <Button variant="ghost">
            <XCircle data-icon="inline-start" />
            {t("decline")}
          </Button>
        }
        title={t("declineTitle")}
        description={t("declineHint")}
        reasonLabel={t("declineReason")}
        requireReason
        confirmLabel={t("decline")}
        onConfirm={async (reason) => (await decline.execute(requestId, reason ?? "")).ok}
      />
    </div>
  )
}
