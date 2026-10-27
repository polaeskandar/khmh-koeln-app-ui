import type { Locale } from "@/i18n/config"
import {
  CHURCH_TIME_ZONE,
  daysBetween,
  isoWeekday,
  localDateOf,
  localTimeOf,
} from "@/lib/domain/time"
import type {
  Instant,
  IsoWeekday,
  LocalDate,
  LocalTime,
  MonthWeek,
  Recurrence,
} from "@/lib/domain/types"

/**
 * Display formatting in English, German and Arabic.
 *
 * Dates are spelled out from the tables below instead of with
 * Intl.DateTimeFormat: the server (Node) and the browser ship different ICU
 * versions ("Sun 8 Nov" on one, "Sun, 8 Nov" on the other), which breaks
 * hydration of client components. Local dates are calendar dates in the
 * church's time zone, so no time zone math is needed to name them. Numbers use
 * Western digits in every language, also in Arabic, like times and room numbers
 * around them.
 *
 * Components get the functions for the current language with `useFormat()`
 * (src/i18n/format.ts), async server components with `getFormat()`.
 */

type Table = {
  /** Monday first, like ISO weekdays. */
  weekdays: string[]
  weekdaysShort: string[]
  /** For narrow controls such as the weekday toggles of a schedule. */
  weekdaysMin: string[]
  months: string[]
  monthsShort: string[]
  /** Tout … Nasie, in the language's usual spelling. */
  copticMonths: string[]
}

const TABLES: Record<Locale, Table> = {
  en: {
    weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    weekdaysShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    weekdaysMin: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    months: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    monthsShort: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    copticMonths: [
      "Tout",
      "Baba",
      "Hator",
      "Kiahk",
      "Toba",
      "Amshir",
      "Baramhat",
      "Baramouda",
      "Bashans",
      "Paona",
      "Epep",
      "Mesra",
      "Nasie",
    ],
  },
  de: {
    weekdays: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
    weekdaysShort: ["Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa.", "So."],
    weekdaysMin: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
    months: [
      "Januar",
      "Februar",
      "März",
      "April",
      "Mai",
      "Juni",
      "Juli",
      "August",
      "September",
      "Oktober",
      "November",
      "Dezember",
    ],
    monthsShort: [
      "Jan.",
      "Feb.",
      "März",
      "Apr.",
      "Mai",
      "Juni",
      "Juli",
      "Aug.",
      "Sept.",
      "Okt.",
      "Nov.",
      "Dez.",
    ],
    copticMonths: [
      "Thout",
      "Paopi",
      "Hathor",
      "Koiak",
      "Tobi",
      "Meschir",
      "Paremhat",
      "Paremoude",
      "Paschons",
      "Paoni",
      "Epip",
      "Mesori",
      "Nasie",
    ],
  },
  ar: {
    weekdays: ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"],
    weekdaysShort: ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"],
    weekdaysMin: ["اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت", "أحد"],
    months: [
      "يناير",
      "فبراير",
      "مارس",
      "أبريل",
      "مايو",
      "يونيو",
      "يوليو",
      "أغسطس",
      "سبتمبر",
      "أكتوبر",
      "نوفمبر",
      "ديسمبر",
    ],
    monthsShort: [
      "يناير",
      "فبراير",
      "مارس",
      "أبريل",
      "مايو",
      "يونيو",
      "يوليو",
      "أغسطس",
      "سبتمبر",
      "أكتوبر",
      "نوفمبر",
      "ديسمبر",
    ],
    copticMonths: [
      "توت",
      "بابه",
      "هاتور",
      "كيهك",
      "طوبة",
      "أمشير",
      "برمهات",
      "برمودة",
      "بشنس",
      "بؤونة",
      "أبيب",
      "مسرى",
      "نسيء",
    ],
  },
}

/** Words around dates and in schedule patterns. */
type Words = {
  today: string
  tomorrow: string
  yesterday: string
  /** "today at 12:10", "on Sun 1 Nov at 13:47" */
  at: (day: string, time: string, relative: boolean) => string
  copticYear: (year: number) => string
  /** "A, B and C" */
  list: (items: string[]) => string
  percent: (n: number) => string
  recurrence: (r: Recurrence, t: Table) => string
  monthWeek: Record<MonthWeek, string>
}

const MONTH_WEEKS: MonthWeek[] = [1, 2, 3, 4, -1]
const byMonthWeek = (names: string[]) =>
  Object.fromEntries(MONTH_WEEKS.map((w, i) => [w, names[i]])) as Record<MonthWeek, string>

const day = (t: Table, d: IsoWeekday) => t.weekdays[d - 1]

