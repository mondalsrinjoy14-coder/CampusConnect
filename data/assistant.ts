import { CampusEvent, isPastEvent } from './events'
import { registrations, getActiveRegistration } from './registrations'
import { AppUser, getUserById } from './auth'
import { availableSeats, eventsVisibleTo } from './store'

export interface AssistantLink {
  label: string
  href: string
}
export interface AssistantAnswer {
  text: string
  links: AssistantLink[]
}

/**
 * Structured source describing what the website can do. When a new
 * feature ships, add it here and the assistant picks it up automatically —
 * no prompt rewriting needed.
 */
const FEATURES: { name: string; blurb: string }[] = [
  { name: 'Event board', blurb: 'Browse every upcoming event, search by name, filter by category, and sort by date, free seats, or popularity.' },
  { name: 'Event details', blurb: 'Open any event to see its date, time, venue, category, organizer, and live seat availability.' },
  { name: 'Registration', blurb: 'Students can reserve a seat with one tap; the seat count updates immediately and double bookings are blocked.' },
  { name: 'My Registrations', blurb: 'Students see their upcoming and past bookings in one place and can cancel an upcoming booking to free the seat.' },
  { name: 'Organizer dashboard', blurb: 'Organizers create, edit, cancel, or delete their own events, and review active plus cancelled/past events with participant history.' },
  { name: 'Campus AI', blurb: 'This assistant — ask it about events, seats, your registrations, and what is new on the board.' },
]

const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'on', 'at', 'in', 'for', 'and', 'event', 'events'])

interface EventFact {
  event: CampusEvent
  status: 'open' | 'full' | 'past' | 'cancelled'
  seats: number
  booked: number
}

function norm(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function tokens(text: string): string[] {
  return norm(text).split(' ').filter(t => t && !STOPWORDS.has(t))
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  )
}

function statusOf(event: CampusEvent): EventFact['status'] {
  if (event.cancelled) return 'cancelled'
  if (isPastEvent(event)) return 'past'
  if (availableSeats(event) <= 0) return 'full'
  return 'open'
}

function buildFacts(user: AppUser | null): EventFact[] {
  return eventsVisibleTo(user)
    .map(event => ({
      event,
      status: statusOf(event),
      seats: availableSeats(event),
      booked: Math.max(0, event.capacity - availableSeats(event)),
    }))
    .sort((a, b) => +new Date(a.event.date) - +new Date(b.event.date))
}

/** Find visible events mentioned in the question; returns matches or null. */
function matchEvents(facts: EventFact[], question: string): EventFact[] {
  const q = norm(question)
  const scored: { fact: EventFact; score: number; exact: boolean }[] = []
  for (const fact of facts) {
    const name = norm(fact.event.name)
    if (!name) continue
    if (q.includes(name)) {
      scored.push({ fact, score: 2, exact: true })
      continue
    }
    const nameTokens = tokens(fact.event.name)
    if (!nameTokens.length) continue
    const hits = nameTokens.filter(t => q.split(' ').includes(t)).length
    const score = hits / nameTokens.length
    if (hits > 0 && score >= 0.5) scored.push({ fact, score, exact: false })
  }
  scored.sort((a, b) => b.score - a.score || (b.exact ? 1 : 0) - (a.exact ? 1 : 0))
  if (!scored.length) return []
  const top = scored[0].score
  return scored.filter(s => s.score === top).map(s => s.fact)
}

function eventSummary(f: EventFact): string {
  const e = f.event
  const statusLine =
    f.status === 'open'
      ? `${f.seats} of ${e.capacity} seats available`
      : f.status === 'full'
        ? `Full (${e.capacity} seats taken)`
        : f.status === 'past'
          ? 'Already happened'
          : 'Cancelled'
  return `${e.name}\n${formatWhen(e.date)} · ${e.venue}\n${e.category} · organized by ${organizerName(e)} · ${statusLine}`
}

function organizerName(event: CampusEvent): string {
  // Organizer names are public on the board; student rosters are not.
  return getUserById(event.organizerId)?.name ?? 'Campus organizer'
}

