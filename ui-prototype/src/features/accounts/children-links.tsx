"use client"

import { useMemo, useState } from "react"
import { Link2, Search, X } from "lucide-react"
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

type Child = { id: string; child: { id: string; name: string }; groups: string[] }
type Choice = { id: string; name: string; groups: string[] }

/** The children a parent follows in the parent portal: links, not permissions. */
export function ChildrenLinks({
  accountId,
  name,
  links,
  choices,
}: {
  accountId: string
  name: string
  links: Child[]
  choices: Choice[]
}) {
  const t = useTranslations("accounts.children")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const link = useServerAction(linkChildAction, { onSuccess: () => setOpen(false) })
  const unlink = useServerAction(unlinkChildAction)
  const shown = useMemo(
    () => choices.filter((c) => fold(c.name).includes(fold(query))).slice(0, 8),
    [choices, query]
  )

  return (
    <div className="flex flex-col gap-3">
      {links.length === 0 ? <p className="text-sm text-muted-foreground">{t("none")}</p> : null}
      {links.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {links.map((c) => (
            <li key={c.id} className="flex items-center gap-1 border py-1 ps-3 pe-1 text-sm">
              <span className="flex flex-col leading-tight">
                <span className="font-medium">{c.child.name}</span>
                <span className="text-xs text-muted-foreground">{c.groups.join(" · ")}</span>
              </span>
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("unlink", { name: c.child.name })}
                  >
                    <X />
                  </Button>
                }
                title={t("unlinkTitle", { name: c.child.name })}
                description={t("unlinkHint")}
                confirmLabel={t("unlinkConfirm")}
                tone="destructive"
                onConfirm={async () => (await unlink.execute(c.id)).ok}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Link2 data-icon="inline-start" />
          {t("link")}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={(o) => !link.pending && setOpen(o)}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("linkTitle", { name })}</DialogTitle>
            <DialogDescription>{t("linkHint", { name })}</DialogDescription>
          </DialogHeader>
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              autoFocus
              aria-label={t("search")}
              placeholder={t("search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
          <ul className="flex flex-col divide-y border">
            {shown.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">{t("noChoices")}</li>
            ) : (
              shown.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={link.pending}
                    className="flex w-full flex-col px-3 py-2 text-start text-sm hover:bg-muted/50"
                    onClick={() => void link.execute(accountId, c.id)}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.groups.join(" · ")}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
