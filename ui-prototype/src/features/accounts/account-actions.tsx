"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AtSign, KeyRound, Plus, Trash2, X } from "lucide-react"
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
import { useServerAction } from "@/hooks/use-server-action"
import type { Unit } from "@/lib/domain/types"
import {
  addAccountGroupAction,
  changeUsernameAction,
  endAccountGroupAction,
  resetPasswordAction,
  deleteAccountAction,
} from "@/server/actions/accounts"

import {
  generatePassword,
  HandOverDialog,
  TemporaryPasswordField,
  UsernameField,
} from "./credentials"
import { type ScopeChoice, UnitPicker } from "./scope-picker"

export function ResetPasswordButton({
  accountId,
  name,
  username,
}: {
  accountId: string
  name: string
  username: string
}) {
  const t = useTranslations("accounts.reset")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [handOver, setHandOver] = useState(false)
  const { execute, pending, fieldErrors } = useServerAction(resetPasswordAction, {
    toastOnSuccess: false,
    onSuccess: () => {
      setOpen(false)
      setHandOver(true)
    },
  })

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setPassword(generatePassword())
          setOpen(true)
        }}
      >
        <KeyRound data-icon="inline-start" />
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("title", { name })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <TemporaryPasswordField
            value={password}
            onChange={setPassword}
            error={fieldErrors.temporaryPassword}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button disabled={pending} onClick={() => execute(accountId, password)}>
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <HandOverDialog
        open={handOver}
        name={name}
        username={username}
        password={password}
        onDone={() => {
          setHandOver(false)
          setPassword("")
        }}
      />
    </>
  )
}

export function ChangeUsernameButton({
  accountId,
  username,
}: {
  accountId: string
  username: string
}) {
  const t = useTranslations("accounts.username")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(username)
  const { execute, pending, fieldErrors } = useServerAction(changeUsernameAction, {
    onSuccess: () => setOpen(false),
  })

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setValue(username)
          setOpen(true)
        }}
      >
        <AtSign data-icon="inline-start" />
        {t("change")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <UsernameField value={value} onChange={setValue} error={fieldErrors.username} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button disabled={pending} onClick={() => execute(accountId, value)}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function DeleteAccountButton({ accountId, name }: { accountId: string; name: string }) {
  const t = useTranslations("accounts.delete")
  const router = useRouter()
  const { execute } = useServerAction(deleteAccountAction, {
    onSuccess: () => router.push("/admin/accounts"),
  })

  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive">
          <Trash2 data-icon="inline-start" />
          {t("open")}
        </Button>
      }
      title={t("title", { name })}
      description={t("hint")}
      consequences={[t("removes"), t("keeps")]}
      confirmLabel={t("confirm")}
      tone="destructive"
      onConfirm={async () => (await execute(accountId)).ok}
    />
  )
}

export function GroupsEditor({
  accountId,
  groups,
  scopes,
}: {
  accountId: string
  groups: { id: string; unit: { name: string; serviceId: string; stageId: string | null } }[]
  scopes: ScopeChoice[]
}) {
  const t = useTranslations("accounts.groups")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<Unit[]>([])
  const add = useServerAction(addAccountGroupAction)
  const end = useServerAction(endAccountGroupAction)

  return (
    <div className="flex flex-col gap-3">
      {groups.length === 0 ? <p className="text-sm text-muted-foreground">{t("none")}</p> : null}
      <ul className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <li
            key={g.id}
            className="flex items-center gap-1 border bg-muted/40 py-1 ps-3 pe-1 text-sm"
          >
            <bdi>{g.unit.name}</bdi>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("remove", { name: g.unit.name })}
              onClick={() => end.execute(g.id)}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        {t("add")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addTitle")}</DialogTitle>
            <DialogDescription>{t("addHint")}</DialogDescription>
          </DialogHeader>
          <UnitPicker scopes={scopes} value={chosen} onChange={setChosen} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={add.pending || chosen.length === 0}
              onClick={async () => {
                for (const unit of chosen) {
                  await add.execute(accountId, unit)
                }

                setChosen([])
                setOpen(false)
              }}
            >
              {t("add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