function myUpcomingRegistrations(user: AppUser, facts: EventFact[]): EventFact[] {
  const byId = new Map(facts.map(f => [f.event.id, f]))
  return registrations
    .filter(r => r.studentId === user.id && r.status === 'confirmed' && byId.has(r.eventId))
    .map(r => byId.get(r.eventId)!)
    .sort((a, b) => +new Date(a.event.date) - +new Date(b.event.date))
}

function helpText(user: AppUser | null): string {
  const base =
    'I can help you with:\n' +
    '• Finding events — try "any tech events this month?"\n' +
    '• Event details — "when is Hack the Campus 2026?"\n' +
    '• Seat availability — "how many seats left for Acoustic Nights?"\n' +
    '• Your bookings — "am I registered for the hackathon?"\n' +
    "• What's new — \"any new events?\"\n" +
    '• How the site works — "how do I cancel a registration?"'
  return user?.role === 'organizer'
    ? base + '\n• Your events — "show my cancelled events" or "who is registered for my workshop?"'
    : base
}

/**
 * Answer a question using the application's live data.
 *
 * Visibility rules are identical to the website's: students and guests only
 * ever see student-facing events, organizers see their own events including
 * cancelled/past ones, and no private student information is ever exposed.
 * Nothing is hard-coded — every fact below is read from the current store,
 * so new or updated events are answered correctly without any prompt edits.
 */
export function askAssistant(user: AppUser | null, rawQuestion: string): AssistantAnswer {
  const question = rawQuestion.trim()
  if (!question) return { text: helpText(user), links: [] }
  try {
    return answerFromLiveData(user, question)
  } catch {
    return {
      text: 'I am having trouble reaching the event data right now. Please try again in a moment.',
      links: [],
    }
  }
}