const WORDS: Record<Locale, Words> = {
  en: {
    today: "Today",
    tomorrow: "Tomorrow",
    yesterday: "Yesterday",
    at: (d, time, relative) => (relative ? `${d.toLowerCase()} at ${time}` : `on ${d} at ${time}`),
    copticYear: (y) => `${y} A.M.`,
    list: (items) =>
      items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`,
    percent: (n) => `${n}%`,
    monthWeek: byMonthWeek(["First", "Second", "Third", "Fourth", "Last"]),
    recurrence(r, t) {
      const days = WORDS.en.list(r.weekdays.map((d) => day(t, d)))
      if (r.frequency === "weekly") {
        if (r.interval === 1) return `Every ${days}`
        if (r.interval === 2) return `Every other ${days}`
        return `Every ${r.interval} weeks on ${days}`
      }
      const which = `${WORDS.en.monthWeek[r.monthWeek ?? 1]} ${day(t, r.weekdays[0])}`
      return r.interval === 1 ? `${which} of every month` : `${which} of every ${r.interval} months`
    },
  },
  de: {
    today: "Heute",
    tomorrow: "Morgen",
    yesterday: "Gestern",
    at: (d, time, relative) => (relative ? `${d.toLowerCase()} um ${time}` : `am ${d}, um ${time}`),
    copticYear: (y) => `${y} A.M.`,
    list: (items) =>
      items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} und ${items.at(-1)}`,
    percent: (n) => `${n} %`,
    monthWeek: byMonthWeek(["Erster", "Zweiter", "Dritter", "Vierter", "Letzter"]),
    recurrence(r, t) {
      const days = WORDS.de.list(r.weekdays.map((d) => day(t, d)))
      if (r.frequency === "weekly") {
        if (r.interval === 1) return `Jeden ${days}`
        if (r.interval === 2) return `Jeden zweiten ${days}`
        return `Alle ${r.interval} Wochen am ${days}`
      }
      const ordinal =
        ["ersten", "zweiten", "dritten", "vierten"][(r.monthWeek ?? 1) - 1] ?? "letzten"
      const weekday = day(t, r.weekdays[0])
      return r.interval === 1
        ? `Jeden ${ordinal} ${weekday} im Monat`
        : `Alle ${r.interval} Monate am ${ordinal} ${weekday}`
    },
  },
  ar: {
    today: "اليوم",
    tomorrow: "غدًا",
    yesterday: "أمس",
    at: (d, time, relative) => (relative ? `${d} الساعة ${time}` : `يوم ${d} الساعة ${time}`),
    copticYear: (y) => `${y} ش`,
    list: (items) =>
      items.length <= 1 ? items.join("") : `${items.slice(0, -1).join("، ")} و${items.at(-1)}`,
    percent: (n) => `${n}%`,
    monthWeek: byMonthWeek(["الأول", "الثاني", "الثالث", "الرابع", "الأخير"]),
    recurrence(r, t) {
      const indefinite = (d: IsoWeekday) => t.weekdaysMin[d - 1]
      const days = WORDS.ar.list(r.weekdays.map((d) => day(t, d)))
      if (r.frequency === "weekly") {
        if (r.interval === 1) {
          return r.weekdays.length === 1
            ? `كل يوم ${indefinite(r.weekdays[0])}`
            : `${days} من كل أسبوع`
        }
        if (r.interval === 2) return `${days} كل أسبوعين`
        return `${days} كل ${r.interval} أسابيع`
      }
      const ordinal = ["أول", "ثاني", "ثالث", "رابع"][(r.monthWeek ?? 1) - 1] ?? "آخر"
      const which = `${ordinal} ${indefinite(r.weekdays[0])}`
      if (r.interval === 1) return `${which} من كل شهر`
      if (r.interval === 2) return `${which} كل شهرين`
      return `${which} كل ${r.interval} ${r.interval <= 10 ? "أشهر" : "شهرًا"}`
    },
  },
}

type Parts = { year: number; month: number; day: number; weekday: IsoWeekday }
const partsOf = (date: LocalDate): Parts => {
  const [year, month, d] = date.split("-").map(Number)
  return { year, month, day: d, weekday: isoWeekday(date) }
}

/** Julian day number of 1 Tout, year 1 of the Martyrs (29 August 284, Julian calendar). */
const COPTIC_EPOCH = 1825030

