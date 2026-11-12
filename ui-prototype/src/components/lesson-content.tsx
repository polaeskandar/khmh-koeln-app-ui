import { ExternalLink, FileText, Target } from "lucide-react"
import { useTranslations } from "next-intl"

function lines(text: string | null): string[] {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
}

export function LessonReading({
  summary,
  objectives,
  teachingPoints,
  materials,
}: {
  summary: string | null
  objectives: string | null
  teachingPoints: string | null
  materials: { label: string; url: string | null }[]
}) {
  const t = useTranslations("lessons.reading")

  return (
    <div className="flex flex-col gap-8">
      {summary ? (
        <p className="max-w-[68ch] text-lg leading-relaxed text-pretty">{summary}</p>
      ) : null}
      {lines(objectives).length > 0 ? (
        <section aria-labelledby="objectives" className="flex flex-col gap-3">
          <h2
            id="objectives"
            className="flex items-center gap-2 font-heading text-base font-semibold"
          >
            <Target className="size-4 text-primary" aria-hidden="true" />
            {t("objectives")}
          </h2>
          <ul className="flex max-w-[68ch] list-disc flex-col gap-1.5 ps-6 marker:text-primary">
            {lines(objectives).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {lines(teachingPoints).length > 0 ? (
        <section aria-labelledby="points" className="flex flex-col gap-3">
          <h2 id="points" className="font-heading text-base font-semibold">
            {t("teachingPoints")}
          </h2>
          <ol className="flex max-w-[68ch] flex-col gap-3">
            {lines(teachingPoints).map((l, i) => (
              <li key={l} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center bg-primary/10 text-xs font-semibold text-primary tabular-nums">
                  {i + 1}
                </span>
                <span className="pt-0.5">{l}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {materials.length > 0 ? (
        <section aria-labelledby="materials" className="flex flex-col gap-3">
          <h2 id="materials" className="font-heading text-base font-semibold">
            {t("materials")}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {materials.map((m) =>
              m.url ? (
                <li key={m.label}>
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 border p-3 text-sm hover:bg-muted/40"
                  >
                    <ExternalLink className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="truncate">{m.label}</span>
                  </a>
                </li>
              ) : (
                <li key={m.label} className="flex items-center gap-3 border p-3 text-sm">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {m.label}
                </li>
              )
            )}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
