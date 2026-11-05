'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { ownerRequest, ownerToken, type Production, type Restaurant } from '../../lib/menu-api'
import type { SurplusListing } from '../../lib/listing-api'
import { availableListings } from '../../lib/dashboard-listings'
import { orderDate, type OwnerOrder } from '../../lib/order-api'
import MenuShell from './menu/MenuShell'
import OwnerEmptyState from './OwnerEmptyState'
import './dashboard.css'

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
type Recommendation = { recommendedQuantity: number } | null
type Insights = { menus: { menuId: number; name: string; recommendation: Recommendation }[] }
type DashboardData = { restaurants: Restaurant[]; production: Production[]; listings: SurplusListing[]; orders: OwnerOrder[]; insights: Insights | null; insightsFailed: boolean; loadedAt: number }

export default function OwnerDashboard() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [selected, setSelected] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [date] = useState(today)

  useEffect(() => {
    const token = ownerToken()
    if (!token) { router.replace('/login/'); return }
    let active = true
    async function load() {
      setLoading(true); setError('')
      try {
        const restaurants = await ownerRequest<Restaurant[]>('/api/owner/restaurants', token!)
        const restaurant = restaurants.find(item => String(item.restaurantId) === selected) ?? restaurants[0]
        if (!restaurant) { if (active) setData({ restaurants, production: [], listings: [], orders: [], insights: null, insightsFailed: false, loadedAt: Date.now() }); return }
        const [production, listings, orders, insights] = await Promise.all([
          ownerRequest<Production[]>(`/api/owner/restaurants/${restaurant.restaurantId}/production?date=${date}`, token!),
          ownerRequest<SurplusListing[]>(`/api/owner/restaurants/${restaurant.restaurantId}/listings`, token!),
          ownerRequest<OwnerOrder[]>('/api/owner/orders', token!),
          ownerRequest<Insights>(`/api/owner/restaurants/${restaurant.restaurantId}/recommendations?date=${date}`, token!).then(value => ({ value, failed: false })).catch(() => ({ value: null, failed: true })),
        ])
        if (active) { setSelected(String(restaurant.restaurantId)); setData({ restaurants, production, listings, orders, insights: insights.value, insightsFailed: insights.failed, loadedAt: Date.now() }) }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Ringkasan belum dapat dimuat.') }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [router, selected, date, refresh])

  const restaurant = data?.restaurants.find(item => String(item.restaurantId) === selected)
  const production = data?.production ?? []
  const activeListings = availableListings(data?.listings ?? [], data?.loadedAt ?? 0)
  const pendingOrders = (data?.orders ?? []).filter(item => item.status === 'Pending')
  const produced = production.reduce((sum, item) => sum + item.producedQuantity, 0)
  const sold = production.reduce((sum, item) => sum + item.soldQuantity, 0)
  const surplus = production.reduce((sum, item) => sum + item.surplusQuantity, 0)
  const portions = activeListings.reduce((sum, item) => sum + item.availableQuantity, 0)
  const nextPickup = activeListings.toSorted((a, b) => Date.parse(a.pickupStart) - Date.parse(b.pickupStart))[0]
  const recommendations = (data?.insights?.menus ?? []).filter(item => item.recommendation)

  return <MenuShell restaurant={restaurant?.name ?? ''} active="dashboard">
    <header className="menu-header"><div><h1>Ringkasan restoran</h1><p>Hal yang perlu diperhatikan di dapur dan pesananmu hari ini.</p></div><Link className="menu-primary" href="/owner/menu/">Catat produksi</Link></header>
    <div className="owner-dashboard">
      {loading ? <p role="status">Memuat ringkasan restoran…</p> : error ? <OwnerEmptyState title="Ringkasan belum dapat dimuat" action={<button className="menu-secondary" type="button" onClick={() => setRefresh(value => value + 1)}>Coba lagi</button>}><span role="alert">{error}</span></OwnerEmptyState> : !data?.restaurants.length ? <OwnerEmptyState title="Mulai dengan profil restoran" action={<Link className="menu-primary" href="/owner/settings/">Buat profil restoran</Link>}>Tambahkan profil untuk mencatat produksi dan menawarkan makanan surplus.</OwnerEmptyState> : <>
        <div className="dashboard-context"><div><span>RINGKASAN HARI INI</span><strong>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeZone: 'Asia/Jakarta' }).format(new Date(data.loadedAt))}</strong></div>{data.restaurants.length > 1 && <label>Restoran<select value={selected} onChange={event => setSelected(event.target.value)}>{data.restaurants.map(item => <option value={item.restaurantId} key={item.restaurantId}>{item.name}</option>)}</select></label>}</div>
        <section aria-label="Ringkasan hari ini" className="dashboard-stats">
          {[['Diproduksi', produced, 'porsi tercatat'], ['Terjual reguler', sold, 'porsi terjual'], ['Surplus tercatat', surplus, 'porsi dari produksi'], ['Listing tersedia', portions, `${activeListings.length} listing aktif`]].map(([label, value, detail]) => <Card key={label} className="dashboard-stat"><CardHeader><CardTitle>{label}</CardTitle></CardHeader><CardContent><strong>{value}</strong><p>{detail}</p></CardContent></Card>)}
        </section>
        <div className="dashboard-grid"><Card className="dashboard-panel"><CardHeader><CardTitle>Pesanan menunggu pickup</CardTitle><p>Semua restoran milikmu</p></CardHeader><CardContent>{pendingOrders.length ? <><strong className="dashboard-count">{pendingOrders.length} pesanan</strong><p>Siapkan pesanan dan verifikasi kode saat pelanggan datang.</p><ul>{pendingOrders.slice(0, 3).map(order => <li key={order.orderId}><span>#{order.orderId} · {order.restaurantName}</span><small>{order.estimatedPickupAt ? orderDate(order.estimatedPickupAt) : 'Jadwal belum tersedia'}</small></li>)}</ul></> : <p>Belum ada pesanan yang menunggu pickup.</p>}<Link href="/owner/orders/">Lihat pesanan →</Link></CardContent></Card>
          <Card className="dashboard-panel"><CardHeader><CardTitle>Listing surplus</CardTitle><p>{restaurant?.name}</p></CardHeader><CardContent>{nextPickup ? <><strong className="dashboard-count">{portions} porsi tersedia</strong><p>Pickup terdekat: {orderDate(nextPickup.pickupStart)}</p><p>{nextPickup.menuName}</p></> : <p>Belum ada listing aktif yang tersedia untuk pickup.</p>}<Link href="/owner/listings/">Kelola listing →</Link></CardContent></Card></div>
        <Card className="dashboard-panel dashboard-recommendation"><CardHeader><CardTitle>Pertimbangan produksi</CardTitle><p>Rekomendasi untuk {restaurant?.name} hari ini</p></CardHeader><CardContent>{recommendations.length ? <ul>{recommendations.slice(0, 3).map(item => <li key={item.menuId}><span>{item.name}</span><strong>{item.recommendation?.recommendedQuantity} porsi disarankan</strong></li>)}</ul> : <p>{data.insightsFailed ? 'Rekomendasi belum dapat dimuat. Coba lihat halaman analitik.' : 'Rekomendasi akan muncul setelah tersedia cukup catatan produksi dan hasil perhitungan untuk hari ini.'}</p>}<Link href="/owner/insights/">Lihat analitik →</Link></CardContent></Card>
        <nav className="dashboard-actions" aria-label="Aksi cepat"><Link href="/owner/menu/">Catat produksi</Link><Link href="/owner/listings/new/">Buat listing surplus</Link><Link href="/owner/orders/">Kelola pesanan</Link></nav>
      </>}
    </div>
  </MenuShell>
}
