'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { useStore } from '@/components/useStore'
import { events, CampusEvent, isPastEvent } from '@/data/events'
import { categories, EventInput, saveEvent, removeEvent, confirmedCount, getEventParticipants } from '@/data/store'
import EmptyState from '@/components/EmptyState'
import StatusBadge from '@/components/StatusBadge'

function localDate(iso: string) {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function EventForm({ event, onClose }: { event?: CampusEvent, onClose: () => void }) {
  const { currentUser } = useAuth()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [values, setValues] = useState<EventInput>(event ? { ...event, date: localDate(event.date) } : {
    name: '', venue: '', date: '', description: '', category: 'Tech', capacity: 30,
  })
  return <form className="card-surface event-form" onSubmit={e => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try { saveEvent(currentUser, values, event?.id); onClose() }
    catch(error) { setMessage((error as Error).message); setBusy(false) }
  }}>
    <h2>{event ? 'Edit event' : 'Create event'}</h2>
    <label>Event name<input required maxLength={160} value={values.name} onChange={e => setValues({ ...values, name: e.target.value })} /></label>
    <label>Description<textarea rows={3} value={values.description} onChange={e => setValues({ ...values, description: e.target.value })} /></label>
    <label>Date and time (your local time)<input required type="datetime-local" value={values.date} onChange={e => setValues({ ...values, date: e.target.value })} /></label>
    <label>Venue<input required maxLength={160} value={values.venue} onChange={e => setValues({ ...values, venue: e.target.value })} /></label>
    <label>Category<select value={values.category} onChange={e => setValues({ ...values, category: e.target.value as EventInput['category'] })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
    <label>Capacity<input required type="number" min={1} step={1} value={values.capacity} onChange={e => setValues({ ...values, capacity: Number(e.target.value) })} /></label>
    <p role="alert">{message}</p>
    <div className="actions"><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save event'}</button><button className="btn btn-secondary" type="button" onClick={onClose}>Close</button></div>
  </form>
}

function ParticipantHistory({ eventId }: { eventId: string }) {
  const { currentUser } = useAuth()
  const [open, setOpen] = useState(false)
  if (!open) return <button className="btn btn-secondary" onClick={() => setOpen(true)}>View participants</button>
  let participants: ReturnType<typeof getEventParticipants> = []
  let error = ''
  try { participants = getEventParticipants(currentUser, eventId) }
  catch (e) { error = (e as Error).message }
  return <div>
    <button className="btn btn-secondary" onClick={() => setOpen(false)}>Hide participants</button>
    {error ? <p role="alert">{error}</p> : participants.length === 0 ? <p>No registrations were recorded for this event.</p> : (
      <ul className="participant-list">
        {participants.map((p, i) => (
          <li key={i} className={p.status === 'cancelled' ? 'cancelled' : ''}>
            {p.name} — {p.status === 'cancelled' ? 'cancelled' : 'registered'} · {new Date(p.registeredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </li>
        ))}
      </ul>
    )}
  </div>
}

export default function OrganizerPage() {
  useStore()
  const { currentUser } = useAuth()
  const [editing, setEditing] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState<'active' | 'history'>('active')
  if (currentUser?.role !== 'organizer') return <section className="shell section-pad"><EmptyState title="Organizer account required" description="Choose an organizer account to manage its events." /></section>
  const mine = events.filter(e => e.organizerId === currentUser.id).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const active = mine.filter(e => !e.cancelled && !isPastEvent(e))
  const history = mine.filter(e => e.cancelled || isPastEvent(e))
  const selected = mine.find(e => e.id === editing)
  const shown = tab === 'active' ? active : history
  return <section className="shell section-pad">
    <span className="eyebrow-tag">{currentUser.name}</span>
    <div className="manage-row"><h1>Your events</h1><button className="btn btn-primary" onClick={() => setEditing('new')}>New event</button></div>
    <p role="status">{message}</p>
    {editing && (editing === 'new' || selected) && <EventForm key={currentUser.id + editing} event={selected} onClose={() => setEditing(null)} />}
    <div className="cc-tabs" role="tablist" aria-label="Event groups">
      <button role="tab" aria-selected={tab === 'active'} className="cc-tab" onClick={() => setTab('active')}>Active ({active.length})</button>
      <button role="tab" aria-selected={tab === 'history'} className="cc-tab" onClick={() => setTab('history')}>Cancelled &amp; past ({history.length})</button>
    </div>
    {!shown.length && <EmptyState title={tab === 'active' ? 'No active events' : 'No cancelled or past events'} description={tab === 'active' ? 'Create your first campus event.' : 'Events you cancel or that finish will appear here with their registration history.'} />}
    <ul className="stack">{shown.map(event => {
      const booked = confirmedCount(event.id)
      const status = event.cancelled ? 'cancelled' as const : isPastEvent(event) ? 'past' as const : 'open' as const
      return <li key={event.id} className="card-surface manage-row">
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href={'/events/' + event.id}><strong>{event.name}</strong></Link>
            <StatusBadge status={status} />
          </div>
          <p>{new Date(event.date).toLocaleString('en-IN')} · {event.venue}</p>
          <p>{event.cancelled ? 'Cancelled' : `${booked} / ${event.capacity} seats taken`}</p>
          {tab === 'history' && <ParticipantHistory eventId={event.id} />}
        </div>
        <div className="actions">
          <button className="btn btn-secondary" disabled={event.cancelled || isPastEvent(event)} onClick={() => setEditing(event.id)}>Edit</button>
          {[false, true].map(permanent => <button className="btn btn-secondary" key={String(permanent)} disabled={!permanent && event.cancelled} onClick={() => {
            if (!window.confirm((permanent ? 'Delete' : 'Cancel') + ' this event and its registrations?')) return
            try { removeEvent(currentUser, event.id, permanent); setEditing(null); setMessage(permanent ? 'Event deleted.' : 'Event cancelled.') }
            catch(error) { setMessage((error as Error).message) }
          }}>{permanent ? 'Delete' : 'Cancel event'}</button>)}
        </div>
      </li>
    })}</ul>
  </section>
}
