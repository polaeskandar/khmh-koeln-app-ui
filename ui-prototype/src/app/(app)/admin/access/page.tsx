import Link from "next/link"
import { Lock, Plus, UsersRound } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { LinkTabs } from "@/components/link-tabs"
import { PageHeader, Section } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  AssignmentChip,
  AssignRoleDialog,
  ChildChip,
  LinkChildDialog,
} from "@/features/access/access-dialogs"
import { PERMISSION_GROUPS, permissionKey } from "@/lib/domain/policy"
import { getAccess } from "@/server/queries/admin"
import { getStaffContext } from "@/server/request"

type Tab = "roles" | "assignments" | "parents"

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("access") }
}

export default async function AccessPage({ searchParams }: PageProps<"/admin/access">) {
  const query = await searchParams
  const data = getAccess(await getStaffContext())
  const tabs: Tab[] = data.can.access ? ["roles", "assignments", "parents"] : ["parents"]
  const tab: Tab = tabs.includes(query.tab as Tab) ? (query.tab as Tab) : tabs[0]
  const t = await getTranslations("access")
  const tp = await getTranslations("permissions")
  const tn = await getTranslations("nav")
  const filter = typeof query.q === "string" ? query.q.toLowerCase() : ""

  return (
    <>
      <Topbar crumbs={[{ label: tn("administration") }, { label: t("title") }]} />
      <PageBody>
        <PageHeader title={t("title")} description={t("description")} />
        <LinkTabs
          label={t("title")}
          active={tab}
          items={tabs.map((x) => ({
            key: x,
            href: `/admin/access?tab=${x}`,
            label: t(`tabs.${x}`),
          }))}
        />
        {tab === "roles" ? (
          <Section
            title={t("tabs.roles")}
            description={t("roles.hint")}
            actions={
              <Button asChild>
                <Link href="/admin/access/roles/new">
                  <Plus data-icon="inline-start" />
                  {t("roles.new")}
                </Link>
              </Button>
            }
          >
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.roles.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/admin/access/roles/${r.id}`}
                    className="flex h-full flex-col gap-3 border bg-card p-5 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-2 font-heading text-lg font-semibold">
                        {r.name}
                        {r.protected ? (
                          <Lock
                            className="size-4 text-muted-foreground"
                            aria-label={t("roles.protected")}
                          />
                        ) : null}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <UsersRound className="size-3.5" aria-hidden="true" />
                        {t("roles.holders", { count: r.holders })}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.churchOnly ? t("roles.churchWide") : t("roles.inGroups")}
                    </span>
                    <dl className="flex flex-col gap-1.5 border-t pt-3 text-sm">
                      {PERMISSION_GROUPS.filter((g) =>
                        g.permissions.some((p) => r.permissions.includes(p))
                      ).map((g) => (
                        <div key={g.group} className="flex flex-col">
                          <dt className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                            {tp(`groups.${g.group}`)}
                          </dt>
                          <dd>
                            {g.permissions
                              .filter((p) => r.permissions.includes(p))
                              .map((p) => tp(`labels.${permissionKey(p)}`))
                              .join(" · ")}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
        {tab === "assignments" ? (
          <Section
            title={t("tabs.assignments")}
            description={t("assignments.hint")}
            actions={
              <AssignRoleDialog accounts={data.accounts} roles={data.roles} scopes={data.scopes} />
            }
          >
            <form className="max-w-sm" role="search">
              <input type="hidden" name="tab" value="assignments" />
              <input
                name="q"
                defaultValue={filter}
                placeholder={t("assignments.search")}
                aria-label={t("assignments.search")}
                className="h-10 w-full border bg-transparent px-3 text-sm"
              />
            </form>
            <ul className="divide-y border">
              {data.assignments
                .filter(
                  (a) =>
                    !filter ||
                    `${a.account.name} ${a.account.username}`.toLowerCase().includes(filter)
                )
                .filter((a) => filter || a.items.some((x) => !x.portal))
                .map((a) => (
                  <li
                    key={a.account.id}
                    className="flex flex-col gap-2 p-4 md:flex-row md:items-start"
                  >
                    <Link
                      href={`/admin/accounts/${a.account.id}`}
                      className="flex w-56 shrink-0 flex-col hover:underline"
                    >
                      <span className="font-medium">{a.account.name}</span>
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {a.account.username}
                      </span>
                    </Link>
                    <ul className="flex flex-1 flex-wrap gap-2">
                      {a.items.map((x) => (
                        <AssignmentChip
                          key={x.id}
                          id={x.id}
                          role={x.role}
                          where={x.where}
                          removable={x.giveable && !a.self}
                        />
                      ))}
                    </ul>
                  </li>
                ))}
            </ul>
            {filter ? null : (
              <p className="text-xs text-muted-foreground">{t("assignments.portalHidden")}</p>
            )}
          </Section>
        ) : null}
        {tab === "parents" ? (
          <Section
            title={t("tabs.parents")}
            description={t("parents.hint")}
            actions={<LinkChildDialog parents={data.parentAccounts} candidates={data.members} />}
          >
            <ul className="divide-y border">
              {data.parents.map((p) => (
                <li
                  key={p.account.id}
                  className="flex flex-col gap-2 p-4 md:flex-row md:items-start"
                >
                  <span className="flex w-56 shrink-0 flex-col">
                    <span className="font-medium">{p.account.name}</span>
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {p.account.username}
                    </span>
                  </span>
                  {p.children.length === 0 ? (
                    <span className="text-sm text-muted-foreground">{t("parents.noChildren")}</span>
                  ) : (
                    <ul className="flex flex-1 flex-wrap gap-2">
                      {p.children.map((c) => (
                        <ChildChip
                          key={c.id}
                          guardianshipId={c.id}
                          name={c.child.name}
                          groups={[
                            ...c.groups,
                            ...(c.otherGuardians.length > 0
                              ? [t("parents.alsoWith", { names: c.otherGuardians.join(", ") })]
                              : []),
                          ]}
                        />
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </PageBody>
    </>
  )
}
