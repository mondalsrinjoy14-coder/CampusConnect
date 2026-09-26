import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { events } from '@/data/events'
import { registrations, getActiveRegistrationsForEvent } from '@/data/registrations'
import { users, AppUser } from '@/data/auth'
import {
  registerForEvent,
  cancelRegistration,
  saveEvent,
  removeEvent,
  confirmedCount,
  availableSeats,
  syncSeats,
  verifySeatIntegrity,
  repairDataIntegrity,
  eventsVisibleTo,
  studentFacingEvents,
  registrationStatusFor,
  getEventParticipants,
} from '@/data/store'

const seedEvents = structuredClone(events)
const seedRegistrations = structuredClone(registrations)
const seedUsers = structuredClone(users)
const student = users[0], organizer = users[1], student2 = users[2], student3 = users[3]

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-26T00:00:00Z'))
  events.splice(0, events.length, ...structuredClone(seedEvents))
  registrations.splice(0, registrations.length, ...structuredClone(seedRegistrations))
  users.splice(0, users.length, ...structuredClone(seedUsers))
})
afterEach(() => { vi.useRealTimers() })

function fixture(capacity = 3) {
  saveEvent(organizer, {
    name: 'Seat lab ' + Math.random().toString(36).slice(2, 7),
    venue: 'Lab', date: '2026-12-01T12:00:00Z', description: '',
    category: 'Tech', capacity,
  })
  return events[events.length - 1]
}
function tempStudents(n: number): AppUser[] {
  const made: AppUser[] = []
  for (let i = 0; i < n; i++) {
    const u = { id: 'tmp-stu-' + i + '-' + Date.now(), name: 'Temp ' + i, role: 'student' as const }
    users.push(u)
    made.push(u)
  }
  return made
}
function seatsAreConsistent() {
  expect(verifySeatIntegrity()).toBe(true)
  for (const e of events) {
    expect(e.seatsAvailable).toBe(e.cancelled ? 0 : Math.max(0, e.capacity - confirmedCount(e.id)))
  }
}

describe('seat counting', () => {
  it('starts consistent and stays consistent through the whole flow', () => {
    seatsAreConsistent()
    const e = fixture(2)
    expect(availableSeats(e)).toBe(2)
    registerForEvent(student, e.id)
    expect(availableSeats(e)).toBe(1)
    expect(e.seatsAvailable).toBe(1)
    registerForEvent(student2, e.id)
    expect(availableSeats(e)).toBe(0)
    expect(e.seatsAvailable).toBe(0)
    seatsAreConsistent()
  })

  it('counts only confirmed registrations; cancelled ones free the seat', () => {
    const e = fixture(2)
    registerForEvent(student, e.id)
    registerForEvent(student2, e.id)
    const reg = registrations.find(r => r.eventId === e.id && r.studentId === student.id)!
    cancelRegistration(student, reg.id)
    expect(confirmedCount(e.id)).toBe(1)
    expect(availableSeats(e)).toBe(1)
    expect(e.seatsAvailable).toBe(1)
    seatsAreConsistent()
  })

  it('never lets the occupied count exceed capacity, even under burst registrations', async () => {
    const e = fixture(3)
    const racers = tempStudents(10)
    const outcomes = await Promise.all(racers.map(u =>
      Promise.resolve().then(() => {
        try { registerForEvent(u, e.id); return 'ok' }
        catch (err) { return (err as Error).message }
      })
    ))
    expect(outcomes.filter(o => o === 'ok')).toHaveLength(3)
    expect(outcomes.filter(o => o !== 'ok').every(o => o.includes('full'))).toBe(true)
    expect(confirmedCount(e.id)).toBe(3)
    expect(availableSeats(e)).toBe(0)
    seatsAreConsistent()
  })
})

