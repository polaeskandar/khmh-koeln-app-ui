"use client"

import { useMemo, useState } from "react"
import { Link2, Search, Users, X } from "lucide-react"
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
} from "@/components/ui/dialog"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { useServerAction } from "@/hooks/use-server-action"
import { fold } from "@/lib/domain/names"
import { linkChildAction, unlinkChildAction } from "@/server/actions/accounts"
import type { getParentalAccess } from "@/server/queries/admin"

type Option = { id: string; name: string; username?: string; groups?: string[] }

function Picker({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string
  options: Option[]
  value: string | null
  onChange: (id: string) => void
  placeholder: string
}) {
  const [query, setQuery] = useState("")
  const shown = useMemo(
    () =>
      options
        .filter((o) => fold(`${o.name} ${o.username ?? ""}`).includes(fold(query)))
        .slice(0, 6),
    [options, query]
  )
  const selected = options.find((o) => o.id === value)

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {selected ? (
        <div className="flex items-center justify-between border border-primary bg-primary/5 px-3 py-2 text-sm">
          <span>
            <span className="font-medium">{selected.name}</span>
            {selected.username ? (
              <span className="text-muted-foreground" dir="ltr">
                {" "}
                · {selected.username}
              </span>
            ) : null}
          </span>
          <Button variant="ghost" size="icon-xs" aria-label={label} onClick={() => onChange("")}>
            <X />
          </Button>
        </div>
      ) : (
        <>
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={label}
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
          <ul className="divide-y border">
            {shown.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="flex w-full flex-col px-3 py-2 text-start text-sm hover:bg-muted/50"
                  onClick={() => onChange(o.id)}
                >
                  <span className="font-medium">{o.name}</span>
                  <span
                    className="text-xs text-muted-foreground"
                    dir={o.username ? "ltr" : undefined}
                  >
                    {o.username ?? o.groups?.join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function LinkChildDialog({ parents, candidates }: { parents: Option[]; candidates: Option[] }) {
  const t = useTranslations("access.parents")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [parentId, setParentId] = useState<string | null>(null)
  const [memberId, setMemberId] = useState<string | null>(null)
  const { execute, pending } = useServerAction(linkChildAction, { onSuccess: () => setOpen(false) })

  return (
    <>
      <Button
        onClick={() => {
          setParentId(null)
          setMemberId(null)
          setOpen(true)
        }}
      >
        <Link2 data-icon="inline-start" />
        {t("link")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("linkTitle")}</DialogTitle>
            <DialogDescription>{t("linkHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5">
            <Picker
              label={t("parent")}
              options={parents}
              value={parentId}
              onChange={(id) => setParentId(id || null)}
              placeholder={t("searchParent")}
            />
            <Picker
              label={t("member")}
              options={candidates}
              value={memberId}
              onChange={(id) => setMemberId(id || null)}
              placeholder={t("searchMember")}
            />
            <p className="text-xs text-muted-foreground">{t("membersOnly")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={pending || !parentId || !memberId}
              onClick={() => execute(parentId!, memberId!)}
            >
              {t("link")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ChildChip({
  guardianshipId,
  name,
  groups,
  canUnlink,
}: {
  guardianshipId: string
  name: string
  groups: string[]
  canUnlink: boolean
}) {
  const t = useTranslations("access.parents")
  const unlink = useServerAction(unlinkChildAction)

  return (
    <li className="flex items-center gap-1 border bg-background py-1 ps-3 pe-1 text-sm">
      <span className="flex flex-col leading-tight">
        <span className="font-medium">{name}</span>
        <span className="text-xs text-muted-foreground">{groups.join(" · ") || t("noGroup")}</span>
      </span>
      {canUnlink ? (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-xs" aria-label={t("unlink", { name })}>
              <X />
            </Button>
          }
          title={t("unlinkTitle", { name })}
          description={t("unlinkHint")}
          confirmLabel={t("unlinkConfirm")}
          tone="destructive"
          onConfirm={async () => (await unlink.execute(guardianshipId)).ok}
        />
      ) : null}
    </li>
  )
}

/**
 * Parental access: relationships between a parent's account and the members they follow. They are
 * not roles: the Parent role only opens the portal, these links decide which children it shows.
 */
export function ParentalAccess({ data }: { data: ReturnType<typeof getParentalAccess> }) {
  const t = useTranslations("access.parents")
  const [query, setQuery] = useState("")
  const parents = useMemo(() => {
    const q = fold(query)

    return data.parents.filter(
      (p) =>
        q === "" ||
        fold(
          `${p.account.name} ${p.account.username} ${p.children.map((c) => c.child.name).join(" ")}`
        ).includes(q)
    )
  }, [data.parents, query])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 border bg-card p-4 md:flex-row md:items-center md:justify-between">
        <p className="flex max-w-[70ch] items-start gap-2 text-sm text-muted-foreground">
          <Users className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("hint")}
        </p>
        {data.canLink ? (
          <LinkChildDialog parents={data.parentAccounts} candidates={data.members} />
        ) : null}
      </div>
      <InputGroup className="md:max-w-sm">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={t("search")}
          placeholder={t("search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InputGroup>
      <ul className="divide-y border bg-card">
        {parents.map((p) => (
          <li key={p.account.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-start">
            <span className="flex w-60 shrink-0 items-center gap-3">
              <span
                className="flex size-8 shrink-0 items-center justify-center bg-muted text-xs font-semibold text-muted-foreground"
                aria-hidden="true"
              >
                {p.initials}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{p.account.name}</span>
                <span className="text-xs text-muted-foreground" dir="ltr">
                  {p.account.username}
                </span>
              </span>
            </span>
            {p.children.length === 0 ? (
              <span className="text-sm text-muted-foreground">{t("noChildren")}</span>
            ) : (
              <ul className="flex flex-1 flex-wrap gap-2">
                {p.children.map((c) => (
                  <ChildChip
                    key={c.id}
                    guardianshipId={c.id}
                    name={c.child.name}
                    canUnlink={data.canUnlink}
                    groups={[
                      ...c.groups,
                      ...(c.otherGuardians.length > 0
                        ? [t("alsoWith", { names: c.otherGuardians.join(", ") })]
                        : []),
                    ]}
                  />
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
