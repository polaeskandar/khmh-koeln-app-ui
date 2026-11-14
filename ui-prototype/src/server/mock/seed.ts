import { computeOccasions } from "@/lib/domain/calendar"
import { addDays, epochOf, localInstant, toInstant } from "@/lib/domain/time"
import type { Action, ResourceType } from "@/lib/domain/resources"
import {
  CHURCH,
  type Account,
  type AnnualPlan,
  type CalendarOccasion,
  type Lesson,
  type LocalDate,
  type LocalTime,
  type Material,
  type Person,
  type PlanDecision,
  type PlanRule,
  type Schedule,
  type ResourceRef,
  type Service,
  type ServiceStructure,
  type Session,
  type Stage,
  type Task,
  type Unit,
  type Uuid,
} from "@/lib/domain/types"
import { suggestUsername } from "@/lib/domain/username"

import { uuidv7 } from "./ids"
import { demoPasswordHash } from "./passwords"
import { createRandom } from "./random"
import { automaticDays, materialize, newSession, recurringSessionOn } from "./scheduling"
import { rosterOf } from "./selectors"
import type { DemoData, State } from "./state"

export const DEMO_DAY: LocalDate = "2026-11-08"

const BOYS = [
  "Mark",
  "Bishoy",
  "Abanoub",
  "Philopateer",
  "Youssef",
  "Peter",
  "Fady",
  "Ramy",
  "Shenouda",
  "Antonios",
  "Karas",
  "Pavly",
  "David",
  "John",
  "Joseph",
  "Matthew",
  "Thomas",
  "Stephen",
  "Elias",
  "Noah",
  "Luka",
  "Jonas",
  "Raphael",
  "Simon",
  "Philip",
  "Marco",
  "Michael",
  "George",
  "Kyrillos",
]
const GIRLS = [
  "Marina",
  "Demiana",
  "Nardeen",
  "Martina",
  "Sarah",
  "Rebecca",
  "Monica",
  "Mira",
  "Youstina",
  "Verena",
  "Theresa",
  "Joyce",
  "Maria",
  "Lydia",
  "Emilia",
  "Lea",
  "Mia",
  "Clara",
  "Anna",
  "Veronica",
  "Catherine",
  "Hannah",
  "Julia",
  "Natalie",
  "Rita",
  "Irene",
  "Christina",
]
const LAST = [
  "Hanna",
  "Habib",
  "Wadie",
  "Botros",
  "Girgis",
  "Mikhail",
  "Iskander",
  "Rizk",
  "Bishay",
  "Gerges",
  "Saad",
  "Kamal",
  "Youssef",
  "Zaki",
  "Labib",
  "Morcos",
  "Ghaly",
  "Assaad",
  "Salib",
  "Naguib",
  "Fawzy",
  "Halim",
  "Sedky",
  "Aziz",
  "Henein",
  "Abdelmalek",
  "Khalil",
  "Soliman",
  "Fanous",
  "Riad",
  "Nasr",
  "Gayed",
]
const PARENT_FIRST = [
  "Rania",
  "Mona",
  "Nermin",
  "Hany",
  "Sherif",
  "Mervat",
  "Ehab",
  "Magda",
  "Ashraf",
  "Nagwa",
  "Emad",
  "Samia",
  "Wael",
  "Hala",
  "Amir",
  "Dalia",
  "Tamer",
  "Lamia",
  "Osama",
  "Reham",
  "Karim",
  "Nevin",
  "Medhat",
  "Sanaa",
  "Atef",
  "Hanan",
  "Raafat",
  "Inas",
  "Maher",
  "Soad",
]

const at = (date: LocalDate, time: LocalTime) => epochOf(localInstant(date, time))
const MIN = 60_000

