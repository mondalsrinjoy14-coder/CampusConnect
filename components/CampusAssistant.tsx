'use client'
import { FormEvent, useState } from 'react'
import Link from 'next/link'

function answer(question: string) {
  const q=question.toLowerCase()
  if(/register|join|book|seat/.test(q))return <>Open an event card and choose <strong>Confirm registration</strong>. You can find or cancel it under <Link href="/registrations">My Registrations</Link>.</>
  if(/create|host|post|organ/.test(q))return <>Choose <Link href="/organizer">Organizer</Link>, then <strong>New event</strong>. Add a future date, venue, category, and capacity.</>
  if(/search|find|filter|category|event/.test(q))return <>Open <Link href="/events">All events</Link> to search by name, filter by category, and sort upcoming events.</>
  if(/club|community/.test(q))return <>Try the category shortcuts above, or browse <Link href="/events">all campus events</Link> to find a group or activity you like.</>
  return <>I can help with finding events, registration, cancelling a booking, or creating an event. What are you trying to do?</>
}
export default function CampusAssistant(){
 const [open,setOpen]=useState(false),[question,setQuestion]=useState(''),[asked,setAsked]=useState('')
 function submit(e:FormEvent){e.preventDefault();if(question.trim()){setAsked(question.trim());setQuestion('')}}
 return <div className="cc-assistant"><span className="cc-assistant-label">Campus AI</span>{open&&<section className="cc-chat" aria-label="Campus AI helper"><div className="cc-chat-head"><span><b>Campus AI</b><small>YOUR CAMPUS GUIDE</small></span><button aria-label="Close Campus AI" onClick={()=>setOpen(false)}>×</button></div><div className="cc-chat-messages"><p className="cc-chat-bubble">Hey! I can help you find events, register, or create one. What do you need?</p>{asked&&<><p className="cc-chat-user">{asked}</p><p className="cc-chat-bubble">{answer(asked)}</p></>}</div><form onSubmit={submit}><input aria-label="Ask Campus AI" placeholder="Ask about campus events…" value={question} onChange={e=>setQuestion(e.target.value)}/><button aria-label="Send question" disabled={!question.trim()}>↑</button></form><small className="cc-chat-note">Demo assistant · answers from the project guide</small></section>}<button className="cc-assistant-button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label={open?'Close Campus AI':'Open Campus AI'}><span>{open?'×':'✳'}</span></button></div>
}
