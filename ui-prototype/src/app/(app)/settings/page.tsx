import { FlaskConical } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { PageHeader, Section } from "@/components/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AccountRequests } from "@/features/settings/account-requests"
import { DataProtectionSummary } from "@/features/settings/data-protection-summary"
import { MemberAccounts } from "@/features/settings/member-accounts"
import { ParentAccess } from "@/features/settings/parent-access"
import { ResetDemoButton } from "@/features/settings/reset-demo"
import { NewRoleButton, RolesOverview } from "@/features/settings/roles-overview"
import { UsersRoles } from "@/features/settings/users-roles"
import { getFormat } from "@/i18n/server"
import { getAccountRequests } from "@/server/queries/accounts"
import { getDataRequests } from "@/server/queries/privacy"
import { getSettings } from "@/server/queries/settings"
import { getStaffContext } from "@/server/request"

export async function generateMetadata() {
  const t = await getTranslations("nav")
  return { title: t("settings") }
}

export default async function SettingsPage() {
  const ctx = await getStaffContext()
  const [d, accountRequests, dataRequests, t, ta, tn, f] = await Promise.all([
    getSettings(ctx),
    getAccountRequests(ctx),
    getDataRequests(ctx),
    getTranslations("settings"),
    getTranslations("accountRequests"),
    getTranslations("nav"),
    getFormat(),
  ])
  return (
    <>
      <Topbar crumbs={[{ label: tn("settings") }]} />
      <PageBody>
        <PageHeader title={tn("settings")} description={t("description")} />

        {accountRequests ? (
          <Section
            id="account-requests"
            title={ta("title", { count: accountRequests.requests.length })}
            description={ta("description")}
          >
            <AccountRequests data={accountRequests} />
          </Section>
        ) : null}

        {dataRequests ? <DataProtectionSummary data={dataRequests} /> : null}

        {d.users ? (
          <Section
            id="users"
            title={t("users.title")}
            description={
              d.canChangeAccounts ? t("users.description") : t("users.descriptionReadOnly")
            }
          >
            <UsersRoles
              users={d.users}
              roles={d.assignableRoles}
              groups={d.assignableGroups}
              canGive={d.canChangeAccounts}
            />
          </Section>
        ) : null}

        {d.roles ? (
          <Section
            id="roles"
            title={t("roles.title")}
            description={t("roles.description")}
            actions={d.roles.can.create ? <NewRoleButton /> : null}
          >
            <RolesOverview list={d.roles} />
          </Section>
        ) : null}

        {d.parentAccess ? (
          <Section id="parents" title={t("parents.title")} description={t("parents.description")}>
            <ParentAccess access={d.parentAccess} today={d.today} canChange={d.canChangeAccounts} />
          </Section>
        ) : null}

        {d.memberAccounts ? (
          <Section id="members" title={t("members.title")} description={t("members.description")}>
            <MemberAccounts
              accounts={d.memberAccounts}
              today={d.today}
              canChange={d.canChangeAccounts}
            />
          </Section>
        ) : null}

        <div className="grid gap-10 lg:grid-cols-2">
          <Section id="church" title={t("church.title")}>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 border p-5 text-sm">
              <dt className="text-muted-foreground">{t("church.name")}</dt>
              <dd>{d.church.name}</dd>
              <dt className="text-muted-foreground">{t("church.timeZone")}</dt>
              <dd>{d.church.timeZone}</dd>
              <dt className="text-muted-foreground">{t("church.calendar")}</dt>
              <dd>
                {t("church.calendarValue", {
                  date: f.longDate(d.today),
                  coptic: f.copticDate(d.today),
                })}
              </dd>
              <dt className="text-muted-foreground">{t("church.language")}</dt>
              <dd>{t("church.languageValue")}</dd>
            </dl>
          </Section>

          <Section
            id="generator"
            title={t("generator.title")}
            description={t("generator.description")}
          >
            <p className="flex items-start gap-2 border border-dashed p-3 text-sm text-muted-foreground">
              <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t("generator.simulated")}
            </p>
            {d.generatorRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("generator.noRuns")}</p>
            ) : (
              <div className="overflow-x-auto border">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="ps-4">{t("generator.ran")}</TableHead>
                      <TableHead>{t("generator.for")}</TableHead>
                      <TableHead className="pe-4 text-end">{t("generator.created")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.generatorRuns.map((r) => (
                      <TableRow key={r.ranAt}>
                        <TableCell className="ps-4 text-sm">
                          {f.atLabel(r.ranAt, d.today)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {f.list([f.dayMonth(r.today), f.dayMonth(r.tomorrow)])}
                        </TableCell>
                        <TableCell className="pe-4 text-end text-sm tabular-nums">
                          {r.created}{" "}
                          <span className="text-muted-foreground">
                            {t("generator.existing", { count: r.existing })}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Section>
        </div>

        <Section id="prototype" title={t("prototype.title")}>
          <div className="flex flex-col gap-4 border border-dashed p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-prose text-sm text-muted-foreground">
              {t("prototype.data")}{" "}
              {d.clock === "frozen" ? t("prototype.clockFrozen") : t("prototype.clockRunning")}
            </p>
            <ResetDemoButton />
          </div>
        </Section>
      </PageBody>
    </>
  )
}