function answerFromLiveData(user: AppUser | null, question: string): AssistantAnswer {
  const q = question.toLowerCase()
  const facts = buildFacts(user)
  const upcoming = facts.filter(f => f.status === 'open' || f.status === 'full')

  const link = (f: EventFact): AssistantLink => ({ label: f.event.name, href: '/events/' + f.event.id })

  // Greetings / help.
  if (/^(hi|hii+|hello|hey|namaste)\b/.test(q) || /what can you do|help me|how does this (site|website|app) work/.test(q)) {
    return { text: `Hey${user ? ' ' + user.name.split(' ')[0] : ''}! ${helpText(user)}`, links: [] }
  }

  // Feature questions — answered from the structured FEATURES source.
  if (/feature|what.{0,12}(can|does) (this|the) (site|website|app)/.test(q)) {
    return {
      text: 'Here is what you can do on Campus Connect:\n' + FEATURES.map(f => `• ${f.name} — ${f.blurb}`).join('\n'),
      links: [],
    }
  }

  // Named-event questions are the most specific — resolve them first.
  const matches = matchEvents(facts, question)

  // Cancelled events — organizer-only knowledge.
  if (/cancelled|canceled/.test(q) && matches.length === 0) {
    const mine = facts.filter(f => f.status === 'cancelled')
    if (user?.role !== 'organizer') {
      return {
        text: 'Cancelled events are not shown on the student board, so I cannot list them here. Your own bookings live under My Registrations.',
        links: [{ label: 'My Registrations', href: '/registrations' }],
      }
    }
    if (!mine.length) return { text: 'You have no cancelled events. Everything you posted is still active or upcoming.', links: [] }
    const lines = mine.map(f => {
      const regs = registrations.filter(r => r.eventId === f.event.id)
      const active = regs.filter(r => r.status === 'confirmed').length
      return `• ${f.event.name} — ${formatWhen(f.event.date)} (${regs.length} registration record${regs.length === 1 ? '' : 's'}, ${active} were active)`
    })
    return { text: 'Your cancelled events:\n' + lines.join('\n'), links: mine.map(link) }
  }

  // Named-event questions.
  if (matches.length === 1) {
    const f = matches[0]
    const links = [link(f)]
    if (/cancelled|canceled/.test(q)) {
      return {
        text: f.status === 'cancelled'
          ? `Yes — ${f.event.name} has been cancelled.`
          : `No — ${f.event.name} is still ${f.status === 'full' ? 'open but full' : f.status} (${formatWhen(f.event.date)}).`,
        links,
      }
    }
    if (/seat|full|available|spot|place/.test(q)) {
      const text =
        f.status === 'open'
          ? `${f.event.name} has ${f.seats} of ${f.event.capacity} seats still available.`
          : f.status === 'full'
            ? `${f.event.name} is full right now — all ${f.event.capacity} seats are taken.`
            : f.status === 'past'
              ? `${f.event.name} already happened, so registration is closed.`
              : `${f.event.name} has been cancelled, so registration is closed.`
      return { text: text + '\n' + eventSummary(f), links }
    }
    if (/who.*(register|join|attend|coming)|participant|attendee/.test(q)) {
      if (user?.role === 'organizer' && f.event.organizerId === user.id) {
        const regs = registrations.filter(r => r.eventId === f.event.id && r.status === 'confirmed')
        return {
          text: `${f.event.name} has ${regs.length} active registration${regs.length === 1 ? '' : 's'} out of ${f.event.capacity} seats. The full roster is on your organizer dashboard.`,
          links: [{ label: 'Organizer dashboard', href: '/organizer' }],
        }
      }
      return {
        text: `I can't share who else registered — but ${f.event.name} has ${f.booked} of ${f.event.capacity} seats taken${f.status === 'open' ? `, so ${f.seats} are still open` : ''}.`,
        links,
      }
    }
    if (/am i registered|did i register|my registration|my booking|registered for/.test(q)) {
      if (!user) return { text: 'Choose an account from the top menu first, then ask me again.', links: [] }
      if (user.role !== 'student') return { text: 'Registrations are for student accounts — organizers manage events instead.', links: [] }
      const reg = getActiveRegistration(user.id, f.event.id)
      const had = registrations.some(r => r.studentId === user.id && r.eventId === f.event.id)
      return {
        text: reg
          ? `Yes — you are registered for ${f.event.name} (${formatWhen(f.event.date)}, ${f.event.venue}).`
          : had
            ? `You are not currently registered for ${f.event.name} — your earlier registration was cancelled. ${f.status === 'open' ? `${f.seats} seats are still available if you want to book again.` : ''}`
            : `You are not registered for ${f.event.name}.${f.status === 'open' ? ` It has ${f.seats} seats available.` : ''}`,
        links,
      }
    }
    if (/when|date|time|schedule/.test(q)) {
      return { text: `${f.event.name} is on ${formatWhen(f.event.date)}.`, links }
    }
    if (/where|venue|location|place/.test(q)) {
      return { text: `${f.event.name} is at ${f.event.venue}.`, links }
    }
    if (/who.*(organiz|host|run)|organiz.{0,3} by/.test(q)) {
      return { text: `${f.event.name} is organized by ${organizerName(f.event)}.`, links }
    }
    return { text: eventSummary(f), links }
  }
  if (matches.length > 1) {
    return {
      text: 'I found a few events matching that — which one did you mean?\n' + matches.slice(0, 5).map(f => `• ${f.event.name} (${formatWhen(f.event.date)})`).join('\n'),
      links: matches.slice(0, 5).map(link),
    }
  }

  // How to cancel — before the generic "my registration" branch, since
  // "how do I cancel my registration?" mentions registrations too.
  if (/how.*cancel/.test(q)) {
    return {
      text: 'To cancel: open My Registrations and choose "Cancel registration" next to the event. Your seat becomes available again immediately.',
      links: [{ label: 'My Registrations', href: '/registrations' }],
    }
  }

  // "Am I registered" without a name → list their bookings.
  if (/am i registered|my registration|my booking|my events|events.*registered/.test(q)) {
    if (!user) return { text: 'Choose an account from the top menu first, then ask me about your registrations.', links: [] }
    if (user.role !== 'student') return { text: 'Only student accounts have registrations. Organizers can review their events on the dashboard.', links: [{ label: 'Organizer dashboard', href: '/organizer' }] }
    const mine = myUpcomingRegistrations(user, facts)
    if (!mine.length) {
      return {
        text: 'You have no upcoming registrations right now. Want to browse the board?',
        links: [{ label: 'Browse events', href: '/events' }],
      }
    }
    return {
      text: 'Your upcoming registrations:\n' + mine.map(f => `• ${f.event.name} — ${formatWhen(f.event.date)}, ${f.event.venue}`).join('\n'),
      links: mine.map(link),
    }
  }

  // What's new / recently added / updated.
  if (/recently added|just added|latest|what('| i)s new|any new|\bnew\b.{0,25}events?|events?.{0,25}\bnew\b/.test(q)) {
    const recent = facts.filter(f => Date.now() - new Date(f.event.createdAt).getTime() <= RECENT_WINDOW_MS && f.status !== 'cancelled')
    if (!recent.length) return { text: 'Nothing was added in the last two weeks. Here is what is coming up:', links: [{ label: 'All events', href: '/events' }] }
    return {
      text: 'Recently added:\n' + recent.map(f => `• ${f.event.name} — ${formatWhen(f.event.date)} (${f.seats} seats left)`).join('\n'),
      links: recent.map(link),
    }
  }
  if (/recently updated|just updated|was updated|changed/.test(q)) {
    const updated = facts.filter(f => {
      const age = Date.now() - new Date(f.event.updatedAt).getTime()
      const gap = new Date(f.event.updatedAt).getTime() - new Date(f.event.createdAt).getTime()
      return age <= RECENT_WINDOW_MS && gap > 60_000 && f.status !== 'cancelled'
    })
    if (!updated.length) return { text: 'No event details were changed in the last two weeks.', links: [] }
    return {
      text: 'Recently updated:\n' + updated.map(f => `• ${f.event.name} — ${formatWhen(f.event.date)}, ${f.event.venue}`).join('\n'),
      links: updated.map(link),
    }
  }

  // Upcoming / listing questions.
  if (/upcoming|what('| i)s (on|happening)|list.*event|show.*event|all event|this week|weekend|today|tomorrow/.test(q)) {
    if (!upcoming.length) return { text: 'There is nothing upcoming on the board right now. Check back soon!', links: [] }
    const top = upcoming.slice(0, 5)
    return {
      text: 'Here is what is coming up:\n' + top.map(f => `• ${f.event.name} — ${formatWhen(f.event.date)} (${f.status === 'full' ? 'full' : f.seats + ' seats left'})`).join('\n'),
      links: top.map(link),
    }
  }

  // Category browsing.
  if (/categor|types of event|what kind/.test(q)) {
    const counts = new Map<string, number>()
    upcoming.forEach(f => counts.set(f.event.category, (counts.get(f.event.category) ?? 0) + 1))
    const line = [...counts.entries()].map(([c, n]) => `${c} (${n})`).join(', ') || 'none right now'
    return { text: `Events come in these categories: Tech, Cultural, Sports, Workshop, Career, Music.\nUpcoming right now: ${line}.`, links: [{ label: 'Browse events', href: '/events' }] }
  }

  // How to register.
  if (/how.*(register|join|book|sign up|signup)/.test(q)) {
    return {
      text: 'To register: open any event, then choose "Confirm registration". It appears under My Registrations, and the seat count updates right away. You need a student account, and each student gets one seat per event.',
      links: [{ label: 'Browse events', href: '/events' }],
    }
  }

  // How to create / host.
  if (/how.*(create|host|post|organize|organise|add.*event)/.test(q)) {
    return {
      text: user?.role === 'organizer'
        ? 'As an organizer, open your dashboard and choose "New event". Give it a future date, venue, category, and capacity — it appears on the board instantly.'
        : 'Events are posted by organizers. Switch to an organizer account from the top menu, then use the Organizer dashboard to create one.',
      links: [{ label: 'Organizer dashboard', href: '/organizer' }],
    }
  }

  // Unknown event name guess: the question mentions something event-like we cannot find.
  return {
    text: `I couldn't find an event matching "${question.length > 60 ? question.slice(0, 60) + '…' : question}" on the board right now. It may be past, cancelled, or under a different name — try the search on the events page.`,
    links: [{ label: 'Search events', href: '/events' }],
  }
}