function julianDay(date: LocalDate): number {
  const [y, m, d] = date.split("-").map(Number)
  const a = Math.floor((14 - m) / 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  return (
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045
  )
}

/** The Coptic calendar date (Anno Martyrum): twelve months of 30 days and Nasie with 5 or 6. */
export function copticParts(date: LocalDate) {
  const jd = julianDay(date)
  const year = Math.floor((4 * (jd - COPTIC_EPOCH) + 1463) / 1461)
  const startOfYear = COPTIC_EPOCH + 365 * (year - 1) + Math.floor(year / 4)
  const dayOfYear = jd - startOfYear
  const month = Math.floor(dayOfYear / 30)
  return { year, month, day: dayOfYear - month * 30 + 1 }
}

function create(locale: Locale) {
  const t = TABLES[locale]
  const w = WORDS[locale]
  const weekdayLong = (date: LocalDate) => t.weekdays[partsOf(date).weekday - 1]
  const weekdayShort = (date: LocalDate) => t.weekdaysShort[partsOf(date).weekday - 1]

  /** en "Sunday 8 November 2026", de "Sonntag, 8. November 2026", ar "الأحد، 8 نوفمبر 2026" */
  const longDate = (date: LocalDate) => {
    const p = partsOf(date)
    const month = t.months[p.month - 1]
    if (locale === "de") return `${weekdayLong(date)}, ${p.day}. ${month} ${p.year}`
    if (locale === "ar") return `${weekdayLong(date)}، ${p.day} ${month} ${p.year}`
    return `${weekdayLong(date)} ${p.day} ${month} ${p.year}`
  }

  /** en "Sun 8 Nov", de "So., 8. Nov.", ar "الأحد، 8 نوفمبر" */
  const dayMonth = (date: LocalDate) => {
    const p = partsOf(date)
    const month = t.monthsShort[p.month - 1]
    if (locale === "de") return `${weekdayShort(date)}, ${p.day}. ${month}`
    if (locale === "ar") return `${weekdayShort(date)}، ${p.day} ${month}`
    return `${weekdayShort(date)} ${p.day} ${month}`
  }

  /** en "8 Nov", de "8. Nov.", ar "8 نوفمبر" */
  const shortDate = (date: LocalDate) => {
    const p = partsOf(date)
    return `${p.day}${locale === "de" ? "." : ""} ${t.monthsShort[p.month - 1]}`
  }

  const relativeWord = (date: LocalDate, today: LocalDate): string | null => {
    const diff = daysBetween(today, date)
    if (diff === 0) return w.today
    if (diff === 1) return w.tomorrow
    if (diff === -1) return w.yesterday
    return null
  }

  return {
    locale,
    longDate,
    /** en "Sun 8 Nov 2026" */
    mediumDate: (date: LocalDate) => `${dayMonth(date)} ${partsOf(date).year}`,
    dayMonth,
    shortDate,
    /** en "Nov" */
    monthShort: (date: LocalDate) => t.monthsShort[partsOf(date).month - 1],
    weekdayLong,
    weekdayShort,
    dayOfMonth: (date: LocalDate) => partsOf(date).day,
    /** A weekday by its ISO number, 1 = Monday. */
    weekdayName: (d: IsoWeekday) => t.weekdays[d - 1],
    weekdayMin: (d: IsoWeekday) => t.weekdaysMin[d - 1],
    monthWeekName: (week: MonthWeek) => w.monthWeek[week],
    /** "Today", "Tomorrow", "Yesterday", or a date (short or long). */
    relativeDay(date: LocalDate, today: LocalDate, style: "short" | "long" = "short"): string {
      return relativeWord(date, today) ?? (style === "long" ? longDate(date) : dayMonth(date))
    },
    /** Like relativeDay, for the middle of a sentence: "today", "tomorrow" or a date. */
    relativeDayInline(date: LocalDate, today: LocalDate): string {
      const word = relativeWord(date, today)
      return word ? (locale === "ar" ? word : word.toLowerCase()) : dayMonth(date)
    },
    /** "Today" or the short weekday, for compact date tiles. */
    todayOrWeekday: (date: LocalDate, today: LocalDate) =>
      date === today ? w.today : weekdayShort(date),
    timeRange: (start: LocalTime, end: LocalTime | null) => (end ? `${start}–${end}` : start),
    instantTime: (instant: Instant) => localTimeOf(instant),
    instantDate: (instant: Instant) => localDateOf(instant),
    /** "Today 12:03", "Yesterday 18:20", "Sun 1 Nov, 13:47". */
    instantLabel(instant: Instant, today: LocalDate): string {
      const date = localDateOf(instant)
      const time = localTimeOf(instant)
      const diff = daysBetween(today, date)
      if (diff === 0 || diff === -1) return `${relativeWord(date, today)} ${time}`
      return `${dayMonth(date)}${locale === "ar" ? "،" : ","} ${time}`
    },
    /** For sentences: "today at 12:10", "yesterday at 18:20", "on Sun 1 Nov at 13:47". */
    atLabel(instant: Instant, today: LocalDate): string {
      const date = localDateOf(instant)
      const diff = daysBetween(today, date)
      const relative = diff === 0 || diff === -1
      return w.at(
        relative ? relativeWord(date, today)! : dayMonth(date),
        localTimeOf(instant),
        relative
      )
    },
    /** en "29 Baba 1743 A.M.", de "29. Paopi 1743 A.M.", ar "29 بابه 1743 ش" */
    copticDate(date: LocalDate): string {
      const c = copticParts(date)
      return `${c.day}${locale === "de" ? "." : ""} ${t.copticMonths[c.month]} ${w.copticYear(c.year)}`
    },
    /** 0.82 → en "82%", de "82 %" */
    percent: (ratio: number) => w.percent(Math.round(ratio * 100)),
    /** ["A", "B", "C"] → en "A, B and C" */
    list: (items: string[]) => w.list(items),
    /** "Every Sunday", "Jeden zweiten Sonntag", "أول سبت من كل شهر" */
    recurrence: (r: Recurrence) => w.recurrence(r, t),
  }
}

export type Format = ReturnType<typeof create>

const cache = new Map<Locale, Format>()

/** The formatting functions for one language. */
export function formatFor(locale: Locale): Format {
  let f = cache.get(locale)
  if (!f) {
    f = create(locale)
    cache.set(locale, f)
  }
  return f
}

export const TIME_ZONE_LABEL = CHURCH_TIME_ZONE
