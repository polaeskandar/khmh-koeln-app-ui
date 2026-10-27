"use client"

import { useMemo, useState } from "react"
import { ArrowRightLeft, Search, UserMinus, UserPlus } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { TextField } from "@/components/form-fields"
import { MemberAvatar } from "@/components/member-avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { useServerAction } from "@/hooks/use-server-action"
import { useFormat } from "@/i18n/format"
import { fold } from "@/lib/domain/names"
import {
  addMembershipAction,
  createPersonAction,
  endMembershipAction,
  moveMembershipAction,
} from "@/server/actions/people"
import type { DirectoryPerson } from "@/server/queries/members"

export type PlacementOption = {
  id: string
  name: string
  canManageServiceLevel: boolean
  stages: { id: string; name: string; canManageMembers: boolean }[]
}

/** Register a new person, placed in a service and optionally a stage. Warns about namesakes. */
export function NewPersonForm({
  services,
  fixed,
  onDone,
  onCancel,
}: {
  services: PlacementOption[]
  fixed?: { serviceId: string; stageId: string | null }
  onDone: () => void
  onCancel: () => void
}) {
  const t = useTranslations("members")
  const tc = useTranslations("common")
  const te = useTranslations("errors.people")
  const allowed = services.filter(
    (s) => s.canManageServiceLevel || s.stages.some((st) => st.canManageMembers)
  )
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [serviceId, setServiceId] = useState(fixed?.serviceId ?? allowed[0]?.id ?? "")
  const service = services.find((s) => s.id === serviceId)
  const stageChoices = service?.stages.filter((st) => st.canManageMembers) ?? []
  const [stageId, setStageId] = useState<string>(
    fixed?.stageId ?? (service?.canManageServiceLevel ? "" : (stageChoices[0]?.id ?? ""))
  )
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const create = useServerAction(createPersonAction, { onSuccess: onDone, toastOnSuccess: true })
  const submit = async (allowDuplicate: boolean) => {
    const result = await create.execute({
      firstName,
      lastName,
      displayName: displayName || null,
      serviceId: serviceId || null,
      stageId: stageId || null,
      allowDuplicate,
    })
    if (!result.ok && result.problem.status === 409)
      setDuplicateWarning(result.problem.detail ?? t("newPerson.duplicateFallback"))
  }
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        setDuplicateWarning(null)
        submit(false)
      }}
    >
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t("fields.firstName")}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            maxLength={80}
            autoFocus
            error={create.fieldErrors.firstName}
          />
          <TextField
            label={t("fields.lastName")}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            maxLength={80}
            error={create.fieldErrors.lastName}
          />
        </div>
        <TextField
          label={t("fields.displayName")}
          optional
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={120}
          description={t("fields.displayNameHint")}
          error={create.fieldErrors.displayName}
        />
        {fixed ? null : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={create.fieldErrors.serviceId ? true : undefined}>
              <FieldLabel htmlFor="person-service">{t("service")}</FieldLabel>
              <NativeSelect
                id="person-service"
                className="w-full"
                value={serviceId}
                onChange={(e) => {
                  const next = services.find((s) => s.id === e.target.value)
                  setServiceId(e.target.value)
                  setStageId(
                    next?.canManageServiceLevel
                      ? ""
                      : (next?.stages.find((st) => st.canManageMembers)?.id ?? "")
                  )
                }}
              >
                {allowed.map((s) => (
                  <NativeSelectOption key={s.id} value={s.id}>
                    {s.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {create.fieldErrors.serviceId ? (
                <FieldError>{create.fieldErrors.serviceId}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={create.fieldErrors.stageId ? true : undefined}>
              <FieldLabel htmlFor="person-stage">{t("stage")}</FieldLabel>
              <NativeSelect
                id="person-stage"
                className="w-full"
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
              >
                {service?.canManageServiceLevel ? (
                  <NativeSelectOption value="">{t("fields.noStage")}</NativeSelectOption>
                ) : null}
                {stageChoices.map((st) => (
                  <NativeSelectOption key={st.id} value={st.id}>
                    {st.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {create.fieldErrors.stageId ? (
                <FieldError>{create.fieldErrors.stageId}</FieldError>
              ) : null}
            </Field>
          </div>
        )}
      </FieldGroup>
      {duplicateWarning ? (
        <Alert>
          <UserPlus />
          <AlertTitle>{te("duplicateTitle")}</AlertTitle>
          <AlertDescription>
            {duplicateWarning} {t("newPerson.duplicateHint")}
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => submit(true)}
                disabled={create.pending}
              >
                {t("newPerson.addAnyway")}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={create.pending}>
          {create.pending ? <Spinner data-icon="inline-start" /> : null}
          {t("addPerson")}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Add someone to a stage: pick an existing person, or register a new one. */
export function AddMemberDialog({
  serviceId,
  stageId,
  stageName,
  people,
  services,
}: {
  serviceId: string
  stageId: string | null
  stageName: string
  people: DirectoryPerson[]
  services: PlacementOption[]
}) {
  const t = useTranslations("members")
  const tc = useTranslations("common")
  const f = useFormat()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"find" | "new">("find")
  const [query, setQuery] = useState("")
  const add = useServerAction(addMembershipAction)
  const candidates = useMemo(() => {
    const q = fold(query)
    if (q.length < 2) return []
    return people
      .filter(
        (p) => !p.placements.some((pl) => pl.serviceId === serviceId && pl.stageId === stageId)
      )
      .filter((p) => fold(`${p.firstName} ${p.lastName} ${p.displayName ?? ""}`).includes(q))
      .slice(0, 8)
  }, [people, query, serviceId, stageId])
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setMode("find")
          setQuery("")
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus data-icon="inline-start" />
          {t("addMember.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("addMember.title", { stage: stageName })}</DialogTitle>
          <DialogDescription>
            {mode === "find"
              ? t("addMember.searchFirst")
              : t("addMember.registerNew", { stage: stageName })}
          </DialogDescription>
        </DialogHeader>
        {mode === "find" ? (
          <div className="flex flex-col gap-4">
            <InputGroup>
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                autoFocus
                placeholder={t("addMember.typeName")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={t("search")}
              />
            </InputGroup>
            <ul className="flex min-h-24 flex-col divide-y">
              {query.length < 2 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  {t("addMember.typeTwoLetters")}
                </li>
              ) : candidates.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  {t("addMember.nobodyFound")}
                </li>
              ) : (
                candidates.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <MemberAvatar name={p.name} initials={p.initials} seed={p.id} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{p.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {p.placements.length
                          ? p.placements.map((pl) => pl.label).join(f.locale === "ar" ? "، " : ", ")
                          : t("addMember.notInAnyService")}
                      </span>
                    </span>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={add.pending}
                      onClick={async () => {
                        const r = await add.execute(p.id, serviceId, stageId)
                        if (r.ok) setOpen(false)
                      }}
                    >
                      {t("addMember.add")}
                    </Button>
                  </li>
                ))
              )}
            </ul>
            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" size="sm" onClick={() => setMode("new")}>
                <UserPlus data-icon="inline-start" />
                {t("addMember.registerPerson")}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {tc("close")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <NewPersonForm
            services={services}
            fixed={{ serviceId, stageId }}
            onDone={() => setOpen(false)}
            onCancel={() => setMode("find")}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Move to another stage of the service, or remove from this one. History stays. */
export function MembershipMenu({
  membershipId,
  personName,
  where,
  otherStages,
}: {
  membershipId: string
  personName: string
  where: string
  otherStages: { id: string; name: string }[]
}) {
  const t = useTranslations("members.membership")
  const [confirm, setConfirm] = useState(false)
  const move = useServerAction(moveMembershipAction)
  const end = useServerAction(endMembershipAction)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("change", { name: personName })}>
            <ArrowRightLeft className="rtl:-scale-x-100" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {otherStages.length > 0 ? (
            <>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {t("moveFromToday")}
              </DropdownMenuLabel>
              {otherStages.map((st) => (
                <DropdownMenuItem key={st.id} onSelect={() => move.execute(membershipId, st.id)}>
                  {st.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
            <UserMinus />
            {t("removeFrom", { where })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("removeTitle", { name: personName, where })}
        description={t("removeDescription")}
        confirmLabel={t("remove")}
        tone="destructive"
        onConfirm={async () => (await end.execute(membershipId)).ok}
      />
    </>
  )
}
