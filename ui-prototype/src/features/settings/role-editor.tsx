"use client"

/**
 * Adds or changes a role: its name and what it allows, as a grid of the permission catalog —
 * one row per resource, one column per action (See, Add, Change, Delete). Roles hold everywhere
 * in the church, so there is nothing else to choose. The aside lists who has the role, since
 * every change reaches them at once.
 */
import { Fragment, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ShieldAlert, Trash2, TriangleAlert } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { TextField } from "@/components/form-fields"
import { FormPanel } from "@/components/form-panel"
import { MemberAvatar } from "@/components/member-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldError } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { useServerAction } from "@/hooks/use-server-action"
import { useFormat } from "@/i18n/format"
import { nameKey } from "@/lib/domain/names"
import { ACTIONS, inCatalogOrder, permissionOf, PERMISSIONS, RESOURCES } from "@/lib/domain/policy"
import type { Action, Permission, Resource } from "@/lib/domain/types"
import { createRoleAction, deleteRoleAction, updateRoleAction } from "@/server/actions/roles"
import type { RoleEditorData } from "@/server/queries/roles"

/** Rows that let people change who may do what, or see everyone's personal data. */
const SENSITIVE: Resource[] = ["members", "users", "roles"]

/**
 * Ticking Add, Change or Delete ticks See too (nobody changes what they can't see); unticking
 * See unticks the rest of the row.
 */
function toggled(chosen: Permission[], action: Action, resource: Resource, on: boolean) {
  const set = new Set(chosen)
  const key = permissionOf(action, resource)
  if (on) {
    set.add(key)
    if (action !== "read") set.add(permissionOf("read", resource))
  } else {
    set.delete(key)
    if (action === "read") for (const a of ACTIONS) set.delete(permissionOf(a, resource))
  }
  return inCatalogOrder(set)
}