export function seed(data: DemoData): State {
  const rnd = createRandom(20_261_108)
  let clock = at("2026-08-24", "09:00")
  const newId = (ms?: number) => uuidv7(ms ?? (clock += 1000), rnd.next)
  const setupAt = toInstant(at("2026-08-24", "10:00"))

  const s: State = {
    services: [],
    serviceTones: {},
    stages: [],
    persons: [],
    memberships: [],
    accounts: [],
    guardianships: [],
    grants: [],
    managers: [],
    schedules: [],
    plans: [],
    sessions: [],
    attendance: [],
    occasions: [],
    daysOff: [],
    lessons: [],
    tasks: [],
    completions: [],
    dataRequests: [],
    anonymousCounts: {},
    seededAt: toInstant(at(DEMO_DAY, "12:08")),
  }

  const person = (firstName: string, lastName: string, displayName: string | null = null) => {
    const p: Person = { id: newId(), firstName, lastName, displayName, createdAt: setupAt }
    s.persons.push(p)

    return p
  }

  const account = (p: Person, options: Partial<Account> = {}): Account => {
    const a: Account = {
      id: newId(),
      personId: p.id,
      username: uniqueUsername(suggestUsername(p.firstName, p.lastName)),
      passwordHash: demoPasswordHash(),
      mustChangePassword: false,
      passwordChangedAt: setupAt,
      language: null,
      lastSignInAt: toInstant(at("2026-11-07", "18:30")),
      createdAt: setupAt,
      createdBy: s.accounts[0]?.id ?? null,
      ...options,
    }
    s.accounts.push(a)

    return a
  }

  /** A permission for one type at one resource, given by the first administrator. */
  const allow = (a: Account, resource: ResourceRef, type: ResourceType, actions: Action[]) => {
    s.grants.push({
      id: newId(),
      accountId: a.id,
      resource,
      type,
      actions,
      createdAt: setupAt,
      createdBy: s.accounts[0]?.id ?? null,
    })
  }

  const manage = (a: Account, resource: ResourceRef) => {
    s.managers.push({
      id: newId(),
      accountId: a.id,
      resource,
      createdAt: setupAt,
      createdBy: s.accounts[0]?.id === a.id ? null : (s.accounts[0]?.id ?? null),
    })
  }

  const church: ResourceRef = CHURCH

  const uniqueUsername = (base: string) => {
    let candidate = base
    let n = 2

    while (s.accounts.some((a) => a.username === candidate)) {
      candidate = `${base}${n++}`
    }

    return candidate
  }

  for (const year of [2026, 2027, 2028]) {
    for (const o of computeOccasions(year)) {
      s.occasions.push({
        id: newId(),
        date: o.date,
        key: o.key,
        name: null,
        category: o.category,
        source: "computed",
        mode: "suggested",
        serviceIds: [],
        verifiedAt: null,
        verifiedBy: null,
      } satisfies CalendarOccasion)
    }
  }

  const mariamP = person("Mariam", "Fahmy")
  const mariam = account(mariamP, { createdBy: null, language: "en" })
  manage(mariam, church)

  const verifiedAt = toInstant(at("2026-10-20", "19:40"))

  for (const o of s.occasions) {
    if (o.date < "2028-01-01") {
      o.verifiedAt = verifiedAt
      o.verifiedBy = mariam.id
    }
  }

  s.occasions.push({
    id: newId(),
    date: "2027-06-27",
    key: null,
    name: "Parish festival (sample)",
    category: "churchEvent",
    source: "church",
    mode: "mandatory",
    serviceIds: [],
    verifiedAt,
    verifiedBy: mariam.id,
  })

  if (data === "empty") {
    return s
  }

  const tones = new Map<Uuid, number>()

  const service = (name: string, description: string, structure: ServiceStructure): Service => {
    const x: Service = {
      id: newId(),
      name,
      description,
      structure,
      archivedAt: null,
      createdAt: setupAt,
    }
    s.services.push(x)
    tones.set(x.id, tones.size + 1)
    s.serviceTones[x.id] = tones.size

    if (structure === "single") {
      s.schedules.push({ id: newId(), serviceId: x.id, stageId: null, createdAt: setupAt })
    }

    return x
  }

  const stage = (svc: Service, name: string, description: string | null = null): Stage => {
    const x: Stage = {
      id: newId(),
      serviceId: svc.id,
      name,
      description,
      position: s.stages.filter((st) => st.serviceId === svc.id).length + 1,
      archivedAt: null,
      createdAt: setupAt,
    }
    s.stages.push(x)
    s.schedules.push({ id: newId(), serviceId: svc.id, stageId: x.id, createdAt: setupAt })

    return x
  }

  const scheduleOf = (unit: Unit): Schedule =>
    s.schedules.find((x) => x.serviceId === unit.serviceId && x.stageId === unit.stageId)!

  const join = (
    p: Person,
    unit: Unit,
    startsOn: LocalDate = "2026-09-01",
    endsOn: LocalDate | null = null
  ) => {
    s.memberships.push({ id: newId(), personId: p.id, ...unit, startsOn, endsOn })
  }

  const sundaySchool = service(
    "Sunday School",
    "Classes for children from kindergarten to 4th class, after the Divine Liturgy.",
    "stages"
  )
  const kg = stage(sundaySchool, "Kindergarten", "Ages 4 to 6")
  const first = stage(sundaySchool, "1st Class")
  const second = stage(sundaySchool, "2nd Class")
  const third = stage(sundaySchool, "3rd Class")
  const fourth = stage(sundaySchool, "4th Class")
  const youth = service(
    "Youth Gathering",
    "Friday evenings for young people from 14 to 18: a talk, prayer and time together.",
    "single"
  )
  const university = service(
    "University Students",
    "Every other Wednesday for students: Bible study and questions of faith.",
    "single"
  )
  const coptic = service(
    "Coptic Language Course",
    "Reading and writing Coptic for children and adults, in two levels.",
    "stages"
  )
  const level1 = stage(coptic, "Level 1", "The alphabet and first words")
  const level2 = stage(coptic, "Level 2", "Reading the hymns")
  const servantsMeeting = service(
    "Servants' Meeting",
    "Once a month for everyone who serves: preparation, prayer and planning.",
    "single"
  )

  s.daysOff.push({
    serviceId: sundaySchool.id,
    year: 2027,
    mode: "custom",
    days: [...automaticDays(s, sundaySchool.id, 2027), "2027-12-26"].sort(),
  })

  const u = (svc: Service, st: Stage | null = null): Unit => ({
    serviceId: svc.id,
    stageId: st?.id ?? null,
  })
  const groupOf = (svc: Service, st: Stage | null = null): ResourceRef =>
    st ? { type: "stage", id: st.id } : { type: "service", id: svc.id }

  const staff = (first: string, last: string, options: Partial<Account> = {}) => {
    const p = person(first, last)

    return { person: p, account: account(p, options) }
  }

  const CRUD: Action[] = ["create", "read", "update", "delete"]

  /** A service leader: manages access in the service and may do everything in it. */
  const leads = (a: Account, svc: Service) => {
    const ref = groupOf(svc)
    manage(a, ref)
    allow(a, ref, "service", ["read", "update"])

    for (const type of [
      ...(svc.structure === "stages" ? (["stage"] as const) : []),
      "session",
      "lesson",
      "task",
    ] as const) {
      allow(a, ref, type, CRUD)
    }
  }

  /** A servant of a stage, or of a service without stages. */
  const serves = (a: Account, svc: Service, st: Stage | null = null) => {
    const ref = groupOf(svc, st)
    allow(a, ref, ref.type, ["read"])
    allow(a, ref, "session", ["read", "update"])
    allow(a, ref, "lesson", ["create", "read", "update"])
    allow(a, ref, "task", ["create", "read", "update"])
  }

  const sara = staff("Sara", "Wissa")
  const christine = staff("Christine", "Adel")
  const daniel = staff("Daniel", "Michael")
  const youssef = staff("Youssef", "Kamel")
  const george = staff("George", "Nashed")
  const marina = staff("Marina", "Samuel")
  const bishoy = staff("Bishoy", "Tawfik")
  const mark = staff("Mark", "Shenouda")
  const peter = staff("Peter", "Girgis")
  const irene = staff("Irene", "Wahba")
  const maged = staff("Maged", "Botros")
  const rebecca = staff("Rebecca", "Habib", {
    mustChangePassword: true,
    passwordChangedAt: null,
    lastSignInAt: null,
    createdAt: toInstant(at("2026-11-07", "11:20")),
    createdBy: sara.account.id,
  })
  manage(sara.account, church)
  leads(christine.account, sundaySchool)
  serves(daniel.account, sundaySchool, first)
  allow(daniel.account, groupOf(sundaySchool, third), "stage", ["read"])
  allow(daniel.account, groupOf(sundaySchool, third), "session", ["read", "update"])
  serves(daniel.account, youth)
  serves(youssef.account, sundaySchool, third)
  serves(george.account, sundaySchool, kg)
  serves(marina.account, sundaySchool, second)
  serves(bishoy.account, sundaySchool, fourth)
  serves(rebecca.account, sundaySchool, kg)
  leads(mark.account, youth)
  leads(peter.account, university)
  leads(irene.account, coptic)
  leads(maged.account, servantsMeeting)
  const andrew = person("Andrew", "Samir")

  for (const servant of [
    sara,
    christine,
    daniel,
    youssef,
    george,
    marina,
    bishoy,
    mark,
    peter,
    irene,
    maged,
    rebecca,
  ]) {
    join(servant.person, u(servantsMeeting))
  }

  join(andrew, u(servantsMeeting), "2026-10-03")
  join(mariamP, u(servantsMeeting))

  const unitServant = new Map<Uuid | null, Uuid>([
    [kg.id, george.account.id],
    [first.id, daniel.account.id],
    [second.id, marina.account.id],
    [third.id, youssef.account.id],
    [fourth.id, bishoy.account.id],
    [level1.id, irene.account.id],
    [level2.id, irene.account.id],
  ])
  const unitStaff = (unit: Unit) =>
    unitServant.get(unit.stageId) ??
    (unit.serviceId === youth.id
      ? mark.account.id
      : unit.serviceId === university.id
        ? peter.account.id
        : maged.account.id)

  let boy = 0
  let girl = 0
  let lastName = 0
  const childName = (gender: "b" | "g") =>
    gender === "b" ? BOYS[boy++ % BOYS.length] : GIRLS[girl++ % GIRLS.length]

  const parentAccount = (p: Person, createdAt = setupAt) =>
    account(p, {
      createdAt,
      createdBy: sara.account.id,
      lastSignInAt: rnd.chance(0.7) ? toInstant(at("2026-11-0" + rnd.int(1, 7), "20:00")) : null,
    })

  const childAccount = (child: Person, signedIn: boolean) =>
    account(child, {
      createdBy: sara.account.id,
      mustChangePassword: !signedIn,
      passwordChangedAt: signedIn ? setupAt : null,
      lastSignInAt: signedIn ? toInstant(at("2026-11-06", "17:45")) : null,
    })

  const link = (parent: Account, child: Person) => {
    s.guardianships.push({
      id: newId(),
      accountId: parent.id,
      childId: child.id,
      createdAt: parent.createdAt,
      createdBy: sara.account.id,
    })
  }

  const hodaP = person("Hoda", "Farag")
  const hoda = parentAccount(hodaP)
  const mina = person("Mina", "Farag")
  const mimi = person("Mimi", "Farag")
  join(mina, u(sundaySchool, third))
  join(mimi, u(sundaySchool, first))
  childAccount(mina, true)
  childAccount(mimi, false)
  link(hoda, mina)
  link(hoda, mimi)
  const nadiaP = person("Nadia", "Mansour")
  const nadia = parentAccount(nadiaP)
  const sophia = person("Sophia", "Mansour")
  join(sophia, u(sundaySchool, third))
  childAccount(sophia, false)
  link(nadia, sophia)

  const families: { parent: Account; last: string }[] = []
  const sizes: [Stage, number][] = [
    [kg, 8],
    [first, 8],
    [second, 8],
    [third, 7],
    [fourth, 8],
  ]

  for (const [st, size] of sizes) {
    for (let i = 0; i < size; i++) {
      const sibling = families.length > 2 && i % 4 === 3 ? families[families.length - 3] : null
      const last = sibling?.last ?? LAST[lastName++ % LAST.length]
      const child = person(childName(rnd.chance(0.5) ? "b" : "g"), last)
      join(child, u(sundaySchool, st))
      childAccount(child, st === fourth && i % 2 === 0)

      if (sibling) {
        link(sibling.parent, child)
        continue
      }

      const parentP = person(PARENT_FIRST[families.length % PARENT_FIRST.length], last)
      const parent = parentAccount(parentP)
      link(parent, child)
      families.push({ parent, last })
    }
  }

  const theresa = person("Theresa", "Wadie")
  join(theresa, u(sundaySchool, second), "2026-09-01", "2026-10-15")

  const memberAccount = (
    first: string,
    last: string,
    units: Unit[],
    options: Partial<Account> = {}
  ) => {
    const p = person(first, last)
    const a = account(p, {
      createdBy: sara.account.id,
      ...options,
    })

    for (const unit of units) {
      join(p, unit)
    }

    return { person: p, account: a }
  }

  const nevine = memberAccount("Nevine", "Boulos", [u(coptic, level1)], { language: "en" })
  memberAccount("Kirollos", "Ibrahim", [u(youth), u(coptic, level2)])
  memberAccount("Maria", "Hanna", [u(university)])

  for (let i = 0; i < 11; i++) {
    memberAccount(childName(i % 2 === 0 ? "b" : "g"), LAST[lastName++ % LAST.length], [u(youth)])
  }

  for (let i = 0; i < 8; i++) {
    memberAccount(childName(i % 2 === 0 ? "g" : "b"), LAST[lastName++ % LAST.length], [
      u(university),
    ])
  }

  for (let i = 0; i < 5; i++) {
    memberAccount(childName(i % 2 === 0 ? "b" : "g"), LAST[lastName++ % LAST.length], [
      u(coptic, level1),
    ])
  }

  for (let i = 0; i < 4; i++) {
    memberAccount(childName(i % 2 === 0 ? "g" : "b"), LAST[lastName++ % LAST.length], [
      u(coptic, level2),
    ])
  }

  const rule = (fields: Partial<PlanRule> & Pick<PlanRule, "weekday" | "startTime">): PlanRule => ({
    frequency: "weekly",
    interval: 1,
    monthWeek: null,
    endTime: null,
    startsOn: null,
    endsOn: null,
    location: null,
    ...fields,
  })

  const plan = (
    unit: Unit,
    year: number,
    r: PlanRule,
    status: AnnualPlan["status"],
    by: Uuid,
    when: LocalDate,
    decisions: Record<LocalDate, PlanDecision> = {}
  ) => {
    const schedule = scheduleOf(unit)
    const time = toInstant(at(when, "20:00"))
    const p: AnnualPlan = {
      id: newId(),
      scheduleId: schedule.id,
      year,
      status,
      rule: r,
      decisions,
      version: 1,
      updatedAt: time,
      updatedBy: by,
      confirmedAt: status === "confirmed" ? time : null,
      confirmedBy: status === "confirmed" ? by : null,
    }
    s.plans.push(p)

    if (status === "confirmed") {
      materialize(s, schedule, p, () => newId(epochOf(time)), time)
    }

    return p
  }

  const rooms: [Stage, string][] = [
    [kg, "Room 1"],
    [first, "Room 2"],
    [second, "Room 3"],
    [third, "Room 4"],
    [fourth, "Room 5"],
  ]

  for (const [st, room] of rooms) {
    plan(
      u(sundaySchool, st),
      2026,
      rule({
        weekday: 7,
        startTime: "12:00",
        endTime: "13:15",
        startsOn: "2026-09-06",
        location: room,
      }),
      "confirmed",
      christine.account.id,
      "2026-08-30"
    )
  }

  plan(
    u(youth),
    2026,
    rule({ weekday: 5, startTime: "19:30", startsOn: "2026-09-04", location: "Upper hall" }),
    "confirmed",
    mark.account.id,
    "2026-08-28"
  )
  plan(
    u(youth),
    2027,
    rule({ weekday: 5, startTime: "19:30", location: "Upper hall" }),
    "draft",
    mark.account.id,
    "2026-11-05",
    { "2027-01-01": "cancel" }
  )
  plan(
    u(university),
    2026,
    rule({
      weekday: 3,
      interval: 2,
      startTime: "19:00",
      endTime: "21:00",
      startsOn: "2026-09-09",
      location: "Room 5",
    }),
    "confirmed",
    peter.account.id,
    "2026-08-29"
  )

  for (const [st, start, end] of [
    [level1, "18:00", "19:00"],
    [level2, "19:15", "20:15"],
  ] as const) {
    const r = { weekday: 1 as const, startTime: start, endTime: end, location: "Room 2" }
    plan(
      u(coptic, st),
      2026,
      rule({ ...r, startsOn: "2026-09-14" }),
      "confirmed",
      irene.account.id,
      "2026-09-01"
    )
    plan(u(coptic, st), 2027, rule(r), "confirmed", irene.account.id, "2026-11-02")
  }

  plan(
    u(servantsMeeting),
    2026,
    rule({
      frequency: "monthly",
      weekday: 6,
      monthWeek: 1,
      startTime: "18:00",
      endTime: "19:30",
      startsOn: "2026-09-05",
      location: "Church hall",
    }),
    "confirmed",
    maged.account.id,
    "2026-08-30"
  )

  const session = (unit: Unit, date: LocalDate) => recurringSessionOn(s, scheduleOf(unit).id, date)!

  const cancel = (x: Session, reason: string) => {
    x.status = "canceled"
    x.cancelReason = reason
    x.changedByHand = true
  }

  cancel(
    session(u(sundaySchool, fourth), DEMO_DAY),
    "Bishoy is ill. 4th Class joins 3rd Class today."
  )
  cancel(session(u(university), "2026-11-18"), "Exam week at the university.")

  for (const st of [kg, first, second, third, fourth]) {
    cancel(
      session(u(sundaySchool, st), "2026-12-27"),
      "Christmas holidays: many families are away."
    )
  }

  const moved = session(u(youth), "2026-11-13")
  moved.startTime = "20:00"
  moved.changedByHand = true
  moved.originalDate = moved.date

  const oneOff = newSession(
    scheduleOf(u(youth)),
    {
      kind: "oneOff",
      date: "2026-11-21",
      startTime: "15:00",
      endTime: "18:00",
      location: "Church hall",
      changedByHand: true,
    },
    newId(at("2026-11-03", "20:15")),
    toInstant(at("2026-11-03", "20:15"))
  )
  s.sessions.push(oneOff)

  const mark_ = (x: Session, p: Person, ms: number, by: Uuid) => {
    s.attendance.push({
      id: newId(ms),
      sessionId: x.id,
      personId: p.id,
      recordedAt: toInstant(ms),
      recordedBy: by,
      removedAt: null,
      removedBy: null,
      removalReason: null,
    })
  }

  for (const x of s.sessions) {
    if (x.status !== "scheduled" || x.date >= DEMO_DAY) {
      continue
    }

    const unit = { serviceId: x.serviceId, stageId: x.stageId }
    const by = unitStaff(unit)
    const opened = at(x.date, x.startTime) + 2 * MIN
    x.status = "closed"
    x.openedAt = toInstant(opened)
    x.closedAt = toInstant(opened + 70 * MIN)
    x.closedBy = by

    for (const p of rosterOf(s, unit, x.date)) {
      if (rnd.chance(0.86)) {
        mark_(x, p, opened + rnd.int(1, 20) * MIN, by)
      }
    }
  }

  const openToday = (st: Stage, present: number) => {
    const x = session(u(sundaySchool, st), DEMO_DAY)
    const by = unitStaff(u(sundaySchool, st))
    const opened = at(DEMO_DAY, "12:02")
    x.status = "open"
    x.openedAt = toInstant(opened)
    rosterOf(s, u(sundaySchool, st), DEMO_DAY)
      .slice(0, present)
      .forEach((p, i) => mark_(x, p, opened + (i + 1) * MIN, by))

    return x
  }

  openToday(kg, 5)
  openToday(second, 6)
  const thirdToday = openToday(third, 5)

  for (const p of rosterOf(s, u(sundaySchool, fourth), DEMO_DAY).slice(0, 2)) {
    mark_(thirdToday, p, at(DEMO_DAY, "12:07"), youssef.account.id)
  }

  const lessonAt = (unit: Unit, date: LocalDate) => recurringSessionOn(s, scheduleOf(unit).id, date)

  const material = (label: string, url: string | null, shared: boolean): Material => ({
    label,
    url,
    shared,
  })

  const lesson = (
    unit: Unit,
    date: LocalDate,
    fields: Pick<Lesson, "title" | "status"> & Partial<Lesson>,
    by: Uuid
  ): Lesson => {
    const time = toInstant(at(addDays(date, -5), "20:30"))
    const x: Lesson = {
      id: newId(epochOf(time)),
      ...unit,
      sessionId: lessonAt(unit, date)?.id ?? null,
      date,
      summary: null,
      objectives: null,
      teachingPoints: null,
      materials: [],
      notes: null,
      responsibleId: by,
      publishedAt: fields.status === "published" ? toInstant(at(addDays(date, -1), "19:00")) : null,
      createdAt: time,
      updatedAt: time,
      ...fields,
    }
    s.lessons.push(x)

    return x
  }

  const task = (
    l: Lesson,
    fields: Pick<Task, "title" | "instructions" | "status"> & Partial<Task>,
    by: Uuid
  ): Task => {
    const x: Task = {
      id: newId(epochOf(l.updatedAt) + 1000),
      lessonId: l.id,
      serviceId: l.serviceId,
      stageId: l.stageId,
      dueDate: addDays(l.date, 7),
      resources: [],
      publishedAt: fields.status === "draft" ? null : l.publishedAt,
      createdBy: by,
      createdAt: l.updatedAt,
      updatedAt: l.updatedAt,
      ...fields,
    }
    s.tasks.push(x)

    return x
  }

  const complete = (t: Task, p: Person, by: Uuid, ms: number) => {
    s.completions.push({
      id: newId(ms),
      taskId: t.id,
      personId: p.id,
      completedAt: toInstant(ms),
      completedBy: by,
      undoneAt: null,
    })
  }

  const firstU = u(sundaySchool, first)
  const thirdU = u(sundaySchool, third)
  lesson(
    firstU,
    "2026-11-01",
    {
      title: "God creates the world",
      status: "published",
      summary: "In six days God made everything, and He saw that it was good (Genesis 1).",
      objectives: "The children can name what God made on each day.",
      teachingPoints: "God made everything out of love.\nWe take care of His creation.",
      materials: [material("Picture cards of the seven days", null, false)],
    },
    christine.account.id
  )
  const noah = lesson(
    firstU,
    DEMO_DAY,
    {
      title: "Noah's ark",
      status: "published",
      summary:
        "Noah trusted God and built the ark. After the flood, God put the rainbow in the sky as a sign of His promise (Genesis 6–9).",
      objectives:
        "The children can retell the story of Noah.\nThey know that God keeps His promises.",
      teachingPoints:
        "Noah listened to God even when others laughed.\nThe rainbow reminds us of God's promise.\nWe can trust God like Noah did.",
      materials: [
        material("Children's Bible, page 18", null, true),
        material("Song: Rise and shine", "https://example.org/songs/rise-and-shine", true),
        material("Ark craft template", "https://example.org/crafts/ark.pdf", false),
      ],
      notes:
        "Bring the cardboard ark from the cupboard in Room 2. Mimi and Philip love to help with the animals.",
    },
    daniel.account.id
  )
  lesson(
    firstU,
    "2026-11-15",
    {
      title: "The Good Samaritan",
      status: "ready",
      summary: "Jesus tells of a Samaritan who helps a wounded stranger (Luke 10:25–37).",
      objectives: "The children understand that everyone is our neighbour.",
      teachingPoints: "Who is my neighbour?\nHelping costs something, and it is worth it.",
      materials: [material("Role-play props: bandages and a blanket", null, false)],
      notes: "Ask George for the first-aid kit for the role-play.",
    },
    daniel.account.id
  )
  lesson(
    firstU,
    "2026-11-22",
    {
      title: "The Lost Sheep",
      status: "draft",
      summary: "The shepherd leaves the ninety-nine to look for the one (Luke 15:3–7).",
    },
    christine.account.id
  )

  const joseph = lesson(
    thirdU,
    "2026-11-01",
    {
      title: "Joseph forgives his brothers",
      status: "published",
      summary: "Joseph meets his brothers again in Egypt and forgives them (Genesis 45).",
      objectives: "The children can explain why Joseph forgave.",
      teachingPoints: "Forgiveness is a choice.\nGod can turn evil into good.",
      materials: [material("Genesis 45, read together", null, true)],
    },
    youssef.account.id
  )
  const bush = lesson(
    thirdU,
    DEMO_DAY,
    {
      title: "Moses and the burning bush",
      status: "published",
      summary:
        "God calls Moses from a bush that burns but is not consumed, and sends him to free His people (Exodus 3).",
      objectives:
        "The children can tell how God called Moses.\nThey learn that God is holy and that He hears His people.",
      teachingPoints:
        'Moses took off his sandals: God is holy.\n"I AM WHO I AM": God\'s name.\nGod sends Moses even though he feels weak.',
      materials: [
        material("Exodus 3:1–12", null, true),
        material(
          "Coloring page: the burning bush",
          "https://example.org/coloring/burning-bush.pdf",
          true
        ),
        material("Video for the introduction", "https://example.org/videos/moses", false),
      ],
      notes:
        "Mina asked last week whether God still speaks today. Keep five minutes for his question.",
    },
    youssef.account.id
  )
  lesson(
    thirdU,
    "2026-11-22",
    {
      title: "The Sermon on the Mount",
      status: "draft",
      summary: "The Beatitudes (Matthew 5:1–12).",
    },
    youssef.account.id
  )
  lesson(
    u(sundaySchool, kg),
    DEMO_DAY,
    {
      title: "God made the animals",
      status: "published",
      summary: "We thank God for every animal He made.",
      objectives: "The children can name five animals and thank God for them.",
      teachingPoints: "God made every animal.\nWe are kind to animals.",
    },
    george.account.id
  )
  lesson(
    u(sundaySchool, second),
    "2026-11-15",
    {
      title: "David and Goliath",
      status: "ready",
      summary: "David trusts God against the giant (1 Samuel 17).",
    },
    marina.account.id
  )

  const letters = lesson(
    u(coptic, level1),
    "2026-11-09",
    {
      title: "The first eight letters",
      status: "published",
      summary: "Alpha to Theta: how each letter is written and pronounced, with a word for each.",
      objectives: "Read and write the letters Ⲁ to Ⲑ.\nPronounce them as in the hymns.",
      teachingPoints:
        "Ⲁ alpha, Ⲃ vida, Ⲅ gamma, Ⲇ delta, Ⲉ ei, Ⲋ so, Ⲍ zita, Ⲏ ita, Ⲑ thita.\nⲂ is read as v in most words.\nPractise with the word Ⲡⲁⲡⲁ.",
      materials: [
        material("Alphabet sheet", "https://example.org/coptic/alphabet.pdf", true),
        material("Audio: the letters read aloud", "https://example.org/coptic/letters.mp3", true),
        material("Answer key for the worksheet", "https://example.org/coptic/key.pdf", false),
      ],
      notes:
        "Nevine asked about the pronunciation of Ⲉ. Two of the children need the large-print sheet.",
    },
    irene.account.id
  )
  lesson(
    u(youth),
    "2026-11-13",
    {
      title: "Prayer in everyday life",
      status: "ready",
      summary: "How to keep a rule of prayer between school, friends and family.",
      objectives: "Everyone leaves with one small, realistic prayer habit.",
      teachingPoints: "The Agpeya hours as anchors.\nShort prayers during the day.",
    },
    daniel.account.id
  )

  const verse = task(
    bush,
    {
      title: "Learn Exodus 3:14 by heart",
      instructions: 'Say the verse to someone at home: "I AM WHO I AM." Then tick it off.',
      status: "published",
      dueDate: "2026-11-15",
    },
    youssef.account.id
  )
  task(
    bush,
    {
      title: "Colour the burning bush",
      instructions: "Print the coloring page or draw the bush yourself and bring it next Sunday.",
      status: "published",
      dueDate: "2026-11-15",
      resources: [{ label: "Coloring page", url: "https://example.org/coloring/burning-bush.pdf" }],
    },
    youssef.account.id
  )
  task(
    bush,
    {
      title: "Draw Moses at the bush",
      instructions: "Draw what Moses saw.",
      status: "draft",
      dueDate: null,
    },
    youssef.account.id
  )
  const forgive = task(
    joseph,
    {
      title: "Forgive someone this week",
      instructions: "Think of one person you want to forgive and pray for them every evening.",
      status: "published",
      dueDate: "2026-11-08",
    },
    youssef.account.id
  )
  const ark = task(
    noah,
    {
      title: "Tell the story of Noah at home",
      instructions: "Tell your family the story of Noah's ark and show them the rainbow you made.",
      status: "published",
      dueDate: "2026-11-15",
    },
    daniel.account.id
  )
  const write = task(
    letters,
    {
      title: "Write the first eight letters",
      instructions:
        "Write each letter from Ⲁ to Ⲑ five times on the alphabet sheet and read them aloud.",
      status: "published",
      dueDate: "2026-11-16",
      resources: [{ label: "Alphabet sheet", url: "https://example.org/coptic/alphabet.pdf" }],
    },
    irene.account.id
  )

  const reporters = (p: Person) =>
    s.guardianships.filter((g) => g.childId === p.id).map((g) => g.accountId)

  rosterOf(s, thirdU, DEMO_DAY).forEach((p, i) => {
    if (i < 5 && p.id !== mina.id) {
      complete(forgive, p, reporters(p)[0], at("2026-11-0" + (3 + (i % 4)), "19:30"))
    }

    if (i < 2 && p.id !== mina.id) {
      complete(verse, p, reporters(p)[0], at(DEMO_DAY, "10:15"))
    }
  })
  complete(forgive, mina, hoda.id, at("2026-11-05", "18:45"))
  rosterOf(s, firstU, DEMO_DAY)
    .filter((p) => p.id !== mimi.id)
    .slice(0, 2)
    .forEach((p) => complete(ark, p, reporters(p)[0], at(DEMO_DAY, "11:00")))
  rosterOf(s, u(coptic, level1), DEMO_DAY)
    .filter((p) => p.id !== nevine.person.id)
    .slice(0, 3)
    .forEach((p) => {
      const own = s.accounts.find((a) => a.personId === p.id)
      complete(write, p, own?.id ?? irene.account.id, at(DEMO_DAY, "09:30"))
    })

  s.dataRequests.push(
    {
      id: newId(at("2026-09-12", "10:00")),
      kind: "erasure",
      personId: null,
      subjectName: null,
      erasedSubject: "a child in Kindergarten",
      requestedBy: "The child's mother, in person",
      channel: "in_person",
      receivedAt: toInstant(at("2026-09-12", "10:00")),
      dueOn: "2026-10-12",
      note: null,
      status: "done",
      outcome: { person: 1, memberships: 1, guardianships: 1, attendance: 1 },
      declineReason: null,
      closedAt: toInstant(at("2026-09-14", "18:00")),
      closedBy: mariam.id,
    },
    {
      id: newId(at("2026-11-02", "17:30")),
      kind: "erasure",
      personId: theresa.id,
      subjectName: "Theresa Wadie",
      erasedSubject: null,
      requestedBy: "Samir Wadie (her father), by letter",
      channel: "letter",
      receivedAt: toInstant(at("2026-11-02", "17:30")),
      dueOn: "2026-12-02",
      note: "The family moved to Hamburg in October.",
      status: "open",
      outcome: null,
      declineReason: null,
      closedAt: null,
      closedBy: null,
    }
  )

  return s
}
