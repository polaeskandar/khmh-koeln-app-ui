"use client"

/**
 * Account requests: people who registered themselves. Their accounts can't be
 * used until the office approves them — a parent by linking their children and
 * giving roles (Parent), a servant by giving roles and the groups they serve in, a member by linking the
 * account to their own member record (under 16 only with a parent's or
 * guardian's agreement). Declining deletes the account and everything the
 * person entered.
 */
import { useId, useMemo, useState } from "react"
import { Check, Layers, Plus, Search, UserRoundCheck, X } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { type ChosenGroup, GroupFields } from "@/features/assignments/group-choice"
import { useServerAction } from "@/hooks/use-server-action"
import { LOCALE_NAMES } from "@/i18n/config"
import { useFormat } from "@/i18n/format"
import { matchesQuery } from "@/lib/domain/names"
import { approveAccountAction, declineAccountAction } from "@/server/actions/accounts"
import type { AccountRequests as Data } from "@/server/queries/accounts"

type Request = Data["requests"][number]
type AgeCheck = "sixteenOrOlder" | "guardianConsent"

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

/** The member record with exactly the registered name, if there is one and only one without an account. */
function suggestedMember(request: Request, members: Data["members"]): string {
  const same = members.filter((m) => m.name.toLowerCase() === request.name.toLowerCase())
  return same.length === 1 && !same[0].hasAccount ? same[0].id : ""
}

