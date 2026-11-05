'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MenuShell from '../menu/MenuShell'
import OwnerEmptyState from '../OwnerEmptyState'
import CustomerIcon from '../../customer/CustomerIcon'
import { ownerRequest, ownerToken, type Restaurant, type Production } from '../../../lib/menu-api'
import './insights.css'

type Recommendation = { recommendedQuantity: number; predictedDemand: number; modelVersion: string; insight: string; generatedAt: string }
type Dashboard = { name: string; synthetic: boolean; menus: { menuId: number; name: string; records: Production[]; recommendation: Recommendation | null }[] }
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
const number = (value: number) => value.toLocaleString('id-ID', { maximumFractionDigits: 1 })

export default function Insights() {
  const router = useRouter()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [restaurantId, setRestaurantId] = useState('')
  const [date, setDate] = useState(today)
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const token = ownerToken()
    if (!token) { router.replace('/login/'); return }
    let current = true
    ownerRequest<Restaurant[]>('/api/owner/restaurants', token).then(rows => {
      if (current) { setRestaurants(rows); setRestaurantId(String(rows[0]?.restaurantId ?? '')); if (!rows.length) setLoading(false) }
    }).catch(error => { if (current) { setError(error.message); setLoading(false) } })
    return () => { current = false }
  }, [router])
  useEffect(() => {
    const token = ownerToken()
    if (!token || !restaurantId || !date) return
    let current = true
    ownerRequest<Dashboard>(`/api/owner/restaurants/${restaurantId}/recommendations?date=${date}`, token)
      .then(value => { if (current) { setData(value); setError('') } })
      .catch(error => { if (current) { setData(null); setError(error.message) } })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [restaurantId, date, refresh])
  const cutoff = Date.parse(`${date}T00:00:00Z`) - 28 * 86400000
  const records = data?.menus.flatMap(menu => menu.records).filter(record => Date.parse(record.productionDate) >= cutoff) ?? []
  const produced = records.reduce((sum, r) => sum + r.producedQuantity, 0)
  const sold = records.reduce((sum, r) => sum + r.soldQuantity, 0)
  const surplus = records.reduce((sum, r) => sum + r.surplusQuantity, 0)
  const days = [...new Set(records.map(r => r.productionDate))].sort()
  const daily = days.map(day => ({ day, sold: records.filter(r => r.productionDate === day).reduce((s, r) => s + r.soldQuantity, 0), surplus: records.filter(r => r.productionDate === day).reduce((s, r) => s + r.surplusQuantity, 0) }))
  const max = Math.max(1, ...daily.map(day => day.sold + day.surplus))
  const change = () => { setLoading(true); setData(null) }
  return <MenuShell restaurant={restaurants.find(r => String(r.restaurantId) === restaurantId)?.name ?? ''} active="insights">
    <header className="menu-header"><div><h1>Analitik & rekomendasi</h1><p>Dari catatan produksi menjadi pertimbangan untuk masak berikutnya.</p></div></header>
    <div className="insights-content">
      <div className="insights-controls">
        <label>Restoran<select value={restaurantId} onChange={event => { change(); setRestaurantId(event.target.value) }} disabled={!restaurants.length}>{restaurants.map(r => <option key={r.restaurantId} value={r.restaurantId}>{r.name}</option>)}</select></label>
        <label>Tanggal rekomendasi<input type="date" value={date} onChange={event => { if (event.target.value) { change(); setDate(event.target.value) } }} required /></label>
        <button type="button" className="insights-refresh" aria-label="Muat ulang rekomendasi" disabled={loading || !restaurantId || !date} onClick={() => { change(); setRefresh(value => value + 1) }}><CustomerIcon name="refresh" /></button>
      </div>
      {error && <p role="alert" className="insights-notice">{error}</p>}
      {loading ? <p role="status">Memuat catatan produksi…</p> : !restaurants.length ? <OwnerEmptyState title="Mulai dari profil restoran" action={<Link href="/owner/settings/">Buat profil restoran →</Link>}>Setelah menu dan produksi tercatat, analitik akan tersedia di sini.</OwnerEmptyState> : data && <>
        {data.synthetic && <p className="insights-notice" role="status">Data demo sintetis · Angka dan evaluasi ini untuk demonstrasi, bukan hasil operasional restoran.</p>}
        <section className="insights-stats" aria-label="Ringkasan 28 hari sebelum tanggal rekomendasi">
          <div><span>Diproduksi · 28 hari</span><strong>{number(produced)} <small>porsi</small></strong></div>
          <div><span>Terjual reguler</span><strong>{number(sold)} <small>porsi</small></strong></div>
          <div><span>Surplus dari produksi</span><strong>{number(surplus)} <small>porsi · {produced ? number(surplus / produced * 100) : '0'}%</small></strong></div>
        </section>
        {daily.length > 0 && <section className="insights-panel"><h2>Ke mana hasil masakmu?</h2><p>Penjualan reguler dan surplus per hari. Hari tanpa catatan tidak dihitung sebagai nol.</p>
          <div className="insights-chart" role="img" aria-label={`Tren ${daily.length} hari tercatat; ${sold} porsi terjual reguler dan ${surplus} surplus. Rincian tersedia di tabel berikut.`}>{daily.map(day => <div key={day.day} title={`${day.day}: ${day.sold} terjual, ${day.surplus} surplus`}><i style={{ height: `${day.surplus / max * 100}%` }} /><b style={{ height: `${day.sold / max * 100}%` }} /></div>)}</div>
          <div className="insights-legend"><span>● Terjual reguler</span><span>● Surplus</span><small>{daily[0]?.day} — {daily.at(-1)?.day}</small></div>
          <details><summary>Lihat rincian harian</summary><table><thead><tr><th scope="col">Tanggal</th><th scope="col">Terjual</th><th scope="col">Surplus</th></tr></thead><tbody>{daily.map(day => <tr key={day.day}><th scope="row">{day.day}</th><td>{day.sold}</td><td>{day.surplus}</td></tr>)}</tbody></table></details>
        </section>}
        <section className="insights-recommendations"><div><h2>Pertimbangan produksi berikutnya</h2><p>Target {date || '—'} · Menggunakan catatan sebelum tanggal ini, maksimal 180 hari.</p></div>
          {!data.menus.length ? <OwnerEmptyState title="Belum ada menu aktif" action={<Link href="/owner/menu/">Kelola menu →</Link>}>Tambahkan menu dan catat produksi harian untuk memulai.</OwnerEmptyState> : data.menus.map(menu => <article className="insights-panel" key={menu.menuId}>
            <div className="insights-menu-title"><h3>{menu.name}</h3><span>{menu.records.length} catatan tersedia</span></div>
            {menu.recommendation ? <><p className="insights-quantity">{number(menu.recommendation.recommendedQuantity)} <span>porsi disarankan</span></p><p>{menu.recommendation.insight}</p><small className="insights-meta">{menu.recommendation.modelVersion} · Diperbarui {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(menu.recommendation.generatedAt))} WIB</small></> : <><p>{menu.records.length < 35 ? `Butuh minimal 35 catatan harian valid. Saat ini tersedia ${menu.records.length}.` : 'Belum ada hasil batch untuk tanggal ini. Catatan akan diperiksa saat proses rekomendasi dijalankan.'}</p><Link href="/owner/menu/">Catat produksi →</Link></>}
          </article>)}
        </section>
        <p className="insights-footnote">Saran memperkirakan penjualan reguler teramati, yang dapat dibatasi stok. Pesanan surplus tidak dihitung sebagai permintaan reguler. Keputusan jumlah masak tetap di tanganmu.</p>
      </>}
    </div>
  </MenuShell>
}
