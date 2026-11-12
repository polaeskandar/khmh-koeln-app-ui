import Link from "next/link"
import { Search } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { AccountStatusBadge } from "@/components/account-status"
import { PageBody, Topbar } from "@/components/app-shell/topbar"
import { LinkTabs } from "@/components/link-tabs"
import { MemberAvatar } from "@/components/member-avatar"
import { PageHeader } from "@/components/page-header"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { NewAccountDialog } from "@/features/accounts/new-account-dialog"
import { getFormat } from "@/i18n/server"
import { today } from "@/server/mock/clock"
import { type AccountFilter, getAccountForm, getAccounts } from "@/server/queries/admin"
import { getStaffContext } from "@/server/request"

const FILTERS: AccountFilter[] = ["all", "staff", "parents", "members"]

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("accounts") }
}

export default async function AccountsPage({ searchParams }: PageProps<"/admin/accounts">) {
  const query = await searchParams
  const q = typeof query.q === "string" ? query.q : ""
  const filter = FILTERS.includes(query.show as AccountFilter)
    ? (query.show as AccountFilter)
    : "all"
  const ctx = await getStaffContext()
  const data = getAccounts(ctx, q, filter)
  const t = await getTranslations("accounts")
  const tn = await getTranslations("nav")
  const f = await getFormat()
  const href = (show: AccountFilter) =>
    `/admin/accounts?show=${show}${q ? `&q=${encodeURIComponent(q)}` : ""}`
  const now = today()

  return (
    <>
      <Topbar crumbs={[{ label: tn("administration") }, { label: t("title") }]} />
      <PageBody>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={<NewAccountDialog form={getAccountForm(ctx)} />}
        />
        <form className="max-w-md" role="search">
          <input type="hidden" name="show" value={filter} />
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              name="q"
              defaultValue={q}
              placeholder={t("search")}
              aria-label={t("search")}
            />
          </InputGroup>
        </form>
        <LinkTabs
          label={t("title")}
          active={filter}
          items={FILTERS.map((x) => ({
            key: x,
            href: href(x),
            label: t(`filters.${x}`),
            count: data.counts[x],
          }))}
        />
        <div className="border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.person")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("columns.roles")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("columns.lastSignIn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/admin/accounts/${r.id}`}
                      className="flex items-center gap-3 hover:underline"
                    >
                      <MemberAvatar name={r.name} initials={r.initials} seed={r.id} />
                      <span className="flex flex-col">
                        <span className="font-medium">{r.name}</span>
                        <span className="text-xs text-muted-foreground" dir="ltr">
                          {r.username}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden max-w-md md:table-cell">
                    <span className="line-clamp-2 text-sm text-muted-foreground">
                      {r.roles.map((x) => (x.where ? `${x.role} · ${x.where}` : x.role)).join(", ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <AccountStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {r.lastSignInAt ? f.instantLabel(r.lastSignInAt, now) : t("never")}
                  </TableCell>
                </TableRow>
              ))}
              {data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    {t("noResults")}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </PageBody>
    </>
  )
}
