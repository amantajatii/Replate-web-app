'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { customerRequest, customerToken, readCart, saveCart, type CartLine, type CustomerOrder, type MarketplaceListing } from '../../../lib/customer-api'
import { reconcileCart } from '../../../lib/cart-reconciliation'
import FoodPhoto from '../FoodPhoto'
import CustomerNav from '../CustomerNav'
import CustomerHeader from '../CustomerHeader'
import CustomerIcon from '../CustomerIcon'

const currency = (amount: number) => `Rp ${Math.round(amount).toLocaleString('id-ID')}`
const time = (value: string) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(value))
type CartItem = CartLine & { listing: MarketplaceListing }

export default function CustomerCart() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [order, setOrder] = useState<CustomerOrder | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const value = customerToken()
      if (!value) { router.replace('/login/'); return }
      setToken(value)
      try {
        const { items: next, removedCount } = await reconcileCart(readCart(), id => customerRequest<MarketplaceListing>(`/api/marketplace/listings/${id}`, value))
        if (cancelled) return
        setItems(next)
        saveCart(next.map(({ surplusListingId, quantity }) => ({ surplusListingId, quantity })))
        setError(removedCount ? 'Listing yang sudah tidak tersedia telah dihapus dari keranjang.' : '')
        setLoadFailed(false)
      } catch {
        if (cancelled) return
        setLoadFailed(true)
        setError('Keranjang belum dapat diperiksa. Pilihanmu tetap tersimpan. Coba muat ulang.')
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [router, refresh])

  const total = useMemo(() => items.reduce((sum, item) => sum + item.listing.rescuePrice * item.quantity, 0), [items])
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0)

  function update(lineId: number, quantity: number) {
    const next = items.map((item) => item.surplusListingId === lineId ? { ...item, quantity: Math.max(0, Math.min(item.listing.availableQuantity, quantity)) } : item).filter((item) => item.quantity > 0)
    setItems(next)
    saveCart(next.map(({ surplusListingId, quantity: count }) => ({ surplusListingId, quantity: count })))
  }

  async function checkout() {
    if (!token || !items.length) return
    setBusy(true); setError('')
    try {
      const result = await customerRequest<CustomerOrder>('/api/customer/orders', token, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map(({ surplusListingId, quantity }) => ({ surplusListingId, quantity })) }),
      })
      setOrder(result); setItems([]); saveCart([])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pesanan belum dapat dibuat. Periksa lagi stok dan jendela pickup.')
    } finally { setBusy(false) }
  }

  return (
    <main className="customer-app customer-cart-page">
      <CustomerHeader />
      <header className="customer-cart-topbar"><Link href="/customer/" aria-label="Kembali ke marketplace"><CustomerIcon name="back" /></Link><h1>{order ? 'Pesanan Berhasil' : 'Keranjang'}</h1><span /></header>
      {loading ? <div className="customer-empty customer-loading" role="status">Memuat keranjang…</div> : loadFailed ? <div className="customer-empty"><h2>Keranjang belum dapat dimuat</h2><p role="alert">{error}</p><button className="customer-secondary" type="button" onClick={() => { setLoading(true); setRefresh(value => value + 1) }}>Coba lagi</button><Link className="customer-back" href="/customer/">Kembali ke marketplace</Link></div> : order ? (
        <section className="checkout-success" aria-labelledby="order-success-heading"><span className="success-check"><CustomerIcon name="check" /></span><small>Pesanan #{order.orderId}</small><h2 id="order-success-heading">Makananmu sudah dipesan!</h2><p>Tunjukkan kode ini ke restoran saat mengambil pesanan.</p><div className="pickup-code-card"><small>KODE PICKUP</small><strong>{order.pickupCode ?? 'Belum tersedia'}</strong><span>Pickup sekitar {order.estimatedPickupAt ? time(order.estimatedPickupAt) : 'sesuai jadwal'}</span></div><div className="checkout-order-summary">{order.items.map((item, index) => <div key={`${item.menuName}-${index}`}><span>{item.quantity}× {item.menuName}</span><strong>{currency(item.subtotal)}</strong></div>)}<div className="checkout-total"><span>Total</span><strong>{currency(order.totalAmount)}</strong></div></div><Link className="customer-primary customer-browse-link" href={`/customer/order/?id=${order.orderId}`}>Lihat Status Pesanan</Link><Link className="customer-back" href="/customer/">Jelajahi makanan lain</Link></section>
      ) : (
        <>
          <section className="customer-cart-content"><h2>Pesananmu</h2><p className="customer-cart-intro">Pastikan jadwal pickup sesuai sebelum memesan.</p>
            {error && <p className="customer-alert" role="alert">{error}</p>}
            {items.length === 0 ? <div className="customer-empty"><CustomerIcon name="cart" /><h2>Keranjang masih kosong</h2><p>Pilih makanan surplus di sekitar dan bantu kurangi food waste.</p><Link href="/customer/">Cari makanan</Link></div> : (
              <><div className="customer-cart-list">{items.map((item) => <article className="customer-cart-item" key={item.surplusListingId}><div className="customer-cart-photo"><FoodPhoto photoUrl={item.listing.photos[0]} name={item.listing.menuName} sizes="120px" /></div><div className="customer-cart-item-content"><strong>{item.listing.restaurant.name}</strong><h3>{item.listing.menuName}</h3><small>{time(item.listing.pickupStart)}–{time(item.listing.pickupEnd)} WIB</small><div className="customer-cart-item-footer"><b>{currency(item.listing.rescuePrice)}</b><div className="quantity-stepper compact"><button type="button" aria-label={`Kurangi ${item.listing.menuName}`} onClick={() => update(item.surplusListingId, item.quantity - 1)}>−</button><span aria-live="polite">{item.quantity}</span><button type="button" aria-label={`Tambah ${item.listing.menuName}`} disabled={item.quantity >= item.listing.availableQuantity} onClick={() => update(item.surplusListingId, item.quantity + 1)}>+</button></div></div></div></article>)}</div>
                <section className="customer-cart-total"><div><span>Total ({cartCount} porsi)</span><strong>{currency(total)}</strong></div><small>Pickup dari {items[0]?.listing.restaurant.name}</small><button className="customer-primary" type="button" disabled={busy || !items.length} onClick={() => void checkout()}>{busy ? 'Memproses pesanan…' : 'Konfirmasi Pesanan'}</button><p>Dengan melanjutkan, stok akan dipesan dan kode pickup akan dibuat.</p></section>
              </>
            )}
          </section>
          <CustomerNav cartCount={cartCount} active="cart" />
        </>
      )}
    </main>
  )
}
