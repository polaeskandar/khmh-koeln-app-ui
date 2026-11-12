"use client"

import { useState } from "react"
import { BadgeCheck, Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { TextField } from "@/components/form-fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useServerAction } from "@/hooks/use-server-action"
import {
  addChurchEventAction,
  removeChurchEventAction,
  verifyYearAction,
} from "@/server/actions/calendar"

export function VerifyYearButton({ year, count }: { year: number; count: number }) {
  const t = useTranslations("calendar")
  const { execute } = useServerAction(verifyYearAction)

  return (
    <ConfirmDialog
      trigger={
        <Button>
          <BadgeCheck data-icon="inline-start" />
          {t("verify", { year: String(year) })}
        </Button>
      }
      title={t("verifyTitle", { year: String(year) })}
      description={t("verifyHint", { count })}
      confirmLabel={t("verify", { year: String(year) })}
      onConfirm={async () => (await execute(year)).ok}
    />
  )
}

export function RemoveEventButton({ id, name }: { id: string; name: string }) {
  const t = useTranslations("calendar")
  const tc = useTranslations("common")
  const { execute } = useServerAction(removeChurchEventAction)

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-xs" aria-label={t("removeEvent", { name })}>
          <Trash2 />
        </Button>
      }
      title={t("removeEvent", { name })}
      description={t("removeHint")}
      confirmLabel={tc("delete")}
      tone="destructive"
      onConfirm={async () => (await execute(id)).ok}
    />
  )
}

export function AddEventDialog({
  year,
  services,
}: {
  year: number
  services: { id: string; name: string }[]
}) {
  const t = useTranslations("calendar.event")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(`${year}-06-27`)
  const [name, setName] = useState("")
  const [mode, setMode] = useState<"suggested" | "mandatory">("mandatory")
  const [all, setAll] = useState(true)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const { execute, pending, fieldErrors } = useServerAction(addChurchEventAction)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        {t("add")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5">
            <TextField
              label={t("name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
            />
            <TextField
              type="date"
              label={t("date")}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={fieldErrors.date}
            />
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as "suggested" | "mandatory")}
              className="gap-3"
            >
              {(["mandatory", "suggested"] as const).map((m) => (
                <label key={m} className="flex items-start gap-3 text-sm">
                  <RadioGroupItem value={m} className="mt-0.5" />
                  <span className="flex flex-col">
                    <span className="font-medium">{t(`mode.${m}`)}</span>
                    <span className="text-xs text-muted-foreground">{t(`modeHint.${m}`)}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 text-sm font-medium">
                <Checkbox checked={all} onCheckedChange={(v) => setAll(v === true)} />
                {t("allServices")}
              </label>
              {all ? null : (
                <ul className="grid gap-2 ps-7 sm:grid-cols-2">
                  {services.map((x) => (
                    <li key={x.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={chosen.has(x.id)}
                          onCheckedChange={(v) => {
                            const next = new Set(chosen)

                            if (v) {
                              next.add(x.id)
                            } else {
                              next.delete(x.id)
                            }

                            setChosen(next)
                          }}
                        />
                        {x.name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={pending}
              onClick={async () => {
                const result = await execute({
                  date,
                  name,
                  mode,
                  serviceIds: all ? [] : [...chosen],
                })

                if (result.ok) {
                  setOpen(false)
                  setName("")
                }
              }}
            >
              {t("add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
