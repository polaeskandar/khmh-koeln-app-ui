"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Check,
  ChevronRight,
  CornerDownRight,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useFormat } from "@/i18n/format"
import { useServerAction } from "@/hooks/use-server-action"
import type { RoleDetail, RoleLevel, RoleSummary, RoleTreeNode } from "@/lib/view-models"
import { deleteRoleAction } from "@/server/actions/access"

import { TypeIcon, useAccessLabels } from "./labels"

const LEVELS: RoleLevel[] = ["church", "unit", "item"]

export function rolesHref(roleId: string) {
  return `/admin/access?tab=roles&role=${roleId}`
}

/** Every role, grouped by where it is given, each with the roles it builds on. */
export function RoleList({
  roles,
  selectedId,
  canCreate,
}: {
  roles: RoleSummary[]
  selectedId: string | null
  canCreate: boolean
}) {
  const t = useTranslations("access.roles")

  return (
    <nav aria-label={t("listLabel")} className="flex flex-col gap-4">
      {canCreate ? (
        <Button asChild variant="outline" className="w-full">
          <Link href="/admin/access/roles/new">
            <Plus data-icon="inline-start" />
            {t("new")}
          </Link>
        </Button>
      ) : null}
      {LEVELS.map((level) => {
        const list = roles.filter((r) => r.level === level)

        return list.length === 0 ? null : (
          <div key={level} className="flex flex-col gap-1.5">
            <h3 className="px-1 text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
              {t(`levels.${level}`)}
            </h3>
            <ul className="flex flex-col border bg-card">
              {list.map((r) => {
                const active = r.id === selectedId

                return (
                  <li key={r.id} className="border-b last:border-b-0">
                    <Link
                      href={rolesHref(r.id)}
                      scroll={false}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex flex-col gap-0.5 px-3 py-2.5 text-sm hover:bg-muted/40 focus-visible:bg-muted focus-visible:outline-none",
                        active &&
                          "bg-primary/8 before:absolute before:inset-y-0 before:start-0 before:w-0.5 before:bg-primary"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {r.protected ? (
                          <ShieldCheck
                            className="size-3.5 text-primary"
                            aria-label={t("protected")}
                          />
                        ) : null}
                        <span className="font-medium">{r.name}</span>
                        <span className="ms-auto text-xs text-muted-foreground tabular-nums">
                          {t("holders", { count: r.holders })}
                        </span>
                      </span>
                      {r.includes.length > 0 ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CornerDownRight className="size-3 rtl:-scale-x-100" aria-hidden="true" />
                          {t("includes", { roles: r.includes.map((x) => x.name).join(", ") })}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

function Tree({ node, root = false }: { node: RoleTreeNode; root?: boolean }) {
  const t = useTranslations("access.roles")

  return (
    <li className={cn("flex flex-col", !root && "relative ps-5")}>
      {!root ? (
        <span
          className="absolute start-0 top-0 h-4 w-3.5 border-s border-b border-muted-foreground/40"
          aria-hidden="true"
        />
      ) : null}
      {root ? (
        <span className="flex w-fit items-center gap-2 border border-primary bg-primary/5 px-2.5 py-1.5 text-sm font-semibold">
          {node.name}
        </span>
      ) : (
        <Link
          href={rolesHref(node.id)}
          scroll={false}
          className="flex w-fit items-center gap-2 border bg-card px-2.5 py-1 text-sm hover:bg-muted/40"
        >
          {node.name}
          {node.repeated ? (
            <span className="text-xs text-muted-foreground">{t("repeated")}</span>
          ) : null}
        </Link>
      )}
      {node.children.length > 0 ? (
        <ul className="ms-3 mt-1 flex flex-col gap-1 border-s border-muted-foreground/40 ps-0">
          {node.children.map((c) => (
            <Tree key={c.id} node={c} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function DeleteRole({ role }: { role: RoleDetail }) {
  const t = useTranslations("access.roles")
  const router = useRouter()
  const { execute } = useServerAction(deleteRoleAction, {
    onSuccess: () => router.push("/admin/access?tab=roles"),
  })

  if (role.deleteBlocked) {
    return (
      <Button
        variant="outline"
        disabled
        title={role.deleteBlocked}
        aria-describedby="delete-blocked"
      >
        <Trash2 data-icon="inline-start" />
        {t("delete")}
      </Button>
    )
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline">
          <Trash2 data-icon="inline-start" />
          {t("delete")}
        </Button>
      }
      title={t("deleteTitle", { name: role.name })}
      description={t("deleteHint")}
      confirmLabel={t("delete")}
      tone="destructive"
      onConfirm={async () => (await execute(role.id)).ok}
    />
  )
}

/** One role: what it builds on, what it allows (own or inherited), whom it may give, who has it. */
export function RoleDetailView({ role }: { role: RoleDetail }) {
  const t = useTranslations("access.roles")
  const labels = useAccessLabels()
  const f = useFormat()
  const [showAll, setShowAll] = useState(false)
  const groups = role.permissionGroups.filter(
    (g) => showAll || g.actions.some((a) => a.state !== "none")
  )

  return (
    <article
      aria-labelledby="role-title"
      className="flex min-w-0 flex-col gap-6 border bg-card p-4 md:p-6"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2 text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
            {t(`levels.${role.level}`)}
            {role.protected ? (
              <span className="inline-flex items-center gap-1 text-primary">
                <ShieldCheck className="size-3" aria-hidden="true" />
                {t("protected")}
              </span>
            ) : null}
          </span>
          <h2 id="role-title" className="font-heading text-xl font-semibold">
            {role.name}
          </h2>
          {role.description ? (
            <p className="max-w-[70ch] text-sm text-muted-foreground">{role.description}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t("count", { count: role.permissions })} · {t("holders", { count: role.holders })} ·{" "}
            {t("updated", { date: f.mediumDate(f.instantDate(role.updatedAt)) })}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {role.canEdit ? (
            <Button asChild>
              <Link href={`/admin/access/roles/${role.id}`}>
                <Pencil data-icon="inline-start" />
                {t("edit")}
              </Link>
            </Button>
          ) : null}
          {role.canDelete && !role.protected ? <DeleteRole role={role} /> : null}
        </div>
      </header>
      {role.protected ? (
        <p className="border-s-2 border-primary bg-primary/5 px-3 py-2 text-sm">
          {t("protectedHint")}
        </p>
      ) : null}
      {role.canDelete && role.deleteBlocked && !role.protected ? (
        <p id="delete-blocked" className="text-xs text-muted-foreground">
          {role.deleteBlocked}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
        <section aria-labelledby="role-hierarchy" className="flex flex-col gap-2">
          <h3 id="role-hierarchy" className="font-heading text-base font-semibold">
            {t("hierarchy")}
          </h3>
          {role.tree.children.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t("hierarchyHint", { name: role.name })}
              </p>
              <ul className="flex flex-col">
                <Tree node={role.tree} root />
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("includesNothing")}</p>
          )}
          {role.includedBy.length > 0 ? (
            <p className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">{t("includedBy")}:</span>
              {role.includedBy.map((r) => (
                <Link
                  key={r.id}
                  href={rolesHref(r.id)}
                  scroll={false}
                  className="border px-2 py-0.5 text-xs hover:bg-muted/40"
                >
                  {r.name}
                </Link>
              ))}
            </p>
          ) : null}
        </section>
        <section aria-labelledby="role-where" className="flex flex-col gap-2">
          <h3 id="role-where" className="font-heading text-base font-semibold">
            {t("assignable")}
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {role.assignableAt.map((type) => (
              <li key={type} className="flex items-center gap-1.5 border px-2 py-1 text-xs">
                <TypeIcon type={type} className="size-3.5 text-muted-foreground" />
                {labels.type(type, true)}
              </li>
            ))}
          </ul>
          {role.ownership.map((type) => (
            <p key={type} className="text-xs text-muted-foreground">
              {t("owner", { type: labels.type(type, true) })}
            </p>
          ))}
        </section>
      </div>

      <section aria-labelledby="role-permissions" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <h3 id="role-permissions" className="font-heading text-base font-semibold">
              {t("permissions")}
            </h3>
            <p className="max-w-[70ch] text-sm text-muted-foreground">
              {role.protected ? t("everything") : t("permissionsHint")}
            </p>
          </div>
          {!role.protected ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={showAll} onCheckedChange={setShowAll} />
              {t("showAll")}
            </label>
          ) : null}
        </div>
        <div className={cn("grid gap-2 md:grid-cols-2", role.protected && "hidden")}>
          {groups.map((g) => (
            <div key={g.group} className="flex flex-col border">
              <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2 text-sm font-medium">
                <TypeIcon type={g.group} className="text-muted-foreground" />
                {labels.group(g.group)}
              </div>
              <ul className="flex flex-col gap-1 p-3 text-sm">
                {g.actions.map((a) => (
                  <li
                    key={a.action}
                    className={cn(
                      "flex items-center gap-2",
                      a.state === "none" && "text-muted-foreground/70"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center border",
                        a.state === "direct" && "border-primary bg-primary text-primary-foreground",
                        a.state === "inherited" && "border-dashed border-primary/60 text-primary"
                      )}
                      aria-hidden="true"
                    >
                      {a.state !== "none" ? <Check className="size-3" /> : null}
                    </span>
                    <span className="flex-1">{labels.action(a.action)}</span>
                    {a.state === "direct" ? (
                      <span className="text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase">
                        {t("direct")}
                      </span>
                    ) : null}
                    {a.state === "inherited" ? (
                      <span className="text-xs text-muted-foreground">
                        {t("inheritedFrom", { roles: a.from.join(", ") })}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="role-delegation" className="flex flex-col gap-2">
        <h3 id="role-delegation" className="font-heading text-base font-semibold">
          {t("delegation")}
        </h3>
        {role.delegation === "all" ? (
          <p className="text-sm">{t("delegationAll")}</p>
        ) : role.delegation.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("delegationNone")}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("delegationHint")}</p>
            <ul className="flex flex-col divide-y border">
              {role.delegation.map((d) => (
                <li
                  key={d.role}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{d.role}</span>
                  <span className="text-muted-foreground">{labels.types(d.at)}</span>
                  {d.from ? (
                    <span className="ms-auto text-xs text-muted-foreground">
                      {t("delegationFrom", { role: d.from })}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="role-holders" className="flex flex-col gap-2">
        <h3 id="role-holders" className="font-heading text-base font-semibold">
          {t("holdersTitle")}
        </h3>
        {role.holderRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("holders", { count: 0 })}</p>
        ) : (
          <ul className="flex flex-col divide-y border">
            {role.holderRows.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="font-medium">{h.person.name}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{h.scope}</span>
                {h.href ? (
                  <Link
                    href={h.href}
                    aria-label={t("openPlace", { place: h.scope })}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="size-4 rtl:-scale-x-100" />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {role.holders > role.holderRows.length ? (
          <p className="text-xs text-muted-foreground">
            {t("holdersMore", { count: role.holders - role.holderRows.length })}
          </p>
        ) : null}
      </section>
    </article>
  )
}
