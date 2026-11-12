"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { FormPanel } from "@/components/form-panel"
import { TextField } from "@/components/form-fields"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { useServerAction } from "@/hooks/use-server-action"
import { needsChurchScope, PERMISSION_GROUPS, permissionKey } from "@/lib/domain/policy"
import type { Permission } from "@/lib/domain/types"
import { createRoleAction, deleteRoleAction, updateRoleAction } from "@/server/actions/access"

export function RoleEditor({
  role,
}: {
  role: {
    id: string
    name: string
    permissions: Permission[]
    protected: boolean
    holders: unknown[]
  } | null
}) {
  const t = useTranslations("access.editor")
  const tp = useTranslations("permissions")
  const tc = useTranslations("common")
  const router = useRouter()
  const [name, setName] = useState(role?.name ?? "")
  const [permissions, setPermissions] = useState(new Set<Permission>(role?.permissions ?? []))
  const back = () => router.push("/admin/access")
  const create = useServerAction(createRoleAction, {
    onSuccess: (id) => router.push(`/admin/access/roles/${id}`),
  })
  const update = useServerAction(updateRoleAction)
  const remove = useServerAction(deleteRoleAction, { onSuccess: back })
  const errors = { ...create.fieldErrors, ...update.fieldErrors }
  const list = [...permissions]
  const church = needsChurchScope(list)

  return (
    <form
      className="flex max-w-3xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        const input = { name, permissions: list }
        void (role ? update.execute(role.id, input) : create.execute(input))
      }}
    >
      <TextField
        label={t("name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        className="max-w-md"
      />
      <p className="border-s-2 border-primary ps-3 text-sm text-muted-foreground">
        {list.length === 0 ? t("noneYet") : church ? t("givenChurchWide") : t("givenInGroups")}
      </p>
      {PERMISSION_GROUPS.map((g) => (
        <FormPanel key={g.group} title={tp(`groups.${g.group}`)}>
          <ul className="flex flex-col gap-4">
            {g.permissions.map((p) => {
              const locked = role?.protected === true && p === "access.manage"

              return (
                <li key={p} className="flex items-start justify-between gap-4">
                  <label htmlFor={`perm-${p}`} className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {tp(`labels.${permissionKey(p)}`)}
                      {locked ? (
                        <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      ) : null}
                    </span>
                    <span className="text-xs text-pretty text-muted-foreground">
                      {tp(`hints.${permissionKey(p)}`)}
                    </span>
                  </label>
                  <Switch
                    id={`perm-${p}`}
                    checked={permissions.has(p)}
                    disabled={locked}
                    onCheckedChange={(checked) => {
                      const next = new Set(permissions)

                      if (checked) {
                        next.add(p)
                      } else {
                        next.delete(p)
                      }

                      setPermissions(next)
                    }}
                  />
                </li>
              )
            })}
          </ul>
        </FormPanel>
      ))}
      {errors.permissions ? <FieldError>{errors.permissions}</FieldError> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={back}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={create.pending || update.pending}>
          {role ? tc("saveChanges") : t("create")}
        </Button>
        {role && !role.protected ? (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="ghost" className="text-destructive sm:ms-auto">
                <Trash2 data-icon="inline-start" />
                {t("delete")}
              </Button>
            }
            title={t("deleteTitle", { name: role.name })}
            description={role.holders.length > 0 ? t("deleteInUse") : t("deleteHint")}
            confirmLabel={t("delete")}
            tone="destructive"
            onConfirm={async () => (await remove.execute(role.id)).ok}
          />
        ) : null}
      </div>
    </form>
  )
}
