'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { useStore } from '@/components/useStore'
import { studentFacingEvents } from '@/data/store'
import EventCard from '@/components/EventCard'
import EmptyState from '@/components/EmptyState'
import CampusAssistant from '@/components/CampusAssistant'

const trending = ['Hackathon', 'Tech Talk', 'DJ Night', 'AI Workshop']
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const fullDate = (date: Date) => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-')

export default function HomePage() {
  useStore()
  const { currentUser } = useAuth()
  const [selectedDay, setSelectedDay] = useState('')
  const upcoming = studentFacingEvents().sort((a,b) => +new Date(a.date)- +new Date(b.date))
  const today = new Date()
  const monday = new Date(today)
  monday.setHours(0,0,0,0)
  monday.setDate(monday.getDate() - ((monday.getDay()+6)%7))
  const week = Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return d})
  const daysWithEvents = week.map(day=>({day, matches:upcoming.filter(e=>fullDate(new Date(e.date))===fullDate(day))}))
  const selectedEvents = selectedDay ? upcoming.filter(e=>fullDate(new Date(e.date))===selectedDay) : []

  return <main>
    <section className="cc-hero">
      <div className="cc-hero-glow" aria-hidden="true" />
      <div className="cc-hero-inner">
        <span className="cc-eyebrow"><span className="cc-pulse" /> CAMPUS LIFE, ALL IN ONE PLACE</span>
        <h1>Your campus,<br/><span>your world.</span></h1>
        <p>Discover what’s happening around you.<br/>Events · Workshops · Hackathons · Communities</p>
        <div className="cc-hero-actions"><Link className="cc-button cc-button-light" href="/events">Explore events <span>↗</span></Link>{currentUser?.role==='organizer'?<Link className="cc-button cc-button-outline" href="/organizer">Create event <span>＋</span></Link>:<Link className="cc-button cc-button-outline" href="/organizer">Create event <span>＋</span></Link>}</div>
        <div className="cc-scroll-cue"><span/> Find something worth showing up for</div>
      </div>
      <div className="cc-hero-orbit orbit-a" aria-hidden="true"/><div className="cc-hero-orbit orbit-b" aria-hidden="true"/>
      <div className="cc-hero-stamp" aria-hidden="true"><span>MAKE</span><b>IT<br/>HAPPEN</b><span>ON CAMPUS ↗</span></div>
      <div className="cc-hero-index">01 — DISCOVER</div>
    </section>

    <section className="shell cc-section cc-trending" id="trending">
      <div className="cc-section-heading"><div><span className="cc-overline">WHAT’S GETTING BUZZ</span><h2>Trending on campus <span className="cc-flame">✳</span></h2></div><Link href="/events" className="cc-view-all">All events <span>↗</span></Link></div>
      <div className="cc-trend-list">{trending.map((item,i)=><Link href={'/events?q='+encodeURIComponent(item)} className={'cc-trend-chip chip-'+i} key={item}><span className="cc-trend-num">0{i+1}</span><span>{item}</span><span className="cc-chip-arrow">↗</span></Link>)}</div>
    </section>

    <section className="shell cc-section" id="for-you">
      <div className="cc-section-heading"><div><span className="cc-overline">A FEW GOOD PLANS</span><h2>For you <span className="cc-sparkle">✳</span></h2></div><Link href="/events" className="cc-view-all">Explore the board <span>↗</span></Link></div>
      {upcoming.length ? <div className="cc-event-grid">{upcoming.slice(0,3).map(event=><EventCard key={event.id} event={event}/>)}</div> : <EmptyState title="Nothing scheduled just yet" description="Check back soon for new events around campus."/>}
    </section>

    <section className="shell cc-section cc-week-section">
      <div className="cc-section-heading"><div><span className="cc-overline">SAVE A SPOT IN YOUR WEEK</span><h2>Happening this week <span className="cc-calendar-icon">▦</span></h2></div><span className="cc-month-label">{monday.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</span></div>
      <div className="cc-week-grid">{daysWithEvents.map(({day,matches})=>{const date=fullDate(day);const active=selectedDay===date;return <button key={date} className={'cc-day'+(active?' active':'')+(matches.length?' has-events':'')} onClick={()=>setSelectedDay(active?'':date)} aria-pressed={active}><span>{weekday.format(day)}</span><b>{day.getDate()}</b><i aria-label={matches.length?matches.length+' events':'No events'}>{matches.length?matches.length>1?'••':'•':''}</i></button>})}</div>
      {selectedDay&&<div className="cc-day-results"><div className="cc-day-results-heading"><strong>{new Date(selectedDay+'T12:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</strong><button className="cc-clear-day" onClick={()=>setSelectedDay('')}>Clear ×</button></div>{selectedEvents.length?<div className="cc-day-event-list">{selectedEvents.map(e=><Link key={e.id} href={'/events/'+e.id}><span className="cc-day-event-time">{new Date(e.date).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span><span><strong>{e.name}</strong><small>{e.venue} · {e.category}</small></span><b>↗</b></Link>)}</div>:<p>No events on this date. Pick a day marked with a dot.</p>}</div>}
    </section>

    <section className="shell cc-community-row">
      <div className="cc-community-card"><div><span className="cc-overline">SHOW UP. LEVEL UP.</span><h2>Campus leaderboard <span>♛</span></h2><p>Sample XP rankings for this demo.</p></div><ol className="cc-leaderboard"><li><span className="cc-rank">01</span><span className="cc-medal medal-gold">✦</span><span className="cc-student">Aarav S.<small>Event explorer</small></span><b>820 <small>XP</small></b></li><li><span className="cc-rank">02</span><span className="cc-medal medal-silver">✦</span><span className="cc-student">Meera K.<small>Workshop regular</small></span><b>760 <small>XP</small></b></li><li><span className="cc-rank">03</span><span className="cc-medal medal-bronze">✦</span><span className="cc-student">Ishaan R.<small>Campus connector</small></span><b>710 <small>XP</small></b></li></ol><span className="cc-community-mark" aria-hidden="true">✳</span></div>
      <div className="cc-create-card"><span className="cc-overline">YOUR IDEA, YOUR PEOPLE</span><div className="cc-create-icon">＋</div><h2>Make something<br/>happen.</h2><p>Start a workshop, host a match, bring your campus together.</p><Link className="cc-button cc-button-green" href="/organizer">Create an event <span>↗</span></Link></div>
    </section>
    <CampusAssistant/>
  </main>
}
