import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { AccountStatusBadge } from "@/components/account-status"
import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader, Section } from "@/components/page-header"
import {
  ChangeUsernameButton,
  DeleteAccountButton,
  GroupsEditor,
  ResetPasswordButton,
} from "@/features/accounts/account-actions"
import { AssignmentChip, AssignRoleDialog } from "@/features/access/access-dialogs"
import { getFormat } from "@/i18n/server"
import { today } from "@/server/mock/clock"
import { getAccess, getAccount } from "@/server/queries/admin"
import { getStaffContext } from "@/server/request"

export default async function AccountPage({ params }: PageProps<"/admin/accounts/[accountId]">) {
  const { accountId } = await params
  const ctx = await getStaffContext()
  const a = getAccount(ctx, accountId)
  const access = a.can.access ? getAccess(ctx) : null
  const t = await getTranslations("accounts")
  const tn = await getTranslations("nav")
  const f = await getFormat()
  const now = today()

  return (
    <>
      <Topbar crumbs={[{ label: tn("accounts"), href: "/admin/accounts" }, { label: a.name }]} />
      <PageBody>
        <PageHeader
          title={a.name}
          meta={<AccountStatusBadge status={a.status} />}
          description={t("createdBy", {
            date: f.mediumDate(a.createdAt.slice(0, 10)),
            name: a.createdBy ?? t("system"),
          })}
          actions={a.self ? null : <DeleteAccountButton accountId={a.id} name={a.name} />}
        />
        <Section title={t("signIn.title")} description={t("signIn.hint")}>
          <ul className="divide-y border bg-card">
            <li className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{t("signIn.username")}</span>
                <span className="font-mono font-semibold" dir="ltr">
                  {a.username}
                </span>
              </div>
              {a.self ? null : <ChangeUsernameButton accountId={a.id} username={a.username} />}
            </li>
            <li className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{t("signIn.password")}</span>
                <span className="text-sm">
                  {a.status === "mustChange"
                    ? t("signIn.mustChange")
                    : a.passwordChangedAt
                      ? t("signIn.changedOn", {
                          date: f.mediumDate(a.passwordChangedAt.slice(0, 10)),
                        })
                      : t("signIn.unknown")}
                </span>
              </div>
              {a.self ? null : (
                <ResetPasswordButton accountId={a.id} name={a.name} username={a.username} />
              )}
            </li>
            <li className="flex flex-col gap-0.5 p-4">
              <span className="text-xs text-muted-foreground">{t("signIn.lastSignIn")}</span>
              <span className="text-sm">
                {a.lastSignInAt ? f.instantLabel(a.lastSignInAt, now) : t("never")}
              </span>
            </li>
          </ul>
        </Section>
        <Section
          title={t("roles.title")}
          description={t("roles.hint")}
          actions={
            access && !a.self ? (
              <AssignRoleDialog
                accounts={access.accounts}
                roles={access.roles}
                scopes={access.scopes}
                fixedAccount={{ id: a.id, name: a.name, username: a.username }}
              />
            ) : null
          }
        >
          <ul className="flex flex-wrap gap-2">
            {a.roles.map((r) => (
              <AssignmentChip
                key={r.id}
                id={r.id}
                role={r.role}
                where={r.where}
                removable={!!access && !a.self}
              />
            ))}
          </ul>
          <Link
            href="/admin/access?tab=assignments"
            className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
          >
            {t("roles.manage")}
            <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
          </Link>
        </Section>
        {a.kinds.member || a.groups.length > 0 ? (
          <Section title={t("groups.title")} description={t("groups.hint")}>
            <GroupsEditor accountId={a.id} groups={a.groups} scopes={a.scopes} />
          </Section>
        ) : null}
        {a.kinds.parent ? (
          <Section title={t("children.title")} description={t("children.hint")}>
            {a.children.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("children.none")}</p>
            ) : null}
            <ul className="flex flex-wrap gap-2">
              {a.children.map((c) => (
                <li key={c.id} className="flex flex-col border px-3 py-1.5 text-sm">
                  <span className="font-medium">{c.child.name}</span>
                  <span className="text-xs text-muted-foreground">{c.groups.join(" · ")}</span>
                </li>
              ))}
            </ul>
            {a.can.guardians ? (
              <Link
                href="/admin/access?tab=parents"
                className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
              >
                {t("children.manage")}
                <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
              </Link>
            ) : null}
          </Section>
        ) : null}
      </PageBody>
    </>
  )
}
