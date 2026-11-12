"use client"

import { useMemo, useState } from "react"
import { Link2, Plus, Search, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { ConfirmDialog } from "@/components/confirm-dialog"
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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ScopePicker, type ScopeChoice } from "@/features/accounts/scope-picker"
import { useServerAction } from "@/hooks/use-server-action"
import { fold } from "@/lib/domain/names"
import type { Scope } from "@/lib/domain/types"
import { linkChildAction, unlinkChildAction } from "@/server/actions/accounts"
import { assignRoleAction, removeAssignmentAction } from "@/server/actions/access"

type Option = { id: string; name: string; username?: string; groups?: string[] }

function Picker({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string
  options: Option[]
  value: string | null
  onChange: (id: string) => void
  placeholder: string
}) {
  const [query, setQuery] = useState("")
  const shown = useMemo(
    () =>
      options
        .filter((o) => fold(`${o.name} ${o.username ?? ""}`).includes(fold(query)))
        .slice(0, 6),
    [options, query]
  )
  const selected = options.find((o) => o.id === value)

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {selected ? (
        <div className="flex items-center justify-between border border-primary bg-primary/5 px-3 py-2 text-sm">
          <span>
            <span className="font-medium">{selected.name}</span>
            {selected.username ? (
              <span className="text-muted-foreground" dir="ltr">
                {" "}
                · {selected.username}
              </span>
            ) : null}
          </span>
          <Button variant="ghost" size="icon-xs" aria-label={label} onClick={() => onChange("")}>
            <X />
          </Button>
        </div>
      ) : (
        <>
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={label}
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
          <ul className="divide-y border">
            {shown.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="flex w-full flex-col px-3 py-2 text-start text-sm hover:bg-muted/50"
                  onClick={() => onChange(o.id)}
                >
                  <span className="font-medium">{o.name}</span>
                  <span
                    className="text-xs text-muted-foreground"
                    dir={o.username ? "ltr" : undefined}
                  >
                    {o.username ?? o.groups?.join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function AssignRoleDialog({
  accounts,
  roles,
  scopes,
  fixedAccount,
}: {
  accounts: Option[]
  roles: { id: string; name: string; churchOnly: boolean; giveable: boolean }[]
  scopes: ScopeChoice[]
  fixedAccount?: Option
}) {
  const t = useTranslations("access.assign")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState<string | null>(fixedAccount?.id ?? null)
  const giveable = roles.filter((r) => r.giveable)
  const [roleId, setRoleId] = useState(giveable[0]?.id ?? "")
  const role = roles.find((r) => r.id === roleId)
  const [scope, setScope] = useState<Scope>({ type: "church" })
  const { execute, pending, fieldErrors } = useServerAction(assignRoleAction, {
    onSuccess: () => setOpen(false),
  })
  const effectiveScope: Scope = role?.churchOnly ? { type: "church" } : scope

  return (
    <>
      <Button
        onClick={() => {
          setAccountId(fixedAccount?.id ?? null)
          setScope(
            scopes[0] ? { type: "service", serviceId: scopes[0].serviceId } : { type: "church" }
          )
          setOpen(true)
        }}
        variant={fixedAccount ? "outline" : "default"}
        size={fixedAccount ? "sm" : "default"}
      >
        <Plus data-icon="inline-start" />
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5">
            {fixedAccount ? null : (
              <Picker
                label={t("person")}
                options={accounts}
                value={accountId}
                onChange={(id) => setAccountId(id || null)}
                placeholder={t("searchPerson")}
              />
            )}
            <Field>
              <FieldLabel htmlFor="assign-role">{t("role")}</FieldLabel>
              <NativeSelect
                id="assign-role"
                className="w-full"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                {giveable.map((r) => (
                  <NativeSelectOption key={r.id} value={r.id}>
                    {r.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <ScopePicker
              label={t("where")}
              scopes={scopes}
              value={effectiveScope}
              onChange={setScope}
              allowChurch
              churchOnly={role?.churchOnly}
            />
            {role?.churchOnly ? (
              <p className="text-xs text-muted-foreground">{t("churchOnly")}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t("scopeHint")}</p>
            )}
            {fieldErrors.scope ? <FieldError>{fieldErrors.scope}</FieldError> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={pending || !accountId || !roleId}
              onClick={() => execute(accountId!, roleId, effectiveScope)}
            >
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function AssignmentChip({
  id,
  role,
  where,
  removable,
}: {
  id: string
  role: string
  where: string | null
  removable: boolean
}) {
  const t = useTranslations("access.assignments")
  const { execute } = useServerAction(removeAssignmentAction)
  const label = where ? `${role} · ${where}` : role

  return (
    <li
      className={cn(
        "flex items-center gap-1 border py-1 ps-3 text-sm",
        removable ? "pe-1" : "pe-3"
      )}
    >
      <span className="font-medium">{role}</span>
      <span className="text-muted-foreground">· {where ?? t("wholeChurch")}</span>
      {removable ? (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-xs" aria-label={t("remove", { assignment: label })}>
              <X />
            </Button>
          }
          title={t("removeTitle", { assignment: label })}
          description={t("removeHint")}
          confirmLabel={t("removeConfirm")}
          tone="destructive"
          onConfirm={async () => (await execute(id)).ok}
        />
      ) : null}
    </li>
  )
}

export function LinkChildDialog({
  parents,
  candidates,
}: {
  parents: Option[]
  candidates: Option[]
}) {
  const t = useTranslations("access.parents")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [parentId, setParentId] = useState<string | null>(null)
  const [memberId, setMemberId] = useState<string | null>(null)
  const { execute, pending } = useServerAction(linkChildAction, { onSuccess: () => setOpen(false) })

  return (
    <>
      <Button
        onClick={() => {
          setParentId(null)
          setMemberId(null)
          setOpen(true)
        }}
      >
        <Link2 data-icon="inline-start" />
        {t("link")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("linkTitle")}</DialogTitle>
            <DialogDescription>{t("linkHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5">
            <Picker
              label={t("parent")}
              options={parents}
              value={parentId}
              onChange={(id) => setParentId(id || null)}
              placeholder={t("searchParent")}
            />
            <Picker
              label={t("member")}
              options={candidates}
              value={memberId}
              onChange={(id) => setMemberId(id || null)}
              placeholder={t("searchMember")}
            />
            <p className="text-xs text-muted-foreground">{t("membersOnly")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={pending || !parentId || !memberId}
              onClick={() => execute(parentId!, memberId!)}
            >
              {t("link")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function ChildChip({
  guardianshipId,
  name,
  groups,
}: {
  guardianshipId: string
  name: string
  groups: string[]
}) {
  const t = useTranslations("access.parents")
  const unlink = useServerAction(unlinkChildAction)

  return (
    <li className="flex items-center gap-1 border py-1 ps-3 pe-1 text-sm">
      <span className="flex flex-col leading-tight">
        <span className="font-medium">{name}</span>
        <span className="text-xs text-muted-foreground">{groups.join(" · ") || t("noGroup")}</span>
      </span>
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="icon-xs" aria-label={t("unlink", { name })}>
            <X />
          </Button>
        }
        title={t("unlinkTitle", { name })}
        description={t("unlinkHint")}
        confirmLabel={t("unlinkConfirm")}
        tone="destructive"
        onConfirm={async () => (await unlink.execute(guardianshipId)).ok}
      />
    </li>
  )
}
