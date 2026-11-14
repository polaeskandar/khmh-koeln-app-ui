"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  HandHeart,
  Plus,
  Search,
  UserPlus,
  UserRound,
  UsersRound,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { useServerAction } from "@/hooks/use-server-action"
import { fold } from "@/lib/domain/names"
import { ROLE_IDS } from "@/lib/domain/policy"
import type { Unit } from "@/lib/domain/types"
import { suggestUsername } from "@/lib/domain/username"
import { refKey } from "@/lib/domain/resources"
import type { ResourceLabel } from "@/lib/view-models"
import { createAccountAction } from "@/server/actions/accounts"
import type { getAccountForm } from "@/server/queries/admin"

import {
  generatePassword,
  HandOverDialog,
  TemporaryPasswordField,
  UsernameField,
} from "./credentials"
import { UnitPicker } from "./scope-picker"

type Form = ReturnType<typeof getAccountForm>
type Chosen = { roleId: string; resource: ResourceLabel }

const PRESETS = [
  { key: "servant", roleId: ROLE_IDS.servant, icon: HandHeart },
  { key: "parent", roleId: ROLE_IDS.parent, icon: UsersRound },
  { key: "member", roleId: ROLE_IDS.member, icon: BookOpenText },
] as const

function PeoplePicker({
  people,
  value,
  onChange,
}: {
  people: Form["people"]
  value: string | null
  onChange: (id: string) => void
}) {
  const t = useTranslations("accounts.create")
  const [query, setQuery] = useState("")
  const shown = people.filter((p) => fold(p.name).includes(fold(query))).slice(0, 6)

  return (
    <div className="flex flex-col gap-2">
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          placeholder={t("searchPeople")}
          aria-label={t("searchPeople")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InputGroup>
      <ul className="divide-y border" role="radiogroup" aria-label={t("existing")}>
        {shown.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              role="radio"
              aria-checked={value === p.id}
              onClick={() => onChange(p.id)}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2 text-start hover:bg-muted/50",
                value === p.id && "bg-primary/10"
              )}
            >
              <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{p.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {p.groups.join(" · ") || t("noGroups")}
                </span>
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted-foreground">{t("noPeople")}</li>
        ) : null}
      </ul>
    </div>
  )
}

