'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { customerRequest, customerToken, readCart, saveCart, type MarketplaceListing } from '../../../lib/customer-api'
import { mediaUrl } from '../../../lib/menu-api'
import CustomerHeader from '../CustomerHeader'
import CustomerIcon from '../CustomerIcon'

const currency = (amount: number) => `Rp ${Math.round(amount).toLocaleString('id-ID')}`
const time = (value: string) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(value))

export default function ListingDetail() {
  const router = useRouter()
  const [listing, setListing] = useState<MarketplaceListing | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(''), 4000)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const value = customerToken()
      if (!value) { router.replace('/login/'); return }
      setToken(value)
      const listingId = Number(new URLSearchParams(window.location.search).get('id'))
      if (!Number.isSafeInteger(listingId) || listingId < 1) { setError('Listing tidak ditemukan.'); setBusy(false); return }
      try {
        const item = await customerRequest<MarketplaceListing>(`/api/marketplace/listings/${listingId}`, value)
        if (!cancelled) setListing(item)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Detail makanan belum dapat dimuat.')
      } finally { if (!cancelled) setBusy(false) }
    })()
    return () => { cancelled = true }
  }, [router])

  function addToCart() {
    if (!listing || !token) return
    const cart = readCart()
    if (cart.length) {
      const existing = awaitListingRestaurant(cart[0]!.surplusListingId)
      void existing.then((restaurantId) => {
        if (restaurantId !== listing.restaurant.restaurantId) { setError('Keranjang hanya dapat berisi makanan dari satu restoran. Selesaikan atau kosongkan keranjang terlebih dahulu.'); return }
        persist()
      }).catch(() => { setError('Keranjang berisi listing yang sudah tidak tersedia.'); saveCart([]) })
    } else persist()

    function persist() {
      const current = readCart()
      const line = current.find((item) => item.surplusListingId === listing!.surplusListingId)
      if (line) line.quantity = Math.min(listing!.availableQuantity, line.quantity + quantity)
      else current.push({ surplusListingId: listing!.surplusListingId, quantity })
      saveCart(current)
      sessionStorage.setItem('replate-cart-notice', `${listing!.menuName} ditambahkan ke keranjang.`)
      router.push('/customer/')
    }
  }

  async function awaitListingRestaurant(listingId: number) {
    const other = await customerRequest<MarketplaceListing>(`/api/marketplace/listings/${listingId}`, token!)
    return other.restaurant.restaurantId
  }

  if (busy) return <main className="customer-app"><CustomerHeader /><div className="customer-detail-page"><div className="customer-empty customer-loading" role="status">Memuat detail makanan…</div></div></main>
  if (!listing) return <main className="customer-app"><CustomerHeader /><div className="customer-detail-page"><Link className="customer-back" href="/customer/"><CustomerIcon name="back" /> Kembali ke marketplace</Link><div className="customer-empty"><CustomerIcon name="leaf" /><h1>Listing tidak tersedia</h1><p>{error || 'Listing sudah habis atau waktu pickup berakhir.'}</p></div></div></main>

  return (
    <main className="customer-app">
      <CustomerHeader />
      <div className="customer-detail-page">
      <div className="customer-detail-toolbar"><Link href="/customer/" aria-label="Kembali ke marketplace"><CustomerIcon name="back" /></Link><span>Detail Makanan</span><button type="button" aria-label="Salin tautan makanan" onClick={() => { void navigator.clipboard?.writeText(window.location.href).then(() => setMessage('Tautan disalin.')).catch(() => setError('Tautan belum dapat disalin. Salin alamat halaman dari browser.')) }}><CustomerIcon name="share" /></button></div>
      <div className="customer-detail-layout"><div className="customer-detail-photo"><Image src={listing.photos[0] ? mediaUrl(listing.photos[0]) : '/menu/veggie.jpg'} alt={listing.menuName} fill sizes="(max-width: 600px) 100vw, 720px" unoptimized /></div>
      <article className="customer-detail-card">
        <div className="customer-detail-heading"><div><h1>{listing.menuName}</h1><p>{listing.restaurant.name}</p></div><span className="detail-discount">Hemat {listing.discountPercent}%</span></div>
        <div className="customer-detail-price"><strong>{currency(listing.rescuePrice)}</strong><del>{currency(listing.normalPrice)}</del></div>
        <p className="customer-detail-description">{listing.description}</p>
        {(listing.dietTags.length > 0 || listing.allergens.length > 0) && <div className="customer-detail-tags">{listing.dietTags.map((tag) => <span key={tag}>{tag}</span>)}{listing.allergens.map((tag) => <span key={tag}>Mengandung {tag}</span>)}</div>}
        <div className="customer-detail-facts"><div><CustomerIcon name="cart" /><p><strong>Stok</strong><small>{listing.availableQuantity} porsi tersedia</small></p></div><div><CustomerIcon name="clock" /><p><strong>Jadwal pickup</strong><small>{time(listing.pickupStart)}–{time(listing.pickupEnd)} WIB</small></p></div><div><CustomerIcon name="pin" /><p><strong>Lokasi</strong><small>{listing.restaurant.address}</small></p></div></div>
        {listing.pickupDirections && <p className="pickup-directions">Instruksi pickup: {listing.pickupDirections}</p>}
        {error && <p className="customer-alert" role="alert">{error}</p>}{message && <p className="customer-success" role="status">{message}</p>}
        <div className="customer-detail-actions"><div className="quantity-stepper"><button type="button" aria-label="Kurangi jumlah" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><span aria-live="polite">{quantity}</span><button type="button" aria-label="Tambah jumlah" disabled={quantity >= listing.availableQuantity} onClick={() => setQuantity((value) => Math.min(listing.availableQuantity, value + 1))}>+</button></div><button className="customer-primary" type="button" onClick={addToCart}><span>Tambah ke keranjang<br />{currency(listing.rescuePrice * quantity)}</span></button></div>
      </article>
      </div>
      </div>
    </main>
  )
}
