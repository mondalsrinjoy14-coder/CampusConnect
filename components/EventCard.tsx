import Link from 'next/link'
import { CampusEvent, isPastEvent, isFullEvent } from '@/data/events'
import StatusBadge from './StatusBadge'
const symbols: Record<string,string> = {Tech:'⌘', Cultural:'✳', Sports:'↗', Workshop:'✎', Career:'◇', Music:'♫'}
export default function EventCard({ event }: { event: CampusEvent }) {
  const status = event.cancelled ? 'cancelled' : isPastEvent(event) ? 'past' : isFullEvent(event) ? 'full' : 'open'
  const booked = Math.max(0,Math.min(100,(1-event.seatsAvailable/event.capacity)*100))
  return <Link href={'/events/'+event.id} className={'event-card theme-'+event.category.toLowerCase()}>
    <div className="event-poster" aria-hidden="true"><span className="poster-symbol">{symbols[event.category]}</span><span className="poster-type">{event.category.toUpperCase()}<br />ON CAMPUS</span><span className="date-chip"><small>{new Date(event.date).toLocaleDateString('en-IN',{month:'short'})}</small><b>{new Date(event.date).getDate()}</b></span></div>
    <div className="event-card__main"><div className="card-topline"><span className="event-card__category">{event.category}</span><StatusBadge status={status}/></div><h3 className="event-card__name">{event.name}</h3><p className="event-description">{event.description}</p><div className="event-card__meta"><span>{new Date(event.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · {new Date(event.date).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span><span>{event.venue}</span></div><div className="seat-track" aria-hidden="true"><span style={{width:booked+'%'}} /></div><div className="card-bottom"><span>{event.seatsAvailable} seats left <small>/ {event.capacity}</small></span><strong>Details ↗</strong></div></div>
  </Link>
}
