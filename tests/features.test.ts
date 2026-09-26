import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { events, searchEventsByName, filterEventsByCategory } from '@/data/events'
import { registrations } from '@/data/registrations'
import { users } from '@/data/auth'
import { registerForEvent, cancelRegistration, saveEvent, removeEvent } from '@/data/store'

const seedEvents = structuredClone(events)
const seedRegistrations = structuredClone(registrations)
const student = users[0], organizer = users[1], student2 = users[2], student3 = users[3]
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-26T00:00:00Z'))
  events.splice(0, events.length, ...structuredClone(seedEvents))
  registrations.splice(0, registrations.length, ...structuredClone(seedRegistrations))
})
afterEach(() => { vi.useRealTimers() })
function fixture() {
  saveEvent(organizer, { name: 'New workshop', venue: 'Lab', date: '2026-12-01T12:00:00Z', description: '', category: 'Tech', capacity: 1 })
  return events[events.length - 1]
}
describe('required features', () => {
  it('composes search and category filtering', () => {
    expect(filterEventsByCategory(searchEventsByName(events, ' HACK '), 'Tech')).toHaveLength(1)
    expect(filterEventsByCategory(searchEventsByName(events, 'hack'), 'Music')).toHaveLength(0)
  })
  it('updates seats once, blocks duplicates, cancels and allows re-registration', () => {
    const e = fixture()
    registerForEvent(student, e.id)
    expect(e.seatsAvailable).toBe(0)
    expect(() => registerForEvent(student, e.id)).toThrow('already registered')
    const r = registrations.find(r => r.eventId === e.id)!
    cancelRegistration(student, r.id)
    expect(r.status).toBe('cancelled')
    expect(e.seatsAvailable).toBe(1)
    expect(() => cancelRegistration(student, r.id)).toThrow('already cancelled')
    expect(e.seatsAvailable).toBe(1)
    registerForEvent(student, e.id)
    expect(e.seatsAvailable).toBe(0)
  })
  it('requires a student and blocks full, past, missing, and cancelled events', () => {
    const e = fixture()
    expect(() => registerForEvent(null, e.id)).toThrow()
    expect(() => registerForEvent(organizer, e.id)).toThrow()
    expect(() => registerForEvent(student, 'missing')).toThrow()
    registerForEvent(student, e.id) // capacity 1 is now genuinely full
    expect(() => registerForEvent(student2, e.id)).toThrow('full')
    const pastEvent = fixture()
    pastEvent.date = '2020-01-01'
    expect(() => registerForEvent(student, pastEvent.id)).toThrow('closed')
    const cancelledEvent = fixture()
    cancelledEvent.cancelled = true
    expect(() => registerForEvent(student, cancelledEvent.id)).toThrow('closed')
  })
  it('enforces organizer ownership and capacity validation', () => {
    const e = fixture()
    registerForEvent(student, e.id)
    saveEvent(organizer, { ...e, capacity: 2 }, e.id)
    expect(e.seatsAvailable).toBe(1)
    expect(() => saveEvent(organizer, { ...e, capacity: 0 }, e.id)).toThrow()
    // Book 3 of 4 seats for real, then capacity cannot drop below 3.
    saveEvent(organizer, { ...e, capacity: 4 }, e.id)
    registerForEvent(student2, e.id)
    registerForEvent(student3, e.id)
    expect(e.seatsAvailable).toBe(1)
    expect(() => saveEvent(organizer, { ...e, capacity: 2 }, e.id)).toThrow('booked')
    expect(() => saveEvent(student, e, e.id)).toThrow()
    const foreign = events.find(x => x.organizerId !== organizer.id)!
    expect(() => removeEvent(organizer, foreign.id)).toThrow('own')
    expect(() => saveEvent(organizer, { ...e, name: ' ' }, e.id)).toThrow()
    expect(() => saveEvent(organizer, { ...e, venue: ' ' }, e.id)).toThrow()
    expect(() => saveEvent(organizer, { ...e, date: 'invalid' }, e.id)).toThrow()
    expect(() => saveEvent(organizer, { ...e, date: '2020-01-01' }, e.id)).toThrow()
    expect(() => saveEvent(organizer, { ...e, capacity: 3.5 }, e.id)).toThrow()
  })
  it('cancels related registrations and deletes without orphan records', () => {
    const e = fixture()
    registerForEvent(student, e.id)
    removeEvent(organizer, e.id)
    expect(e.cancelled).toBe(true)
    expect(registrations.filter(r => r.eventId === e.id).every(r => r.status === 'cancelled')).toBe(true)
    expect(() => cancelRegistration(student, registrations.find(r => r.eventId === e.id)!.id)).toThrow()
    removeEvent(organizer, e.id, true)
    expect(events.some(x => x.id === e.id)).toBe(false)
    expect(registrations.some(r => r.eventId === e.id)).toBe(false)
  })
})
