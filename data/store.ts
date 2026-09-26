import { events, CampusEvent, EventCategory, isPastEvent } from './events'
import {
  registrations,
  Registration,
  getActiveRegistrationsForEvent,
  getActiveRegistration,
} from './registrations'
import { AppUser, getUserById } from './auth'

let revision = 0
const listeners = new Set<() => void>()
export const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export const getRevision = () => revision
function changed() { revision++; listeners.forEach(listener => listener()) }

function requireRole(user: AppUser | null, role: AppUser['role']) {
  if (!user || getUserById(user.id)?.role !== role || user.role !== role)
    throw new Error(role === 'student' ? 'Choose a student account to register.' : 'An organizer account is required.')
  return user
}
function ownedEvent(user: AppUser | null, id: string) {
  const owner = requireRole(user, 'organizer')
  const event = events.find(e => e.id === id)
  if (!event || event.organizerId !== owner.id) throw new Error('You can only manage your own events.')
  return event
}

// ---------------------------------------------------------------------------
// Seat accounting — single source of truth
// ---------------------------------------------------------------------------

/**
 * Number of seats currently occupied by an event.
 * Only 'confirmed' registrations count. Cancelled registrations free
 * their seat immediately and never occupy one.
 */
export function confirmedCount(eventId: string): number {
  return getActiveRegistrationsForEvent(eventId).length
}

/**
 * Seats still bookable for an event. This is derived from the
 * registration records on every call, so it can never drift.
 * Cancelled (or deleted) events have no bookable seats.
 */
export function availableSeats(event: CampusEvent): number {
  if (event.cancelled) return 0
  return Math.max(0, event.capacity - confirmedCount(event.id))
}

/**
 * Refresh the denormalized `seatsAvailable` cache on an event so every
 * reader (cards, detail pages, sorting) shows the same number that the
 * registration records imply. Call after every mutation.
 */
export function syncSeats(event: CampusEvent): void {
  event.seatsAvailable = event.cancelled ? 0 : availableSeats(event)
}

/** True when every event's cached seat count matches its registrations. */
export function verifySeatIntegrity(): boolean {
  return events.every(e => e.seatsAvailable === (e.cancelled ? 0 : Math.max(0, e.capacity - confirmedCount(e.id))))
}

// ---------------------------------------------------------------------------
// Data repair ("migration" for the in-memory store)
// ---------------------------------------------------------------------------

export interface RepairReport {
  duplicatesFixed: number
  orphansRemoved: number
  seatsResynced: number
}

/**
 * Inspect the current data and repair inconsistencies without losing
 * legitimate history:
 *  - duplicate CONFIRMED registrations for the same (event, student) are
 *    collapsed to one: the earliest stays confirmed, later ones are marked
 *    cancelled (never deleted, so the history is preserved);
 *  - registrations pointing at events that no longer exist are removed;
 *  - every event's seat cache is recomputed from its registrations;
 *  - events missing createdAt/updatedAt get sensible defaults.
 */
export function repairDataIntegrity(): RepairReport {
  const report: RepairReport = { duplicatesFixed: 0, orphansRemoved: 0, seatsResynced: 0 }
  const eventIds = new Set(events.map(e => e.id))

  for (let i = registrations.length - 1; i >= 0; i--) {
    if (!eventIds.has(registrations[i].eventId)) {
      registrations.splice(i, 1)
      report.orphansRemoved++
    }
  }

  const firstConfirmed = new Map<string, Registration>()
  for (const reg of registrations) {
    if (reg.status !== 'confirmed') continue
    const key = reg.eventId + '|' + reg.studentId
    const existing = firstConfirmed.get(key)
    if (!existing) {
      firstConfirmed.set(key, reg)
      continue
    }
    // Keep the earliest registration confirmed; mark the later one cancelled.
    const [keep, drop] =
      new Date(existing.registeredAt).getTime() <= new Date(reg.registeredAt).getTime()
        ? [existing, reg]
        : [reg, existing]
    drop.status = 'cancelled'
    firstConfirmed.set(key, keep)
    report.duplicatesFixed++
  }

  for (const event of events) {
    if (!event.createdAt) event.createdAt = new Date().toISOString()
    if (!event.updatedAt) event.updatedAt = event.createdAt
    const before = event.seatsAvailable
    syncSeats(event)
    if (event.seatsAvailable !== before) report.seatsResynced++
  }
  return report
}

// Run the repair once when the store loads so the app always starts
// from consistent data, the same way a migration runs on server boot.
repairDataIntegrity()

// ---------------------------------------------------------------------------
// Visibility — enforced here, never only in the UI
// ---------------------------------------------------------------------------

/** Events a signed-out visitor or student may discover: active and upcoming only. */
export function studentFacingEvents(): CampusEvent[] {
  return events.filter(e => !e.cancelled && !isPastEvent(e))
}

/**
 * Every event a user is allowed to know about.
 * Students (and guests) see the student-facing board. Organizers see all of
 * their own events, including cancelled and past ones, for history.
 */
export function eventsVisibleTo(user: AppUser | null): CampusEvent[] {
  if (user?.role === 'organizer') return events.filter(e => e.organizerId === user.id)
  return studentFacingEvents()
}

