"use client"

/**
 * Account requests (administrators only): people who registered themselves.
 * Their accounts can't be used until an administrator approves them — a
 * parent by linking their children, a servant by giving them a role.
 * Declining deletes the account and everything the person entered.
 */
import { useId, useMemo, useState } from "react"
import { Check, Search, UserRoundCheck, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { MemberAvatar } from "@/components/member-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { LOCALE_NAMES } from "@/i18n/config"
import { useFormat } from "@/i18n/format"
import { matchesQuery } from "@/lib/domain/names"
import { approveAccountAction, declineAccountAction } from "@/server/actions/accounts"
import type { AccountRequests as Data } from "@/server/queries/accounts"

type Request = Data["requests"][number]

const initialsOf = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()

/** Children whose full name appears in what the parent wrote: a starting point, not a decision. */
function suggestedChildren(request: Request, children: Data["children"]): string[] {
  const text = request.details.toLowerCase()
  return children.filter((c) => text.includes(c.name.toLowerCase())).map((c) => c.id)
}

function ParentApproval({
  request,
  candidates,
  selected,
  onChange,
  error,
}: {
  request: Request
  candidates: Data["children"]
  selected: string[]
  onChange: (ids: string[]) => void
  error?: string
}) {
  const t = useTranslations("accountRequests.approve")
  const [query, setQuery] = useState("")
  const q = query.trim()
  const visible = useMemo(() => {
    const matching = q
      ? candidates.filter((c) => {
          const [firstName = "", ...rest] = c.name.split(" ")
          return (
            matchesQuery({ firstName, lastName: rest.join(" "), displayName: null }, q) ||
            c.group.toLowerCase().includes(q.toLowerCase())
          )
        })
      : candidates.filter((c) => selected.includes(c.id))
    return matching.slice(0, 30)
  }, [candidates, q, selected])
  const toggle = (id: string, on: boolean) =>
    onChange(on ? [...new Set([...selected, id])] : selected.filter((x) => x !== id))
  return (
    <FieldSet data-invalid={error ? true : undefined}>
      <FieldLegend variant="label">{t("children")}</FieldLegend>
      <FieldDescription>{t("childrenHint", { name: request.name })}</FieldDescription>
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={t("findChild")}
          placeholder={t("findChild")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InputGroup>
      <ul className="flex max-h-64 flex-col overflow-y-auto border" aria-live="polite">
        {visible.length === 0 ? (
          <li className="p-3 text-sm text-muted-foreground">
            {q ? t("noChildMatches") : t("searchToAdd")}
          </li>
        ) : (
          visible.map((c) => {
            const id = `child-${request.id}-${c.id}`
            return (
              <li key={c.id} className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
                <Checkbox
                  id={id}
                  checked={selected.includes(c.id)}
                  onCheckedChange={(v) => toggle(c.id, v === true)}
                />
                <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col text-sm">
                  <span className="truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.group}</span>
                </label>
              </li>
            )
          })
        )}
      </ul>
      <p className="text-xs text-muted-foreground">{t("selected", { count: selected.length })}</p>
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  )
}

function ApproveDialog({
  request,
  data,
  open,
  onOpenChange,
}: {
  request: Request
  data: Data
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("accountRequests.approve")
  const tr = useTranslations("roles")
  const tc = useTranslations("common")
  const ids = { service: useId(), stage: useId() }
  const [childIds, setChildIds] = useState(() => suggestedChildren(request, data.children))
  const [role, setRole] = useState<"servant" | "service_leader">("servant")
  const [serviceId, setServiceId] = useState(request.service?.id ?? "")
  const [stageId, setStageId] = useState("")
  const approve = useServerAction(approveAccountAction, { onSuccess: () => onOpenChange(false) })
  const stages = data.services.find((s) => s.id === serviceId)?.stages ?? []
  const errors = approve.fieldErrors

  return (
    <Dialog open={open} onOpenChange={(next) => !approve.pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title", { name: request.name })}</DialogTitle>
          <DialogDescription>
            {request.as === "parent" ? t("parentDescription") : t("servantDescription")}
          </DialogDescription>
        </DialogHeader>
        <blockquote
          dir="auto"
          className="border-s-2 ps-3 text-sm whitespace-pre-line text-muted-foreground"
        >
          {request.details}
        </blockquote>
        <form
          id={`approve-${request.id}`}
          onSubmit={(e) => {
            e.preventDefault()
            approve.execute(
              request.id,
              request.as === "parent"
                ? { as: "parent", childIds }
                : {
                    as: "servant",
                    role,
                    serviceId,
                    stageId: role === "servant" && stageId ? stageId : null,
                  }
            )
          }}
        >
          {request.as === "parent" ? (
            <ParentApproval
              request={request}
              candidates={data.children}
              selected={childIds}
              onChange={setChildIds}
              error={errors.childIds}
            />
          ) : (
            <FieldGroup>
              <FieldSet>
                <FieldLegend variant="label">{t("role")}</FieldLegend>
                <RadioGroup
                  value={role}
                  onValueChange={(v) => setRole(v as typeof role)}
                  className="grid gap-2"
                >
                  {(["servant", "service_leader"] as const).map((r) => (
                    <FieldLabel
                      key={r}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 border p-3 text-sm font-normal tracking-normal normal-case",
                        role === r && "border-primary bg-primary/5"
                      )}
                    >
                      <RadioGroupItem value={r} className="mt-0.5" />
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium">{tr(r)}</span>
                        <span className="text-xs text-muted-foreground">
                          {tr(`description.${r}`)}
                        </span>
                      </span>
                    </FieldLabel>
                  ))}
                </RadioGroup>
              </FieldSet>
              <Field data-invalid={errors.serviceId ? true : undefined}>
                <FieldLabel htmlFor={ids.service}>{t("service")}</FieldLabel>
                <NativeSelect
                  id={ids.service}
                  className="w-full"
                  value={serviceId}
                  onChange={(e) => {
                    setServiceId(e.target.value)
                    setStageId("")
                  }}
                >
                  <NativeSelectOption value="">{t("chooseService")}</NativeSelectOption>
                  {data.services.map((s) => (
                    <NativeSelectOption key={s.id} value={s.id}>
                      {s.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {errors.serviceId ? <FieldError>{errors.serviceId}</FieldError> : null}
              </Field>
              {role === "servant" && stages.length > 0 ? (
                <Field data-invalid={errors.stageId ? true : undefined}>
                  <FieldLabel htmlFor={ids.stage}>{t("stage")}</FieldLabel>
                  <NativeSelect
                    id={ids.stage}
                    className="w-full"
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value)}
                  >
                    <NativeSelectOption value="">{t("wholeService")}</NativeSelectOption>
                    {stages.map((s) => (
                      <NativeSelectOption key={s.id} value={s.id}>
                        {s.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>{t("stageHint")}</FieldDescription>
                  {errors.stageId ? <FieldError>{errors.stageId}</FieldError> : null}
                </Field>
              ) : null}
            </FieldGroup>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={approve.pending}>
            {tc("cancel")}
          </Button>
          <Button
            type="submit"
            form={`approve-${request.id}`}
            disabled={
              approve.pending || (request.as === "parent" ? childIds.length === 0 : !serviceId)
            }
          >
            {approve.pending ? <Spinner data-icon="inline-start" /> : null}
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AccountRequests({ data }: { data: Data }) {
  const t = useTranslations("accountRequests")
  const f = useFormat()
  const [approving, setApproving] = useState<Request | null>(null)
  const [declining, setDeclining] = useState<Request | null>(null)
  const decline = useServerAction(declineAccountAction)

  if (data.requests.length === 0) {
    return (
      <p className="flex items-center gap-2 border border-dashed p-4 text-sm text-muted-foreground">
        <UserRoundCheck className="size-4 shrink-0" aria-hidden="true" />
        {t("empty")}
      </p>
    )
  }

  return (
    <>
      <ul className="divide-y border-y">
        {data.requests.map((r) => (
          <li key={r.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-start">
            <div className="flex min-w-0 flex-1 gap-3">
              <MemberAvatar name={r.name} initials={initialsOf(r.name)} seed={r.id} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{r.name}</span>
                  <Badge variant="outline">
                    {r.as === "parent" ? t("asParent") : t("asServant")}
                  </Badge>
                  {r.service ? (
                    <span className="text-xs text-muted-foreground">{r.service.name}</span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  <bdi dir="ltr">{r.email}</bdi> ·{" "}
                  {t("registered", { when: f.atLabel(r.registeredAt, data.today) })}
                  {r.language ? <> · {LOCALE_NAMES[r.language]}</> : null}
                </p>
                <blockquote
                  dir="auto"
                  className="max-w-prose border-s-2 ps-3 text-sm whitespace-pre-line"
                >
                  {r.details}
                </blockquote>
              </div>
            </div>
            <div className="flex shrink-0 gap-2 md:pt-0.5">
              <Button size="sm" onClick={() => setApproving(r)}>
                <Check data-icon="inline-start" />
                {t("approveButton")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDeclining(r)}>
                <X data-icon="inline-start" />
                {t("declineButton")}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {approving ? (
        <ApproveDialog
          key={approving.id}
          request={approving}
          data={data}
          open
          onOpenChange={(open) => !open && setApproving(null)}
        />
      ) : null}

      <ConfirmDialog
        open={!!declining}
        onOpenChange={(open) => !open && setDeclining(null)}
        title={declining ? t("decline.title", { name: declining.name }) : ""}
        description={t("decline.description")}
        consequences={[t("decline.deleted"), t("decline.tell")]}
        confirmLabel={t("decline.confirm")}
        tone="destructive"
        onConfirm={async () => (declining ? (await decline.execute(declining.id)).ok : true)}
      />
    </>
  )
}
