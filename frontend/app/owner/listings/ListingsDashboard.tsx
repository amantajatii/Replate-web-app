'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ownerRequest, ownerToken, type Restaurant } from '../../../lib/menu-api'
import type { ListingStatus, SurplusListing } from '../../../lib/listing-api'
import MenuShell from '../menu/MenuShell'
import OwnerChoiceGroup from '../OwnerChoiceGroup'
import CustomerIcon from '../../customer/CustomerIcon'

const statuses: Array<'Semua' | ListingStatus> = ['Semua', 'Active', 'Draft', 'Closed']
const statusText: Record<ListingStatus, string> = { Active: 'Aktif', Draft: 'Draft', Closed: 'Ditutup' }
const currency = (value: number) => `Rp ${value.toLocaleString('id-ID')}`
const shortDate = (value: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(value))
const time = (value: string) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(value))

export default function ListingsDashboard() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [listings, setListings] = useState<SurplusListing[]>([])
  const [status, setStatus] = useState<(typeof statuses)[number]>('Semua')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function load(value: string) {
    setError('')
    try {
      const restaurants = await ownerRequest<Restaurant[]>('/api/owner/restaurants', value)
      const first = restaurants[0] ?? null
      setRestaurant(first)
      if (first) setListings(await ownerRequest<SurplusListing[]>(`/api/owner/restaurants/${first.restaurantId}/listings`, value))
      else setListings([])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Listing belum dapat dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      const value = ownerToken()
      if (!value) {
        router.replace('/login/')
        setLoading(false)
        return
      }
      setToken(value)
      await load(value)
    })()
  }, [router])

  const visible = useMemo(() => listings.filter((listing) =>
    (status === 'Semua' || listing.status === status) &&
    `${listing.menuName} ${listing.status}`.toLowerCase().includes(query.toLowerCase()),
  ), [listings, query, status])
  const active = listings.filter((listing) => listing.status === 'Active')

  async function closeListing(listingId: number) {
    if (!token || !window.confirm('Tutup listing ini? Listing tidak lagi tampil di marketplace.')) return
    setClosing(listingId)
    setError('')
    try {
      await ownerRequest(`/api/owner/listings/${listingId}`, token, { method: 'DELETE' })
      await load(token)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Listing belum dapat ditutup.')
    } finally {
      setClosing(null)
    }
  }

  return (
    <MenuShell restaurant={restaurant?.name ?? 'Restoran Baru'} active="listing">
      <header className="listing-topbar">
        <div>
          <h1>Listing Surplus</h1>
          <p>Atur makanan surplus yang siap diselamatkan pelanggan.</p>
        </div>
        <Link className="listing-button primary" href="/owner/listings/new/"><CustomerIcon name="plus" />Buat listing</Link>
      </header>
      <div className="listing-dashboard">
        <section className="listing-stats" aria-label="Ringkasan listing">
          <article><small>Listing Aktif</small><strong>{active.length}</strong><span>Tayang di marketplace</span></article>
          <article><small>Porsi Tersedia</small><strong>{active.reduce((sum, item) => sum + item.availableQuantity, 0)}</strong><span>Siap diselamatkan</span></article>
          <article><small>Harga Surplus</small><strong>{active.length ? currency(active.reduce((sum, item) => sum + item.rescuePrice, 0) / active.length) : 'Belum ada'}</strong><span>Rata-rata per listing</span></article>
        </section>
        <section className="listing-table-panel">
          <div className="listing-panel-heading">
            <div><h2>Semua Listing</h2><p>Kelola stok dan jendela pickup surplus restoran.</p></div>
            <label className="listing-search"><CustomerIcon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama menu..." aria-label="Cari nama menu" /></label>
          </div>
          <OwnerChoiceGroup label="Filter status listing" className="listing-filters" value={status} onChange={setStatus} options={statuses.map((item) => ({ value: item, label: item === 'Semua' ? 'Semua' : statusText[item] }))} />
          {error && <p className="listing-alert" role="alert">{error}</p>}
          {loading ? <p className="listing-state">Memuat listing…</p> : !restaurant ? (
            <div className="listing-state"><h3>Profil restoran belum tersedia</h3><p>Buat profil restoran sebelum mempublikasikan surplus.</p><Link href="/owner/settings/">Atur Profil Restoran →</Link></div>
          ) : visible.length === 0 ? (
            <div className="listing-state"><h3>{query || status !== 'Semua' ? 'Tidak ada listing yang cocok' : 'Belum ada listing surplus'}</h3><p>{query || status !== 'Semua' ? 'Coba kata pencarian atau filter lain.' : 'Buat listing dari catatan produksi agar pelanggan dapat memesan.'}</p>{listings.length === 0 && <Link href="/owner/listings/new/">Buat Listing Pertama →</Link>}</div>
          ) : (
            <div className="listing-table-scroll"><table className="listing-table">
              <thead><tr><th>Menu</th><th>Status</th><th>Harga Surplus</th><th>Porsi</th><th>Jadwal Pickup</th><th>Aksi</th></tr></thead>
              <tbody>{visible.map((item) => <tr key={item.surplusListingId}>
                <td><strong>{item.menuName}</strong><small>Produksi {shortDate(`${item.productionDate}T00:00:00`)}</small></td>
                <td><span className={`listing-status ${item.status.toLowerCase()}`}>{statusText[item.status]}</span></td>
                <td><strong>{currency(item.rescuePrice)}</strong><small>Normal {currency(item.normalPrice)}</small></td>
                <td><strong>{item.availableQuantity} tersisa</strong><small>dari {item.initialQuantity} porsi</small></td>
                <td><strong>{shortDate(item.pickupStart)}, {time(item.pickupStart)}</strong><small>s.d. {shortDate(item.pickupEnd)}, {time(item.pickupEnd)} WIB</small></td>
                <td><div className="listing-row-actions"><Link href={`/owner/listings/new/?edit=${item.surplusListingId}`}>Ubah</Link>{item.status !== 'Closed' && <button type="button" disabled={closing === item.surplusListingId} onClick={() => void closeListing(item.surplusListingId)}>{closing === item.surplusListingId ? 'Menutup…' : 'Tutup'}</button>}</div></td>
              </tr>)}</tbody>
            </table></div>
          )}
        </section>
      </div>
    </MenuShell>
  )
}
