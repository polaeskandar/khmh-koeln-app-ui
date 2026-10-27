"use client"

import { useId, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { TextAreaField, TextField } from "@/components/form-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { useServerAction } from "@/hooks/use-server-action"
import { fold } from "@/lib/domain/names"
import { recordDataRequestAction } from "@/server/actions/privacy"
import type { DataRequestsPage } from "@/server/queries/privacy"

type Kind = "erasure" | "copy"
type About = "member" | "account"
type Channel = "email" | "letter" | "in_person"

/** The office records a data protection request that came by email, letter or in person. */
export function RecordRequestDialog({ data }: { data: DataRequestsPage }) {
  const t = useTranslations("privacy.record")
  const tch = useTranslations("privacy.channel")
  const tc = useTranslations("common")
  const router = useRouter()
  const ids = { channel: useId(), list: useId() }
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>("erasure")
  const [about, setAbout] = useState<About>("member")
  const [query, setQuery] = useState("")
  const [subjectId, setSubjectId] = useState("")
  const [requestedBy, setRequestedBy] = useState("")
  const [channel, setChannel] = useState<Channel>("email")
  const [receivedOn, setReceivedOn] = useState(data.today)
  const [note, setNote] = useState("")
  const record = useServerAction(recordDataRequestAction, {
    onSuccess: (id) => {
      setOpen(false)
      router.push(`/settings/data-requests/${id}`)
    },
  })
  const errors = record.fieldErrors

  const options = useMemo(() => {
    const words = fold(query).split(" ").filter(Boolean)
    const list =
      about === "member"
        ? data.people.map((p) => ({ id: p.id, title: p.name, hint: p.group }))
        : data.accounts.map((a) => ({ id: a.id, title: a.name, hint: a.email }))
    const matching = words.length
      ? list.filter((o) => words.every((w) => fold(`${o.title} ${o.hint ?? ""}`).includes(w)))
      : list.filter((o) => o.id === subjectId)
    return matching.slice(0, 20)
  }, [about, data.accounts, data.people, query, subjectId])

  const reset = () => {
    setKind("erasure")
    setAbout("member")
    setQuery("")
    setSubjectId("")
    setRequestedBy("")
    setChannel("email")
    setReceivedOn(data.today)
    setNote("")
    record.reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (record.pending) return
        if (!next) reset()
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          {t("open")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form
          id="record-data-request"
          className="grid gap-x-8 gap-y-6 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            record.execute({
              kind,
              personId: about === "member" && subjectId ? subjectId : null,
              userId: about === "account" && subjectId ? subjectId : null,
              requestedBy,
              channel,
              receivedOn,
              note: note.trim() || null,
            })
          }}
        >
          <FieldGroup>
            <FieldSet>
              <FieldLegend>{t("kind")}</FieldLegend>
              <RadioGroup
                value={kind}
                onValueChange={(v) => setKind(v as Kind)}
                className="grid gap-2"
              >
                {(["erasure", "copy"] as const).map((k) => (
                  <FieldLabel
                    key={k}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 border p-3 text-sm font-normal tracking-normal normal-case",
                      kind === k && "border-primary bg-primary/5"
                    )}
                  >
                    <RadioGroupItem value={k} className="mt-0.5" />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{t(`kinds.${k}`)}</span>
                      <span className="text-xs text-muted-foreground">{t(`kinds.${k}Hint`)}</span>
                    </span>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>
            <TextField
              label={t("requestedBy")}
              placeholder={t("requestedByPlaceholder")}
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              error={errors.requestedBy}
            />
            <div className="grid gap-6 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={ids.channel}>{t("channel")}</FieldLabel>
                <NativeSelect
                  id={ids.channel}
                  className="w-full"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as Channel)}
                >
                  {(["email", "letter", "in_person"] as const).map((c) => (
                    <NativeSelectOption key={c} value={c}>
                      {tch(c)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <TextField
                label={t("receivedOn")}
                type="date"
                max={data.today}
                value={receivedOn}
                onChange={(e) => setReceivedOn(e.target.value)}
                error={errors.receivedOn}
              />
            </div>
          </FieldGroup>

          <FieldGroup>
            <FieldSet data-invalid={errors.subject ? true : undefined}>
              <FieldLegend>{t("about")}</FieldLegend>
              <RadioGroup
                value={about}
                onValueChange={(v) => {
                  setAbout(v as About)
                  setSubjectId("")
                  setQuery("")
                }}
                className="flex gap-6"
              >
                {(["member", "account"] as const).map((a) => (
                  <FieldLabel
                    key={a}
                    className="flex cursor-pointer items-center gap-2 text-sm font-normal tracking-normal normal-case"
                  >
                    <RadioGroupItem value={a} />
                    {t(`abouts.${a}`)}
                  </FieldLabel>
                ))}
              </RadioGroup>
              <InputGroup>
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  aria-label={about === "member" ? t("findMember") : t("findAccount")}
                  aria-controls={ids.list}
                  placeholder={about === "member" ? t("findMember") : t("findAccount")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </InputGroup>
              <RadioGroup
                id={ids.list}
                value={subjectId}
                onValueChange={setSubjectId}
                className="flex max-h-56 flex-col gap-0 overflow-y-auto border"
              >
                {options.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    {query.trim() ? t("noMatches") : t("searchHint")}
                  </p>
                ) : (
                  options.map((o) => (
                    <FieldLabel
                      key={o.id}
                      className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm font-normal tracking-normal normal-case last:border-b-0"
                    >
                      <RadioGroupItem value={o.id} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">{o.title}</span>
                        {o.hint ? (
                          <span className="truncate text-xs text-muted-foreground">
                            <bdi>{o.hint}</bdi>
                          </span>
                        ) : null}
                      </span>
                    </FieldLabel>
                  ))
                )}
              </RadioGroup>
              <FieldDescription>{t("aboutHint")}</FieldDescription>
              {errors.subject ? <FieldError>{errors.subject}</FieldError> : null}
            </FieldSet>
            <TextAreaField
              label={t("note")}
              optional
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              description={t("noteHint")}
              error={errors.note}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={record.pending}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="record-data-request" disabled={record.pending}>
            {record.pending ? <Spinner data-icon="inline-start" /> : null}
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
