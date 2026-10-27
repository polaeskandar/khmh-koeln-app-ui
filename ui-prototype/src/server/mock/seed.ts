import { addDays, epochOf, localDateOf, localInstant, toInstant } from "@/lib/domain/time"
import { oneMonthAfter, PRIVACY_VERSION } from "@/lib/domain/privacy"
import type {
  Attendance,
  DataRequest,
  GuardianRelationship,
  HomeworkAssignment,
  IsoWeekday,
  Lesson,
  LocalDate,
  LocalTime,
  MeetingSchedule,
  MeetingSession,
  Membership,
  MonthWeek,
  Person,
  Recurrence,
  RosterMode,
  Service,
  SessionEventType,
  Stage,
  User,
  Uuid,
} from "@/lib/domain/types"

import { generate, occurrenceOn, sessionFromOccurrence } from "./generator"
import { uuidv7 } from "./ids"
import { demoPasswordHash } from "./passwords"
import { createRandom } from "./random"
import { isCurrentOn, sessionRoster } from "./selectors"
import type { State } from "./state"

/**
 * The fictional KHMK Köln dataset. Deterministic: the same seed always produces
 * the same people, sessions and attendance, so screenshots and demos match.
 *
 * Story on the demo day (Sunday 8 November 2026, 12:08):
 *  - Sunday School classes started at 12:00. Kindergarten, 1st, 3rd and
 *    5th & 6th Class are taking attendance; 4th Class has not opened yet;
 *    2nd Class was canceled yesterday and joins 1st Class today.
 *  - Monday's Coptic classes were created today at 00:05, the day before.
 *  - Wednesday's Bible Study is canceled in advance; Friday's Youth Meeting
 *    was moved to 19:30.
 *  - Last Sunday, 3rd Class was reopened to fix a mix-up between two
 *    people called Mina Hanna.
 */

const DEMO_DAY: LocalDate = "2026-11-08"
const HISTORY_FROM: LocalDate = "2026-09-01"

const BOYS = [
  "Mina",
  "Mark",
  "Bishoy",
  "Kirollos",
  "Abanoub",
  "Philopateer",
  "Youssef",
  "Andrew",
  "Peter",
  "George",
  "Fady",
  "Ramy",
  "Michael",
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
  "Samuel",
  "Raphael",
  "Simon",
  "Philip",
  "Marco",
]
const GIRLS = [
  "Marina",
  "Mariam",
  "Demiana",
  "Irene",
  "Nardeen",
  "Christine",
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
  "Sophia",
  "Emilia",
  "Lea",
  "Mia",
  "Clara",
  "Anna",
  "Sandra",
  "Veronica",
  "Catherine",
  "Hannah",
  "Julia",
  "Natalie",
  "Rita",
]
const LAST = [
  "Hanna",
  "Samuel",
  "Habib",
  "Wadie",
  "Botros",
  "Tawfik",
  "Girgis",
  "Ibrahim",
  "Mikhail",
  "Iskander",
  "Rizk",
  "Bishay",
  "Wahba",
  "Gerges",
  "Saad",
  "Farag",
  "Kamal",
  "Youssef",
  "Mansour",
  "Zaki",
  "Labib",
  "Morcos",
  "Ghaly",
  "Assaad",
  "Salib",
  "Naguib",
  "Tadros",
  "Fawzy",
  "Halim",
  "Sedky",
  "Aziz",
  "Boulos",
  "Henein",
  "Abdelmalek",
  "Khalil",
  "Soliman",
  "Fanous",
  "Riad",
  "Nasr",
  "Gayed",
]
const NICKNAMES: Record<string, string> = {
  Kirollos: "Kiro",
  Philopateer: "Philo",
  Youstina: "Tina",
  Antonios: "Tony",
  Demiana: "Demi",
  Veronica: "Vero",
}

type ServiceKey =
  | "summer-club"
  | "sunday-school"
  | "youth"
  | "deacons"
  | "bible-study"
  | "servants"
  | "coptic"
  | "choir"

type UserKey =
  | "mariam"
  | "christine"
  | "daniel"
  | "rebecca"
  | "youssef"
  | "marina"
  | "george"
  | "mark"
  | "bishoy"
  | "maged"
  | "peter"
  | "irene"
  | "samuel"
  | "nabil"
  | "hoda"
  | "samir"
  | "nadia"

const at = (date: LocalDate, time: LocalTime) => epochOf(localInstant(date, time))
const MIN = 60_000

