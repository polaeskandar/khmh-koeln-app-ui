"use client"

/**
 * Accounts and their roles. Adapted from the shadcnblocks "settings-members2" block (member list
 * with role chips and an invite dialog). Roles hold everywhere in the church, so giving one is
 * choosing it, nothing more; the dialog offers the roles the account doesn't have yet.
 */
import { useState } from "react"
import Link from "next/link"
import { Plus, X } from "lucide-react"
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
import { useServerAction } from "@/hooks/use-server-action"
import { giveRoleAction, removeRoleAction } from "@/server/actions/roles"
import type { AssignableRole } from "@/server/queries/roles"
import type { StaffAccount } from "@/server/queries/settings"

type RoleChip = StaffAccount["roles"][number]

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
  canGive,
}: {
  users: StaffAccount[]
  roles: AssignableRole[]
  canGive: boolean
}) {
  const t = useTranslations("settings.users")
  const tc = useTranslations("common")
  const [giveTo, setGiveTo] = useState<StaffAccount | null>(null)
  const [removing, setRemoving] = useState<{ user: StaffAccount; role: RoleChip } | null>(null)
  const remove = useServerAction(removeRoleAction)
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
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 ps-11 sm:ps-0">
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
            {canGive && roles.some((r) => !u.roles.some((x) => x.id === r.id)) ? (
              <Button
                variant="ghost"
                size="sm"
                className="self-start sm:self-center"
                onClick={() => setGiveTo(u)}
              >
                <Plus data-icon="inline-start" />
                {t("addRole")}
              </Button>
            ) : null}
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
