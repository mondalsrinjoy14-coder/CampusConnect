import { events, CampusEvent, EventCategory, isPastEvent } from './events'
import { registrations } from './registrations'
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
export function registerForEvent(user: AppUser | null, eventId: string) {
  const student = requireRole(user, 'student')
  const event = events.find(e => e.id === eventId)
  if (!event || event.cancelled || isPastEvent(event)) throw new Error('Registration is closed for this event.')
  if (registrations.some(r => r.studentId === student.id && r.eventId === eventId && r.status === 'confirmed'))
    throw new Error('You are already registered for this event.')
  if (event.seatsAvailable <= 0) throw new Error('This event is full.')
  registrations.push({ id: crypto.randomUUID(), eventId, studentId: student.id, status: 'confirmed', registeredAt: new Date().toISOString() })
  event.seatsAvailable--
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
  event.seatsAvailable = Math.min(event.capacity, event.seatsAvailable + 1)
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
  const booked = existing ? existing.capacity - existing.seatsAvailable : 0
  if (input.capacity < booked) throw new Error('Capacity cannot be below ' + booked + ' booked seats.')
  const values = { ...input, name: input.name.trim(), venue: input.venue.trim(), description: input.description.trim(), date: new Date(time).toISOString(), seatsAvailable: input.capacity - booked }
  if (existing) Object.assign(existing, values)
  else events.push({ ...values, id: crypto.randomUUID(), organizerId: owner.id, cancelled: false })
  changed()
}
export function removeEvent(user: AppUser | null, id: string, permanently = false) {
  const event = ownedEvent(user, id)
  registrations.forEach(r => { if (r.eventId === id) r.status = 'cancelled' })
  event.cancelled = true
  event.seatsAvailable = event.capacity
  if (permanently) {
    events.splice(events.indexOf(event), 1)
    for (let i = registrations.length - 1; i >= 0; i--) if (registrations[i].eventId === id) registrations.splice(i, 1)
  }
  changed()
}
