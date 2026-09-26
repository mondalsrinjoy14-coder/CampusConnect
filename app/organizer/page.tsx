'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { useStore } from '@/components/useStore'
import { events, CampusEvent } from '@/data/events'
import { categories, EventInput, saveEvent, removeEvent } from '@/data/store'
import EmptyState from '@/components/EmptyState'

function localDate(iso: string) {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function EventForm({ event, onClose }: { event?: CampusEvent, onClose: () => void }) {
  const { currentUser } = useAuth()
  const [message, setMessage] = useState('')
  const [values, setValues] = useState<EventInput>(event ? { ...event, date: localDate(event.date) } : {
    name: '', venue: '', date: '', description: '', category: 'Tech', capacity: 30,
  })
  return <form className="card-surface event-form" onSubmit={e => {
    e.preventDefault()
    try { saveEvent(currentUser, values, event?.id); onClose() }
    catch(error) { setMessage((error as Error).message) }
  }}>
    <h2>{event ? 'Edit event' : 'Create event'}</h2>
    <label>Event name<input required maxLength={160} value={values.name} onChange={e => setValues({ ...values, name: e.target.value })} /></label>
    <label>Description<textarea rows={3} value={values.description} onChange={e => setValues({ ...values, description: e.target.value })} /></label>
    <label>Date and time (your local time)<input required type="datetime-local" value={values.date} onChange={e => setValues({ ...values, date: e.target.value })} /></label>
    <label>Venue<input required maxLength={160} value={values.venue} onChange={e => setValues({ ...values, venue: e.target.value })} /></label>
    <label>Category<select value={values.category} onChange={e => setValues({ ...values, category: e.target.value as EventInput['category'] })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
    <label>Capacity<input required type="number" min={1} step={1} value={values.capacity} onChange={e => setValues({ ...values, capacity: Number(e.target.value) })} /></label>
    <p role="alert">{message}</p>
    <div className="actions"><button className="btn btn-primary" type="submit">Save event</button><button className="btn btn-secondary" type="button" onClick={onClose}>Close</button></div>
  </form>
}
export default function OrganizerPage() {
  useStore()
  const { currentUser } = useAuth()
  const [editing, setEditing] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  if (currentUser?.role !== 'organizer') return <section className="shell section-pad"><EmptyState title="Organizer account required" description="Choose an organizer account to manage its events." /></section>
  const mine = events.filter(e => e.organizerId === currentUser.id).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const selected = mine.find(e => e.id === editing)
  return <section className="shell section-pad">
    <span className="eyebrow-tag">{currentUser.name}</span>
    <div className="manage-row"><h1>Your events</h1><button className="btn btn-primary" onClick={() => setEditing('new')}>New event</button></div>
    <p role="status">{message}</p>
    {editing && (editing === 'new' || selected) && <EventForm key={currentUser.id + editing} event={selected} onClose={() => setEditing(null)} />}
    {!mine.length && <EmptyState title="No events yet" description="Create your first campus event." />}
    <ul className="stack">{mine.map(event => <li key={event.id} className="card-surface manage-row">
      <div><Link href={'/events/' + event.id}><strong>{event.name}</strong></Link>
        <p>{new Date(event.date).toLocaleString('en-IN')} · {event.venue}</p>
        <p>{event.cancelled ? 'Cancelled' : event.seatsAvailable + ' / ' + event.capacity + ' seats available'}</p>
      </div>
      <div className="actions">
        <button className="btn btn-secondary" disabled={event.cancelled} onClick={() => setEditing(event.id)}>Edit</button>
        {[false, true].map(permanent => <button className="btn btn-secondary" key={String(permanent)} disabled={!permanent && event.cancelled} onClick={() => {
          if (!window.confirm((permanent ? 'Delete' : 'Cancel') + ' this event and its registrations?')) return
          try { removeEvent(currentUser, event.id, permanent); setEditing(null); setMessage(permanent ? 'Event deleted.' : 'Event cancelled.') }
          catch(error) { setMessage((error as Error).message) }
        }}>{permanent ? 'Delete' : 'Cancel event'}</button>)}
      </div>
    </li>)}</ul>
  </section>
}
