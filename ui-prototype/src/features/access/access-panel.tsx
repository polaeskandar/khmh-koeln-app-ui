"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, KeyRound, Pencil, ShieldCheck, UserPlus, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { useServerAction } from "@/hooks/use-server-action"
import type { AccessLine, AccessView, MemberAccess } from "@/lib/view-models"
import { removeManagerAction, revokeGrantAction } from "@/server/actions/access"

import { GrantDialog, type GrantDialogState } from "./grant-dialog"
import { TypeIcon, useAccessWords } from "./labels"

function Source({ line }: { line: AccessLine }) {
  const t = useTranslations("access.panel")

  if (line.from === null) {
    return <span className="text-xs text-primary">{t("here")}</span>
  }

  const text = t("from", { place: line.from.name })

  return line.from.href ? (
    <Link
      href={line.from.href}
      scroll={false}
      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {text}
    </Link>
  ) : (
    <span className="text-xs text-muted-foreground">{text}</span>
  )
}

function Line({
  view,
  member,
  line,
  onChange,
}: {
  view: AccessView
  member: MemberAccess
  line: AccessLine
  onChange: (state: GrantDialogState) => void
}) {
  const t = useTranslations("access.panel")
  const words = useAccessWords()
  const revoke = useServerAction(revokeGrantAction)
  const unmanage = useServerAction(removeManagerAction)
  const name = member.person.name

  if (line.kind === "manager") {
    const church = (line.from?.type ?? view.resource.type) === "church"

    return (
      <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          {church ? (
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          ) : (
            <KeyRound className="size-4 text-primary" aria-hidden="true" />
          )}
          <span className="font-medium">{church ? t("administrator") : t("manages")}</span>
          {church ? (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {t("administratorHint")}
            </span>
          ) : null}
        </span>
        <Source line={line} />
        {line.editable ? (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={t("removeManagerLabel", { name })}>
                <X />
              </Button>
            }
            title={t("removeManagerTitle", { name })}
            description={t("removeManagerHint")}
            confirmLabel={t("removeConfirm")}
            tone="destructive"
            onConfirm={async () => (await unmanage.execute(line.id)).ok}
          />
        ) : null}
      </li>
    )
  }

  const type = line.type!
  const own = type === (line.from?.type ?? view.resource.type)
  const what = own ? (line.from?.name ?? view.resource.name) : words.type(type, true)

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <TypeIcon type={type} className="text-muted-foreground" />
        <span className="font-medium">
          <bdi>{what}</bdi>
        </span>
        <span className="flex flex-wrap gap-1">
          {line.actions.map((a) => (
            <span key={a} className="bg-muted px-1.5 py-0.5 text-xs">
              {words.action(a)}
            </span>
          ))}
        </span>
      </span>
      <Source line={line} />
      {line.editable ? (
        <span className="flex">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("changeLabel", { name, type: what })}
            onClick={() =>
              onChange({ mode: "change", person: member.person, type, actions: line.actions })
            }
          >
            <Pencil />
          </Button>
          <ConfirmDialog
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("removeLabel", { name, type: what })}
              >
                <X />
              </Button>
            }
            title={t("removeTitle", { name })}
            description={t("removeHint", { name })}
            confirmLabel={t("removeConfirm")}
            tone="destructive"
            onConfirm={async () => (await revoke.execute(line.id)).ok}
          />
        </span>
      ) : null}
    </li>
  )
}

/** The selected place: who has access, with what, and whether it was given here or above. */
export function AccessPanel({ view }: { view: AccessView }) {
  const t = useTranslations("access.panel")
  const words = useAccessWords()
  const [dialog, setDialog] = useState<GrantDialogState | null>(null)
  const { resource } = view
  const title = view.type ? words.type(view.type, true) : resource.name

  return (
    <section
      aria-labelledby="access-title"
      className="flex min-w-0 flex-col gap-6 border bg-card p-4 md:p-6"
    >
      <header className="flex flex-col gap-4">
        {view.path.length > 0 || view.type ? (
          <nav aria-label={t("path")}>
            <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
              {[
                ...view.path,
                ...(view.type ? [{ ...resource, href: null as string | null }] : []),
              ].map((p) => (
                <li key={`${p.type}:${p.id}`} className="flex items-center gap-1.5">
                  {p.href ? (
                    <Link
                      href={p.href}
                      scroll={false}
                      className="underline-offset-4 hover:text-foreground hover:underline"
                    >
                      <bdi>{p.name}</bdi>
                    </Link>
                  ) : (
                    <bdi>{p.name}</bdi>
                  )}
                  <span aria-hidden="true">›</span>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center border bg-muted/40">
              <TypeIcon type={view.type ?? resource.type} className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">
                {view.type ? resource.name : words.type(resource.type)}
              </span>
              <h2 id="access-title" className="font-heading text-xl leading-tight font-semibold">
                <bdi>{title}</bdi>
                {resource.detail && !view.type ? (
                  <span className="ms-2 text-base font-normal text-muted-foreground">
                    {resource.detail}
                  </span>
                ) : null}
              </h2>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {view.openHref && !view.type ? (
              <Button asChild variant="outline">
                <Link href={view.openHref}>
                  {t("open")}
                  <ArrowUpRight data-icon="inline-end" className="rtl:-scale-x-100" />
                </Link>
              </Button>
            ) : null}
            {view.canManage && !resource.archived ? (
              <Button onClick={() => setDialog({ mode: "add" })}>
                <UserPlus data-icon="inline-start" />
                {t("add")}
              </Button>
            ) : null}
          </div>
        </div>
        {resource.archived ? (
          <p className="border border-dashed px-3 py-2 text-sm text-muted-foreground">
            {t("archived")}
          </p>
        ) : null}
      </header>

      <section aria-labelledby="access-who" className="flex flex-col gap-3">
        <h3 id="access-who" className="font-heading text-base font-semibold">
          {t("who")}
        </h3>
        {view.members.length === 0 ? (
          <p className="border border-dashed p-5 text-center text-sm text-muted-foreground">
            {t("nobody")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y border">
            {view.members.map((member) => (
              <li
                key={member.person.id}
                className={cn(
                  "flex flex-col gap-1 px-4 py-3",
                  member.lines.every((l) => l.from !== null) && "bg-muted/20"
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center bg-muted text-xs font-semibold text-muted-foreground"
                    aria-hidden="true"
                  >
                    {member.person.initials}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">
                      <bdi>{member.person.name}</bdi>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      <bdi dir="ltr">{member.person.username}</bdi>
                    </span>
                  </span>
                </div>
                <ul className="flex flex-col ps-11">
                  {member.lines.map((line) => (
                    <Line
                      key={line.id}
                      view={view}
                      member={member}
                      line={line}
                      onChange={setDialog}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
      <GrantDialog view={view} state={dialog} onClose={() => setDialog(null)} />
    </section>
  )
}
