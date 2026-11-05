'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ownerRequest, ownerToken, type Menu, type Production, type Restaurant } from '../../../lib/menu-api'
import MenuShell from '../menu/MenuShell'
import OwnerEmptyState from '../OwnerEmptyState'

export default function ProductionHistory() {
  const [token, setToken] = useState<string | null>(null)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [restaurantId, setRestaurantId] = useState('')
  const [menus, setMenus] = useState<Menu[]>([])
  const [records, setRecords] = useState<Production[]>([])
  const [menuId, setMenuId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let alive = true
    const value = ownerToken()
    async function load() {
      setToken(value)
      setLoading(true)
      setError('')
      if (!value) { setLoading(false); return }
      try {
        const items = await ownerRequest<Restaurant[]>('/api/owner/restaurants', value)
        if (!alive) return
        setRestaurants(items)
        setRestaurantId((current) => current || String(items[0]?.restaurantId ?? ''))
        if (!items.length) setLoading(false)
      } catch (cause) {
        if (alive) { setError(cause instanceof Error ? cause.message : 'Gagal memuat restoran.'); setLoading(false) }
      }
    }
    void load()
    return () => { alive = false }
  }, [refresh])

  useEffect(() => {
    if (!token || !restaurantId) return
    let alive = true
    async function load() {
      setLoading(true)
      setError('')
      if (from && to && from > to) { setError('Tanggal awal tidak boleh melewati tanggal akhir.'); setLoading(false); return }
      try {
        const params = new URLSearchParams()
        if (menuId) params.set('menuId', menuId)
        if (from) params.set('from', from)
        if (to) params.set('to', to)
        const [items, history] = await Promise.all([
          ownerRequest<Menu[]>(`/api/owner/restaurants/${restaurantId}/menus`, token!),
          ownerRequest<Production[]>(`/api/owner/restaurants/${restaurantId}/production/history?${params}`, token!),
        ])
        if (alive) { setMenus(items); setRecords(history) }
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : 'Gagal memuat histori.')
      } finally { if (alive) setLoading(false) }
    }
    void load()
    return () => { alive = false }
  }, [token, restaurantId, menuId, from, to, refresh])

  const restaurant = restaurants.find((item) => String(item.restaurantId) === restaurantId)
  const totals = records.reduce((sum, row) => ({ produced: sum.produced + row.producedQuantity, sold: sum.sold + row.soldQuantity, surplus: sum.surplus + row.surplusQuantity }), { produced: 0, sold: 0, surplus: 0 })
  const number = (value: number) => value.toLocaleString('id-ID')

  return <MenuShell restaurant={restaurant?.name ?? ''} active="production">
    <header className="menu-header"><div><h1>Histori Produksi</h1><p>Tinjau produksi, penjualan reguler, dan surplus per menu dan tanggal.</p></div><Link className="menu-primary" href="/owner/menu/">Catat Produksi</Link></header>
    {!token && !loading ? <OwnerEmptyState title="Masuk sebagai pemilik restoran" action={<Link href="/login/">Masuk</Link>} /> : <>
      {restaurants.length > 0 && <div className="production-filters">
        <label htmlFor="production-restaurant">Restoran<select id="production-restaurant" value={restaurantId} onChange={(event) => { setRestaurantId(event.target.value); setMenuId(''); setMenus([]) }}>{restaurants.map((item) => <option key={item.restaurantId} value={item.restaurantId}>{item.name}</option>)}</select></label>
        <label htmlFor="production-menu">Menu<select id="production-menu" value={menuId} onChange={(event) => setMenuId(event.target.value)}><option value="">Semua menu</option>{menus.map((menu) => <option key={menu.menuId} value={menu.menuId}>{menu.name}</option>)}</select></label>
        <label htmlFor="production-from">Dari tanggal<input id="production-from" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
        <label htmlFor="production-to">Sampai tanggal<input id="production-to" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
        <button className="menu-secondary" type="button" onClick={() => { setMenuId(''); setFrom(''); setTo('') }}>Reset Filter</button>
      </div>}
      {loading ? <p className="menu-notice" role="status">Memuat histori produksi...</p> : error ? <div className="menu-notice error" role="alert"><p>{error}</p><button type="button" onClick={() => setRefresh((value) => value + 1)}>Coba Lagi</button></div> : !restaurant ? <OwnerEmptyState title="Belum ada restoran untuk dicatat" action={<Link className="menu-primary" href="/owner/settings/">Buat profil restoran</Link>}>Lengkapi profil restoran, tambahkan menu, lalu catat produksi harian. Riwayat dan filter produksi akan muncul di sini.</OwnerEmptyState> : <>
        <div className="menu-stats"><div><small>CATATAN PRODUKSI</small><strong>{number(records.length)}</strong></div><div><small>DIPRODUKSI</small><strong>{number(totals.produced)} Porsi</strong></div><div><small>TERJUAL REGULER</small><strong>{number(totals.sold)} Porsi</strong></div><div><small>SURPLUS</small><strong>{number(totals.surplus)} Porsi</strong></div></div>
        {!records.length ? <OwnerEmptyState title="Belum ada catatan produksi" action={<Link href="/owner/menu/">Catat Produksi</Link>}>Ubah filter atau catat produksi melalui halaman Menu & Produksi.</OwnerEmptyState> : <div className="production-table"><table><caption>Catatan produksi sesuai filter, tanggal terbaru terlebih dahulu.</caption><thead><tr><th scope="col">Tanggal</th><th scope="col">Menu</th><th scope="col">Diproduksi</th><th scope="col">Terjual Reguler</th><th scope="col">Surplus</th></tr></thead><tbody>{records.map((row) => <tr key={row.productionRecordId}><td>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(row.productionDate))}</td><td>{menus.find((menu) => menu.menuId === row.menuId)?.name ?? `Menu #${row.menuId}`}</td><td>{number(row.producedQuantity)}</td><td>{number(row.soldQuantity)}</td><td>{number(row.surplusQuantity)}</td></tr>)}</tbody></table></div>}
      </>}
    </>}
  </MenuShell>
}
