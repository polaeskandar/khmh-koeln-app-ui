"use client"

/**
 * Accounts and their roles. Adapted from the shadcnblocks "settings-members2"
 * block (member list with role chips and an invite dialog): roles here are
 * scoped to a service, and a servant's role optionally to one stage.
 */
import { useState } from "react"
import { Plus, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { MemberAvatar } from "@/components/member-avatar"
import { ServiceSwatch } from "@/components/service-tag"
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
import type { Role } from "@/lib/domain/types"
import { assignRoleAction, removeRoleAction } from "@/server/actions/people"
import type { SettingsPage } from "@/server/queries/settings"

type User = SettingsPage["users"][number]
type RoleRow = User["roles"][number]

/** "Servant · Sunday School · 3rd Class" in the current language. */
function useRoleText() {
  const tr = useTranslations("roles")
  return (r: RoleRow) =>
    r.service
      ? `${tr(r.role)} · ${r.service.name}${r.stage ? ` · ${r.stage.name}` : ""}`
      : tr(r.role)
}

function AssignRoleDialog({
  user,
  services,
  open,
  onOpenChange,
}: {
  user: User
  services: SettingsPage["services"]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("settings.users.assign")
  const tr = useTranslations("roles")
  const tc = useTranslations("common")
  const [role, setRole] = useState<Exclude<Role, "parent">>("servant")
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "")
  const [stageId, setStageId] = useState("")
  const assign = useServerAction(assignRoleAction, { onSuccess: () => onOpenChange(false) })
  const service = services.find((s) => s.id === serviceId)
  const scoped = role !== "administrator"
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) assign.reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { name: user.name })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form
          id="assign-role"
          onSubmit={(e) => {
            e.preventDefault()
            assign.execute(
              user.id,
              role,
              scoped ? serviceId : null,
              scoped && stageId ? stageId : null
            )
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="role">{t("role")}</FieldLabel>
              <NativeSelect
                id="role"
                className="w-full"
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
              >
                <NativeSelectOption value="servant">{tr("servant")}</NativeSelectOption>
                <NativeSelectOption value="service_leader">
                  {tr("service_leader")}
                </NativeSelectOption>
                <NativeSelectOption value="administrator">{tr("administrator")}</NativeSelectOption>
              </NativeSelect>
              <FieldDescription>{tr(`description.${role}`)}</FieldDescription>
            </Field>
            {scoped ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={assign.fieldErrors.serviceId ? true : undefined}>
                  <FieldLabel htmlFor="role-service">{t("service")}</FieldLabel>
                  <NativeSelect
                    id="role-service"
                    className="w-full"
                    value={serviceId}
                    onChange={(e) => {
                      setServiceId(e.target.value)
                      setStageId("")
                    }}
                  >
                    {services.map((s) => (
                      <NativeSelectOption key={s.id} value={s.id}>
                        {s.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {assign.fieldErrors.serviceId ? (
                    <FieldError>{assign.fieldErrors.serviceId}</FieldError>
                  ) : null}
                </Field>
                <Field data-invalid={assign.fieldErrors.stageId ? true : undefined}>
                  <FieldLabel htmlFor="role-stage">{t("stage")}</FieldLabel>
                  <NativeSelect
                    id="role-stage"
                    className="w-full"
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value)}
                  >
                    <NativeSelectOption value="">{t("wholeService")}</NativeSelectOption>
                    {service?.stages.map((st) => (
                      <NativeSelectOption key={st.id} value={st.id}>
                        {st.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {assign.fieldErrors.stageId ? (
                    <FieldError>{assign.fieldErrors.stageId}</FieldError>
                  ) : null}
                </Field>
              </div>
            ) : null}
            {scoped && stageId ? (
              <p className="text-xs text-muted-foreground">
                {t("limitedTo", {
                  stage: service?.stages.find((st) => st.id === stageId)?.name ?? "",
                })}
              </p>
            ) : null}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assign.pending}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="assign-role" disabled={assign.pending}>
            {assign.pending ? <Spinner data-icon="inline-start" /> : null}
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UsersRoles({ data }: { data: SettingsPage }) {
  const t = useTranslations("settings.users")
  const tr = useTranslations("roles")
  const roleText = useRoleText()
  const [assignFor, setAssignFor] = useState<User | null>(null)
  const [removing, setRemoving] = useState<{ user: User; role: RoleRow } | null>(null)
  const remove = useServerAction(removeRoleAction)
  return (
    <>
      <ul className="divide-y border-y">
        {data.users.map((u) => (
          <li key={u.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
            <span className="flex min-w-0 items-center gap-3 sm:w-72">
              <MemberAvatar name={u.name} initials={u.initials} seed={u.id} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{u.name}</span>
                <span className="truncate text-xs text-muted-foreground">{u.email}</span>
              </span>
            </span>
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 ps-11 sm:ps-0">
              {u.roles.map((r, i) => (
                <span key={i} className="inline-flex h-7 items-center gap-1.5 border px-2 text-xs">
                  {r.service ? <ServiceSwatch tone={r.service.tone} /> : null}
                  {roleText(r)}
                  {data.canManageUsers ? (
                    <button
                      type="button"
                      className="-me-1 text-muted-foreground hover:text-foreground"
                      aria-label={t("removeRoleLabel", { role: roleText(r), name: u.name })}
                      onClick={() => setRemoving({ user: u, role: r })}
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </span>
              ))}
              {u.isParentToo ? (
                <span className="inline-flex h-7 items-center border border-dashed px-2 text-xs text-muted-foreground">
                  {tr("parent")}
                </span>
              ) : null}
            </span>
            {data.canManageUsers ? (
              <Button
                variant="ghost"
                size="sm"
                className="self-start sm:self-center"
                onClick={() => setAssignFor(u)}
              >
                <Plus data-icon="inline-start" />
                {t("addRole")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {assignFor ? (
        <AssignRoleDialog
          key={assignFor.id}
          user={assignFor}
          services={data.services}
          open
          onOpenChange={(open) => !open && setAssignFor(null)}
        />
      ) : null}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={
          removing
            ? t("removeTitle", { role: roleText(removing.role), name: removing.user.name })
            : ""
        }
        description={t("removeDescription")}
        tone="destructive"
        confirmLabel={t("remove")}
        onConfirm={async () =>
          removing
            ? (
                await remove.execute(
                  removing.user.id,
                  removing.role.role,
                  removing.role.service?.id ?? null,
                  removing.role.stage?.id ?? null
                )
              ).ok
            : true
        }
      />
    </>
  )
}
