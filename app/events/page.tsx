'use client'

import { useState, useEffect } from 'react'
import { events, isPastEvent, searchEventsByName, filterEventsByCategory, type EventCategory } from '@/data/events'
import { useStore } from '@/components/useStore'
import EmptyState from '@/components/EmptyState'
import EventCard from '@/components/EventCard'

const CATEGORIES: (EventCategory | 'All')[] = [
  'All',
  'Tech',
  'Cultural',
  'Sports',
  'Workshop',
  'Career',
  'Music',
]

export default function EventsPage() {
  useStore()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<EventCategory | 'All'>('All')

  const [sort, setSort] = useState('date')
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const selected = params.get('category')
    if (selected && CATEGORIES.includes(selected as EventCategory)) setCategory(selected as EventCategory)
    const search = params.get('q')
    if (search) setQuery(search)
  }, [])
  const filteredEvents = filterEventsByCategory(
    searchEventsByName(events.filter(e => !e.cancelled && !isPastEvent(e)), query), category,
  ).sort((a, b) => sort === 'seats' ? b.seatsAvailable - a.seatsAvailable : sort === 'popular' ? (b.capacity-b.seatsAvailable)-(a.capacity-a.seatsAvailable) : new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <section className="shell" style={{ padding: '40px 0 64px' }}>
      <div style={{ marginBottom: 28 }}>
        <span className="eyebrow-tag">the board</span>
        <h1 style={{ fontSize: 30, marginTop: 10 }}>All events</h1>
        <p style={{ marginTop: 8 }}>
          Everything posted by clubs and departments this semester.
        </p>
      </div>

      <div
        style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}
      >
        <input
          type="search"
          aria-label="Search events by name"
          placeholder="Search events by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: '1 1 240px',
            padding: '10px 14px',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--radius)',
            fontSize: 14.5,
            background: 'var(--paper-raised)',
          }}
        />
        <select
          aria-label="Filter events by category"
          value={category}
          onChange={(e) => setCategory(e.target.value as EventCategory | 'All')}
          style={{
            padding: '10px 14px',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--radius)',
            fontSize: 14.5,
            background: 'var(--paper-raised)',
          }}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === 'All' ? 'All categories' : c}
            </option>
          ))}
        </select>
        <select className="sort-select" aria-label="Sort events" value={sort} onChange={e=>setSort(e.target.value)}><option value="date">Soonest first</option><option value="seats">Most seats available</option><option value="popular">Most popular</option></select>
      </div>

      <p role="status" style={{ marginBottom: 16 }}>
        {filteredEvents.length === 0
          ? 'No events found. Try a different name or category.'
          : `${filteredEvents.length} event${filteredEvents.length === 1 ? '' : 's'} found.`}
      </p>

      {filteredEvents.length === 0 && <EmptyState title="No matching events" description="Try a different search or category." action={<button className="btn btn-secondary" onClick={() => { setQuery(''); setCategory('All') }}>Clear filters</button>} />}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}
      >
        {filteredEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  )
}
