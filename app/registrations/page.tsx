'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { useStore } from '@/components/useStore'
import { getRegistrationsForStudent } from '@/data/registrations'
import { getEventById, isPastEvent } from '@/data/events'
import { cancelRegistration } from '@/data/store'
import EmptyState from '@/components/EmptyState'

export default function RegistrationsPage() {
  useStore()
  const { currentUser } = useAuth()
  const [message, setMessage] = useState('')
  if (currentUser?.role !== 'student') return <section className="shell section-pad"><EmptyState title="Student account required" description="Choose a student account from the top menu to see your registrations." /></section>
  const mine = getRegistrationsForStudent(currentUser.id).filter(r => {
    const event = getEventById(r.eventId)
    return r.status === 'confirmed' && event && !event.cancelled
  }).sort((a, b) => new Date(getEventById(a.eventId)!.date).getTime() - new Date(getEventById(b.eventId)!.date).getTime())
  return <section className="shell section-pad">
    <span className="eyebrow-tag">{currentUser.name}</span>
    <h1>My registrations</h1>
    <p role="status">{message}</p>
    {!mine.length && <EmptyState title="No registrations yet" description="Find an upcoming event and reserve your seat." action={<Link href="/events" className="btn btn-primary">Browse events</Link>} />}
    {[false, true].map(past => {
      const group = mine.filter(r => isPastEvent(getEventById(r.eventId)!) === past)
      if (!group.length) return null
      return <section key={String(past)} style={{ marginTop: 28 }}>
        <h2>{past ? 'Past events' : 'Upcoming events'}</h2>
        <ul className="stack">{group.map(reg => {
          const event = getEventById(reg.eventId)!
          return <li className="card-surface manage-row" key={reg.id}>
            <div><Link href={'/events/' + event.id}><strong>{event.name}</strong></Link>
              <p>{new Date(event.date).toLocaleString('en-IN')} · {event.venue}</p>
              <span>{past ? 'Past · Confirmed' : 'Confirmed'}</span>
            </div>
            {!past && <button className="btn btn-secondary" onClick={() => {
              try { cancelRegistration(currentUser, reg.id); setMessage('Registration cancelled. Your seat is available again.') }
              catch(error) { setMessage((error as Error).message) }
            }}>Cancel registration</button>}
          </li>
        })}</ul>
      </section>
    })}
  </section>
}
