// Seed data for registrations, so the "My Registrations" and Organizer
// pages have something real to display before participants build the
// actual registration flow (Task 2 and Task 3).

export type RegistrationStatus = 'confirmed' | 'cancelled'

export interface Registration {
  id: string
  eventId: string
  studentId: string
  status: RegistrationStatus
  registeredAt: string // ISO date string
}

// NOTE FOR PARTICIPANTS: this array is the "database" of registrations.
// Task 2 (Registration) means pushing new items into this array when a
// student registers. Task 3 (Cancellation) means updating an item's
// status here. Keep using this same array — don't create a second store.
export const registrations: Registration[] = [
  {
    id: 'reg-01',
    eventId: 'evt-01',
    studentId: 'stu-1',
    status: 'confirmed',
    registeredAt: '2026-09-10T10:15:00',
  },
  {
    id: 'reg-02',
    eventId: 'evt-04',
    studentId: 'stu-1',
    status: 'confirmed',
    registeredAt: '2026-08-20T09:00:00',
  },
  {
    id: 'reg-03',
    eventId: 'evt-09',
    studentId: 'stu-1',
    status: 'confirmed',
    registeredAt: '2026-09-12T18:40:00',
  },
  {
    id: 'reg-04',
    eventId: 'evt-01',
    studentId: 'stu-2',
    status: 'confirmed',
    registeredAt: '2026-09-11T09:20:00',
  },
  {
    id: 'reg-05',
    eventId: 'evt-01',
    studentId: 'stu-3',
    status: 'confirmed',
    registeredAt: '2026-09-13T14:05:00',
  },
  {
    id: 'reg-06',
    eventId: 'evt-05',
    studentId: 'stu-2',
    status: 'confirmed',
    registeredAt: '2026-09-15T11:45:00',
  },
]

/** Simple lookup used by the placeholder "My Registrations" page. */
export function getRegistrationsForStudent(studentId: string): Registration[] {
  return registrations.filter((reg) => reg.studentId === studentId)
}

/**
 * All *active* (non-cancelled) registrations for an event.
 * This is the single source of truth for occupied seats: cancelled,
 * deleted, or duplicate registrations never count here.
 */
export function getActiveRegistrationsForEvent(eventId: string): Registration[] {
  return registrations.filter((reg) => reg.eventId === eventId && reg.status === 'confirmed')
}

/** The active registration of one student for one event, if any. */
export function getActiveRegistration(studentId: string, eventId: string): Registration | undefined {
  return registrations.find(
    (reg) => reg.studentId === studentId && reg.eventId === eventId && reg.status === 'confirmed'
  )
}

/** Any registration (active or cancelled) of one student for one event, newest first. */
export function getRegistrationsForStudentAndEvent(studentId: string, eventId: string): Registration[] {
  return registrations
    .filter((reg) => reg.studentId === studentId && reg.eventId === eventId)
    .sort((a, b) => +new Date(b.registeredAt) - +new Date(a.registeredAt))
}
