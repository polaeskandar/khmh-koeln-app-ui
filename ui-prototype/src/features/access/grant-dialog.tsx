"use client"

import { useMemo, useState } from "react"
import { Check, Search } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"
import { toast } from "sonner"

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
import { FieldError } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { useServerAction } from "@/hooks/use-server-action"
import { fold } from "@/lib/domain/names"
import type { Action, ResourceType } from "@/lib/domain/resources"
import type { AccessPerson, AccessView } from "@/lib/view-models"
import { addManagerAction, saveGrantAction } from "@/server/actions/access"

import { TypeIcon, useAccessWords } from "./labels"

export type GrantDialogState =
  { mode: "add" } | { mode: "change"; person: AccessPerson; type: ResourceType; actions: Action[] }

/**
 * Giving access: a person, what it is for (this resource, or one kind of thing in it), and which
 * of Create, Read, Update and Delete. Administrators may also let the person manage access here.
 */
export function GrantDialog({
  view,
  state,
  onClose,
}: {
  view: AccessView
  state: GrantDialogState | null
  onClose: () => void
}) {
  return state ? (
    <GrantForm key={JSON.stringify(state)} view={view} state={state} onClose={onClose} />
  ) : null
}

function GrantForm({
  view,
  state,
  onClose,
}: {
  view: AccessView
  state: GrantDialogState
  onClose: () => void
}) {
  const t = useTranslations("access.dialog")
  const tc = useTranslations("common")
  const words = useAccessWords()
  const { resource } = view
  const [query, setQuery] = useState("")
  const [personId, setPersonId] = useState(state.mode === "change" ? state.person.id : null)
  const [type, setType] = useState<ResourceType | null>(
    state.mode === "change" ? state.type : (view.options[0]?.type ?? null)
  )
  const [actions, setActions] = useState<Action[]>(state.mode === "change" ? state.actions : [])
  const [manage, setManage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const grant = useServerAction(saveGrantAction, { toastOnSuccess: false })
  const manager = useServerAction(addManagerAction, { toastOnSuccess: false })
  const pending = grant.pending || manager.pending
  const option = view.options.find((o) => o.type === type)
  const people = useMemo(() => {
    const q = fold(query)

    return view.people.filter((p) => fold(`${p.name} ${p.username}`).includes(q)).slice(0, 6)
  }, [view.people, query])
  const where = { type: resource.type, id: resource.id } as Parameters<typeof saveGrantAction>[1]
  const label = (forType: ResourceType) =>
    forType === resource.type ? resource.name : words.type(forType, true)

  const save = async () => {
    setError(null)

    if (!personId || (actions.length === 0 && !manage)) {
      setError(t("chooseSomething"))

      return
    }

    let message: string | undefined

    if (actions.length > 0 && type) {
      const result = await grant.execute(personId, where, type, actions)

      if (!result.ok) {
        return
      }

      message = result.message
    }

    if (manage) {
      const result = await manager.execute(personId, where)

      if (!result.ok) {
        return
      }

      message = result.message
    }

    if (message) {
      toast.success(message)
    }

    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="flex max-h-[92svh] flex-col gap-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{state.mode === "add" ? t("addTitle") : t("changeTitle")}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <TypeIcon type={view.type ?? resource.type} className="size-3.5" />
            {t("for", {
              place: view.type
                ? `${resource.name} › ${words.type(view.type, true)}`
                : resource.name,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 flex min-h-0 flex-col gap-5 overflow-y-auto px-1">
          <section className="flex flex-col gap-2" aria-labelledby="grant-person">
            <h3 id="grant-person" className="text-sm font-medium">
              {t("person")}
            </h3>
            {state.mode === "change" ? (
              <p className="border bg-muted/30 px-3 py-2 text-sm font-medium">
                {state.person.name}
              </p>
            ) : (
              <>
                <InputGroup>
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    autoFocus
                    aria-label={t("searchPerson")}
                    placeholder={t("searchPerson")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </InputGroup>
                <ul
                  role="radiogroup"
                  aria-labelledby="grant-person"
                  className="flex flex-col gap-1"
                >
                  {people.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-muted-foreground">{t("noPeople")}</li>
                  ) : (
                    people.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={p.id === personId}
                          onClick={() => setPersonId(p.id)}
                          className={cn(
                            "flex w-full items-center gap-3 border px-3 py-2 text-start text-sm hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                            p.id === personId && "border-primary bg-primary/5"
                          )}
                        >
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="font-medium">{p.name}</span>
                            <span className="text-xs text-muted-foreground" dir="ltr">
                              {p.username}
                            </span>
                          </span>
                          {p.id === personId ? (
                            <Check className="size-4 text-primary" aria-hidden="true" />
                          ) : null}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                <p className="text-xs text-muted-foreground">{t("accountsOnly")}</p>
              </>
            )}
          </section>

          {view.options.length > 1 && state.mode === "add" ? (
            <section className="flex flex-col gap-2" aria-labelledby="grant-what">
              <h3 id="grant-what" className="text-sm font-medium">
                {t("what")}
              </h3>
              <div
                role="radiogroup"
                aria-labelledby="grant-what"
                className="flex flex-wrap gap-1.5"
              >
                {view.options.map((o) => (
                  <button
                    key={o.type}
                    type="button"
                    role="radio"
                    aria-checked={o.type === type}
                    onClick={() => {
                      setType(o.type)
                      setActions([])
                    }}
                    className={cn(
                      "flex items-center gap-1.5 border px-3 py-1.5 text-sm hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                      o.type === type && "border-primary bg-primary/5 font-medium"
                    )}
                  >
                    <TypeIcon type={o.type} className="size-3.5 text-muted-foreground" />
                    {label(o.type)}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {option ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">
                {t("permissions")}
                {state.mode === "change" || view.options.length === 1 ? (
                  <span className="font-normal text-muted-foreground"> · {label(option.type)}</span>
                ) : null}
              </legend>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {option.actions.map(({ action, allowed }) => {
                  const checked = actions.includes(action)

                  return (
                    <label
                      key={action}
                      className={cn(
                        "flex items-center gap-2 border px-3 py-2 text-sm",
                        checked && "border-primary bg-primary/5",
                        !allowed && "text-muted-foreground"
                      )}
                      title={allowed ? undefined : t("notYours")}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!allowed}
                        onCheckedChange={(on) =>
                          setActions(
                            on ? [...actions, action] : actions.filter((a) => a !== action)
                          )
                        }
                      />
                      {words.action(action)}
                    </label>
                  )
                })}
              </div>
              {option.actions.some((a) => !a.allowed) ? (
                <p className="text-xs text-muted-foreground">{t("notYours")}</p>
              ) : null}
            </fieldset>
          ) : null}

          {view.canChooseManagers && state.mode === "add" ? (
            <label className="flex items-start gap-2.5 border px-3 py-2.5 text-sm">
              <Checkbox
                checked={manage}
                onCheckedChange={(on) => setManage(on === true)}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">
                  {resource.type === "church" ? t("manageChurch") : t("manage")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {resource.type === "church" ? t("manageChurchHint") : t("manageHint")}
                </span>
              </span>
            </label>
          ) : null}

          {error ? <FieldError>{error}</FieldError> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {tc("cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
