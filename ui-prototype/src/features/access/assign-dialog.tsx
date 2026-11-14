"use client"

import { useMemo, useState } from "react"
import { Check, ChevronDown, Info, Search, UserPlus } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { useServerAction } from "@/hooks/use-server-action"
import { fold } from "@/lib/domain/names"
import type { AssignmentPreview, AssignOptions, ResourceLabel } from "@/lib/view-models"
import { assignRoleAction, previewAssignmentAction } from "@/server/actions/access"

import { CapabilityList, TypeIcon, useAccessLabels } from "./labels"

type Step = 1 | 2 | 3 | 4

const STEPS = ["person", "role", "scope", "review"] as const

function Choice({
  selected,
  onSelect,
  children,
  name,
}: {
  selected: boolean
  onSelect: () => void
  children: React.ReactNode
  name: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={name}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 border px-3 py-2.5 text-start text-sm transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
        selected && "border-primary bg-primary/5"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center border",
          selected && "border-primary bg-primary text-primary-foreground"
        )}
        aria-hidden="true"
      >
        {selected ? <Check className="size-3" /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">{children}</span>
    </button>
  )
}

/**
 * Giving a role on the selected place, in four steps: an existing person, one of the roles the
 * viewer may give here, the place (this one, or a broader one the viewer controls), and a review of
 * what the person will be able to do. The server checks every rule again on confirming.
 */