/** A student's own registration state for an event: confirmed, cancelled, or none. */
export function registrationStatusFor(user: AppUser | null, eventId: string): 'confirmed' | 'cancelled' | null {
  if (!user) return null
  if (getActiveRegistration(user.id, eventId)) return 'confirmed'
  const any = registrations.find(r => r.studentId === user.id && r.eventId === eventId)
  return any ? 'cancelled' : null
}

export interface ParticipantInfo {
  name: string
  status: Registration['status']
  registeredAt: string
}

/**
 * Participant list for an event. Organizer-only: the caller must own the
 * event, so students can never pull another event's roster through this.
 */
export function getEventParticipants(user: AppUser | null, eventId: string): ParticipantInfo[] {
  ownedEvent(user, eventId)
  return registrations
    .filter(r => r.eventId === eventId)
    .map(r => ({
      name: getUserById(r.studentId)?.name ?? 'Student',
      status: r.status,
      registeredAt: r.registeredAt,
    }))
    .sort((a, b) => +new Date(a.registeredAt) - +new Date(b.registeredAt))
}

// ---------------------------------------------------------------------------
// Mutations — every write path goes through here
// ---------------------------------------------------------------------------

/**
 * Register a student for an event.
 *
 * This function is fully synchronous, so the "check capacity → insert"
 * sequence is atomic: even if two requests arrive at the same time, one
 * runs to completion before the other starts, and the second sees the
 * updated count. Capacity can therefore never be exceeded, and the
 * (event, student) pair can never gain a second confirmed registration.
 */
export function registerForEvent(user: AppUser | null, eventId: string) {
  const student = requireRole(user, 'student')
  const event = events.find(e => e.id === eventId)
  if (!event) throw new Error('This event does not exist.')
  if (event.cancelled) throw new Error('This event has been cancelled. Registration is closed.')
  if (isPastEvent(event)) throw new Error('Registration is closed for this event.')
  if (getActiveRegistration(student.id, eventId))
    throw new Error('You are already registered for this event.')
  if (availableSeats(event) <= 0) throw new Error('This event is full.')
  registrations.push({
    id: crypto.randomUUID(),
    eventId,
    studentId: student.id,
    status: 'confirmed',
    registeredAt: new Date().toISOString(),
  })
  syncSeats(event)
  changed()
}

export function cancelRegistration(user: AppUser | null, registrationId: string) {
  const student = requireRole(user, 'student')
  const registration = registrations.find(r => r.id === registrationId && r.studentId === student.id)
  if (!registration) throw new Error('Registration not found.')
  if (registration.status === 'cancelled') throw new Error('This registration is already cancelled.')
  const event = events.find(e => e.id === registration.eventId)
  if (!event || event.cancelled || isPastEvent(event)) throw new Error('This registration can no longer be cancelled.')
  registration.status = 'cancelled'
  syncSeats(event)
  changed()
}

export type EventInput = Pick<CampusEvent, 'name' | 'description' | 'date' | 'venue' | 'category' | 'capacity'>
export const categories: EventCategory[] = ['Tech', 'Cultural', 'Sports', 'Workshop', 'Career', 'Music']
export function saveEvent(user: AppUser | null, input: EventInput, id?: string) {
  const owner = requireRole(user, 'organizer')
  const existing = id ? ownedEvent(user, id) : undefined
  if (existing?.cancelled) throw new Error('Cancelled events cannot be edited.')
  if (!input.name.trim() || !input.venue.trim()) throw new Error('Name and venue are required.')
  const time = new Date(input.date).getTime()
  if (!Number.isFinite(time) || time <= Date.now()) throw new Error('Choose a future date and time.')
  if (!Number.isSafeInteger(input.capacity) || input.capacity < 1) throw new Error('Capacity must be a positive whole number.')
  if (!categories.includes(input.category)) throw new Error('Choose a valid category.')
  const booked = existing ? confirmedCount(existing.id) : 0
  if (input.capacity < booked) throw new Error('Capacity cannot be below ' + booked + ' booked seats.')
  const now = new Date().toISOString()
  if (existing) {
    Object.assign(existing, {
      ...input,
      name: input.name.trim(),
      venue: input.venue.trim(),
      description: input.description.trim(),
      date: new Date(time).toISOString(),
      updatedAt: now,
    })
    syncSeats(existing)
  } else {
    const event: CampusEvent = {
      ...input,
      name: input.name.trim(),
      venue: input.venue.trim(),
      description: input.description.trim(),
      date: new Date(time).toISOString(),
      id: crypto.randomUUID(),
      organizerId: owner.id,
      cancelled: false,
      seatsAvailable: input.capacity,
      createdAt: now,
      updatedAt: now,
    }
    events.push(event)
  }
  changed()
}

export function removeEvent(user: AppUser | null, id: string, permanently = false) {
  const event = ownedEvent(user, id)
  registrations.forEach(r => { if (r.eventId === id) r.status = 'cancelled' })
  event.cancelled = true
  event.updatedAt = new Date().toISOString()
  syncSeats(event) // cancelled events expose 0 bookable seats
  if (permanently) {
    events.splice(events.indexOf(event), 1)
    for (let i = registrations.length - 1; i >= 0; i--) if (registrations[i].eventId === id) registrations.splice(i, 1)
  }
  changed()
}