export function NewAccountDialog({ form }: { form: Form }) {
  const t = useTranslations("accounts.create")
  const tc = useTranslations("common")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [mode, setMode] = useState<"new" | "existing">("new")
  const [personId, setPersonId] = useState<string | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [roles, setRoles] = useState<Chosen[]>([])
  const [groups, setGroups] = useState<Unit[]>([])
  const [childIds, setChildIds] = useState<string[]>([])
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [created, setCreated] = useState<{ id: string; name: string; username: string } | null>(
    null
  )
  const [localError, setLocalError] = useState<string | null>(null)
  const { execute, pending, fieldErrors, reset } = useServerAction(createAccountAction, {
    toastOnSuccess: false,
    onSuccess: (data) => {
      setOpen(false)
      setCreated(data)
    },
  })
  const person = form.people.find((p) => p.id === personId)
  const name = mode === "existing" ? (person?.name ?? "") : `${firstName} ${lastName}`.trim()
  const duplicate = mode === "new" && name !== "" && form.existingNames.includes(name.toLowerCase())
  const giveable = form.roles.map((o) => o.role)
  const hasRole = (roleId: string) => roles.some((r) => r.roleId === roleId)
  const [childQuery, setChildQuery] = useState("")
  const children = useMemo(
    () =>
      form.members
        .filter((c) => fold(c.name).includes(fold(childQuery)) && c.id !== personId)
        .slice(0, 6),
    [form.members, childQuery, personId]
  )

  const restart = () => {
    setStep(1)
    setMode("new")
    setPersonId(null)
    setFirstName("")
    setLastName("")
    setRoles([])
    setGroups([])
    setChildIds([])
    setUsername("")
    setPassword(generatePassword())
    setLocalError(null)
    reset()
  }

  const toggleRole = (roleId: string) => {
    const option = form.roles.find((o) => o.role.id === roleId)!

    if (hasRole(roleId)) {
      setRoles(roles.filter((r) => r.roleId !== roleId))

      return
    }

    setRoles([...roles, { roleId, resource: option.resources[0] }])
  }

  const next = () => {
    setLocalError(null)

    if (step === 1) {
      if (mode === "existing" ? !personId : !firstName.trim() || !lastName.trim()) {
        setLocalError(mode === "existing" ? t("choosePerson") : t("enterName"))

        return
      }

      setStep(2)

      return
    }

    if (roles.length === 0) {
      setLocalError(t("chooseRole"))

      return
    }

    if (!username) {
      setUsername(
        mode === "existing" && person
          ? suggestUsername(person.firstName, person.lastName)
          : suggestUsername(firstName, lastName)
      )
    }

    setStep(3)
  }

  return (
    <>
      <Button
        onClick={() => {
          restart()
          setOpen(true)
        }}
      >
        <UserPlus data-icon="inline-start" />
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t("step", { step })}
            </p>
            <DialogTitle>
              {step === 1
                ? t("title1")
                : step === 2
                  ? t("title2", { name })
                  : t("title3", { name })}
            </DialogTitle>
            <DialogDescription>
              {step === 1 ? t("hint1") : step === 2 ? t("hint2") : t("hint3")}
            </DialogDescription>
          </DialogHeader>
          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <div role="radiogroup" className="grid grid-cols-2 gap-2">
                {(["new", "existing"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "border p-3 text-start text-sm hover:bg-muted/50",
                      mode === m && "border-primary bg-primary/5 ring-1 ring-primary"
                    )}
                  >
                    <span className="font-medium">{t(`mode.${m}`)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t(`modeHint.${m}`)}
                    </span>
                  </button>
                ))}
              </div>
              {mode === "new" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label={t("firstName")}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    error={fieldErrors.firstName}
                  />
                  <TextField
                    label={t("lastName")}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    error={fieldErrors.lastName}
                  />
                  {duplicate ? (
                    <p className="text-sm text-warning sm:col-span-2" role="status">
                      {t("duplicate", { name })}
                    </p>
                  ) : null}
                </div>
              ) : (
                <PeoplePicker people={form.people} value={personId} onChange={setPersonId} />
              )}
            </div>
          ) : null}
          {step === 2 ? (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.filter((p) => giveable.some((r) => r.id === p.roleId)).map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={hasRole(p.roleId)}
                    onClick={() => toggleRole(p.roleId)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 border p-3 text-start text-sm hover:bg-muted/50",
                      hasRole(p.roleId) && "border-primary bg-primary/5 ring-1 ring-primary"
                    )}
                  >
                    <p.icon className="size-4 text-primary" aria-hidden="true" />
                    <span className="font-medium">{t(`preset.${p.key}`)}</span>
                  </button>
                ))}
              </div>
              <details
                className="border px-3 py-2"
                open={roles.some((r) => !PRESETS.some((p) => p.roleId === r.roleId))}
              >
                <summary className="cursor-pointer text-sm font-medium">{t("otherRoles")}</summary>
                <ul className="mt-2 flex flex-col gap-2">
                  {giveable
                    .filter((r) => !PRESETS.some((p) => p.roleId === r.id))
                    .map((r) => (
                      <li key={r.id}>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={hasRole(r.id)}
                            onCheckedChange={() => toggleRole(r.id)}
                          />
                          {r.name}
                        </label>
                      </li>
                    ))}
                </ul>
              </details>
              {roles.map((chosen) => {
                const option = form.roles.find((o) => o.role.id === chosen.roleId)!

                return option.resources.length < 2 ? null : (
                  <Field key={chosen.roleId}>
                    <FieldLabel htmlFor={`where-${chosen.roleId}`}>
                      {t("where", { role: option.role.name })}
                    </FieldLabel>
                    <NativeSelect
                      id={`where-${chosen.roleId}`}
                      className="w-full"
                      value={refKey(chosen.resource)}
                      onChange={(e) => {
                        const resource = option.resources.find((p) => refKey(p) === e.target.value)!
                        setRoles(
                          roles.map((r) => (r.roleId === chosen.roleId ? { ...r, resource } : r))
                        )
                      }}
                    >
                      {option.resources.map((p) => (
                        <NativeSelectOption key={refKey(p)} value={refKey(p)}>
                          {p.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                )
              })}
              {hasRole(ROLE_IDS.member) ? (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">{t("groups")}</span>
                  <UnitPicker scopes={form.scopes} value={groups} onChange={setGroups} />
                </div>
              ) : null}
              {hasRole(ROLE_IDS.parent) && form.canLinkChildren ? (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">{t("children")}</span>
                  <InputGroup>
                    <InputGroupAddon>
                      <Search />
                    </InputGroupAddon>
                    <InputGroupInput
                      placeholder={t("searchChildren")}
                      aria-label={t("searchChildren")}
                      value={childQuery}
                      onChange={(e) => setChildQuery(e.target.value)}
                    />
                  </InputGroup>
                  <ul className="flex flex-col gap-1.5">
                    {children.map((c) => (
                      <li key={c.id}>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={childIds.includes(c.id)}
                            onCheckedChange={(v) =>
                              setChildIds(
                                v ? [...childIds, c.id] : childIds.filter((x) => x !== c.id)
                              )
                            }
                          />
                          {c.name}
                          <span className="text-xs text-muted-foreground">
                            {c.groups.join(" · ")}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">{t("childrenLater")}</p>
                </div>
              ) : null}
              {fieldErrors.roles || fieldErrors.resource ? (
                <FieldError>{fieldErrors.roles ?? fieldErrors.resource}</FieldError>
              ) : null}
            </div>
          ) : null}
          {step === 3 ? (
            <div className="flex flex-col gap-5">
              <UsernameField value={username} onChange={setUsername} error={fieldErrors.username} />
              <TemporaryPasswordField
                value={password}
                onChange={setPassword}
                error={fieldErrors.temporaryPassword}
              />
              {fieldErrors.personId ? <FieldError>{fieldErrors.personId}</FieldError> : null}
            </div>
          ) : null}
          {localError ? <FieldError>{localError}</FieldError> : null}
          <DialogFooter>
            {step > 1 ? (
              <Button
                variant="outline"
                className="sm:me-auto"
                onClick={() => setStep((step - 1) as 1 | 2)}
                disabled={pending}
              >
                <ArrowLeft data-icon="inline-start" className="rtl:-scale-x-100" />
                {tc("back")}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {tc("cancel")}
            </Button>
            {step < 3 ? (
              <Button onClick={next}>
                {t("next")}
                <ArrowRight data-icon="inline-end" className="rtl:-scale-x-100" />
              </Button>
            ) : (
              <Button
                disabled={pending}
                onClick={() =>
                  execute({
                    personId: mode === "existing" ? personId : null,
                    firstName,
                    lastName,
                    username,
                    temporaryPassword: password,
                    roles: roles.map((r) => ({
                      roleId: r.roleId,
                      resource: { type: r.resource.type, id: r.resource.id } as Parameters<
                        typeof createAccountAction
                      >[0]["roles"][number]["resource"],
                    })),
                    groups,
                    childIds,
                  })
                }
              >
                <Plus data-icon="inline-start" />
                {t("create")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <HandOverDialog
        open={created !== null}
        name={created?.name ?? ""}
        username={created?.username ?? ""}
        password={password}
        onDone={() => {
          const id = created?.id
          setCreated(null)
          setPassword("")

          if (id) {
            router.push(`/admin/accounts/${id}`)
          }
        }}
      />
    </>
  )
}