function PermissionGrid({
  chosen,
  onToggle,
  disabled,
}: {
  chosen: Permission[]
  onToggle: (action: Action, resource: Resource, on: boolean) => void
  disabled: boolean
}) {
  const t = useTranslations("roleEditor")
  const tp = useTranslations("permissions")
  return (
    <div className="overflow-x-auto border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{t("permissions")}</caption>
        <thead className="bg-muted/40">
          <tr className="border-b">
            <th scope="col" className="h-10 ps-4 text-start text-xs font-medium">
              {t("area")}
            </th>
            {ACTIONS.map((a) => (
              <th
                key={a}
                scope="col"
                className="h-10 w-12 px-1 text-center text-xs font-medium sm:w-14"
              >
                {tp(`actions.${a}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((r) => (
            <Fragment key={r}>
              <tr className="border-t">
                <th
                  scope="row"
                  className="ps-4 pe-2 pt-3 pb-1 text-start align-top font-normal sm:pb-3"
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                    {tp(`resources.${r}.name`)}
                    {SENSITIVE.includes(r) ? (
                      <Badge
                        variant="outline"
                        className="gap-1 font-normal"
                        title={t("sensitiveHint")}
                      >
                        <ShieldAlert className="size-3" aria-hidden="true" />
                        {t("sensitive")}
                      </Badge>
                    ) : null}
                  </span>
                  <span
                    id={`resource-${r}`}
                    className="mt-0.5 hidden text-xs text-pretty text-muted-foreground sm:block"
                  >
                    {tp(`resources.${r}.description`)}
                  </span>
                </th>
                {ACTIONS.map((a) => {
                  const key = permissionOf(a, r)
                  return (
                    <td key={a} className="px-1 pt-3 pb-1 text-center align-top sm:pb-3">
                      <Checkbox
                        aria-label={t("cell", {
                          action: tp(`actions.${a}`),
                          resource: tp(`resources.${r}.name`),
                        })}
                        aria-describedby={`resource-${r}`}
                        checked={chosen.includes(key)}
                        disabled={disabled}
                        onCheckedChange={(v) => onToggle(a, r, v === true)}
                      />
                    </td>
                  )
                })}
              </tr>
              {/* On phones the description gets the full width, under the checkboxes. */}
              <tr className="sm:hidden" aria-hidden="true">
                <td
                  colSpan={ACTIONS.length + 1}
                  className="px-4 pb-3 text-xs text-pretty text-muted-foreground"
                >
                  {tp(`resources.${r}.description`)}
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RoleEditor({ data }: { data: RoleEditorData }) {
  const t = useTranslations("roleEditor")
  const tl = useTranslations("settings.roles")
  const tc = useTranslations("common")
  const f = useFormat()
  const router = useRouter()
  const role = data.role
  const readOnly = !data.can.edit
  const [name, setName] = useState(role?.name ?? "")
  const [chosen, setChosen] = useState<Permission[]>(role?.permissions ?? [])
  const [deleting, setDeleting] = useState(false)

  const create = useServerAction(createRoleAction, {
    onSuccess: (r) => router.push(`/settings/roles/${r.id}`),
  })
  const update = useServerAction(updateRoleAction)
  const remove = useServerAction(deleteRoleAction, {
    onSuccess: () => router.push("/settings#roles"),
  })
  const action = role ? update : create
  const pending = action.pending

  const taken = useMemo(() => {
    const key = nameKey(name)
    return key ? data.otherNames.find((n) => nameKey(n) === key) : undefined
  }, [name, data.otherNames])
  const nameError = taken ? t("nameTaken", { name: taken }) : action.fieldErrors.name
  // A role that opens nothing: its accounts land on the "no role yet" page.
  const opensNothing =
    chosen.length > 0 && !chosen.includes("services:read") && !chosen.includes("parentPortal:read")
  const locksOut = data.onlyWayToChangeRoles && !chosen.includes("roles:update")

  const submit = () => {
    const input = { name, permissions: chosen }
    if (role) update.execute(role.id, input)
    else create.execute(input)
  }

  return (
    <form
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]"
      onSubmit={(e) => {
        e.preventDefault()
        if (!readOnly) submit()
      }}
    >
      <div className="flex min-w-0 flex-col gap-6">
        {readOnly ? (
          <p className="border border-dashed p-4 text-sm text-muted-foreground">
            {t("readOnlyNote")}
          </p>
        ) : null}

        <FormPanel title={t("details")}>
          <TextField
            label={t("name")}
            value={name}
            maxLength={80}
            disabled={readOnly}
            dir="auto"
            onChange={(e) => setName(e.target.value)}
            description={t("nameHint")}
            error={nameError}
          />
        </FormPanel>

        <FormPanel
          title={t("permissions")}
          note={
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("chosen", { count: chosen.length, total: PERMISSIONS.length })}
            </span>
          }
        >
          <p className="-mt-2 text-sm text-pretty text-muted-foreground">{t("permissionsHint")}</p>
          {action.fieldErrors.permissions ? (
            <FieldError>{action.fieldErrors.permissions}</FieldError>
          ) : null}
          <PermissionGrid
            chosen={chosen}
            disabled={readOnly}
            onToggle={(a, r, on) => setChosen((current) => toggled(current, a, r, on))}
          />
          {opensNothing ? (
            <p className="flex items-start gap-2 text-sm text-pretty text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t("opensNothing")}
            </p>
          ) : null}
          {locksOut && !readOnly ? (
            <p
              role="status"
              className="flex items-start gap-2 border border-destructive/40 bg-destructive/5 p-3 text-sm text-pretty"
            >
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
              {t("locksOut")}
            </p>
          ) : null}
        </FormPanel>

        {readOnly ? null : (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending || !!taken}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {role ? t("save") : t("create")}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/settings#roles">{tc("cancel")}</Link>
            </Button>
          </div>
        )}
      </div>

      <aside className="flex min-w-0 flex-col gap-4" aria-labelledby="role-holders">
        <div className="flex flex-col gap-3 border p-5">
          <h2 id="role-holders" className="font-heading text-base font-semibold tracking-tight">
            {t("holdersTitle")}
          </h2>
          {role ? (
            <p className="text-sm text-muted-foreground">
              {t("applyCount", { count: data.holders.length })}
            </p>
          ) : null}
          {data.holders.length > 0 ? (
            <ul className="flex flex-col divide-y border-y">
              {data.holders.map((h) => (
                <li key={h.id} className="flex items-center gap-3 py-2.5">
                  <MemberAvatar name={h.name} initials={h.initials} seed={h.id} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {h.name}
                      {h.disabled ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {t("disabledAccount")}
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      <bdi dir="ltr">{h.email}</bdi>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t.rich(role ? "holdersNone" : "holdersNew", {
                link: (chunks) => (
                  <Link
                    href="/settings#users"
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          )}
        </div>
        {role ? (
          <p className="text-xs text-muted-foreground">
            {role.updatedAt === role.createdAt
              ? t("added", { when: f.atLabel(role.createdAt, data.today) })
              : t("changed", { when: f.atLabel(role.updatedAt, data.today) })}
          </p>
        ) : null}
        {role && data.can.delete ? (
          <Button
            type="button"
            variant="outline"
            className="self-start"
            disabled={remove.pending}
            onClick={() => setDeleting(true)}
          >
            <Trash2 data-icon="inline-start" />
            {t("deleteRole")}
          </Button>
        ) : null}
      </aside>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={role ? tl("deleteTitle", { name: role.name }) : ""}
        description={
          data.onlyWayToChangeRoles
            ? t("deleteLocksOut")
            : tl("deleteDescription", { count: data.holders.length })
        }
        tone="destructive"
        confirmLabel={tl("deleteConfirm")}
        onConfirm={async () => (role ? (await remove.execute(role.id)).ok : true)}
      />
    </form>
  )
}
