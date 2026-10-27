"use client"

/**
 * Parent access (administrators only). A parent sees a child's homework only
 * after an administrator approved the link; knowing a child's name is never
 * enough. Children have no accounts.
 */
import { useState } from "react"
import { Check, Hourglass, Link2, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
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
import type { LocalDate } from "@/lib/domain/types"
import {
  approveGuardianAction,
  linkGuardianAction,
  revokeGuardianAction,
} from "@/server/actions/learning"
import type { SettingsPage } from "@/server/queries/settings"

type Access = NonNullable<SettingsPage["parentAccess"]>
type Link = Access["approved"][number]

/** Names in a sentence, set in medium weight. */
const strong = (chunks: React.ReactNode) => <span className="font-medium">{chunks}</span>

function LinkDialog({ access }: { access: Access }) {
  const t = useTranslations("settings.parents")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [parentId, setParentId] = useState(access.parents[0]?.id ?? "")
  const [childId, setChildId] = useState(access.children[0]?.id ?? "")
  const link = useServerAction(linkGuardianAction, { onSuccess: () => setOpen(false) })
  const groups = [...new Set(access.children.map((c) => c.group))]
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Link2 data-icon="inline-start" />
          {t("give")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("giveTitle")}</DialogTitle>
          <DialogDescription>{t("giveDescription")}</DialogDescription>
        </DialogHeader>
        <form
          id="link-guardian"
          onSubmit={(e) => {
            e.preventDefault()
            link.execute(parentId, childId)
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="guardian-parent">{t("parentAccount")}</FieldLabel>
              <NativeSelect
                id="guardian-parent"
                className="w-full"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                {access.parents.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>
                    {p.name} · {p.email}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="guardian-child">{t("child")}</FieldLabel>
              <NativeSelect
                id="guardian-child"
                className="w-full"
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
              >
                {groups.map((g) => (
                  <NativeSelectOptGroup key={g} label={g}>
                    {access.children
                      .filter((c) => c.group === g)
                      .map((c) => (
                        <NativeSelectOption key={c.id} value={c.id}>
                          {c.name}
                        </NativeSelectOption>
                      ))}
                  </NativeSelectOptGroup>
                ))}
              </NativeSelect>
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={link.pending}>
            {tc("cancel")}
          </Button>
          <Button
            type="submit"
            form="link-guardian"
            disabled={link.pending || !parentId || !childId}
          >
            {link.pending ? <Spinner data-icon="inline-start" /> : null}
            {t("giveAccess")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ParentAccess({ access, today }: { access: Access; today: LocalDate }) {
  const t = useTranslations("settings.parents")
  const f = useFormat()
  const approve = useServerAction(approveGuardianAction)
  const revoke = useServerAction(revokeGuardianAction)
  const [removing, setRemoving] = useState<{ link: Link; pending: boolean } | null>(null)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">
          {t("summary", { count: access.approved.length })}
        </p>
        <LinkDialog access={access} />
      </div>

      {access.pending.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby="pending-access">
          <h3
            id="pending-access"
            className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
          >
            <Hourglass className="size-3.5" aria-hidden="true" />
            {t("waiting", { count: access.pending.length })}
          </h3>
          <ul className="divide-y border-y">
            {access.pending.map((l) => (
              <li key={l.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                  <span>
                    {l.child.group
                      ? t.rich("asksWithGroup", {
                          parent: l.parent.name,
                          child: l.child.name,
                          group: l.child.group,
                          b: strong,
                        })
                      : t.rich("asks", { parent: l.parent.name, child: l.child.name, b: strong })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {l.parent.email} · {t("requested", { when: f.atLabel(l.createdAt, today) })}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => approve.execute(l.id)}
                    disabled={approve.pending}
                  >
                    <Check data-icon="inline-start" />
                    {t("approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRemoving({ link: l, pending: true })}
                  >
                    <X data-icon="inline-start" />
                    {t("decline")}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="overflow-x-auto border">
        <Table className="min-w-[680px]">
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="ps-4">{t("parent")}</TableHead>
              <TableHead>{t("child")}</TableHead>
              <TableHead>{t("approved")}</TableHead>
              <TableHead className="w-28 pe-4">
                <span className="sr-only">{t("actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {access.approved.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="ps-4">
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{l.parent.name}</span>
                    <span className="text-xs text-muted-foreground">{l.parent.email}</span>
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  {l.child.name}
                  {l.child.group ? (
                    <span className="text-muted-foreground"> · {l.child.group}</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {l.approvedAt && l.approvedBy
                    ? t("approvedAtBy", {
                        when: f.atLabel(l.approvedAt, today),
                        name: l.approvedBy,
                      })
                    : l.approvedAt
                      ? f.atLabel(l.approvedAt, today)
                      : l.approvedBy
                        ? t("approvedBy", { name: l.approvedBy })
                        : ""}
                </TableCell>
                <TableCell className="pe-4 text-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemoving({ link: l, pending: false })}
                  >
                    {t("remove")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={
          removing
            ? removing.pending
              ? t("declineTitle", { name: removing.link.parent.name })
              : t("removeTitle", {
                  parent: removing.link.parent.name,
                  child: removing.link.child.name,
                })
            : ""
        }
        description={removing?.pending ? t("declineDescription") : t("removeDescription")}
        tone="destructive"
        confirmLabel={removing?.pending ? t("decline") : t("removeAccess")}
        onConfirm={async () => (removing ? (await revoke.execute(removing.link.id)).ok : true)}
      />
    </div>
  )
}
