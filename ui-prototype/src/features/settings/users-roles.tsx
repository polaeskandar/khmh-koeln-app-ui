"use client"

/**
 * Accounts, their roles and the groups they serve in. Adapted from the shadcnblocks
 * "settings-members2" block (member list with role chips and an invite dialog). The role dialog
 * offers the roles the account doesn't have yet. Roles for assigned groups hold only in the
 * account's groups: a service covers its own roster and all its stages, a stage that stage.
 */
import { useState } from "react"
import Link from "next/link"
import { Layers, Plus, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { MemberAvatar } from "@/components/member-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { AssignGroupDialog, type GroupOption } from "@/features/assignments/group-choice"
import { useServerAction } from "@/hooks/use-server-action"
import { removeAssignmentAction } from "@/server/actions/accounts"
import { giveRoleAction, removeRoleAction } from "@/server/actions/roles"
import type { AssignableRole } from "@/server/queries/roles"
import type { StaffAccount } from "@/server/queries/settings"

type RoleChip = StaffAccount["roles"][number]
type GroupChip = StaffAccount["groups"][number]

function GiveRoleDialog({
  user,
  roles,
  open,
  onOpenChange,
}: {
  user: StaffAccount
  roles: AssignableRole[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("settings.users.assign")
  const tc = useTranslations("common")
  const available = roles.filter((r) => !user.roles.some((x) => x.id === r.id))
  // Nothing chosen at first: the first role in the list may well be the administrator's.
  const [roleId, setRoleId] = useState("")
  const give = useServerAction(giveRoleAction, { onSuccess: () => onOpenChange(false) })
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) give.reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { name: user.name })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form
          id="give-role"
          onSubmit={(e) => {
            e.preventDefault()
            give.execute(user.id, roleId)
          }}
        >
          <FieldGroup>
            <Field data-invalid={give.fieldErrors.roleId ? true : undefined}>
              <FieldLabel htmlFor="role">{t("role")}</FieldLabel>
              <NativeSelect
                id="role"
                className="w-full"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                <NativeSelectOption value="" disabled>
                  {t("choose")}
                </NativeSelectOption>
                {available.map((r) => (
                  <NativeSelectOption key={r.id} value={r.id}>
                    {r.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>
                {t.rich("roleHint", {
                  link: (chunks) => (
                    <Link
                      href="/settings#roles"
                      className="underline underline-offset-4"
                      onClick={() => onOpenChange(false)}
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </FieldDescription>
              {give.fieldErrors.roleId ? <FieldError>{give.fieldErrors.roleId}</FieldError> : null}
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={give.pending}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="give-role" disabled={give.pending || !roleId}>
            {give.pending ? <Spinner data-icon="inline-start" /> : null}
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UsersRoles({
  users,
  roles,
  groups,
  canGive,
}: {
  users: StaffAccount[]
  roles: AssignableRole[]
  /** The services the viewer may assign accounts to; empty when it may assign nowhere. */
  groups: GroupOption[]
  canGive: boolean
}) {
  const t = useTranslations("settings.users")
  const ta = useTranslations("assignments")
  const tc = useTranslations("common")
  const [giveTo, setGiveTo] = useState<StaffAccount | null>(null)
  const [assignTo, setAssignTo] = useState<StaffAccount | null>(null)
  const [removing, setRemoving] = useState<{ user: StaffAccount; role: RoleChip } | null>(null)
  const [leaving, setLeaving] = useState<{ user: StaffAccount; group: GroupChip } | null>(null)
  const remove = useServerAction(removeRoleAction)
  const removeGroup = useServerAction(removeAssignmentAction)
  return (
    <>
      <ul className="divide-y border-y">
        {users.map((u) => (
          <li key={u.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
            <span className="flex min-w-0 items-center gap-3 sm:w-72">
              <MemberAvatar name={u.name} initials={u.initials} seed={u.id} />
              <span className="flex min-w-0 flex-col">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{u.name}</span>
                  {u.disabled ? <Badge variant="outline">{tc("disabled")}</Badge> : null}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  <bdi dir="ltr">{u.email}</bdi>
                </span>
              </span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5 ps-11 sm:ps-0">
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                {u.roles.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex h-7 items-center gap-1.5 border px-2 text-xs"
                  >
                    <bdi>{r.name}</bdi>
                    {canGive ? (
                      <button
                        type="button"
                        className="-me-1 text-muted-foreground hover:text-foreground"
                        aria-label={t("removeRoleLabel", { role: r.name, name: u.name })}
                        onClick={() => setRemoving({ user: u, role: r })}
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                  </span>
                ))}
              </span>
              {u.groups.length > 0 ? (
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {u.groups.map((g) => (
                    <span
                      key={g.id}
                      className="inline-flex h-7 items-center gap-1.5 border border-dashed px-2 text-xs text-muted-foreground"
                    >
                      <Layers className="size-3.5 shrink-0" aria-hidden="true" />
                      <bdi>{g.name}</bdi>
                      {g.canRemove ? (
                        <button
                          type="button"
                          className="-me-1 hover:text-foreground"
                          aria-label={ta("removeLabel", { name: u.name, where: g.name })}
                          onClick={() => setLeaving({ user: u, group: g })}
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                    </span>
                  ))}
                </span>
              ) : u.needsGroups && !u.disabled ? (
                <span className="text-xs text-muted-foreground">{t("noGroups")}</span>
              ) : null}
            </span>
            <span className="flex gap-1 self-start sm:self-center">
              {canGive && roles.some((r) => !u.roles.some((x) => x.id === r.id)) ? (
                <Button variant="ghost" size="sm" onClick={() => setGiveTo(u)}>
                  <Plus data-icon="inline-start" />
                  {t("addRole")}
                </Button>
              ) : null}
              {groups.length > 0 && !u.disabled ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("addGroupLabel", { name: u.name })}
                  onClick={() => setAssignTo(u)}
                >
                  <Plus data-icon="inline-start" />
                  {t("addGroup")}
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {giveTo ? (
        <GiveRoleDialog
          key={giveTo.id}
          user={giveTo}
          roles={roles}
          open
          onOpenChange={(open) => !open && setGiveTo(null)}
        />
      ) : null}
      {assignTo ? (
        <AssignGroupDialog
          key={assignTo.id}
          user={assignTo}
          services={groups}
          open
          onOpenChange={(open) => !open && setAssignTo(null)}
        />
      ) : null}
      <ConfirmDialog
        open={!!leaving}
        onOpenChange={(open) => !open && setLeaving(null)}
        title={
          leaving ? ta("removeTitle", { name: leaving.user.name, where: leaving.group.name }) : ""
        }
        description={ta("removeDescription")}
        tone="destructive"
        confirmLabel={ta("remove")}
        onConfirm={async () => (leaving ? (await removeGroup.execute(leaving.group.id)).ok : true)}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={
          removing ? t("removeTitle", { role: removing.role.name, name: removing.user.name }) : ""
        }
        description={t("removeDescription")}
        tone="destructive"
        confirmLabel={t("remove")}
        onConfirm={async () =>
          removing ? (await remove.execute(removing.user.id, removing.role.id)).ok : true
        }
      />
    </>
  )
}
