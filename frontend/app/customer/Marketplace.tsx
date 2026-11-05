'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { customerRequest, customerToken, readCart, type MarketplaceListing } from '../../lib/customer-api'
import FoodPhoto from './FoodPhoto'
import CustomerNav from './CustomerNav'
import CustomerHeader from './CustomerHeader'
import CustomerIcon from './CustomerIcon'

const currency = (amount: number) => `Rp ${Math.round(amount).toLocaleString('id-ID')}`
const time = (value: string) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(value))
const group = (category: string) => /bakery|pastry|roti|kue/i.test(category) ? 'Bakery' : /lainnya|other/i.test(category) ? 'Others' : 'Meals'

export default function Marketplace() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cartCount, setCartCount] = useState(0)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    void (async () => {
      const value = customerToken()
      if (!value) { router.replace('/login/'); return }
      setToken(value)
      setCartCount(readCart().reduce((sum, item) => sum + item.quantity, 0))
      const cartNotice = sessionStorage.getItem('replate-cart-notice')
      if (cartNotice) {
        setNotice(cartNotice)
        sessionStorage.removeItem('replate-cart-notice')
      }
    })()
  }, [router])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      customerRequest<MarketplaceListing[]>(`/api/marketplace/listings${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`, token)
        .then((items) => { if (!cancelled) { setListings(items); setError('') } })
        .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Marketplace belum dapat dimuat.') })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 200)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [search, token, refresh])

  const visible = useMemo(() => listings.filter((item) => category === 'All' || group(item.category) === category), [category, listings])
  const categories = [{ value: 'All', label: 'Semua' }, { value: 'Meals', label: 'Makanan' }, { value: 'Bakery', label: 'Roti & kue' }, { value: 'Others', label: 'Lainnya' }]

  return (
    <main className="customer-app" id="top">
      <CustomerHeader />
      <section className="marketplace-page" aria-labelledby="marketplace-title">
        <div className="customer-title-row"><div><h1 id="marketplace-title">Makanan baik, harga lebih baik.</h1><p>Temukan makanan surplus dan ambil langsung di restoran.</p></div><span className="customer-location"><CustomerIcon name="leaf" /> Selamatkan makanan</span></div>
        <div className="marketplace-search-row"><label className="marketplace-search"><CustomerIcon name="search" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari menu atau restoran…" aria-label="Cari menu atau restoran" /><button type="button" onClick={() => setSearch('')} aria-label="Hapus pencarian" disabled={!search}><CustomerIcon name="close" /></button></label></div>
        <div className="marketplace-categories" role="group" aria-label="Filter kategori">
          {categories.map((item) => <button key={item.value} type="button" className={category === item.value ? 'selected' : ''} aria-pressed={category === item.value} onClick={() => setCategory(item.value)}>{item.label}</button>)}
        </div>
        <div className="marketplace-list-heading"><div><h2>{search || category !== 'All' ? 'Hasil pencarian' : 'Pilihan makanan'}</h2><p aria-live="polite">{loading ? 'Memuat pilihan makanan…' : error ? 'Pilihan makanan belum dapat dimuat' : `${visible.length} makanan tersedia untuk diselamatkan`}</p></div><span><CustomerIcon name="clock" /> Ambil sesuai jadwal</span></div>
        {error ? <div className="customer-empty"><CustomerIcon name="search" /><h2>Makanan belum dapat dimuat</h2><p className="customer-alert" role="alert">{error}</p><button className="customer-secondary" type="button" onClick={() => setRefresh((value) => value + 1)}>Coba lagi</button></div> : loading ? <div className="customer-empty customer-loading" role="status">Mencari makanan surplus…</div> : visible.length === 0 ? <div className="customer-empty"><CustomerIcon name="leaf" /><h2>{search || category !== 'All' ? 'Belum ada yang cocok' : 'Belum ada makanan tersedia'}</h2><p>{search || category !== 'All' ? 'Coba kata kunci lain atau lihat semua kategori.' : 'Pilihan makanan dari restoran akan muncul di sini. Cek lagi nanti, ya.'}</p>{(search || category !== 'All') && <button className="customer-secondary" type="button" onClick={() => { setSearch(''); setCategory('All') }}>Lihat semua makanan</button>}</div> : (
          <div className="marketplace-grid">{visible.map((item) => <Link className="marketplace-card" href={`/customer/listing/?id=${item.surplusListingId}`} key={item.surplusListingId}>
            <div className="marketplace-card-photo"><FoodPhoto photoUrl={item.photos[0]} name={item.menuName} sizes="(max-width: 599px) 110px, (max-width: 959px) 50vw, 350px" /><span className="marketplace-discount">Hemat {item.discountPercent}%</span><span className="marketplace-stock">{item.availableQuantity} tersisa</span></div>
            <div className="marketplace-card-content"><strong className="marketplace-restaurant">{item.restaurant.name}</strong><h3>{item.menuName}</h3><p className="marketplace-description">{item.description}</p><div className="marketplace-card-price"><span><strong>{currency(item.rescuePrice)}</strong><del>{currency(item.normalPrice)}</del></span><small><CustomerIcon name="clock" />{time(item.pickupStart)}–{time(item.pickupEnd)} WIB</small></div></div>
          </Link>)}</div>
        )}
      </section>
      {notice && <div className="customer-toast"><p role="status"><CustomerIcon name="check" />{notice}</p><Link href="/customer/cart/">Lihat keranjang</Link><button type="button" aria-label="Tutup notifikasi" onClick={() => setNotice('')}><CustomerIcon name="close" /></button></div>}
      <CustomerNav cartCount={cartCount} />
    </main>
  )
}
