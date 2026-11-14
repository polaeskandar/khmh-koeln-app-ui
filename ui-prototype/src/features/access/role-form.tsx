"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useServerAction } from "@/hooks/use-server-action"
import {
  appliesAt,
  type CapabilityGroup,
  groupPermissions,
  isAccessPermission,
  isAdministration,
  type Permission,
  permissions as allPermissions,
  possibleScopes,
  type ResourceType,
} from "@/lib/domain/resources"
import {
  effectiveDelegation,
  effectivePermissions,
  includingRoles,
  inheritanceLoop,
  permissionOrigins,
  type RoleDefinition,
} from "@/lib/domain/roles"
import type { RoleFormRole } from "@/lib/view-models"
import { createRoleAction, updateRoleAction } from "@/server/actions/access"
import type { getRoleForm } from "@/server/queries/access"

import { TypeIcon, useAccessLabels } from "./labels"
import { rolesHref } from "./roles-view"

type Data = ReturnType<typeof getRoleForm>

const SECTIONS = ["work", "administration", "access", "portals"] as const

function sectionOf(group: CapabilityGroup["group"]): (typeof SECTIONS)[number] {
  if (group === "access") {
    return "access"
  }

  if (group === "portal") {
    return "portals"
  }

  return isAdministration(group) ? "administration" : "work"
}

