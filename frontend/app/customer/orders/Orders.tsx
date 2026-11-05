'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { customerRequest, customerToken, readCart, type CustomerOrder } from '../../../lib/customer-api'
import { mediaUrl } from '../../../lib/menu-api'
import { orderCurrency, orderDate, orderError, orderStatus } from '../../../lib/order-api'
import CustomerNav from '../CustomerNav'
import CustomerHeader from '../CustomerHeader'
import CustomerIcon from '../CustomerIcon'

export default function Orders({ detail = false }: { detail?: boolean }) {
  const router = useRouter()
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [cartCount, setCartCount] = useState(0)
  const [status, setStatus] = useState('All')

  useEffect(() => {
    const controller = new AbortController()
    const token = customerToken()
    if (!token) { router.replace('/login/'); return }
    const id = Number(new URLSearchParams(window.location.search).get('id'))
    void (async () => {
      setLoading(true)
      setError('')
      setCartCount(readCart().reduce((sum, item) => sum + item.quantity, 0))
      try {
        if (detail && (!Number.isSafeInteger(id) || id < 1)) throw new Error('Minta tautan pesanan yang valid atau pilih dari riwayat.')
        const result = await customerRequest<CustomerOrder | CustomerOrder[]>(detail ? `/api/customer/orders/${id}` : '/api/customer/orders', token, { signal: controller.signal })
        if (!controller.signal.aborted) setOrders(Array.isArray(result) ? result : [result])
      } catch (cause) {
        if (!controller.signal.aborted) setError(orderError(cause))
      } finally { if (!controller.signal.aborted) setLoading(false) }
    })()
    return () => controller.abort()
  }, [detail, refresh, router])

  useEffect(() => {
    const reload = () => setRefresh((value) => value + 1)
    window.addEventListener('focus', reload)
    return () => window.removeEventListener('focus', reload)
  }, [])

  const order = orders[0]
  const completed = order?.status === 'Completed'
  const visibleOrders = orders.filter((item) => status === 'All' || item.status === status)
  const statuses = ['All', 'Pending', 'Completed', 'Cancelled']
  return <main className="customer-app">
    <CustomerHeader />
    <section className="customer-orders" aria-labelledby="customer-orders-title">
    <header className="orders-heading">
      {detail && <Link href="/customer/orders/" aria-label="Kembali ke riwayat"><CustomerIcon name="back" /></Link>}
      <h1 id="customer-orders-title">{detail ? order ? `Pesanan #${order.orderId}` : 'Status Pesanan' : 'Riwayat Pesanan'}</h1>
      <button className="orders-refresh" type="button" disabled={loading} aria-label={loading ? 'Memperbarui status pesanan' : 'Perbarui status pesanan'} title="Perbarui status" onClick={() => setRefresh((value) => value + 1)}><CustomerIcon name="refresh" /></button>
    </header>
    {!detail && <p className="orders-intro">Lihat riwayat dan jadwal pengambilan makananmu.</p>}
    {!detail && <div className="marketplace-categories orders-filters" role="group" aria-label="Filter status pesanan">{statuses.map((value) => <button key={value} type="button" aria-pressed={status === value} className={status === value ? 'selected' : ''} onClick={() => setStatus(value)}>{value === 'All' ? 'Semua' : orderStatus(value)}</button>)}</div>}
    {error && <p className="customer-alert" role="alert">{error}</p>}
    {loading ? <p className="customer-empty customer-loading" role="status">Memuat pesanan…</p> : error ? null : !orders.length ? <div className="customer-empty"><CustomerIcon name="orders" /><h2>Belum ada pesanan</h2><p>Makanan yang kamu selamatkan akan tampil di sini.</p><Link href="/customer/">Cari Makanan</Link></div> : detail ? <>
      <ol className="order-timeline" aria-label="Status pesanan">
        <li><Image src="/orders/confirmed.svg" alt="" width={31} height={31} /><div><h2>Pesanan Dikonfirmasi</h2><p>{orderDate(order.orderedAt)}</p></div></li>
        <li className={completed ? '' : 'upcoming'}><Image src={completed ? '/orders/confirmed.svg' : '/orders/pending.svg'} alt="" width={31} height={31} /><div><h2>{orderStatus(order.status)}</h2><p>{completed ? 'Pesanan sudah diambil dan pickup terverifikasi.' : order.status === 'Cancelled' ? 'Pesanan dibatalkan. Kode pickup tidak dapat digunakan.' : 'Tunjukkan kode pickup saat mengambil makanan.'}</p></div></li>
      </ol>
      <div className="order-pickup-time"><Image src="/orders/clock.svg" alt="" width={28} height={33} /><div><strong>Estimasi Waktu Pickup</strong><p>{order.estimatedPickupAt ? orderDate(order.estimatedPickupAt) : 'Hubungi restoran untuk jadwal pickup.'}</p></div></div>
      {order.pickupCode && !completed && order.status !== 'Cancelled' && <section className="order-code"><h2>Kode Pickup Kamu</h2><strong>{order.pickupCode}</strong><p>Tunjukkan kode ini di restoran</p></section>}
      <section className="order-summary"><h2>{order.restaurantName || 'Rincian Pesanan'}</h2>{order.items.map((item, index) => <p key={index}><span>{item.quantity}× {item.menuName}</span><strong>{orderCurrency(item.subtotal)}</strong></p>)}<p className="order-total"><span>Total</span><strong>{orderCurrency(order.totalAmount)}</strong></p></section>
    </> : !visibleOrders.length ? <div className="customer-empty"><CustomerIcon name="orders" /><h2>Belum ada pesanan {orderStatus(status).toLowerCase()}</h2><p>Coba pilih status lain untuk melihat pesananmu.</p><button className="customer-secondary" type="button" onClick={() => setStatus('All')}>Lihat semua pesanan</button></div> : <div className="order-history">{visibleOrders.map((item, index) => <Link key={item.orderId} href={`/customer/order/?id=${item.orderId}`} className="order-history-card"><Image src={item.items[0]?.photoUrl ? mediaUrl(item.items[0].photoUrl) : '/orders/placeholder.svg'} alt="" width={120} height={120} loading={index === 0 ? 'eager' : 'lazy'} unoptimized /><div><h2>{item.restaurantName || `Pesanan #${item.orderId}`}</h2><p>{item.items.map((line) => `${line.quantity}× ${line.menuName}`).join(', ')}</p><strong>{orderCurrency(item.totalAmount)}</strong><span className={`order-badge status-${item.status.toLowerCase()}`}>{orderStatus(item.status)}</span><small>{orderDate(item.orderedAt)}</small></div></Link>)}</div>}
    </section>
    <CustomerNav cartCount={cartCount} active="orders" />
  </main>
}
