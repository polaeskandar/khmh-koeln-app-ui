"use client"

/**
 * The church's roles in Settings: what each one allows and how many accounts have it. Roles are
 * listed by name; the ones the church started with are ordinary roles like the others. Anyone
 * who may see roles opens a role's page; changing and deleting depend on the roles permissions.
 */
import { useState } from "react"
import Link from "next/link"
import { Eye, Info, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useServerAction } from "@/hooks/use-server-action"
import { useFormat } from "@/i18n/format"
import { deleteRoleAction } from "@/server/actions/roles"
import type { RoleList, RoleRow } from "@/server/queries/roles"

export function NewRoleButton() {
  const t = useTranslations("settings.roles")
  return (
    <Button asChild size="sm">
      <Link href="/settings/roles/new">
        <Plus data-icon="inline-start" />
        {t("newRole")}
      </Link>
    </Button>
  )
}

export function RolesOverview({ list }: { list: RoleList }) {
  const t = useTranslations("settings.roles")
  const tp = useTranslations("permissions.resources")
  const tc = useTranslations("common")
  const f = useFormat()
  const [deleting, setDeleting] = useState<RoleRow | null>(null)
  const remove = useServerAction(deleteRoleAction)
  const menu = list.can.update || list.can.delete
  return (
    <>
      <div className="overflow-x-auto border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="ps-4">{t("role")}</TableHead>
              <TableHead>{t("allows")}</TableHead>
              <TableHead>{t("accounts")}</TableHead>
              {menu ? (
                <TableHead className="w-12 pe-4">
                  <span className="sr-only">{tc("moreActions")}</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="min-w-44 ps-4 align-top whitespace-normal">
                  <Link
                    href={`/settings/roles/${r.id}`}
                    className="block py-1 font-medium underline-offset-4 hover:underline"
                  >
                    <bdi>{r.name}</bdi>
                  </Link>
                </TableCell>
                <TableCell className="max-w-md min-w-64 align-top text-sm whitespace-normal">
                  <span className="flex flex-col gap-0.5 py-1">
                    <span className="tabular-nums">
                      {t("permissionCount", { count: r.permissions, total: list.total })}
                    </span>
                    {r.resources.length > 0 ? (
                      <span className="text-xs text-pretty text-muted-foreground">
                        {f.list(r.resources.map((x) => tp(`${x}.name`)))}
                      </span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="align-top text-sm">
                  <span className="block py-1 whitespace-nowrap tabular-nums">
                    {t("holders", { count: r.holders })}
                  </span>
                </TableCell>
                {menu ? (
                  <TableCell className="pe-4 text-end align-top">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={t("actionsFor", { role: r.name })}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem asChild>
                          <Link href={`/settings/roles/${r.id}`}>
                            {list.can.update ? <Pencil /> : <Eye />}
                            {list.can.update ? t("edit") : t("view")}
                          </Link>
                        </DropdownMenuItem>
                        {list.can.delete ? (
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(r)}>
                            <Trash2 />
                            {t("delete")}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {t("global")}
          {list.can.update ? null : ` ${t("readOnly")}`}
        </span>
      </p>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? t("deleteTitle", { name: deleting.name }) : ""}
        description={deleting ? t("deleteDescription", { count: deleting.holders }) : ""}
        tone="destructive"
        confirmLabel={t("deleteConfirm")}
        onConfirm={async () => (deleting ? (await remove.execute(deleting.id)).ok : true)}
      />
    </>
  )
}
