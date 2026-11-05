'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { clearSession } from '../../../lib/session'
import CustomerIcon from '../../customer/CustomerIcon'

const navigation = [
  ['dashboard', '/owner/', 'dashboard', 'Ringkasan'],
  ['menu', '/owner/menu/', 'menu', 'Menu & produksi'],
  ['listing', '/owner/listings/', 'listing', 'Listing surplus'],
  ['orders', '/owner/orders/', 'orders', 'Pesanan'],
  ['production', '/owner/production/', 'production', 'Riwayat produksi'],
  ['insights', '/owner/insights/', 'chart', 'Analitik & AI'],
  ['settings', '/owner/settings/', 'settings', 'Pengaturan restoran'],
] as const

export default function MenuShell({
  restaurant,
  active = 'menu',
  children,
}: {
  restaurant: string
  active?: (typeof navigation)[number][0]
  children: ReactNode
}) {
  const router = useRouter()
  return (
    <div className="menu-layout">
      <aside className="menu-sidebar">
        <Link href="/owner/" className="menu-brand">
          <Image src="/Replate-logo.png" alt="" width={40} height={40} unoptimized />
          <strong>Replate</strong>
        </Link>
        <div className="menu-store">
          <span>{restaurant.slice(0, 2).toUpperCase() || 'RP'}</span>
          <div>
            <strong>{restaurant || 'Restoran belum diatur'}</strong>
            <small>Pemilik restoran</small>
          </div>
        </div>
        <nav aria-label="Navigasi owner">
          {navigation.map(([key, href, icon, label]) => <Link key={key} className={active === key ? 'active' : ''} aria-current={active === key ? 'page' : undefined} href={href}>{icon === 'chart' ? <CustomerIcon name="chart" /> : <Image src={`/listing/${icon}.svg`} alt="" width={20} height={20} />}{label}</Link>)}
        </nav>
        <div className="menu-bottom">
          <button
            type="button"
            aria-label="Keluar akun"
            onClick={() => {
              clearSession()
              router.replace('/login/')
            }}
          >
            <Image src="/listing/logout.svg" alt="" width={18} height={18} /><span>Keluar akun</span>
          </button>
        </div>
      </aside>
      <main className="menu-main">{children}</main>
    </div>
  )
}
