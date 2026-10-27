import { BookOpen, ExternalLink } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { useFormat } from "@/i18n/format"
import type { LocalDate, Material } from "@/lib/domain/types"

import { DueLine } from "../homework/homework-bits"
import { isolate } from "@/lib/bidi"

/**
 * One homework task as a parent reads it (P04). The same component renders the
 * servant's preview in the homework editor, so what servants check is exactly
 * what parents get: title, instructions, due date, the lesson's passage and
 * memory verse, and resources. Never the lesson plan or servant notes.
 */
export function ParentHomeworkView({
  child,
  title,
  instructions,
  dueDate,
  today,
  lesson,
  resources,
  status,
  action,
  headingLevel = "h1",
  compact = false,
}: {
  /** `name: null` reads "For your child", for the servants' preview. */
  child: { name: string | null; stage: string | null }
  title: string
  instructions: string
  dueDate: LocalDate | null
  today: LocalDate
  lesson: {
    title: string
    passage: string | null
    memoryVerse: string | null
    teachingDate: LocalDate
  } | null
  resources: Material[]
  /** The completed note (P05) or nothing. */
  status?: React.ReactNode
  /** The completion button, or a disabled stand-in in the preview. */
  action?: React.ReactNode
  headingLevel?: "h1" | "h2" | "h3"
  compact?: boolean
}) {
  const t = useTranslations("parent.view")
  const f = useFormat()
  const Heading = headingLevel
  return (
    <article className={cn("flex flex-col", compact ? "gap-4" : "gap-6")}>
      <header className="flex flex-col gap-2">
        <span className="text-sm text-muted-foreground">
          {child.name === null ? t("forYourChild") : t("forChild", { name: child.name })}
          {/* Isolated, so a Latin class name keeps its place after the child's name in Arabic. */}
          {child.stage ? (
            <>
              {" · "}
              <bdi>{child.stage}</bdi>
            </>
          ) : null}
        </span>
        <Heading
          className={cn(
            "font-heading leading-tight font-semibold tracking-tight text-balance",
            compact ? "text-xl" : "text-2xl md:text-[28px]"
          )}
        >
          {title || <span className="text-muted-foreground">{t("titlePlaceholder")}</span>}
        </Heading>
        <DueLine dueDate={dueDate} today={today} className="text-sm" />
      </header>

      {status}

      <section className="flex flex-col gap-2" aria-label={t("whatToDo")}>
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {t("whatToDo")}
        </h2>
        {instructions.trim() ? (
          <p dir="auto" className="text-[15px] leading-relaxed text-pretty whitespace-pre-line">
            {instructions}
          </p>
        ) : (
          <p className="text-[15px] text-muted-foreground">{t("instructionsPlaceholder")}</p>
        )}
      </section>

      {lesson && (lesson.passage || lesson.memoryVerse) ? (
        <section className="flex flex-col gap-3 bg-muted/50 p-4" aria-label={t("fromLessonLabel")}>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="size-3.5" aria-hidden="true" />
            {t("fromLesson", {
              title: isolate(lesson.title),
              date: f.relativeDayInline(lesson.teachingDate, today),
            })}
          </span>
          {lesson.passage ? (
            <p dir="auto" className="text-sm font-medium">
              {lesson.passage}
            </p>
          ) : null}
          {lesson.memoryVerse ? (
            <blockquote
              dir="auto"
              className="border-s-2 border-primary ps-3 font-heading text-[15px] leading-relaxed text-pretty"
            >
              {lesson.memoryVerse}
            </blockquote>
          ) : null}
        </section>
      ) : null}

      {resources.length > 0 ? (
        <section className="flex flex-col gap-2" aria-label={t("resources")}>
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("resources")}
          </h2>
          <ul dir="auto" className="flex flex-col gap-2">
            {resources.map((r, i) => (
              <li key={i} className="text-[15px]">
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 underline underline-offset-4"
                  >
                    {r.label}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                ) : (
                  r.label
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {action}
    </article>
  )
}
