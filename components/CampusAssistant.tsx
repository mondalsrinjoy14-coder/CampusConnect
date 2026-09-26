'use client'
import { FormEvent, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from './AuthProvider'
import { askAssistant, AssistantLink } from '@/data/assistant'

interface Message {
  from: 'user' | 'ai'
  text: string
  links: AssistantLink[]
}

const SUGGESTIONS = [
  'What events are new?',
  'How do I register?',
  'Am I registered for anything?',
]

export default function CampusAssistant() {
  const { currentUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  function scrollDown() {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: 'end' }))
  }

  function ask(text: string) {
    const question = text.trim()
    if (!question || busy) return
    setBusy(true)
    const next: Message[] = [...messages, { from: 'user', text: question, links: [] }]
    setMessages(next)
    setInput('')
    // Let the user's message paint before answering.
    setTimeout(() => {
      try {
        const answer = askAssistant(currentUser, question)
        setMessages([...next, { from: 'ai', text: answer.text, links: answer.links }])
      } catch {
        setMessages([...next, {
          from: 'ai',
          text: 'Something went wrong on my end. Please try again in a moment.',
          links: [],
        }])
      } finally {
        setBusy(false)
        scrollDown()
      }
    }, 60)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    ask(input)
  }

  return (
    <div className="cc-assistant">
      <span className="cc-assistant-label">Campus AI</span>
      {open && (
        <section className="cc-chat" aria-label="Campus AI helper">
          <div className="cc-chat-head">
            <span><b>Campus AI</b><small>YOUR CAMPUS GUIDE</small></span>
            <button aria-label="Close Campus AI" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="cc-chat-messages">
            <p className="cc-chat-bubble">
              Hey{currentUser ? ' ' + currentUser.name.split(' ')[0] : ''}! Ask me about events, seats, or your registrations — I read the live board.
            </p>
            {messages.map((m, i) => m.from === 'user' ? (
              <p className="cc-chat-user" key={i}>{m.text}</p>
            ) : (
              <div key={i}>
                <p className="cc-chat-bubble" style={{ whiteSpace: 'pre-wrap' }}>{m.text}</p>
                {m.links.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {m.links.map(l => (
                      <Link key={l.href + l.label} href={l.href} className="cc-chat-link">{l.label} ↗</Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && <p className="cc-chat-bubble" aria-live="polite">Thinking…</p>}
            {!messages.length && !busy && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} type="button" className="cc-chat-chip" onClick={() => ask(s)}>{s}</button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={submit}>
            <input
              aria-label="Ask Campus AI"
              placeholder="Ask about campus events…"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={busy}
            />
            <button aria-label="Send question" disabled={!input.trim() || busy}>↑</button>
          </form>
          <small className="cc-chat-note">Answers come from the live event board</small>
        </section>
      )}
      <button
        className="cc-assistant-button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close Campus AI' : 'Open Campus AI'}
      >
        <span>{open ? '×' : '✳'}</span>
      </button>
    </div>
  )
}
