'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
export default function Navbar() {
 const path = usePathname()
 const {currentUser,setCurrentUserId,allUsers}=useAuth()
 const links=[{href:'/',label:'Discover'},{href:'/events',label:'All events'},...(currentUser?.role==='student'?[{href:'/registrations',label:'My registrations'}]:[]),...(currentUser?.role==='organizer'?[{href:'/organizer',label:'Organizer'}]:[])]
 return <header className="site-header"><div className="shell nav-shell"><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">c<span>↗</span></span><span>campus<span className="brand-light">connect</span><small>MAKE YOURSELF PART OF IT.</small></span></Link><nav aria-label="Primary"><ul>{links.map(l=><li key={l.href}><Link href={l.href} aria-current={(l.href==='/'?path==='/':path.startsWith(l.href))?'page':undefined}>{l.label}</Link></li>)}</ul></nav><label className="account-switch"><span className="account-avatar" aria-hidden="true">{currentUser?.name.charAt(0)??'○'}</span><span><small>{currentUser?.role??'guest'}</small><select aria-label="Switch current user" value={currentUser?.id??''} onChange={e=>setCurrentUserId(e.target.value)}><option value="">Signed out</option>{allUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></span></label></div></header>
}