export function seed(): State {
  const rnd = createRandom(20_261_108)
  const id = (epochMs: number) => uuidv7(epochMs, rnd.next)

  const state: State = {
    services: [],
    serviceTones: {},
    stages: [],
    persons: [],
    memberships: [],
    schedules: [],
    sessions: [],
    events: [],
    attendance: [],
    users: [],
    guardians: [],
    lessons: [],
    homework: [],
    completions: [],
    dataRequests: [],
    anonymousCounts: {},
    generatorRuns: [],
    seededAt: toInstant(at(DEMO_DAY, "12:08")),
  }

  // ---------------------------------------------------------------- services
  const service = {} as Record<ServiceKey, Service>
  const addService = (
    key: ServiceKey,
    name: string,
    description: string | null,
    created: [LocalDate, LocalTime],
    archived?: [LocalDate, LocalTime]
  ) => {
    const createdMs = at(...created)
    const s: Service = {
      id: id(createdMs),
      name,
      description,
      archivedAt: archived ? toInstant(at(...archived)) : null,
      createdAt: toInstant(createdMs),
      updatedAt: toInstant(archived ? at(...archived) : createdMs),
    }
    service[key] = s
    state.services.push(s)
  }
  addService(
    "summer-club",
    "Summer Club 2026",
    "Wednesday programme during the summer holidays.",
    ["2026-06-15", "09:00"],
    ["2026-09-01", "09:30"]
  )
  addService(
    "sunday-school",
    "Sunday School",
    "Weekly classes for children from kindergarten to 6th class, after the Divine Liturgy.",
    ["2026-08-24", "10:12"]
  )
  addService(
    "youth",
    "Youth Meeting",
    "Friday evening meeting for secondary school students and young adults.",
    ["2026-08-24", "10:20"]
  )
  addService(
    "deacons",
    "Deacons' School",
    "Hymns, Coptic responses and altar service for boys and young men.",
    ["2026-08-25", "19:02"]
  )
  addService(
    "bible-study",
    "Bible Study",
    "Open Wednesday evening study for adults. Everyone is welcome, so there is no roster.",
    ["2026-08-26", "08:40"]
  )
  addService("servants", "Servants' Preparation", "Monthly preparation meeting for all servants.", [
    "2026-08-26",
    "08:45",
  ])
  addService(
    "coptic",
    "Coptic Language Course",
    "Reading and pronunciation of Bohairic Coptic, in two levels.",
    ["2026-09-01", "17:30"]
  )
  addService("choir", "Choir", "Planned for 2027. No meetings yet.", ["2026-10-20", "20:15"])
  // Colours in the order the services were created.
  const byCreation = [...state.services].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  byCreation.forEach((x, i) => (state.serviceTones[x.id] = (i % 8) + 1))

  // ------------------------------------------------------------------ stages
  const stage: Record<string, Stage> = {}
  const addStage = (
    key: string,
    serviceKey: ServiceKey,
    name: string,
    position: number,
    description: string | null = null,
    archived?: [LocalDate, LocalTime]
  ) => {
    const createdMs = epochOf(service[serviceKey].createdAt) + (position + 1) * 7 * MIN
    const st: Stage = {
      id: id(createdMs),
      serviceId: service[serviceKey].id,
      name,
      description,
      position,
      archivedAt: archived ? toInstant(at(...archived)) : null,
      createdAt: toInstant(createdMs),
    }
    stage[key] = st
    state.stages.push(st)
  }
  addStage("kg", "sunday-school", "Kindergarten", 0, "Ages 4 to 6.")
  addStage("c1", "sunday-school", "1st Class", 1)
  addStage("c2", "sunday-school", "2nd Class", 2)
  addStage("c3", "sunday-school", "3rd Class", 3)
  addStage("c4", "sunday-school", "4th Class", 4)
  addStage("c56", "sunday-school", "5th & 6th Class", 5, "Combined class for the two oldest years.")
  addStage("toddlers", "sunday-school", "Toddlers", 6, "Merged into Kindergarten in September.", [
    "2026-09-06",
    "14:10",
  ])
  addStage("beginners", "deacons", "Beginners", 0, "First and second year.")
  addStage(
    "advanced",
    "deacons",
    "Advanced",
    1,
    "Hymns of the Divine Liturgy and the Midnight Praises."
  )
  addStage("level1", "coptic", "Level 1", 0, "Alphabet and reading.")
  addStage("level2", "coptic", "Level 2", 1, "Reading the responses of the liturgy.")

  // ------------------------------------------------------------------ people
  const usedNames = new Set<string>()
  const addPerson = (
    firstName: string,
    lastName: string,
    opts: { displayName?: string | null; inactive?: boolean; created?: LocalDate } = {}
  ): Person => {
    const createdMs = at(opts.created ?? "2026-08-28", "18:00") + state.persons.length * MIN
    const p: Person = {
      id: id(createdMs),
      firstName,
      lastName,
      displayName: opts.displayName ?? null,
      status: opts.inactive ? "inactive" : "active",
      createdAt: toInstant(createdMs),
    }
    usedNames.add(`${firstName} ${lastName}`)
    state.persons.push(p)
    return p
  }
  const randomPerson = (gender: "boy" | "girl" | "any" = "any", created?: LocalDate): Person => {
    for (;;) {
      const g = gender === "any" ? (rnd.chance(0.5) ? "boy" : "girl") : gender
      const first = rnd.pick(g === "boy" ? BOYS : GIRLS)
      const last = rnd.pick(LAST)
      if (usedNames.has(`${first} ${last}`)) continue
      const nickname = NICKNAMES[first] && rnd.chance(0.6) ? NICKNAMES[first] : null
      return addPerson(first, last, { displayName: nickname, created })
    }
  }

  const member = (
    person: Person,
    serviceKey: ServiceKey,
    stageKey: string | null,
    startsOn: LocalDate,
    endsOn: LocalDate | null = null
  ) => {
    const m: Membership = {
      id: id(at(startsOn, "09:00")),
      personId: person.id,
      serviceId: service[serviceKey].id,
      stageId: stageKey ? stage[stageKey].id : null,
      startsOn,
      endsOn,
    }
    state.memberships.push(m)
    return m
  }

  // Servants and the church office (the people behind the user accounts).
  const servantPerson = {} as Record<UserKey, Person>
  const servantNames: [UserKey, string, string][] = [
    ["mariam", "Mariam", "Fahmy"],
    ["christine", "Christine", "Adel"],
    ["daniel", "Daniel", "Michael"],
    ["rebecca", "Rebecca", "Shokry"],
    ["youssef", "Youssef", "Nashed"],
    ["marina", "Marina", "Saad"],
    ["george", "George", "Labib"],
    ["mark", "Mark", "Shenouda"],
    ["bishoy", "Bishoy", "Tawfik"],
    ["maged", "Maged", "Botros"],
    ["peter", "Peter", "Girgis"],
    ["irene", "Irene", "Wahba"],
  ]
  for (const [key, first, last] of servantNames)
    servantPerson[key] = addPerson(first, last, { created: "2026-08-24" })
  servantPerson.samuel = addPerson("Samuel", "Rizk", { inactive: true, created: "2026-08-24" })
  const otherServants = [
    addPerson("Monica", "Farag"),
    addPerson("Sarah", "Kamal"),
    addPerson("Andrew", "Halim"),
  ]

  // Two different people called Mina Hanna: one in 3rd Class, one in the Youth Meeting.
  const minaChild = addPerson("Mina", "Hanna")
  const minaYouth = addPerson("Mina", "Hanna")

  // Children whose parents use the parent portal (see the guardian links further down).
  const mariamChild = addPerson("Mariam", "Hanna", { displayName: "Mimi" })
  const kirollosChild = addPerson("Kirollos", "Iskander", { displayName: "Kiro" })
  const sophiaChild = addPerson("Sophia", "Mansour")

  // Sunday School classes. Everyone joined at the start of the school year.
  const SCHOOL_YEAR: LocalDate = "2026-09-01"
  const classSizes: [string, number][] = [
    ["kg", 10],
    ["c1", 11],
    ["c2", 10],
    ["c3", 11],
    ["c4", 13],
    ["c56", 13],
  ]
  const kids: Record<string, Person[]> = {}
  for (const [key, size] of classSizes) {
    kids[key] = []
    for (let i = 0; i < size; i++) {
      const p = randomPerson()
      kids[key].push(p)
      member(p, "sunday-school", key, SCHOOL_YEAR)
    }
  }
  kids.c3.push(minaChild)
  member(minaChild, "sunday-school", "c3", SCHOOL_YEAR)
  kids.c3.push(kirollosChild)
  member(kirollosChild, "sunday-school", "c3", SCHOOL_YEAR)
  kids.c1.push(mariamChild)
  member(mariamChild, "sunday-school", "c1", SCHOOL_YEAR)
  kids.kg.push(sophiaChild)
  member(sophiaChild, "sunday-school", "kg", SCHOOL_YEAR)

  // Lydia moved up from 2nd to 3rd Class on 1 October; her 2nd Class membership is kept as history.
  const lydia = addPerson("Lydia", "Morcos")
  member(lydia, "sunday-school", "c2", SCHOOL_YEAR, "2026-09-30")
  member(lydia, "sunday-school", "c3", "2026-10-01")
  kids.c3.push(lydia)

  // A family that moved away in October: inactive, membership ended.
  const movedAway = kids.c4[kids.c4.length - 1]
  movedAway.status = "inactive"
  state.memberships.find((m) => m.personId === movedAway.id)!.endsOn = "2026-10-14"

  // Youth Meeting.
  const youth: Person[] = [minaYouth]
  member(minaYouth, "youth", null, SCHOOL_YEAR)
  for (let i = 0; i < 23; i++) {
    const p = randomPerson()
    youth.push(p)
    member(p, "youth", null, SCHOOL_YEAR)
  }

  // Deacons' School: boys from the older classes and young men from the youth.
  const boysFrom = (people: Person[]) => people.filter((p) => BOYS.includes(p.firstName))
  const beginners = [...boysFrom(kids.c4).slice(0, 4), ...boysFrom(kids.c56).slice(0, 5)]
  const advanced = boysFrom(youth).slice(0, 7)
  for (const p of beginners) member(p, "deacons", "beginners", "2026-09-05")
  for (const p of advanced) member(p, "deacons", "advanced", "2026-09-05")

  // Bible Study regulars (open roster: members are listed but nobody is "expected").
  const adults = [
    addPerson("Nabil", "Hanna"),
    addPerson("Hoda", "Farag"),
    addPerson("Samir", "Iskander"),
    addPerson("Nadia", "Mansour"),
    addPerson("Emad", "Guirguis"),
    addPerson("Mervat", "Labib"),
    addPerson("Ashraf", "Tadros"),
    addPerson("Hanan", "Rizk"),
    addPerson("Magdy", "Soliman"),
    addPerson("Nevine", "Boulos"),
  ]
  const bibleRegulars = [
    ...adults,
    servantPerson.mariam,
    servantPerson.maged,
    servantPerson.christine,
    servantPerson.peter,
  ]
  for (const p of bibleRegulars) member(p, "bible-study", null, "2026-09-09")

  // Servants' Preparation: every servant.
  const servantsRoster = [
    ...(
      [
        "christine",
        "daniel",
        "rebecca",
        "youssef",
        "marina",
        "george",
        "mark",
        "bishoy",
        "maged",
        "peter",
        "irene",
      ] as const
    ).map((k) => servantPerson[k]),
    ...otherServants,
  ]
  for (const p of servantsRoster) member(p, "servants", null, "2026-09-05")
  member(servantPerson.samuel, "servants", null, "2026-09-05", "2026-09-30")
  member(servantPerson.samuel, "youth", null, SCHOOL_YEAR, "2026-09-30")

  // Coptic Language Course.
  const level1 = [...kids.c4.slice(0, 3), ...kids.c56.slice(5, 8), adults[1], adults[3], adults[9]]
  const level2 = [...youth.slice(8, 12), adults[0], servantPerson.marina]
  for (const p of level1) member(p, "coptic", "level1", "2026-09-14")
  for (const p of level2) member(p, "coptic", "level2", "2026-09-14")

  // Summer Club (archived): children from Sunday School, July to August.
  const summerKids = [
    ...kids.c1.slice(0, 5),
    ...kids.c2.slice(0, 5),
    ...kids.c3.slice(0, 6),
    ...kids.c4.slice(0, 5),
    ...kids.c56.slice(0, 5),
  ]
  for (const p of summerKids) member(p, "summer-club", null, "2026-07-20", "2026-08-31")

  // ------------------------------------------------------------------- users
  const user = {} as Record<UserKey, User>
  type RoleSpec = [User["roles"][number]["role"], ServiceKey | null, string?]
  // The office created these accounts, so they were approved at once (by Mariam, the administrator).
  const officeAccount = (createdMs: number) => ({
    passwordHash: demoPasswordHash(),
    language: null,
    registration: null,
    privacyAcceptedAt: toInstant(createdMs),
    privacyVersion: PRIVACY_VERSION,
    approvedAt: toInstant(createdMs),
    approvedBy: user.mariam?.id ?? null,
    createdAt: toInstant(createdMs),
  })
  const addUser = (key: UserKey, roles: RoleSpec[], disabled?: LocalDate) => {
    const p = servantPerson[key]
    const createdMs = epochOf(p.createdAt) + 30 * MIN
    const u: User = {
      id: id(createdMs),
      email: `${p.firstName}.${p.lastName}@example.org`.toLowerCase(),
      displayName: `${p.firstName} ${p.lastName}`,
      personId: p.id,
      roles: roles.map(([role, key, stageKey]) => ({
        role,
        serviceId: key ? service[key].id : null,
        stageId: stageKey ? stage[stageKey].id : null,
      })),
      ...officeAccount(createdMs),
      disabledAt: disabled ? toInstant(at(disabled, "10:00")) : null,
    }
    user[key] = u
    state.users.push(u)
  }
  addUser("mariam", [["administrator", null]])
  addUser("christine", [
    ["service_leader", "sunday-school"],
    ["service_leader", "summer-club"],
  ])
  // Servants are assigned to their class; the leader covers the whole service.
  addUser("daniel", [["servant", "sunday-school", "c3"]])
  addUser("rebecca", [["servant", "sunday-school", "kg"]])
  addUser("youssef", [
    ["servant", "sunday-school", "c1"],
    ["servant", "coptic"],
  ])
  addUser("marina", [["servant", "sunday-school", "c2"]])
  addUser("george", [["servant", "sunday-school", "c4"]])
  addUser("mark", [["service_leader", "youth"]])
  addUser("bishoy", [
    ["servant", "youth"],
    ["servant", "deacons"],
  ])
  addUser("maged", [
    ["service_leader", "bible-study"],
    ["service_leader", "servants"],
  ])
  addUser("peter", [["service_leader", "deacons"]])
  addUser("irene", [["service_leader", "coptic"]])
  addUser("samuel", [["servant", "youth"]], "2026-09-30")
  // Parents with accounts. Their accounts exist because the office created them; children have none.
  servantPerson.nabil = adults[0]
  servantPerson.hoda = adults[1]
  servantPerson.samir = adults[2]
  servantPerson.nadia = adults[3]
  addUser("nabil", [["parent", null]])
  addUser("hoda", [["parent", null]])
  addUser("samir", [["parent", null]])
  addUser("nadia", [["parent", null]])

  // Guardian links, created or approved by the church office. Mina and Mariam have two guardians.
  const guardian = (
    who: UserKey | User,
    child: Person,
    status: GuardianRelationship["status"],
    on: LocalDate
  ) => {
    const u = typeof who === "string" ? user[who] : who
    const ms = at(on, "11:30")
    state.guardians.push({
      id: id(ms),
      userId: u.id,
      personId: child.id,
      relationship: "parent",
      status,
      approvedBy: status === "approved" ? user.mariam.id : null,
      approvedAt: status === "approved" ? toInstant(ms) : null,
      createdAt: toInstant(ms - 2 * 86_400_000),
    })
  }
  guardian("nabil", minaChild, "approved", "2026-09-14")
  guardian("nabil", mariamChild, "approved", "2026-09-14")
  guardian("hoda", minaChild, "approved", "2026-09-14")
  guardian("hoda", mariamChild, "approved", "2026-09-14")
  guardian("samir", kirollosChild, "approved", "2026-09-21")
  guardian("nadia", sophiaChild, "pending", "2026-11-06")

  // Most other families of 3rd and 1st Class have a parent account too (no person record needed).
  const FATHERS = ["Ashraf", "Emad", "Magdy", "Hany", "Sherif", "Wael", "Amir", "Raafat"]
  const MOTHERS = ["Mervat", "Hanan", "Nevine", "Mona", "Rania", "Marian", "Dalia", "Sally"]
  const usedEmails = new Set(state.users.map((u) => u.email))
  for (const child of [...kids.c3, ...kids.c1]) {
    if (state.guardians.some((g) => g.personId === child.id) || !rnd.chance(0.8)) continue
    const first = rnd.pick([...FATHERS, ...MOTHERS])
    const ownName = rnd.chance(0.6) ? null : rnd.pick(LAST)
    // A father carries the child's family name; a mother may have kept her own.
    const last = ownName && MOTHERS.includes(first) ? ownName : child.lastName
    let email = `${first}.${last}@example.org`.toLowerCase()
    for (let n = 2; usedEmails.has(email); n++)
      email = `${first}.${last}${n}@example.org`.toLowerCase()
    usedEmails.add(email)
    const ms = at("2026-09-20", "10:00") + state.users.length * MIN
    const u: User = {
      id: id(ms),
      email,
      displayName: `${first} ${last}`,
      personId: null,
      roles: [{ role: "parent", serviceId: null, stageId: null }],
      ...officeAccount(ms),
      disabledAt: null,
    }
    state.users.push(u)
    guardian(u, child, "approved", "2026-09-27")
  }

  // --------------------------------------------------------------- schedules
  const schedule: Record<string, MeetingSchedule> = {}
  const addSchedule = (
    key: string,
    serviceKey: ServiceKey,
    stageKey: string | null,
    name: string,
    recurrence: Omit<Recurrence, "monthWeek" | "endsOn" | "interval"> &
      Partial<Pick<Recurrence, "monthWeek" | "endsOn" | "interval">>,
    times: [LocalTime, LocalTime | null],
    location: string | null,
    rosterMode: RosterMode,
    opts: { active?: boolean; description?: string; created?: [LocalDate, LocalTime] } = {}
  ) => {
    const createdMs = opts.created
      ? at(...opts.created)
      : epochOf(service[serviceKey].createdAt) + 40 * MIN
    const sch: MeetingSchedule = {
      id: id(createdMs),
      serviceId: service[serviceKey].id,
      stageId: stageKey ? stage[stageKey].id : null,
      name,
      description: opts.description ?? null,
      location,
      recurrence: {
        frequency: recurrence.frequency,
        interval: recurrence.interval ?? 1,
        weekdays: recurrence.weekdays,
        monthWeek: recurrence.monthWeek ?? null,
        startsOn: recurrence.startsOn,
        endsOn: recurrence.endsOn ?? null,
      },
      startTime: times[0],
      endTime: times[1],
      rosterMode,
      active: opts.active ?? true,
      createdAt: toInstant(createdMs),
      updatedAt: toInstant(createdMs),
    }
    schedule[key] = sch
    state.schedules.push(sch)
  }
  const weekly = (
    weekdays: IsoWeekday[],
    startsOn: LocalDate,
    interval = 1,
    endsOn: LocalDate | null = null
  ) => ({
    frequency: "weekly" as const,
    weekdays,
    startsOn,
    interval,
    endsOn,
  })
  const monthly = (weekday: IsoWeekday, monthWeek: MonthWeek, startsOn: LocalDate) => ({
    frequency: "monthly" as const,
    weekdays: [weekday],
    monthWeek,
    startsOn,
  })

  const ssRooms: Record<string, string> = {
    kg: "Room 1",
    c1: "Room 2",
    c2: "Room 3",
    c3: "Room 4",
    c4: "Room 5",
    c56: "Upper hall",
  }
  for (const key of Object.keys(ssRooms)) {
    addSchedule(
      `ss-${key}`,
      "sunday-school",
      key,
      "Sunday class",
      weekly([7], "2026-09-06"),
      ["12:00", "13:15"],
      ssRooms[key],
      "expected"
    )
  }
  addSchedule(
    "ss-toddlers",
    "sunday-school",
    "toddlers",
    "Sunday class",
    weekly([7], "2026-09-06"),
    ["12:00", "12:45"],
    "Room 1",
    "expected",
    {
      active: false,
      description: "Stopped when Toddlers merged into Kindergarten.",
    }
  )
  addSchedule(
    "youth",
    "youth",
    null,
    "Friday youth meeting",
    weekly([5], "2026-09-04"),
    ["19:00", "21:00"],
    "Youth room",
    "expected"
  )
  addSchedule(
    "football",
    "youth",
    null,
    "Saturday football",
    weekly([6], "2026-09-05"),
    ["10:00", "12:00"],
    "Sports hall, Merheim",
    "open",
    {
      active: false,
      description: "Paused for the winter. Resumes in March.",
    }
  )
  addSchedule(
    "hymns-beginners",
    "deacons",
    "beginners",
    "Hymns class",
    weekly([6], "2026-09-05"),
    ["16:00", "17:15"],
    "Deacons' room",
    "expected"
  )
  addSchedule(
    "hymns-advanced",
    "deacons",
    "advanced",
    "Hymns class",
    weekly([6], "2026-09-05"),
    ["17:30", "19:00"],
    "Deacons' room",
    "expected"
  )
  addSchedule(
    "bible",
    "bible-study",
    null,
    "Wednesday Bible study",
    weekly([3], "2026-09-09"),
    ["19:30", "21:00"],
    "Church hall",
    "open"
  )
  addSchedule(
    "servants",
    "servants",
    null,
    "Servants' preparation",
    monthly(6, 1, "2026-09-05"),
    ["19:15", "20:45"],
    "Church hall",
    "expected"
  )
  addSchedule(
    "coptic-1",
    "coptic",
    "level1",
    "Level 1 class",
    weekly([1], "2026-09-14"),
    ["18:00", "19:00"],
    "Room 2",
    "expected"
  )
  addSchedule(
    "coptic-2",
    "coptic",
    "level2",
    "Level 2 class",
    weekly([1], "2026-09-14", 2),
    ["19:15", "20:15"],
    "Room 2",
    "expected"
  )
  addSchedule(
    "summer",
    "summer-club",
    null,
    "Club day",
    weekly([3], "2026-07-22", 1, "2026-08-26"),
    ["10:00", "15:00"],
    "Church hall and garden",
    "expected",
    {
      active: false,
      created: ["2026-06-15", "09:30"],
    }
  )
  schedule.football.updatedAt = toInstant(at("2026-10-12", "21:40"))
  schedule.summer.updatedAt = toInstant(at("2026-09-01", "09:30"))
  schedule["ss-toddlers"].updatedAt = toInstant(at("2026-09-06", "14:10"))

  // ---------------------------------------------------------------- sessions
  const takers: Record<string, UserKey[]> = {
    "ss-kg": ["rebecca"],
    "ss-c1": ["youssef"],
    "ss-c2": ["marina"],
    "ss-c3": ["daniel"],
    "ss-c4": ["george"],
    "ss-c56": ["christine"],
    youth: ["mark", "mark", "bishoy"],
    football: ["mark"],
    "hymns-beginners": ["peter", "bishoy"],
    "hymns-advanced": ["peter"],
    bible: ["maged"],
    servants: ["maged"],
    "coptic-1": ["irene", "youssef"],
    "coptic-2": ["irene"],
    summer: ["christine"],
  }
  const rate = new Map<Uuid, number>()
  const rateOf = (p: Person) => {
    if (!rate.has(p.id))
      rate.set(p.id, rnd.chance(0.12) ? 0.35 + rnd.next() * 0.2 : 0.7 + rnd.next() * 0.28)
    return rate.get(p.id)!
  }

  const addEvent = (
    session: MeetingSession,
    type: SessionEventType,
    atMs: number,
    actor: UserKey | null,
    note: string | null = null
  ) => {
    state.events.push({
      id: id(atMs),
      sessionId: session.id,
      type,
      occurredAt: toInstant(atMs),
      actorId: actor ? user[actor].id : null,
      note,
    })
  }
  const mark = (session: MeetingSession, person: Person, atMs: number, by: UserKey): Attendance => {
    const a: Attendance = {
      id: id(atMs),
      sessionId: session.id,
      personId: person.id,
      recordedAt: toInstant(atMs),
      recordedBy: user[by].id,
      removedAt: null,
      removedBy: null,
      removalReason: null,
    }
    state.attendance.push(a)
    return a
  }
  const removeMark = (a: Attendance, atMs: number, by: UserKey, reason: string) => {
    a.removedAt = toInstant(atMs)
    a.removedBy = user[by].id
    a.removalReason = reason
  }
  const open = (session: MeetingSession, atMs: number, by: UserKey) => {
    session.status = "active"
    session.openedAt = toInstant(atMs)
    addEvent(session, "opened", atMs, by)
  }
  const close = (session: MeetingSession, atMs: number, by: UserKey) => {
    session.status = "completed"
    session.closedAt = toInstant(atMs)
    session.closedBy = user[by].id
    addEvent(session, "closed", atMs, by)
  }
  /** Everyone with a membership in the service on the date: the people who come to an open session. */
  const openPool = (session: MeetingSession) => {
    const ids = new Set(
      state.memberships
        .filter((m) => m.serviceId === session.serviceId && isCurrentOn(m, session.occurrenceDate))
        .map((m) => m.personId)
    )
    return state.persons.filter((p) => ids.has(p.id) && p.status === "active")
  }
  /** Marks a realistic share of the roster present, spread around the start time but never before opening. */
  const takeAttendance = (session: MeetingSession, by: UserKey, untilMs?: number, factor = 1) => {
    const start = epochOf(session.startsAt)
    const openedMs = session.openedAt ? epochOf(session.openedAt) : start
    const pool = session.rosterMode === "open" ? openPool(session) : sessionRoster(state, session)
    const marks: [Person, number][] = []
    for (const p of pool) {
      const p0 = session.rosterMode === "open" ? 0.55 : rateOf(p)
      if (!rnd.chance(Math.min(0.98, p0 * factor))) continue
      const offset = Math.round(rnd.next() ** 1.6 * 26 - 6)
      const t = start + offset * MIN + rnd.int(0, 59) * 1000
      marks.push([p, Math.max(t, openedMs + rnd.int(20, 90) * 1000)])
    }
    marks.sort((a, b) => a[1] - b[1])
    const out: Attendance[] = []
    for (const [p, t] of marks)
      if (untilMs === undefined || t <= untilMs) out.push(mark(session, p, t, by))
    return out
  }
  const materialize = (sch: MeetingSchedule, date: LocalDate, createdMs?: number) => {
    const occ = occurrenceOn(sch, date)
    if (!occ) throw new Error(`No occurrence of ${sch.name} on ${date}`)
    const s = sessionFromOccurrence(sch, occ, createdMs ?? at(addDays(date, -1), "00:05"), rnd.next)
    state.sessions.push(s)
    return s
  }

  // Past occurrences up to yesterday: created the day before, held and closed.
  type Special = "skip" | "canceled" | "not-taken"
  const specials: Record<string, Record<LocalDate, Special>> = {
    youth: { "2026-10-23": "canceled" },
    bible: { "2026-10-21": "canceled" },
    "hymns-beginners": { "2026-10-31": "not-taken" },
  }
  const pastSchedules = [
    "ss-kg",
    "ss-c1",
    "ss-c2",
    "ss-c3",
    "ss-c4",
    "ss-c56",
    "youth",
    "football",
    "hymns-beginners",
    "hymns-advanced",
    "bible",
    "servants",
    "coptic-1",
    "coptic-2",
    "summer",
  ]
  const yesterday = addDays(DEMO_DAY, -1)
  const pastSessions: Record<string, MeetingSession> = {}
  for (const key of pastSchedules) {
    const sch = schedule[key]
    const lastDay = key === "football" ? "2026-10-10" : yesterday
    const from = key === "summer" ? sch.recurrence.startsOn : HISTORY_FROM
    for (let date = from; date <= lastDay; date = addDays(date, 1)) {
      const occ = occurrenceOn(sch, date)
      if (!occ) continue
      const special = specials[key]?.[date]
      // A session canceled in advance was created early, at the moment it was canceled.
      const canceledAt = at(addDays(date, -5), "20:30")
      const s = materialize(sch, date, special === "canceled" ? canceledAt : undefined)
      pastSessions[`${key}@${date}`] = s
      if (special === "canceled") {
        s.status = "canceled"
        s.overridden = true
        s.cancelReason =
          key === "youth"
            ? "Autumn holidays. We meet again on 30 October."
            : "No speaker this week."
        addEvent(s, "canceled", canceledAt, takers[key][0], s.cancelReason)
        continue
      }
      if (special === "not-taken") continue
      const by = rnd.pick(takers[key])
      const start = epochOf(s.startsAt)
      open(s, start - rnd.int(2, 7) * MIN, by)
      const marks = takeAttendance(s, by)
      if (marks.length > 3 && rnd.chance(0.05)) {
        const wrong = rnd.pick(marks)
        removeMark(
          wrong,
          epochOf(wrong.recordedAt) + rnd.int(1, 4) * MIN,
          by,
          "Marked the wrong person."
        )
      }
      close(s, (s.endsAt ? epochOf(s.endsAt) : start + 90 * MIN) + rnd.int(0, 12) * MIN, by)
    }
  }

  // Last Sunday, Daniel marked the wrong Mina Hanna in 3rd Class. Christine reopened the session to fix it.
  {
    const s = pastSessions["ss-c3@2026-11-01"]
    // Daniel tapped the wrong Mina Hanna: the young man from the Youth Meeting instead of the child.
    state.attendance = state.attendance.filter(
      (a) => !(a.sessionId === s.id && a.personId === minaChild.id)
    )
    const wrong = mark(s, minaYouth, at("2026-11-01", "12:04") + 12_000, "daniel")
    const reopenAt = epochOf(s.closedAt!) + 25 * MIN
    addEvent(
      s,
      "reopened",
      reopenAt,
      "christine",
      "Mina Hanna from the Youth Meeting was marked instead of Mina Hanna from 3rd Class."
    )
    removeMark(
      wrong,
      reopenAt + 2 * MIN,
      "christine",
      "Wrong Mina Hanna: marked the one from the Youth Meeting."
    )
    mark(s, minaChild, reopenAt + 3 * MIN, "christine")
    s.status = "completed"
    s.closedAt = toInstant(reopenAt + 4 * MIN)
    s.closedBy = user.christine.id
    addEvent(s, "closed", reopenAt + 4 * MIN, "christine")
  }

  // A one-off session: the youth retreat planning evening.
  {
    const startsAt = localInstant("2026-10-27", "19:00")
    const s: MeetingSession = {
      id: id(at("2026-10-22", "21:15")),
      serviceId: service.youth.id,
      stageId: null,
      scheduleId: null,
      occurrenceDate: "2026-10-27",
      title: "Retreat planning",
      location: "Youth room",
      startsAt,
      endsAt: localInstant("2026-10-27", "20:30"),
      status: "scheduled",
      rosterMode: "open",
      overridden: false,
      cancelReason: null,
      openedAt: null,
      closedAt: null,
      closedBy: null,
      createdAt: toInstant(at("2026-10-22", "21:15")),
    }
    state.sessions.push(s)
    open(s, at("2026-10-27", "18:58"), "mark")
    for (const [i, p] of youth.slice(0, 6).entries())
      mark(s, p, at("2026-10-27", "19:02") + i * 3 * MIN, "mark")
    close(s, at("2026-10-27", "20:41"), "mark")
  }

  // ------------------------------------------------------------ today & tomorrow
  // The hourly generator created today's sessions yesterday and tomorrow's today, at 00:05.
  for (const day of [addDays(DEMO_DAY, -1), DEMO_DAY]) {
    const runMs = at(day, "00:05")
    const run = generate(state, day, runMs, rnd.next)
    state.generatorRuns.push(run)
  }

  const todays = (key: string) => {
    const s = state.sessions.find(
      (x) => x.scheduleId === schedule[key].id && x.occurrenceDate === DEMO_DAY
    )
    if (!s) throw new Error(`Missing today's session for ${key}`)
    return s
  }
  const NOW_MS = at(DEMO_DAY, "12:08")

  // 2nd Class was canceled yesterday evening; the children join 1st Class.
  {
    const s = todays("ss-c2")
    s.status = "canceled"
    s.overridden = true
    s.cancelReason = "Marina is away. 2nd Class joins 1st Class today."
    addEvent(s, "canceled", at("2026-11-07", "18:20"), "christine", s.cancelReason)
  }
  // Classes in progress.
  const live: [string, UserKey, LocalTime][] = [
    ["ss-kg", "rebecca", "11:57"],
    ["ss-c1", "youssef", "11:59"],
    ["ss-c3", "daniel", "12:01"],
    ["ss-c56", "christine", "11:55"],
  ]
  for (const [key, by, openedAt] of live) {
    const s = todays(key)
    open(s, at(DEMO_DAY, openedAt), by)
    takeAttendance(s, by, NOW_MS - 30_000, key === "ss-c3" ? 0.8 : 0.95)
  }
  // 2nd Class children joining 1st Class: present, but not on the 1st Class roster.
  {
    const s = todays("ss-c1")
    kids.c2.slice(0, 3).forEach((p, i) => mark(s, p, at(DEMO_DAY, "12:03") + i * 50_000, "youssef"))
  }

  // ------------------------------------------------- changes made in advance
  // Next Wednesday's Bible Study is canceled; Friday's Youth Meeting starts later.
  {
    const s = materialize(schedule.bible, "2026-11-11", at("2026-11-05", "09:12"))
    s.status = "canceled"
    s.overridden = true
    s.cancelReason = "The church hall is booked for the autumn bazaar."
    addEvent(s, "canceled", at("2026-11-05", "09:12"), "maged", s.cancelReason)
  }
  {
    const s = materialize(schedule.youth, "2026-11-13", at("2026-11-06", "22:04"))
    const from = s.startsAt
    s.startsAt = localInstant("2026-11-13", "19:30")
    s.endsAt = localInstant("2026-11-13", "21:30")
    s.overridden = true
    addEvent(s, "moved", at("2026-11-06", "22:04"), "mark", from)
  }
  // A one-off rehearsal for the whole of Sunday School in December.
  {
    const createdMs = at("2026-11-02", "20:45")
    state.sessions.push({
      id: id(createdMs),
      serviceId: service["sunday-school"].id,
      stageId: null,
      scheduleId: null,
      occurrenceDate: "2026-12-12",
      title: "Christmas play rehearsal",
      location: "Church hall",
      startsAt: localInstant("2026-12-12", "10:00"),
      endsAt: localInstant("2026-12-12", "12:00"),
      status: "scheduled",
      rosterMode: "open",
      overridden: false,
      cancelReason: null,
      openedAt: null,
      closedAt: null,
      closedBy: null,
      createdAt: toInstant(createdMs),
    })
  }

  // ------------------------------------------------------------- lessons & homework
  // Lessons are prepared per stage for a date of the stage's schedule. Sessions
  // only exist from the day before, so the link is (schedule, teaching date).
  type LessonSpec = Partial<
    Omit<
      Lesson,
      | "id"
      | "serviceId"
      | "stageId"
      | "scheduleId"
      | "teachingDate"
      | "title"
      | "status"
      | "responsibleId"
    >
  > & {
    collaborators?: UserKey[]
  }
  const addLesson = (
    stageKey: string,
    teachingDate: LocalDate,
    title: string,
    status: Lesson["status"],
    responsible: UserKey,
    spec: LessonSpec,
    created: [LocalDate, LocalTime]
  ): Lesson => {
    const createdMs = at(...created)
    const sch = schedule[`ss-${stageKey}`]
    const lesson: Lesson = {
      id: id(createdMs),
      serviceId: service["sunday-school"].id,
      stageId: stage[stageKey].id,
      scheduleId: sch.id,
      sessionId: null,
      teachingDate,
      title,
      summary: spec.summary ?? null,
      passage: spec.passage ?? null,
      objectives: spec.objectives ?? null,
      teachingPoints: spec.teachingPoints ?? null,
      memoryVerse: spec.memoryVerse ?? null,
      activities: spec.activities ?? null,
      materials: spec.materials ?? [],
      notes: spec.notes ?? null,
      status,
      responsibleId: user[responsible].id,
      collaboratorIds: (spec.collaborators ?? []).map((k) => user[k].id),
      completedAt: status === "completed" ? toInstant(at(teachingDate, "13:30")) : null,
      archivedAt: null,
      createdAt: toInstant(createdMs),
      updatedAt: toInstant(createdMs + 2 * 86_400_000),
    }
    state.lessons.push(lesson)
    return lesson
  }
  const addHomework = (
    lesson: Lesson,
    title: string,
    instructions: string,
    dueDate: LocalDate | null,
    by: UserKey,
    published: [LocalDate, LocalTime] | null,
    resources: HomeworkAssignment["resources"] = []
  ): HomeworkAssignment => {
    const createdMs = epochOf(lesson.createdAt) + 60 * MIN
    const hw: HomeworkAssignment = {
      id: id(createdMs),
      lessonId: lesson.id,
      serviceId: lesson.serviceId,
      stageId: lesson.stageId!,
      title,
      instructions,
      dueDate,
      resources,
      status: published ? "published" : "draft",
      publishedAt: published ? toInstant(at(...published)) : null,
      archivedAt: null,
      createdBy: user[by].id,
      createdAt: toInstant(createdMs),
      updatedAt: toInstant(published ? at(...published) : createdMs),
    }
    state.homework.push(hw)
    return hw
  }
  const guardianOf = (child: Person) =>
    state.users.find((u) =>
      state.guardians.some(
        (g) => g.userId === u.id && g.personId === child.id && g.status === "approved"
      )
    )
  const complete = (hw: HomeworkAssignment, child: Person, by: User | undefined, when: number) => {
    if (!by) return
    state.completions.push({
      id: id(when),
      assignmentId: hw.id,
      personId: child.id,
      completedAt: toInstant(when),
      completedBy: by.id,
      undoneAt: null,
      undoneBy: null,
    })
  }
  const bible = (ref: string) =>
    `https://www.biblegateway.com/passage/?search=${encodeURIComponent(ref)}&version=NKJV`

  // 3rd Class, prepared by Daniel.
  addLesson(
    "c3",
    "2026-10-04",
    "Noah Builds the Ark",
    "completed",
    "daniel",
    {
      passage: "Genesis 6:9–22",
      memoryVerse: "Noah did according to all that God commanded him. (Genesis 6:22)",
      objectives:
        "The children see that Noah trusted God and obeyed, even when others laughed at him.",
      teachingPoints:
        "God saw that Noah was faithful.\nGod asked Noah to build an ark.\nNoah obeyed, step by step.",
      activities: "Build a paper ark and fill it with pairs of animals.",
      materials: [{ label: "Children’s Bible, pages 14–17", url: null }],
    },
    ["2026-09-27", "20:10"]
  )
  addLesson(
    "c3",
    "2026-10-11",
    "Abraham Trusts God",
    "completed",
    "daniel",
    {
      passage: "Genesis 12:1–9",
      memoryVerse: "Abram believed the Lord. (Genesis 15:6)",
      objectives:
        "The children learn that trusting God means following Him even when we don’t know the way.",
    },
    ["2026-10-04", "19:45"]
  )
  addLesson(
    "c3",
    "2026-10-18",
    "Joseph Forgives His Brothers",
    "completed",
    "daniel",
    {
      passage: "Genesis 45:1–15",
      memoryVerse: "You meant evil against me; but God meant it for good. (Genesis 50:20)",
      objectives: "The children understand forgiveness through Joseph’s story.",
    },
    ["2026-10-11", "21:02"]
  )
  addLesson(
    "c3",
    "2026-10-25",
    "Baby Moses in the Basket",
    "completed",
    "daniel",
    {
      passage: "Exodus 2:1–10",
      objectives:
        "The children see how God protected Moses through his mother, his sister and Pharaoh’s daughter.",
    },
    ["2026-10-18", "18:30"]
  )
  const lostSheep = addLesson(
    "c3",
    "2026-11-01",
    "The Lost Sheep",
    "completed",
    "daniel",
    {
      summary:
        "Jesus tells the story of a shepherd who leaves ninety-nine sheep to find the one that was lost.",
      passage: "Luke 15:3–7",
      memoryVerse: "There will be more joy in heaven over one sinner who repents. (Luke 15:7)",
      objectives:
        "The children know that God looks for every one of us and rejoices when we come back to Him.",
      teachingPoints:
        "The shepherd knows each sheep.\nHe searches until he finds the lost one.\nHe carries it home with joy.",
      activities:
        "Hide a paper sheep in the room and let the children find it.\nSing “The Good Shepherd”.",
      materials: [{ label: "Paper sheep (cupboard, second shelf)", url: null }],
      notes: "Two children were upset last week; keep the hiding game calm.",
      collaborators: ["christine"],
    },
    ["2026-10-25", "20:40"]
  )
  const readStory = addHomework(
    lostSheep,
    "Read the story together",
    "Read Luke 15:3–7 with your child. Ask: how did the shepherd feel when he found his sheep? How does God feel about each of us?",
    "2026-11-07",
    "daniel",
    ["2026-11-01", "14:05"],
    [{ label: "Luke 15:3–7 in the Bible", url: bible("Luke 15:3-7") }]
  )
  const drawSheep = addHomework(
    lostSheep,
    "Draw the shepherd and his sheep",
    "Help your child draw the shepherd carrying the lost sheep home. Please bring the drawing next Sunday.",
    "2026-11-08",
    "daniel",
    ["2026-11-01", "14:06"]
  )
  for (const child of kids.c3) {
    if (child.id === minaChild.id || child.id === kirollosChild.id) continue
    const parent = guardianOf(child)
    if (rnd.chance(0.78))
      complete(readStory, child, parent, at("2026-11-02", "18:00") + rnd.int(0, 5 * 24 * 60) * MIN)
    if (rnd.chance(0.6))
      complete(drawSheep, child, parent, at("2026-11-03", "17:00") + rnd.int(0, 4 * 24 * 60) * MIN)
  }
  complete(readStory, minaChild, user.hoda, at("2026-11-06", "19:40"))
  // Kirollos finished after the due date: shown as "completed after the due date", never as a failure.
  complete(readStory, kirollosChild, user.samir, at("2026-11-08", "09:15"))

  const zacchaeus = addLesson(
    "c3",
    DEMO_DAY,
    "Zacchaeus Meets Jesus",
    "ready",
    "daniel",
    {
      summary:
        "Zacchaeus climbs a tree to see Jesus, and Jesus visits his house. His life changes.",
      passage: "Luke 19:1–10",
      memoryVerse: "The Son of Man has come to seek and to save that which was lost. (Luke 19:10)",
      objectives:
        "The children learn that Jesus loves us before we change, and that His love changes us.",
      teachingPoints:
        "Zacchaeus was small and unpopular.\nJesus called him by name.\nZacchaeus gave back what he had taken.",
      activities: "Act out the story; one child stands on a chair as the sycamore tree.",
      materials: [{ label: "Felt board figures: Zacchaeus, tree, crowd", url: null }],
      notes: "Daniel leads; Christine joins after the liturgy.",
      collaborators: ["christine"],
    },
    ["2026-11-01", "20:15"]
  )
  addHomework(
    zacchaeus,
    "Learn the memory verse",
    "Help your child learn Luke 19:10 by heart: “The Son of Man has come to seek and to save that which was lost.” Say it together each evening.",
    "2026-11-15",
    "daniel",
    null
  )
  addLesson(
    "c3",
    "2026-11-22",
    "The Wise and Foolish Builders",
    "draft",
    "daniel",
    {
      passage: "Matthew 7:24–27",
      objectives:
        "The children understand that listening to Jesus and doing what He says is like building on rock.",
      notes:
        "Bring the building blocks and the sand tray. Ask Monica if she can tell the story with the felt board.",
      collaborators: ["christine"],
    },
    ["2026-11-07", "21:30"]
  )

  // Other classes.
  const animals = addLesson(
    "kg",
    DEMO_DAY,
    "God Made the Animals",
    "ready",
    "rebecca",
    {
      passage: "Genesis 1:20–25",
      objectives: "The children thank God for the animals He made.",
      activities: "Animal sounds game; colour a page with five animals.",
    },
    ["2026-11-02", "19:00"]
  )
  addHomework(
    animals,
    "Name five animals God made",
    "Ask your child to name five animals God made. For each one, say together: “Thank you, God, for the …”.",
    "2026-11-15",
    "rebecca",
    ["2026-11-06", "18:20"]
  )
  const loaves = addLesson(
    "c1",
    "2026-11-01",
    "Jesus Feeds Five Thousand",
    "completed",
    "youssef",
    {
      passage: "John 6:1–14",
      memoryVerse:
        "Jesus took the loaves, and when He had given thanks He distributed them. (John 6:11)",
      objectives:
        "The children learn that Jesus cares for our needs and that we give thanks before eating.",
    },
    ["2026-10-26", "19:30"]
  )
  const drawLoaves = addHomework(
    loaves,
    "Draw the five loaves and two fish",
    "Help your child draw the boy’s basket with five loaves and two fish. Talk about what we can share with others.",
    "2026-11-07",
    "youssef",
    ["2026-11-01", "13:50"]
  )
  complete(drawLoaves, mariamChild, user.nabil, at("2026-11-04", "18:30"))
  for (const child of kids.c1)
    if (child.id !== mariamChild.id && rnd.chance(0.65))
      complete(
        drawLoaves,
        child,
        guardianOf(child),
        at("2026-11-02", "17:00") + rnd.int(0, 4 * 24 * 60) * MIN
      )
  const storm = addLesson(
    "c1",
    DEMO_DAY,
    "Jesus Calms the Storm",
    "ready",
    "youssef",
    {
      passage: "Mark 4:35–41",
      memoryVerse: "Peace, be still! (Mark 4:39)",
      objectives: "The children learn to call on Jesus when they are afraid.",
    },
    ["2026-11-03", "20:00"]
  )
  addHomework(
    storm,
    "Pray before sleeping",
    "Each evening this week, pray a short prayer with your child before bed, like the disciples who called to Jesus in the storm. For example: “Lord Jesus, keep us safe tonight. Amen.”",
    "2026-11-15",
    "youssef",
    ["2026-11-08", "11:40"]
  )
  addLesson(
    "c2",
    DEMO_DAY,
    "Daniel in the Lions’ Den",
    "ready",
    "marina",
    {
      passage: "Daniel 6:10–23",
      memoryVerse: "My God sent His angel and shut the lions’ mouths. (Daniel 6:22)",
    },
    ["2026-11-01", "21:00"]
  )
  addLesson(
    "c56",
    DEMO_DAY,
    "The Armour of God",
    "ready",
    "christine",
    {
      passage: "Ephesians 6:10–18",
      objectives:
        "The older children name the pieces of God’s armour and what each one means for daily life.",
    },
    ["2026-11-02", "20:30"]
  )
  addLesson(
    "c4",
    "2026-11-15",
    "The Ten Commandments",
    "draft",
    "george",
    {
      passage: "Exodus 20:1–17",
    },
    ["2026-11-05", "19:15"]
  )

  // ------------------------------------------------------- account requests
  // People who registered themselves. Their accounts can't be used until an administrator approves
  // them, linking the children (parents) or giving a role (servants); declined ones are deleted.
  const registered = (
    first: string,
    last: string,
    on: [LocalDate, LocalTime],
    registration: User["registration"],
    language: User["language"]
  ) => {
    const ms = at(...on)
    const u: User = {
      id: id(ms),
      email: `${first}.${last}@example.org`.toLowerCase(),
      displayName: `${first} ${last}`,
      personId: null,
      roles: [],
      passwordHash: demoPasswordHash(),
      language,
      registration,
      privacyAcceptedAt: toInstant(ms),
      privacyVersion: PRIVACY_VERSION,
      approvedAt: null,
      approvedBy: null,
      disabledAt: null,
      createdAt: toInstant(ms),
    }
    state.users.push(u)
    return u
  }
  const newFamily = kids.c2[0]
  registered(
    "Sandra",
    newFamily.lastName,
    ["2026-11-06", "21:14"],
    {
      as: "parent",
      details: `${newFamily.displayName ?? newFamily.firstName} ${newFamily.lastName}, 2nd Class (with Marina)`,
      serviceId: null,
    },
    "ar"
  )
  registered(
    "Fady",
    "Gerges",
    ["2026-11-07", "18:02"],
    {
      as: "servant",
      details:
        "I served in the youth meeting of my previous parish for three years and moved to Cologne in October. Mark Shenouda knows me.",
      serviceId: service.youth.id,
    },
    "de"
  )

  // --------------------------------------------------- data protection log
  const dataRequest = (r: Omit<DataRequest, "id" | "dueOn">) => {
    const received = epochOf(r.receivedAt)
    state.dataRequests.push({
      id: id(received),
      ...r,
      dueOn: oneMonthAfter(localDateOf(received)),
    })
  }
  // An erasure carried out in September: only the log entry is left, without the name.
  dataRequest({
    kind: "erasure",
    personId: null,
    userId: null,
    subjectName: null,
    erasedSubject: { kind: "member", group: "Youth Meeting" },
    requestedBy: "The member, in person",
    channel: "in_person",
    receivedAt: toInstant(at("2026-09-13", "13:20")),
    note: null,
    status: "done",
    outcome: { person: 1, memberships: 1, attendance: 2 },
    declineReason: null,
    closedAt: toInstant(at("2026-09-16", "19:05")),
    closedBy: user.mariam.id,
  })
  // Nabil asked for a copy of what the app stores about him; the office sent it.
  dataRequest({
    kind: "copy",
    personId: user.nabil.personId,
    userId: user.nabil.id,
    subjectName: user.nabil.displayName,
    erasedSubject: null,
    requestedBy: "Nabil Hanna, by email",
    channel: "email",
    receivedAt: toInstant(at("2026-10-05", "08:47")),
    note: null,
    status: "done",
    outcome: null,
    declineReason: null,
    closedAt: toInstant(at("2026-10-07", "20:30")),
    closedBy: user.mariam.id,
  })
  // The family that moved away in October asks the office to delete their child's data.
  dataRequest({
    kind: "erasure",
    personId: movedAway.id,
    userId: null,
    subjectName: `${movedAway.firstName} ${movedAway.lastName}`,
    erasedSubject: null,
    requestedBy: "The parents, by email",
    channel: "email",
    receivedAt: toInstant(at("2026-11-02", "19:40")),
    note: "The family moved to Hamburg and asks us to delete everything about their child.",
    status: "open",
    outcome: null,
    declineReason: null,
    closedAt: null,
    closedBy: null,
  })

  return state
}
