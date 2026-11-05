'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { clearSession, readSession, type Session } from '../../lib/session'
import CustomerIcon from './CustomerIcon'

export default function CustomerHeader() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)

  function logout() {
    clearSession()
    sessionStorage.removeItem('replate-cart-notice')
    router.replace('/login/')
  }

  return <header className="customer-header">
    <Link href="/customer/" className="customer-brand"><Image src="/Replate-logo.png" alt="" width={42} height={42} unoptimized /><strong>Replate</strong></Link>
    <span>Makanan baik, lebih sedikit terbuang.</span>
    <button className="customer-profile-button" type="button" popoverTarget="customer-profile" aria-label="Profil akun" onClick={() => setSession(readSession())}><CustomerIcon name="profile" />Profil</button>
    <section id="customer-profile" className="customer-profile-panel" popover="auto" aria-labelledby="customer-profile-title">
      <h2 id="customer-profile-title">Profil saya</h2>
      {session ? <>
        <p className="customer-profile-name">{session.name}</p>
        <p className="customer-profile-email">{session.email}</p>
        <button className="customer-logout" type="button" onClick={logout}><CustomerIcon name="logout" />Keluar akun</button>
      </> : <><p className="customer-profile-email">Sesi berakhir. Masuk kembali untuk melihat akunmu.</p><Link className="customer-primary" href="/login/">Masuk</Link></>}
    </section>
  </header>
}
