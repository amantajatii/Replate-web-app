'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ownerRequest, ownerToken } from '../../../lib/menu-api'
import { orderCurrency, orderDate, orderError, orderStatus, type OwnerOrder } from '../../../lib/order-api'
import MenuShell from '../menu/MenuShell'
import OwnerChoiceGroup from '../OwnerChoiceGroup'
import OwnerEmptyState from '../OwnerEmptyState'
import CustomerIcon from '../../customer/CustomerIcon'

export default function OwnerOrders() {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const [orders, setOrders] = useState<OwnerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [status, setStatus] = useState('All')
  const [restaurant, setRestaurant] = useState('All')
  const [selected, setSelected] = useState<OwnerOrder | null>(null)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [verifyError, setVerifyError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const token = ownerToken()
    if (!token) { router.replace('/login/'); return }
    void (async () => {
      setLoading(true)
      setError('')
      try { const result = await ownerRequest<OwnerOrder[]>('/api/owner/orders', token, { signal: controller.signal }); if (!controller.signal.aborted) setOrders(result) }
      catch (cause) { if (!controller.signal.aborted) setError(orderError(cause)) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    })()
    return () => controller.abort()
  }, [refresh, router])

  useEffect(() => { if (selected && !dialog.current?.open) dialog.current?.showModal() }, [selected])

  function view(order: OwnerOrder) { setCode(''); setFeedback(''); setVerifyError(''); setSelected(order) }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const token = ownerToken()
    if (!token) { router.replace('/login/'); return }
    if (!selected || verifying) return
    setVerifying(true)
    setVerifyError('')
    try {
      const updated = await ownerRequest<OwnerOrder>(`/api/owner/orders/${selected.orderId}/verify-pickup`, token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pickupCode: code.trim().toUpperCase() }) })
      setOrders((current) => current.map((item) => item.orderId === updated.orderId ? updated : item))
      setSelected(updated)
      setFeedback('Pickup berhasil diverifikasi. Pesanan selesai.')
    } catch (cause) { setVerifyError(orderError(cause)) }
    finally { setVerifying(false) }
  }
  const restaurants = [...new Set(orders.map((item) => item.restaurantName))]
  const visible = orders.filter((item) => (status === 'All' || item.status === status) && (restaurant === 'All' || item.restaurantName === restaurant))

  return <MenuShell restaurant={restaurant === 'All' ? 'Semua Restoran' : restaurant} active="orders">
    <section className="owner-orders">
      <header><div><h1>Kelola Pesanan</h1><p>Lihat order masuk dan verifikasi pickup pelanggan.</p></div><label>Restoran<select value={restaurant} onChange={(event) => setRestaurant(event.target.value)}><option value="All">Semua Restoran</option>{restaurants.map((name) => <option key={name}>{name}</option>)}</select></label></header>
      <div className="owner-order-controls"><OwnerChoiceGroup label="Filter status pesanan" value={status} onChange={setStatus} options={['All', 'Pending', 'Completed', 'Cancelled'].map((value) => ({ value, label: value === 'All' ? 'Semua Pesanan' : orderStatus(value) }))} /><button type="button" disabled={loading} aria-label="Perbarui pesanan" title="Perbarui pesanan" onClick={() => setRefresh((value) => value + 1)}><CustomerIcon name="refresh" /></button></div>
      {error && <p className="owner-order-error" role="alert">{error}</p>}
      {loading ? <p role="status">Memuat pesanan…</p> : error ? null : !visible.length ? <OwnerEmptyState title="Belum ada pesanan" className="owner-order-empty">{orders.length ? 'Tidak ada pesanan untuk filter ini.' : 'Pesanan pelanggan akan tampil di sini setelah checkout.'}</OwnerEmptyState> : <div className="owner-order-table"><table><thead><tr><th>Pesanan</th><th>Pelanggan</th><th>Menu</th><th>Jumlah</th><th>Status</th><th>Estimasi Pickup</th><th>Aksi</th></tr></thead><tbody>{visible.map((item) => <tr key={item.orderId}><td>#{item.orderId}<small>{item.restaurantName}</small></td><td>{item.customerName}</td><td>{item.items.map((line) => line.menuName).join(', ')}</td><td>{item.items.reduce((sum, line) => sum + line.quantity, 0)}</td><td><span className={`owner-order-badge status-${item.status.toLowerCase()}`}>{orderStatus(item.status)}</span></td><td>{item.estimatedPickupAt ? orderDate(item.estimatedPickupAt) : 'Belum dijadwalkan'}</td><td><button onClick={() => view(item)} aria-label={`Lihat pesanan ${item.orderId}`}>Lihat</button></td></tr>)}</tbody></table></div>}
    </section>
    <dialog ref={dialog} className="owner-pickup-dialog" aria-labelledby="pickup-title" onClose={() => setSelected(null)} onCancel={(event) => { if (verifying) event.preventDefault() }}>
      {selected && <><header><h2 id="pickup-title">Pesanan #{selected.orderId}</h2><button disabled={verifying} onClick={() => dialog.current?.close()} aria-label="Tutup detail pesanan"><CustomerIcon name="close" /></button></header><p>{selected.customerName} · {selected.restaurantName}</p><span className={`owner-order-badge status-${selected.status.toLowerCase()}`}>{orderStatus(selected.status)}</span><ul>{selected.items.map((item, index) => <li key={index}>{item.quantity}× {item.menuName}<strong>{orderCurrency(item.subtotal)}</strong></li>)}</ul><p>Total: <strong>{orderCurrency(selected.totalAmount)}</strong></p><p>Pickup: {selected.estimatedPickupAt ? orderDate(selected.estimatedPickupAt) : 'Belum dijadwalkan'}</p>
      {feedback && <p className="owner-order-success" role="status">{feedback}</p>}
      {selected.verifiedAt && <p>Terverifikasi: {orderDate(selected.verifiedAt)}</p>}
      {selected.status === 'Pending' && !selected.verifiedAt && <form onSubmit={verify}><label htmlFor="pickup-code">Kode Pickup Pelanggan</label><input id="pickup-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Contoh: A1B2C3D4E5F6" required pattern="[A-Fa-f0-9]{12}" minLength={12} maxLength={12} autoComplete="off" spellCheck={false} disabled={verifying} aria-describedby="pickup-help" /><small id="pickup-help">Masukkan 12 karakter dari kode pada pesanan pelanggan.</small>{verifyError && <p className="owner-order-error" role="alert">{verifyError}</p>}<button className="owner-verify-button" disabled={verifying}>{verifying ? 'Memverifikasi…' : 'Verifikasi Pickup'}</button></form>}</>}
    </dialog>
  </MenuShell>
}
