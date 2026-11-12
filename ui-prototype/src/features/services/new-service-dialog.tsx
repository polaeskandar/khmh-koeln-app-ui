"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Layers,
  Plus,
  Rows3,
  Trash2,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { TextAreaField, TextField } from "@/components/form-fields"
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
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useServerAction } from "@/hooks/use-server-action"
import type { ServiceStructure } from "@/lib/domain/types"
import { createServiceAction } from "@/server/actions/services"

type StageDraft = { key: number; name: string; description: string }

export function StructureChoice({
  value,
  onChange,
}: {
  value: ServiceStructure | null
  onChange: (value: ServiceStructure) => void
}) {
  const t = useTranslations("services.create")
  const options: { value: ServiceStructure; icon: typeof Layers; title: string; hint: string }[] = [
    { value: "stages", icon: Layers, title: t("withStages"), hint: t("withStagesHint") },
    { value: "single", icon: Rows3, title: t("withoutStages"), hint: t("withoutStagesHint") },
  ]

  return (
    <div
      role="radiogroup"
      aria-label={t("structureQuestion")}
      className="grid gap-2 sm:grid-cols-2"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex flex-col gap-1.5 border p-4 text-start transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            value === o.value && "border-primary bg-primary/5 ring-1 ring-primary"
          )}
        >
          <o.icon className="size-5 text-primary" aria-hidden="true" />
          <span className="font-medium">{o.title}</span>
          <span className="text-xs text-pretty text-muted-foreground">{o.hint}</span>
        </button>
      ))}
    </div>
  )
}

export function StageRows({
  stages,
  onChange,
  errors,
}: {
  stages: StageDraft[]
  onChange: (stages: StageDraft[]) => void
  errors: Record<string, string>
}) {
  const t = useTranslations("services.create")
  const [next, setNext] = useState(stages.length + 1)
  const update = (key: number, patch: Partial<StageDraft>) =>
    onChange(stages.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  const move = (index: number, by: number) => {
    const copy = [...stages]
    ;[copy[index], copy[index + by]] = [copy[index + by], copy[index]]
    onChange(copy)
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {stages.map((stage, index) => (
          <li key={stage.key} className="flex items-start gap-2 border p-3">
            <span className="mt-2 w-5 shrink-0 text-center text-sm text-muted-foreground tabular-nums">
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Input
                aria-label={t("stageName", { position: index + 1 })}
                placeholder={t("stageNamePlaceholder")}
                value={stage.name}
                aria-invalid={errors[`stages.${index}`] ? true : undefined}
                onChange={(e) => update(stage.key, { name: e.target.value })}
              />
              <Input
                aria-label={t("stageDescription", { position: index + 1 })}
                placeholder={t("stageDescriptionPlaceholder")}
                value={stage.description}
                onChange={(e) => update(stage.key, { description: e.target.value })}
                className="h-8 text-xs"
              />
              {errors[`stages.${index}`] ? (
                <FieldError>{errors[`stages.${index}`]}</FieldError>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t("moveUp", { name: stage.name || String(index + 1) })}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t("moveDown", { name: stage.name || String(index + 1) })}
                disabled={index === stages.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t("removeStage", { name: stage.name || String(index + 1) })}
                onClick={() => onChange(stages.filter((x) => x.key !== stage.key))}
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => {
          onChange([...stages, { key: next, name: "", description: "" }])
          setNext(next + 1)
        }}
      >
        <Plus data-icon="inline-start" />
        {t("addStage")}
      </Button>
      {errors.stages ? <FieldError>{errors.stages}</FieldError> : null}
    </div>
  )
}

export function NewServiceDialog() {
  const t = useTranslations("services.create")
  const tc = useTranslations("common")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [structure, setStructure] = useState<ServiceStructure | null>(null)
  const [stages, setStages] = useState<StageDraft[]>([{ key: 0, name: "", description: "" }])
  const [structureError, setStructureError] = useState<string | null>(null)
  const { execute, pending, fieldErrors, reset } = useServerAction(createServiceAction, {
    onSuccess: (id) => {
      setOpen(false)
      router.push(`/services/${id}`)
    },
  })

  const restart = () => {
    setStep(1)
    setName("")
    setDescription("")
    setStructure(null)
    setStages([{ key: 0, name: "", description: "" }])
    setStructureError(null)
    reset()
  }

  const submit = async () => {
    const result = await execute({
      name,
      description: description.trim() || null,
      structure: structure!,
      stages:
        structure === "stages"
          ? stages.map((x) => ({ name: x.name, description: x.description.trim() || null }))
          : [],
    })

    if (
      !result.ok &&
      (result.problem.fieldErrors?.name || result.problem.fieldErrors?.description)
    ) {
      setStep(1)
    }
  }

  const proceed = () => {
    if (!structure) {
      setStructureError(t("chooseStructure"))

      return
    }

    if (structure === "stages") {
      setStep(2)

      return
    }

    void submit()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)

        if (next) {
          restart()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          {t("open")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("step", { step, total: structure === "stages" ? 2 : 1 })}
          </p>
          <DialogTitle>
            {step === 1 ? t("title") : t("stagesTitle", { name: name.trim() })}
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? t("description") : t("stagesDescription")}
          </DialogDescription>
        </DialogHeader>
        {step === 1 ? (
          <div className="flex flex-col gap-5">
            <TextField
              label={t("name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
              placeholder={t("namePlaceholder")}
              autoFocus
            />
            <TextAreaField
              label={t("descriptionLabel")}
              optional
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={fieldErrors.description}
            />
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{t("structureQuestion")}</p>
              <StructureChoice
                value={structure}
                onChange={(value) => {
                  setStructure(value)
                  setStructureError(null)
                }}
              />
              {structureError ? <FieldError>{structureError}</FieldError> : null}
              <p className="text-xs text-muted-foreground">{t("scheduleLater")}</p>
            </div>
          </div>
        ) : (
          <StageRows stages={stages} onChange={setStages} errors={fieldErrors} />
        )}
        <DialogFooter>
          {step === 2 ? (
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              disabled={pending}
              className="sm:me-auto"
            >
              <ArrowLeft data-icon="inline-start" className="rtl:-scale-x-100" />
              {tc("back")}
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {tc("cancel")}
          </Button>
          {step === 1 && structure === "stages" ? (
            <Button onClick={proceed} disabled={pending}>
              {t("next")}
              <ArrowRight data-icon="inline-end" className="rtl:-scale-x-100" />
            </Button>
          ) : (
            <Button onClick={step === 1 ? proceed : submit} disabled={pending}>
              {t("create")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
