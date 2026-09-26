import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { events } from '@/data/events'
import { registrations } from '@/data/registrations'
import { users } from '@/data/auth'
import { registerForEvent, saveEvent, removeEvent } from '@/data/store'
import { askAssistant } from '@/data/assistant'

const seedEvents = structuredClone(events)
const seedRegistrations = structuredClone(registrations)
const student = users[0], organizer = users[1]

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-26T00:00:00Z'))
  events.splice(0, events.length, ...structuredClone(seedEvents))
  registrations.splice(0, registrations.length, ...structuredClone(seedRegistrations))
})
afterEach(() => { vi.useRealTimers() })

describe('campus AI assistant', () => {
  it('answers about an existing event with live details', () => {
    const a = askAssistant(student, 'When is Hack the Campus 2026?')
    expect(a.text).toContain('Hack the Campus 2026')
    expect(a.text).toMatch(/Oct/)
    expect(a.links[0].href).toBe('/events/evt-01')

    const b = askAssistant(student, 'Where is the Diwali Mela?')
    expect(b.text).toContain('Central Quad')
  })

  it('reports current seat availability from live registrations', () => {
    const before = askAssistant(student, 'How many seats are left for Intro to Figma Workshop?')
    expect(before.text).toContain('29 of 30 seats still available')
    registerForEvent(student, 'evt-05')
    const after = askAssistant(student, 'how many seats left for intro to figma workshop')
    expect(after.text).toContain('28 of 30 seats still available')
  })

  it('knows about a newly added event without any prompt edits', () => {
    saveEvent(organizer, {
      name: 'Quantum Computing 101', venue: 'Seminar Hall 2', date: '2026-12-05T15:00:00Z',
      description: 'A friendly intro.', category: 'Tech', capacity: 50,
    })
    const a = askAssistant(student, 'What events are new?')
    expect(a.text).toContain('Quantum Computing 101')
    const b = askAssistant(student, 'tell me about Quantum Computing 101')
    expect(b.text).toContain('Seminar Hall 2')
  })

  it('reflects updated event details', () => {
    const e = events.find(x => x.id === 'evt-01')!
    saveEvent(organizer, { ...e, venue: 'New Innovation Wing, Block C' }, e.id)
    const a = askAssistant(student, 'Where is Hack the Campus 2026?')
    expect(a.text).toContain('New Innovation Wing, Block C')
  })

  it('answers registration questions for the asking student only', () => {
    registerForEvent(student, 'evt-05')
    const yes = askAssistant(student, 'Am I registered for the Figma workshop?')
    expect(yes.text).toMatch(/Yes/i)
    const no = askAssistant(student, 'am i registered for diwali mela?')
    expect(no.text).toMatch(/You are not registered/)
    const list = askAssistant(student, 'am I registered for anything?')
    expect(list.text).toContain('Intro to Figma Workshop')
  })

  it('hides cancelled events from students but shows them to the owning organizer', () => {
    removeEvent(organizer, 'evt-01')
    const studentView = askAssistant(student, 'Tell me about Hack the Campus 2026')
    expect(studentView.text).toMatch(/couldn't find/i)
    expect(studentView.text).not.toContain('Innovation Lab')
    const ownerView = askAssistant(organizer, 'Show my cancelled events')
    expect(ownerView.text).toContain('Hack the Campus 2026')
    const guestView = askAssistant(null, 'is the hackathon cancelled?')
    expect(guestView.text).toMatch(/not shown on the student board/i)
  })

  it('says clearly when it cannot find something and never invents events', () => {
    const a = askAssistant(student, 'When is the Underwater Basket Weaving Championship?')
    expect(a.text).toMatch(/couldn't find/i)
    expect(a.text).not.toMatch(/2027|January|February/)
  })

  it('never exposes other students\u2019 private registration data', () => {
    registerForEvent(student, 'evt-05')
    const a = askAssistant(users[2], 'Who is registered for the Figma workshop?')
    expect(a.text).not.toContain('Aditi')
    expect(a.text).not.toContain('Rao')
    // Organizers get aggregate counts for their own events, not names.
    const b = askAssistant(organizer, 'Who is registered for Hack the Campus 2026?')
    expect(b.text).toMatch(/3 active registrations/)
    expect(b.text).not.toContain('Aditi')
    expect(b.text).not.toContain('Priya')
  })

  it('explains how registration and cancellation work', () => {
    const a = askAssistant(student, 'How do I register for an event?')
    expect(a.text).toMatch(/Confirm registration/)
    const b = askAssistant(student, 'how do i cancel my registration?')
    expect(b.text).toMatch(/My Registrations/)
  })
})