function Block({
  title,
  hint,
  error,
  children,
}: {
  title: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 border bg-card p-4 md:p-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        {hint ? <p className="max-w-[72ch] text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </section>
  )
}

/**
 * The role editor. Inheritance, effective permissions, where the role can be given and what other
 * roles feel from the change are computed while editing, with the same functions the server uses.
 */
export function RoleForm({ data }: { data: Data }) {
  const t = useTranslations("access.editor")
  const labels = useAccessLabels()
  const router = useRouter()
  const saved = data.role
  const [name, setName] = useState(saved?.name ?? "")
  const [description, setDescription] = useState(saved?.description ?? "")
  const [inherits, setInherits] = useState<string[]>(saved?.inherits ?? [])
  const [direct, setDirect] = useState<Set<Permission>>(new Set(saved?.permissions ?? []))
  const [assignableAt, setAssignableAt] = useState<Set<ResourceType>>(
    new Set(saved?.assignableAt ?? [])
  )
  const [delegation, setDelegation] = useState<Map<string, Set<ResourceType>>>(
    new Map((saved?.delegation ?? []).map((d) => [d.roleId, new Set(d.at)]))
  )
  const create = useServerAction(createRoleAction, {
    onSuccess: (id) => router.push(rolesHref(id)),
  })
  const update = useServerAction(updateRoleAction, {
    onSuccess: (id) => router.push(rolesHref(id)),
  })
  const action = saved ? update : create
  const errors = action.fieldErrors
  const others = data.roles.filter((r) => r.id !== saved?.id)
  const nameOf = (id: string) => data.roles.find((r) => r.id === id)?.name ?? ""

  const draft: RoleDefinition = useMemo(
    () => ({
      id: saved?.id ?? "draft",
      name,
      inherits,
      permissions: [...direct],
      assignableAt: [...assignableAt],
      delegation: [...delegation].map(([roleId, at]) => ({ roleId, at: [...at] })),
      protected: false,
    }),
    [saved?.id, name, inherits, direct, assignableAt, delegation]
  )
  const graph = useMemo(() => [...others, draft], [others, draft])
  const origins = useMemo(() => permissionOrigins(graph, draft.id), [graph, draft.id])
  const effective = useMemo(() => effectivePermissions(graph, draft.id), [graph, draft.id])
  const possible = possibleScopes(effective)
  const delegates = effective.some(isAccessPermission)
  const inheritedFrom = (p: Permission) =>
    (origins.get(p) ?? []).filter((id) => id !== draft.id).map(nameOf)

  const impact = useMemo(() => {
    const before = saved
      ? new Set(effectivePermissions(data.roles, saved.id))
      : new Set<Permission>()
    const after = new Set(effective)
    const delegators = others.flatMap((d) => {
      const rules = effectiveDelegation(graph, d.id)

      if (rules === "all" || !rules.has(draft.id)) {
        return []
      }

      const theirs = new Set(effectivePermissions(graph, d.id))
      const exceeds = [...rules.get(draft.id)!].some((type) =>
        effective.some((p) => appliesAt(p, type) && !theirs.has(p))
      )

      return [{ name: d.name, exceeds }]
    })

    return {
      added: [...after].filter((p) => !before.has(p)).length,
      removed: [...before].filter((p) => !after.has(p)).length,
      including: saved ? includingRoles(data.roles, saved.id).map((r) => r.name) : [],
      delegators,
    }
  }, [saved, data.roles, effective, others, graph, draft.id])

  const catalog = groupPermissions(allPermissions())

  if (saved?.protected) {
    return <ProtectedForm role={saved} />
  }

  const togglePermission = (p: Permission, on: boolean) => {
    const next = new Set(direct)

    if (on) {
      next.add(p)
    } else {
      next.delete(p)
    }

    setDirect(next)
  }

  const toggleDelegation = (roleId: string, type: ResourceType, on: boolean) => {
    const next = new Map(delegation)
    const at = new Set(next.get(roleId) ?? [])

    if (on) {
      at.add(type)
    } else {
      at.delete(type)
    }

    next.set(roleId, at)
    setDelegation(next)
  }

  const submit = () => {
    const input = {
      name,
      description,
      inherits,
      permissions: [...direct],
      assignableAt: [...assignableAt].filter((x) => possible.includes(x)),
      delegation: delegates
        ? [...delegation]
            .map(([roleId, at]) => ({ roleId, at: [...at] }))
            .filter((d) => d.at.length > 0)
        : [],
    }

    if (saved) {
      void update.execute(saved.id, input)
    } else {
      void create.execute(input)
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Block title={t("basics")}>
          <Field>
            <FieldLabel htmlFor="role-name">{t("name")}</FieldLabel>
            <Input
              id="role-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={errors.name ? true : undefined}
            />
            {errors.name ? <FieldError>{errors.name}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="role-description">{t("description")}</FieldLabel>
            <Textarea
              id="role-description"
              value={description}
              maxLength={240}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-16"
            />
          </Field>
        </Block>

        <Block title={t("inherits")} hint={t("inheritsHint")} error={errors.inherits}>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {others.map((r) => {
              const loop = inheritanceLoop(data.roles, saved?.id ?? null, [r.id])
              const reason = r.protected
                ? t("protectedParent")
                : loop
                  ? t("loop", { role: r.name })
                  : null
              const checked = inherits.includes(r.id)

              return (
                <li key={r.id}>
                  <label
                    className={cn(
                      "flex items-start gap-2.5 border px-3 py-2 text-sm",
                      checked && "border-primary bg-primary/5",
                      reason && "text-muted-foreground"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={reason !== null && !checked}
                      onCheckedChange={(on) =>
                        setInherits(on ? [...inherits, r.id] : inherits.filter((x) => x !== r.id))
                      }
                      className="mt-0.5"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{r.name}</span>
                      {reason ? <span className="text-xs">{reason}</span> : null}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </Block>

        <Block title={t("permissions")} hint={t("permissionsHint")} error={errors.permissions}>
          {SECTIONS.map((section) => {
            const groups = catalog.filter((g) => sectionOf(g.group) === section)

            return (
              <div key={section} className="flex flex-col gap-2">
                <h3 className="text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
                  {t(`groups.${section}`)}
                </h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {groups.map((g) => (
                    <fieldset key={g.group} className="flex flex-col border">
                      <legend className="sr-only">{labels.group(g.group)}</legend>
                      <div
                        className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2 text-sm font-medium"
                        aria-hidden="true"
                      >
                        <TypeIcon type={g.group} className="text-muted-foreground" />
                        {labels.group(g.group)}
                      </div>
                      <div className="flex flex-col gap-1.5 p-3">
                        {g.actions.map((a) => {
                          const p = `${g.group}.${a}` as Permission
                          const from = inheritedFrom(p)
                          const own = direct.has(p)
                          const inherited = from.length > 0 && !own

                          return (
                            <label key={p} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={own || inherited}
                                disabled={inherited}
                                onCheckedChange={(on) => togglePermission(p, on === true)}
                                className={cn(inherited && "border-dashed")}
                              />
                              <span className={cn("flex-1", inherited && "text-muted-foreground")}>
                                {labels.action(a)}
                              </span>
                              {inherited ? (
                                <span className="text-xs text-muted-foreground">
                                  {t("inheritedFrom", { roles: from.join(", ") })}
                                </span>
                              ) : null}
                            </label>
                          )
                        })}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </div>
            )
          })}
        </Block>

        <Block title={t("where")} hint={t("whereHint")} error={errors.assignableAt}>
          <ul className="flex flex-wrap gap-2">
            {data.scopeTypes.map((type) => {
              const allowed = possible.includes(type)
              const checked = assignableAt.has(type) && allowed

              return (
                <li key={type}>
                  <label
                    className={cn(
                      "flex items-center gap-2 border px-3 py-2 text-sm",
                      checked && "border-primary bg-primary/5",
                      !allowed && "text-muted-foreground"
                    )}
                    title={
                      allowed
                        ? undefined
                        : possible.includes("church") && possible.length === 1
                          ? t("whereChurchOnly")
                          : t("whereUnused")
                    }
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!allowed}
                      onCheckedChange={(on) => {
                        const next = new Set(assignableAt)

                        if (on) {
                          next.add(type)
                        } else {
                          next.delete(type)
                        }

                        setAssignableAt(next)
                      }}
                    />
                    <TypeIcon type={type} className="size-3.5 text-muted-foreground" />
                    {labels.type(type, true)}
                  </label>
                </li>
              )
            })}
          </ul>
          {possible.length === 1 && possible[0] === "church" && effective.length > 0 ? (
            <p className="text-xs text-muted-foreground">{t("whereChurchOnly")}</p>
          ) : null}
        </Block>

        <Block title={t("delegation")} hint={t("delegationHint")} error={errors.delegation}>
          {!delegates ? (
            <p className="text-sm text-muted-foreground">{t("delegationNeeds")}</p>
          ) : (
            <ul className="flex flex-col divide-y border">
              {others
                .filter((r) => !r.protected)
                .map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center"
                  >
                    <span className="w-40 shrink-0 text-sm font-medium">{r.name}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {r.assignableAt.map((type) => {
                        const on = delegation.get(r.id)?.has(type) ?? false

                        return (
                          <label
                            key={type}
                            className={cn(
                              "flex items-center gap-1.5 border px-2 py-1 text-xs",
                              on && "border-primary bg-primary/5"
                            )}
                          >
                            <Checkbox
                              checked={on}
                              onCheckedChange={(v) => toggleDelegation(r.id, type, v === true)}
                              aria-label={t("delegateAt", {
                                role: r.name,
                                place: labels.type(type, true),
                              })}
                            />
                            {labels.type(type, true)}
                          </label>
                        )
                      })}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Block>
      </div>

      <aside
        className="flex flex-col gap-4 border bg-card p-4 lg:sticky lg:top-20"
        aria-labelledby="impact-title"
      >
        <h2 id="impact-title" className="font-heading text-base font-semibold">
          {t("impact")}
        </h2>
        <dl className="flex flex-col gap-1 text-sm">
          <dt className="sr-only">{t("impact")}</dt>
          <dd className="font-medium">{t("effective", { count: effective.length })}</dd>
          {saved ? (
            <dd className="flex gap-3 text-xs">
              <span className="text-primary">{t("added", { count: impact.added })}</span>
              <span className="text-destructive">{t("removed", { count: impact.removed })}</span>
            </dd>
          ) : null}
        </dl>
        {saved ? (
          <p className="text-sm text-muted-foreground">
            {t("holders", { count: data.holders[saved.id] ?? 0 })}
          </p>
        ) : null}
        {impact.including.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("alsoChanges", { roles: impact.including.join(", ") })}
          </p>
        ) : null}
        {impact.delegators.map((d) =>
          d.exceeds ? (
            <p
              key={d.name}
              role="status"
              className="flex gap-2 bg-destructive/10 p-2.5 text-xs text-destructive"
            >
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              {t("ceiling", { role: d.name })}
            </p>
          ) : (
            <p key={d.name} className="text-xs text-muted-foreground">
              {t("delegators", { roles: d.name })}
            </p>
          )
        )}
        {data.ownership.map((type) => (
          <p key={type} className="text-xs text-muted-foreground">
            {t("owner", { type: labels.type(type, true) })}
          </p>
        ))}
        <div className="flex flex-col gap-2 border-t pt-4">
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? <Spinner data-icon="inline-start" /> : null}
            {saved ? t("save") : t("create")}
          </Button>
          <Button variant="outline" onClick={() => router.back()} disabled={action.pending}>
            {t("cancel")}
          </Button>
        </div>
      </aside>
    </div>
  )
}

function ProtectedForm({ role }: { role: RoleFormRole }) {
  const t = useTranslations("access.editor")
  const router = useRouter()
  const [name, setName] = useState(role.name)
  const [description, setDescription] = useState(role.description ?? "")
  const update = useServerAction(updateRoleAction, {
    onSuccess: (id) => router.push(rolesHref(id)),
  })

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="flex items-start gap-2 border-s-2 border-primary bg-primary/5 px-3 py-2 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        {t("protected")}
      </p>
      <Block title={t("basics")}>
        <Field>
          <FieldLabel htmlFor="role-name">{t("name")}</FieldLabel>
          <Input
            id="role-name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          {update.fieldErrors.name ? <FieldError>{update.fieldErrors.name}</FieldError> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="role-description">{t("description")}</FieldLabel>
          <Textarea
            id="role-description"
            value={description}
            maxLength={240}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-16"
          />
        </Field>
      </Block>
      <div className="flex gap-2">
        <Button
          disabled={update.pending}
          onClick={() =>
            void update.execute(role.id, {
              name,
              description,
              inherits: [],
              permissions: [],
              assignableAt: [],
              delegation: [],
            })
          }
        >
          {t("save")}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  )
}