export function AssignRoleDialog({
  resource,
  options,
}: {
  resource: ResourceLabel
  options: AssignOptions
}) {
  const t = useTranslations("access.assign")
  const labels = useAccessLabels()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [query, setQuery] = useState("")
  const [personId, setPersonId] = useState<string | null>(null)
  const [roleId, setRoleId] = useState<string | null>(null)
  const [scopeKey, setScopeKey] = useState<string | null>(null)
  const [preview, setPreview] = useState<AssignmentPreview | null>(null)
  const [checking, setChecking] = useState(false)
  const { execute, pending } = useServerAction(assignRoleAction, {
    onSuccess: () => setOpen(false),
  })

  const person = options.people.find((p) => p.id === personId) ?? null
  const role = options.roles.find((r) => r.id === roleId) ?? null
  const scope = role?.scopes.find((s) => `${s.type}:${s.id}` === scopeKey) ?? null
  const people = useMemo(() => {
    const q = fold(query)

    return options.people
      .filter((p) => q === "" || fold(`${p.name} ${p.username}`).includes(q))
      .slice(0, 8)
  }, [options.people, query])

  const start = () => {
    setStep(1)
    setQuery("")
    setPersonId(null)
    setRoleId(options.roles.length === 1 ? options.roles[0].id : null)
    setScopeKey(null)
    setPreview(null)
    setOpen(true)
  }

  const review = async () => {
    if (!person || !role || !scope) {
      return
    }

    setStep(4)
    setChecking(true)
    setPreview(null)
    const result = await previewAssignmentAction(person.id, role.id, {
      type: scope.type,
      id: scope.id,
    } as Parameters<typeof previewAssignmentAction>[2])
    setChecking(false)
    setPreview(
      result.ok
        ? result.data
        : { ok: false, problem: result.problem.detail ?? result.problem.title }
    )
  }

  const next = () => {
    if (step === 1 && person) {
      setStep(2)
    } else if (step === 2 && role) {
      setScopeKey(
        scopeKey && role.scopes.some((s) => `${s.type}:${s.id}` === scopeKey)
          ? scopeKey
          : `${role.scopes[0].type}:${role.scopes[0].id}`
      )
      setStep(3)
    } else if (step === 3 && scope) {
      void review()
    }
  }

  const canNext = (step === 1 && person) || (step === 2 && role) || (step === 3 && scope)

  return (
    <>
      <Button onClick={start}>
        <UserPlus data-icon="inline-start" />
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="flex max-h-[92svh] flex-col gap-5 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5">
              <TypeIcon type={resource.type} className="size-3.5" />
              {t("for", { place: resource.name })}
            </DialogDescription>
          </DialogHeader>

          <ol className="grid grid-cols-4 gap-1" aria-label={t("stepOf", { step })}>
            {STEPS.map((s, i) => (
              <li
                key={s}
                aria-current={step === i + 1 ? "step" : undefined}
                className={cn(
                  "flex flex-col gap-1 border-t-2 pt-1.5 text-[0.65rem] font-semibold tracking-widest uppercase",
                  step > i + 1 && "border-primary text-foreground",
                  step === i + 1 && "border-primary text-primary",
                  step < i + 1 && "border-muted text-muted-foreground"
                )}
              >
                {t(`steps.${s}`)}
              </li>
            ))}
          </ol>

          {step > 1 ? (
            <dl className="flex flex-wrap gap-x-4 gap-y-1 bg-muted/40 px-3 py-2 text-xs">
              {person ? (
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">{t("steps.person")}:</dt>
                  <dd className="font-medium">{person.name}</dd>
                </div>
              ) : null}
              {role && step > 2 ? (
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">{t("steps.role")}:</dt>
                  <dd className="font-medium">{role.name}</dd>
                </div>
              ) : null}
              {scope && step > 3 ? (
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">{t("steps.scope")}:</dt>
                  <dd className="font-medium">{scope.path}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1">
            {step === 1 ? (
              <>
                <div className="flex flex-col gap-1">
                  <h3 className="font-medium">{t("person")}</h3>
                  <p className="text-xs text-muted-foreground">{t("personHint")}</p>
                </div>
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
                <div role="radiogroup" aria-label={t("person")} className="flex flex-col gap-1.5">
                  {people.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">{t("noPeople")}</p>
                  ) : (
                    people.map((p) => (
                      <Choice
                        key={p.id}
                        name={p.name}
                        selected={p.id === personId}
                        onSelect={() => setPersonId(p.id)}
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-muted-foreground" dir="ltr">
                          {p.username}
                        </span>
                      </Choice>
                    ))
                  )}
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <div className="flex flex-col gap-1">
                  <h3 className="font-medium">{t("role")}</h3>
                  <p className="text-xs text-muted-foreground">{t("roleHint")}</p>
                </div>
                <div role="radiogroup" aria-label={t("role")} className="flex flex-col gap-1.5">
                  {options.roles.map((r) => (
                    <Choice
                      key={r.id}
                      name={r.name}
                      selected={r.id === roleId}
                      onSelect={() => setRoleId(r.id)}
                    >
                      <span className="font-medium">{r.name}</span>
                      {r.description ? (
                        <span className="text-xs text-muted-foreground">{r.description}</span>
                      ) : null}
                      {r.includes.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {t("includes", { roles: r.includes.join(", ") })}
                        </span>
                      ) : null}
                    </Choice>
                  ))}
                </div>
                {options.unavailable.length > 0 ? (
                  <Collapsible>
                    <CollapsibleTrigger className="group/why inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                      <Info className="size-3.5" aria-hidden="true" />
                      {t("why")}
                      <ChevronDown className="size-3 transition-transform group-data-[state=open]/why:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="mt-2 flex flex-col gap-1.5 border-s-2 ps-3 text-xs">
                        {options.unavailable.map((u) => (
                          <li key={u.id}>
                            <span className="font-medium">{u.name}</span>
                            <span className="text-muted-foreground"> · {u.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
              </>
            ) : null}

            {step === 3 && role ? (
              <>
                <div className="flex flex-col gap-1">
                  <h3 className="font-medium">{t("scope")}</h3>
                  <p className="text-xs text-muted-foreground">{t("scopeHint")}</p>
                </div>
                <div role="radiogroup" aria-label={t("scope")} className="flex flex-col gap-1.5">
                  {role.scopes.map((s, i) => {
                    const key = `${s.type}:${s.id}`
                    const label =
                      i === 0 ? t("here", { place: s.name }) : t("all", { place: s.name })

                    return (
                      <Choice
                        key={key}
                        name={label}
                        selected={key === scopeKey}
                        onSelect={() => setScopeKey(key)}
                      >
                        <span className="flex items-center gap-2 font-medium">
                          <TypeIcon type={s.type} className="size-3.5 text-muted-foreground" />
                          {label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {labels.type(s.type)} · {s.path}
                        </span>
                      </Choice>
                    )
                  })}
                </div>
                <div className="flex flex-col gap-1.5 bg-muted/40 p-3">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {t("allows", { role: role.name })}
                  </span>
                  <CapabilityList groups={role.capabilities} />
                </div>
              </>
            ) : null}

            {step === 4 ? (
              checking || !preview ? (
                <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Spinner /> {t("checking")}
                </p>
              ) : preview.ok ? (
                <div className="flex flex-col gap-4">
                  <p className="border-s-2 border-primary ps-3 text-sm">
                    {t("summary", {
                      name: preview.person,
                      role: preview.role,
                      place: preview.scope,
                    })}
                  </p>
                  {preview.gains.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        {t("gains", { name: preview.person })}
                      </h3>
                      <CapabilityList groups={preview.gains} tone="added" />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("nothingNew", { name: preview.person })}
                    </p>
                  )}
                  {preview.already.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        {t("already", { name: preview.person })}
                      </h3>
                      <CapabilityList groups={preview.already} tone="muted" />
                    </div>
                  ) : null}
                  {preview.includes.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("includes", { roles: preview.includes.join(", ") })}
                    </p>
                  ) : null}
                  {preview.delegation.length > 0 ? (
                    <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {preview.delegation.map((d) => (
                        <li key={d.role}>
                          {t("delegates", { role: d.role, places: labels.types(d.at) })}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {preview.overlaps.length > 0 ? (
                    <ul className="flex flex-col gap-1 border border-dashed p-3 text-xs">
                      {preview.overlaps.map((o, i) => (
                        <li key={i}>
                          {o.relation === "above"
                            ? t("overlapAbove", { role: o.role, place: o.scope })
                            : t("overlapBelow", { role: o.role, place: o.scope })}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <p role="alert" className="bg-destructive/10 p-3 text-sm text-destructive">
                  {preview.problem}
                </p>
              )
            ) : null}
          </div>

          <DialogFooter>
            {step > 1 ? (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => setStep((step - 1) as Step)}
              >
                {t("back")}
              </Button>
            ) : null}
            {step < 4 ? (
              <Button disabled={!canNext} onClick={next}>
                {t("next")}
              </Button>
            ) : (
              <Button
                disabled={pending || checking || !preview?.ok}
                onClick={() =>
                  execute(person!.id, role!.id, {
                    type: scope!.type,
                    id: scope!.id,
                  } as Parameters<typeof assignRoleAction>[2])
                }
              >
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {t("confirm")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