function MemberApproval({
  request,
  candidates,
  personId,
  onPersonChange,
  ageCheck,
  onAgeCheckChange,
  note,
  onNoteChange,
  errors,
}: {
  request: Request
  candidates: Data["members"]
  personId: string
  onPersonChange: (id: string) => void
  ageCheck: AgeCheck | null
  onAgeCheckChange: (value: AgeCheck) => void
  note: string
  onNoteChange: (value: string) => void
  errors: Record<string, string | undefined>
}) {
  const t = useTranslations("accountRequests.approve")
  const noteId = useId()
  const [query, setQuery] = useState(request.name)
  const q = query.trim()
  const sameName = candidates.filter((c) => c.name.toLowerCase() === request.name.toLowerCase())
  const visible = useMemo(() => {
    const matching = q
      ? candidates.filter((c) => {
          const [firstName = "", ...rest] = c.name.split(" ")
          return (
            matchesQuery({ firstName, lastName: rest.join(" "), displayName: c.displayName }, q) ||
            c.groups.some((g) => g.toLowerCase().includes(q.toLowerCase()))
          )
        })
      : candidates.filter((c) => c.id === personId)
    return matching.slice(0, 30)
  }, [candidates, q, personId])
  return (
    <FieldGroup>
      <FieldSet data-invalid={errors.personId ? true : undefined}>
        <FieldLegend variant="label">{t("memberRecord")}</FieldLegend>
        <FieldDescription>
          {sameName.length > 1
            ? t("sameName", { count: sameName.length, name: request.name })
            : t("memberRecordHint", { name: request.name })}
        </FieldDescription>
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={t("findMember")}
            placeholder={t("findMember")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </InputGroup>
        <RadioGroup
          value={personId}
          onValueChange={onPersonChange}
          className="flex max-h-56 flex-col gap-0 overflow-y-auto border"
          aria-label={t("memberRecord")}
        >
          {visible.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              {q ? t("noMemberMatches") : t("searchMember")}
            </p>
          ) : (
            visible.map((c) => {
              const id = `member-${request.id}-${c.id}`
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0"
                >
                  <RadioGroupItem id={id} value={c.id} disabled={c.hasAccount} />
                  <label
                    htmlFor={id}
                    className={cn(
                      "flex min-w-0 flex-1 cursor-pointer flex-col text-sm",
                      c.hasAccount && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {[
                        c.groups.length > 0 ? c.groups.join(", ") : t("noGroup"),
                        c.hasAccount ? t("hasAccount") : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </label>
                </div>
              )
            })
          )}
        </RadioGroup>
        {errors.personId ? <FieldError>{errors.personId}</FieldError> : null}
      </FieldSet>
      <FieldSet data-invalid={errors.ageCheck ? true : undefined}>
        <FieldLegend variant="label">{t("age")}</FieldLegend>
        <FieldDescription>{t("ageHint")}</FieldDescription>
        <RadioGroup
          value={ageCheck ?? ""}
          onValueChange={(v) => onAgeCheckChange(v as AgeCheck)}
          className="grid gap-2"
        >
          {(["sixteenOrOlder", "guardianConsent"] as const).map((value) => (
            <FieldLabel
              key={value}
              className={cn(
                "flex w-full cursor-pointer items-start gap-3 border p-3 text-sm font-normal tracking-normal normal-case",
                ageCheck === value && "border-primary bg-primary/5"
              )}
            >
              <RadioGroupItem value={value} className="mt-0.5" />
              <span>{t(`ageCheck.${value}`)}</span>
            </FieldLabel>
          ))}
        </RadioGroup>
        {errors.ageCheck ? <FieldError>{errors.ageCheck}</FieldError> : null}
      </FieldSet>
      {ageCheck === "guardianConsent" ? (
        <Field data-invalid={errors.guardianConsentNote ? true : undefined}>
          <FieldLabel htmlFor={noteId}>{t("consentNote")}</FieldLabel>
          <Textarea
            id={noteId}
            rows={2}
            dir="auto"
            value={note}
            placeholder={t("consentNotePlaceholder")}
            onChange={(e) => onNoteChange(e.target.value)}
          />
          {errors.guardianConsentNote ? (
            <FieldError>{errors.guardianConsentNote}</FieldError>
          ) : null}
        </Field>
      ) : null}
    </FieldGroup>
  )
}

/**
 * The roles an approved account gets, at least one. Parents start with the roles that only open
 * the parent portal; for servants the office chooses, and chooses their groups below.
 */
function RolesChoice({
  roles,
  selected,
  onChange,
  error,
}: {
  roles: Data["roles"]
  selected: string[]
  onChange: (ids: string[]) => void
  error?: string
}) {
  const t = useTranslations("accountRequests.approve")
  const tp = useTranslations("permissions.resources")
  const f = useFormat()
  const id = useId()
  return (
    <FieldSet data-invalid={error ? true : undefined}>
      <FieldLegend variant="label">{t("roles")}</FieldLegend>
      <FieldDescription>{t("rolesHint")}</FieldDescription>
      <ul className="flex flex-col divide-y border-y">
        {roles.map((r) => {
          const checked = selected.includes(r.id)
          return (
            <li key={r.id}>
              <label
                htmlFor={`${id}-${r.id}`}
                className="flex cursor-pointer items-start gap-3 py-2.5 text-sm"
              >
                <Checkbox
                  id={`${id}-${r.id}`}
                  className="mt-0.5"
                  checked={checked}
                  onCheckedChange={(v) =>
                    onChange(v === true ? [...selected, r.id] : selected.filter((x) => x !== r.id))
                  }
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">
                    <bdi>{r.name}</bdi>
                  </span>
                  {r.resources.length > 0 ? (
                    <span className="text-xs text-pretty text-muted-foreground">
                      {f.list(r.resources.map((x) => tp(`${x}.name`)))}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  )
}

const sameGroup = (a: ChosenGroup, b: ChosenGroup) =>
  a.serviceId === b.serviceId && a.stageId === b.stageId

/**
 * Where an approved servant serves: services or stages, created with the approval. Roles for
 * assigned groups hold only there. Starts with the service they named when registering.
 */
function GroupsChoice({
  services,
  selected,
  onChange,
  errors,
}: {
  services: Data["groups"]
  selected: ChosenGroup[]
  onChange: (groups: ChosenGroup[]) => void
  errors: Record<string, string | undefined>
}) {
  const t = useTranslations("accountRequests.approve")
  const [draft, setDraft] = useState<ChosenGroup>({ serviceId: "", stageId: null })
  const nameOf = (g: ChosenGroup) => {
    const service = services.find((x) => x.id === g.serviceId)
    const stage = service?.stages.find((x) => x.id === g.stageId)
    return stage ? `${service?.name} · ${stage.name}` : (service?.name ?? "")
  }
  const add = () => {
    if (!draft.serviceId) return
    if (!selected.some((g) => sameGroup(g, draft))) onChange([...selected, draft])
    setDraft({ serviceId: "", stageId: null })
  }
  return (
    <FieldSet data-invalid={errors.serviceId || errors.stageId ? true : undefined}>
      <FieldLegend variant="label">{t("groups")}</FieldLegend>
      <FieldDescription>{t("groupsHint")}</FieldDescription>
      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((g) => (
            <li
              key={`${g.serviceId}-${g.stageId}`}
              className="inline-flex h-7 items-center gap-1.5 border border-dashed px-2 text-xs"
            >
              <Layers className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <bdi>{nameOf(g)}</bdi>
              <button
                type="button"
                className="-me-1 text-muted-foreground hover:text-foreground"
                aria-label={t("removeGroup", { group: nameOf(g) })}
                onClick={() => onChange(selected.filter((x) => !sameGroup(x, g)))}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noGroups")}</p>
      )}
      <div className="flex flex-col gap-3 border p-3">
        <GroupFields services={services} value={draft} onChange={setDraft} errors={errors} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={!draft.serviceId}
          onClick={add}
        >
          <Plus data-icon="inline-start" />
          {t("addGroup")}
        </Button>
      </div>
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
  const tc = useTranslations("common")
  const [childIds, setChildIds] = useState(() => suggestedChildren(request, data.children))
  const [personId, setPersonId] = useState(() => suggestedMember(request, data.members))
  const [ageCheck, setAgeCheck] = useState<AgeCheck | null>(null)
  const [note, setNote] = useState("")
  // Parents start with the roles that open the parent portal and nothing else.
  const [roleIds, setRoleIds] = useState(() =>
    request.as === "parent" ? data.roles.filter((r) => r.parent && !r.staff).map((r) => r.id) : []
  )
  const [groups, setGroups] = useState<ChosenGroup[]>(() =>
    request.service && data.groups.some((x) => x.id === request.service?.id)
      ? [{ serviceId: request.service.id, stageId: null }]
      : []
  )
  const approve = useServerAction(approveAccountAction, { onSuccess: () => onOpenChange(false) })
  const errors = approve.fieldErrors

  return (
    <Dialog open={open} onOpenChange={(next) => !approve.pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title", { name: request.name })}</DialogTitle>
          <DialogDescription>
            {request.as === "parent"
              ? t("parentDescription")
              : request.as === "member"
                ? t("memberDescription")
                : t("servantDescription")}
          </DialogDescription>
        </DialogHeader>
        {request.details ? (
          <blockquote
            dir="auto"
            className="border-s-2 ps-3 text-sm whitespace-pre-line text-muted-foreground"
          >
            {request.details}
          </blockquote>
        ) : null}
        <form
          id={`approve-${request.id}`}
          onSubmit={(e) => {
            e.preventDefault()
            approve.execute(
              request.id,
              request.as === "parent"
                ? { as: "parent", childIds, roleIds }
                : request.as === "member"
                  ? {
                      as: "member",
                      personId: personId || null,
                      ageCheck,
                      guardianConsentNote: ageCheck === "guardianConsent" ? note : null,
                    }
                  : { as: "servant", roleIds, assignments: groups }
            )
          }}
        >
          {request.as === "parent" ? (
            <FieldGroup>
              <ParentApproval
                request={request}
                candidates={data.children}
                selected={childIds}
                onChange={setChildIds}
                error={errors.childIds}
              />
              <RolesChoice
                roles={data.roles}
                selected={roleIds}
                onChange={setRoleIds}
                error={errors.roleIds}
              />
            </FieldGroup>
          ) : request.as === "member" ? (
            <MemberApproval
              request={request}
              candidates={data.members}
              personId={personId}
              onPersonChange={setPersonId}
              ageCheck={ageCheck}
              onAgeCheckChange={setAgeCheck}
              note={note}
              onNoteChange={setNote}
              errors={errors}
            />
          ) : (
            <FieldGroup>
              {request.service ? (
                <p className="text-sm text-muted-foreground">
                  {t("servesIn", { service: request.service.name })}
                </p>
              ) : null}
              <RolesChoice
                roles={data.roles}
                selected={roleIds}
                onChange={setRoleIds}
                error={errors.roleIds}
              />
              {data.groups.length > 0 ? (
                <GroupsChoice
                  services={data.groups}
                  selected={groups}
                  onChange={setGroups}
                  errors={errors}
                />
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
              approve.pending ||
              (request.as === "parent"
                ? childIds.length === 0 || roleIds.length === 0
                : request.as === "member"
                  ? !personId || !ageCheck
                  : roleIds.length === 0)
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
                    {r.as === "parent"
                      ? t("asParent")
                      : r.as === "member"
                        ? t("asMember")
                        : t("asServant")}
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
                {r.details ? (
                  <blockquote
                    dir="auto"
                    className="max-w-prose border-s-2 ps-3 text-sm whitespace-pre-line"
                  >
                    {r.details}
                  </blockquote>
                ) : null}
              </div>
            </div>
            {data.canDecide ? (
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
            ) : null}
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