describe('duplicate registrations', () => {
  it('blocks the same student registering twice, including back-to-back double submits', () => {
    const e = fixture(5)
    registerForEvent(student, e.id)
    expect(() => registerForEvent(student, e.id)).toThrow('already registered')
    expect(() => registerForEvent(student, e.id)).toThrow('already registered') // double submit
    expect(getActiveRegistrationsForEvent(e.id).filter(r => r.studentId === student.id)).toHaveLength(1)
    expect(confirmedCount(e.id)).toBe(1)
    seatsAreConsistent()
  })

  it('allows re-registration after cancellation, keeping a single active registration', () => {
    const e = fixture(2)
    registerForEvent(student, e.id)
    const reg = registrations.find(r => r.eventId === e.id && r.studentId === student.id)!
    cancelRegistration(student, reg.id)
    expect(registrationStatusFor(student, e.id)).toBe('cancelled')
    registerForEvent(student, e.id)
    expect(registrationStatusFor(student, e.id)).toBe('confirmed')
    expect(getActiveRegistrationsForEvent(e.id).filter(r => r.studentId === student.id)).toHaveLength(1)
    expect(availableSeats(e)).toBe(1)
    seatsAreConsistent()
  })

  it('repairDataIntegrity collapses duplicate confirmed registrations, keeping the earliest', () => {
    const e = fixture(10)
    registerForEvent(student, e.id)
    // Simulate a race/double-write that bypassed the API: two extra confirmed rows.
    registrations.push(
      { id: 'dup-1', eventId: e.id, studentId: student.id, status: 'confirmed', registeredAt: '2026-09-27T10:00:00Z' },
      { id: 'dup-2', eventId: e.id, studentId: student.id, status: 'confirmed', registeredAt: '2026-09-28T10:00:00Z' },
    )
    registrations.push({ id: 'orphan-1', eventId: 'no-such-event', studentId: student.id, status: 'confirmed', registeredAt: '2026-09-27T10:00:00Z' })
    expect(confirmedCount(e.id)).toBe(3)

    const report = repairDataIntegrity()

    expect(report.duplicatesFixed).toBe(2)
    expect(report.orphansRemoved).toBe(1)
    const mine = registrations.filter(r => r.eventId === e.id && r.studentId === student.id)
    expect(mine.filter(r => r.status === 'confirmed')).toHaveLength(1)
    expect(mine.filter(r => r.status === 'cancelled')).toHaveLength(2)
    // The earliest registration stays the legitimate one.
    const kept = mine.find(r => r.status === 'confirmed')!
    expect(kept.registeredAt < '2026-09-27T10:00:00Z').toBe(true)
    expect(registrations.some(r => r.id === 'orphan-1')).toBe(false)
    expect(confirmedCount(e.id)).toBe(1)
    expect(availableSeats(e)).toBe(9)
    seatsAreConsistent()
  })
})

describe('cancelled registrations stay out of active views', () => {
  it('a cancelled registration is not counted, listed, or treated as registered', () => {
    const e = fixture(2)
    registerForEvent(student, e.id)
    const reg = registrations.find(r => r.eventId === e.id && r.studentId === student.id)!
    cancelRegistration(student, reg.id)
    expect(getActiveRegistrationsForEvent(e.id)).toHaveLength(0)
    expect(registrationStatusFor(student, e.id)).toBe('cancelled')
    // Organizer roster marks it cancelled rather than dropping history.
    const roster = getEventParticipants(organizer, e.id)
    expect(roster).toHaveLength(1)
    expect(roster[0].status).toBe('cancelled')
  })

  it('cancelling an event retires its registrations and frees nothing bookable', () => {
    const e = fixture(2)
    registerForEvent(student, e.id)
    registerForEvent(student2, e.id)
    removeEvent(organizer, e.id)
    expect(e.cancelled).toBe(true)
    expect(confirmedCount(e.id)).toBe(0)
    expect(availableSeats(e)).toBe(0)
    expect(e.seatsAvailable).toBe(0)
    expect(() => registerForEvent(student3, e.id)).toThrow('cancelled')
    seatsAreConsistent()
  })
})

describe('event visibility', () => {
  it('hides cancelled events from students and guests, but not from the owning organizer', () => {
    const e = fixture(5)
    registerForEvent(student, e.id)
    removeEvent(organizer, e.id)
    expect(studentFacingEvents().some(x => x.id === e.id)).toBe(false)
    expect(eventsVisibleTo(student).some(x => x.id === e.id)).toBe(false)
    expect(eventsVisibleTo(null).some(x => x.id === e.id)).toBe(false)
    expect(eventsVisibleTo(student2).some(x => x.id === e.id)).toBe(false)
    const seenByOwner = eventsVisibleTo(organizer).find(x => x.id === e.id)
    expect(seenByOwner).toBeDefined()
    expect(seenByOwner!.cancelled).toBe(true)
  })

  it('never leaks one organizer\'s events or rosters to another account', () => {
    const e = fixture(2)
    registerForEvent(student, e.id)
    const otherOrg: AppUser = { id: 'org-9', name: 'Other Org', role: 'organizer' }
    users.push(otherOrg)
    expect(eventsVisibleTo(otherOrg).some(x => x.id === e.id)).toBe(false)
    expect(() => getEventParticipants(otherOrg, e.id)).toThrow('own')
    expect(() => getEventParticipants(student, e.id)).toThrow('organizer')
    expect(() => getEventParticipants(null, e.id)).toThrow()
  })

  it('syncSeats keeps the cached count honest after every mutation', () => {
    const e = fixture(4)
    e.seatsAvailable = 999 // simulate drift
    syncSeats(e)
    expect(e.seatsAvailable).toBe(4)
    registerForEvent(student, e.id)
    registerForEvent(student2, e.id)
    saveEvent(organizer, { ...e, capacity: 6 }, e.id)
    expect(e.seatsAvailable).toBe(4)
    seatsAreConsistent()
  })
})
