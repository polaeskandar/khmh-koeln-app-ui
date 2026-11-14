"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { useTranslations } from "next-intl"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useServerAction } from "@/hooks/use-server-action"
import type { AccessRow, RevocationPreview } from "@/lib/view-models"
import { previewRevocationAction, removeAssignmentAction } from "@/server/actions/access"

import { CapabilityList } from "./labels"

/**
 * Removes one role given on this place, after showing what the person loses here and which of
 * their other roles keep giving access (overlapping roles aren't touched).
 */
export function RevokeButton({ row, place }: { row: AccessRow; place: string }) {
  const t = useTranslations("access.revoke")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<RevocationPreview | null>(null)
  const { execute, pending } = useServerAction(removeAssignmentAction, {
    onSuccess: () => setOpen(false),
  })
  const names = { role: row.role.name, name: row.person.name }

  const show = async () => {
    setOpen(true)
    setPreview(null)
    const result = await previewRevocationAction(row.id)
    setPreview(
      result.ok
        ? result.data
        : { ok: false, problem: result.problem.detail ?? result.problem.title }
    )
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={t("action", names)} onClick={show}>
        <X />
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("title", names)}</AlertDialogTitle>
            <AlertDialogDescription>{t("description", { place })}</AlertDialogDescription>
          </AlertDialogHeader>
          {!preview ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> {tc("loadingEllipsis")}
            </p>
          ) : preview.ok ? (
            <div className="flex flex-col gap-4">
              {preview.loses.length > 0 ? (
                <div className="flex flex-col gap-2 bg-destructive/5 p-3">
                  <span className="text-xs font-semibold tracking-wider text-destructive uppercase">
                    {t("loses", { name: preview.person })}
                  </span>
                  <CapabilityList groups={preview.loses} tone="removed" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("losesNothing", { name: preview.person })}
                </p>
              )}
              {preview.keeps.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {t("keeps")}
                  </span>
                  <ul className="flex flex-col gap-1 text-sm">
                    {preview.keeps.map((k, i) => (
                      <li key={i}>{t(`keep.${k.relation}`, { role: k.role, place: k.scope })}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p role="alert" className="bg-destructive/10 p-3 text-sm text-destructive">
              {preview.problem}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{tc("cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending || !preview?.ok}
              onClick={() => execute(row.id)}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {t("confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
