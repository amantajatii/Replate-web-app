'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  mediaUrl,
  ownerRequest,
  ownerToken,
  type Menu,
  type Production,
  type Restaurant,
} from '../../../lib/menu-api'
import type { SurplusListing, SurplusListingInput } from '../../../lib/listing-api'
import MenuShell from '../menu/MenuShell'

const currency = (value: number) => `Rp ${Math.round(value).toLocaleString('id-ID')}`
function localDate(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}
function dateForInput(value: string) {
  const date = new Date(value)
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}
function timeForInput(value: string) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta' }).format(new Date(value))
}
function isoLocal(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString()
}

type ListingFormValues = {
  rescuePrice: number
  initialQuantity: number
  pickupStart: string
  pickupEnd: string
  pickupInstructions: string | null
  status: 'Active' | 'Draft'
}

export default function ListingForm() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menus, setMenus] = useState<Menu[]>([])
  const [productions, setProductions] = useState<Production[]>([])
  const [listings, setListings] = useState<SurplusListing[]>([])
  const [editId, setEditId] = useState<number | null>(null)
  const [productionId, setProductionId] = useState<number | null>(null)
  const [rescuePrice, setRescuePrice] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [pickupDate, setPickupDate] = useState(localDate(new Date().getHours() >= 17 ? 1 : 0))
  const [pickupStart, setPickupStart] = useState('17:00')
  const [pickupEnd, setPickupEnd] = useState('19:00')
  const [instructions, setInstructions] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const value = ownerToken()
      if (!value) {
        router.replace('/login/')
        setLoading(false)
        return
      }
      setToken(value)
      const edit = Number(new URLSearchParams(window.location.search).get('edit'))
      const validEdit = Number.isSafeInteger(edit) && edit > 0 ? edit : null
      setEditId(validEdit)
      try {
        const restaurants = await ownerRequest<Restaurant[]>('/api/owner/restaurants', value)
        const first = restaurants[0] ?? null
        if (cancelled) return
        setRestaurant(first)
        if (!first) return
        const current = validEdit
          ? await ownerRequest<SurplusListing>(`/api/owner/listings/${validEdit}`, value)
          : null
        const day = current?.productionDate ?? localDate()
        const [menuData, productionData, listingData] = await Promise.all([
          ownerRequest<Menu[]>(`/api/owner/restaurants/${first.restaurantId}/menus`, value),
          ownerRequest<Production[]>(`/api/owner/restaurants/${first.restaurantId}/production?date=${day}`, value),
          ownerRequest<SurplusListing[]>(`/api/owner/restaurants/${first.restaurantId}/listings`, value),
        ])
        if (cancelled) return
        setMenus(menuData.filter((menu) => menu.isActive))
        setProductions(productionData)
        setListings(listingData)
        if (current) {
          setProductionId(current.productionRecordId)
          setRescuePrice(String(current.rescuePrice))
          setQuantity(current.initialQuantity)
          setPickupDate(dateForInput(current.pickupStart))
          setPickupStart(timeForInput(current.pickupStart))
          setPickupEnd(timeForInput(current.pickupEnd))
          setInstructions(current.pickupInstructions ?? '')
        } else {
          const firstRecord = productionData.find((record) => record.surplusQuantity > 0)
          if (firstRecord) {
            setProductionId(firstRecord.productionRecordId)
            setQuantity(firstRecord.surplusQuantity)
            const menu = menuData.find((item) => item.menuId === firstRecord.menuId)
            if (menu) setRescuePrice(String(Math.round(menu.normalPrice * 0.43)))
          }
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Data listing belum dapat dimuat.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [router])

  const production = productions.find((record) => record.productionRecordId === productionId) ?? null
  const menu = menus.find((item) => item.menuId === production?.menuId) ?? null
  const currentListing = listings.find((item) => item.surplusListingId === editId)
  const sold = currentListing ? currentListing.initialQuantity - currentListing.availableQuantity : 0
  const reservedElsewhere = production ? listings.filter((item) => item.productionRecordId === production.productionRecordId && item.surplusListingId !== editId).reduce((sum, item) => sum + (item.status === 'Active' ? item.initialQuantity : item.initialQuantity - item.availableQuantity), 0) : 0
  const maxQuantity = production ? Math.max(0, production.surplusQuantity - reservedElsewhere) : 0
  const discount = menu && menu.normalPrice > 0 && Number(rescuePrice) > 0 ? Math.max(0, Math.round((1 - Number(rescuePrice) / menu.normalPrice) * 100)) : 0
  const image = menu?.photos[0] ? mediaUrl(menu.photos[0]) : '/menu/veggie.jpg'
  const availableMenus = useMemo(() => menus.filter((item) => productions.some((record) => record.menuId === item.menuId && (record.surplusQuantity > 0 || record.productionRecordId === productionId))), [menus, productions, productionId])

  function selectProduction(value: string) {
    const next = Number(value)
    setProductionId(Number.isSafeInteger(next) ? next : null)
    const record = productions.find((item) => item.productionRecordId === next)
    const selectedMenu = menus.find((item) => item.menuId === record?.menuId)
    if (selectedMenu) {
      setRescuePrice(String(Math.round(selectedMenu.normalPrice * 0.43)))
      setQuantity(Math.max(1, record?.surplusQuantity ?? 1))
    }
  }

  async function save(status: 'Draft' | 'Active', form: HTMLFormElement, now = new Date()) {
    if (!token || !restaurant || !production) {
      setError('Pilih menu yang memiliki catatan produksi dan surplus hari ini.')
      return
    }
    if (!form.reportValidity()) return
    const price = Number(rescuePrice)
    if (!Number.isFinite(price) || price <= 0 || price >= (menu?.normalPrice ?? 0)) {
      setError('Harga surplus harus lebih kecil dari harga normal menu.')
      return
    }
    if (new Date(`${pickupDate}T${pickupStart}:00`).getTime() <= now.getTime() || new Date(`${pickupDate}T${pickupEnd}:00`).getTime() <= new Date(`${pickupDate}T${pickupStart}:00`).getTime()) {
      setError('Jendela pickup harus dimulai di masa depan dan berakhir setelah waktu mulai.')
      return
    }
    if (quantity < sold || quantity > maxQuantity) {
      setError(`Jumlah harus di antara ${sold} dan ${maxQuantity} porsi berdasarkan stok produksi.`)
      return
    }
    const payload: SurplusListingInput = {
      productionRecordId: production.productionRecordId,
      rescuePrice: price,
      initialQuantity: quantity,
      pickupStart: isoLocal(pickupDate, pickupStart),
      pickupEnd: isoLocal(pickupDate, pickupEnd),
      pickupInstructions: instructions.trim(),
      status,
    }
    setSaving(true)
    setError('')
    try {
      await ownerRequest<ListingFormValues>(editId ? `/api/owner/listings/${editId}` : `/api/owner/restaurants/${restaurant.restaurantId}/listings`, token, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      router.push('/owner/listings/')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Listing belum dapat disimpan.')
    } finally {
      setSaving(false)
    }
  }

  function submit(status: 'Active' | 'Draft') {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const form = event.currentTarget
      void save(status, form)
    }
  }

  return (
    <MenuShell restaurant={restaurant?.name ?? 'Restoran Baru'} active="listing">
      <header className="listing-form-topbar">
        <div>
          <div className="listing-breadcrumb"><Link href="/owner/">{restaurant?.name ?? 'Partner Portal'}</Link><Image src="/listing/crumb.svg" alt="" width={4} height={7} /><Link href="/owner/listings/">Listing Surplus</Link><Image src="/listing/crumb.svg" alt="" width={4} height={7} /><strong>{editId ? 'Ubah Listing' : 'Buat Listing Baru'}</strong></div>
        </div>
        <div className="listing-form-top-actions">
          <button type="button" form="surplus-listing-form" disabled={saving} onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) void save('Draft', form) }}><Image src="/listing/draft.svg" alt="" width={10} height={14} />Simpan Draft</button>
          <button className="primary" type="submit" form="surplus-listing-form" disabled={saving}><Image src="/listing/publish.svg" alt="" width={14} height={14} />{saving ? 'Menyimpan…' : editId ? 'Simpan Perubahan' : 'Publikasikan Listing'}</button>
        </div>
      </header>
      <div className="listing-form-page">
        <div className="listing-form-heading"><h1>{editId ? 'Ubah Listing Surplus' : 'Buat Surplus Listing Baru'}</h1><p>Publikasikan surplus makanan berlebih dari dapur Anda dengan harga terjangkau untuk pelanggan sekitar.</p></div>
        {loading ? <div className="listing-state">Memuat menu dan catatan produksi…</div> : !restaurant ? <div className="listing-state"><h2>Profil restoran belum tersedia</h2><p>Buat profil restoran sebelum membuat listing.</p><Link href="/owner/settings/">Atur Profil Restoran →</Link></div> : (
          <div className="listing-form-grid">
            <form id="surplus-listing-form" className="listing-form-column" onSubmit={submit('Active')}>
              <section className="listing-card menu-select-card">
                <div className="listing-section-heading"><div><span>1</span><h2>Pilihan Menu Terdaftar</h2></div><small>Pilih dari katalog dapur aktif</small></div>
                <label className="listing-select-wrap"><span className="sr-only">Menu dan catatan produksi</span><select value={productionId ?? ''} onChange={(event) => selectProduction(event.target.value)} required disabled={!!editId}>
                  <option value="">Pilih menu dengan catatan produksi</option>
                  {availableMenus.map((item) => productions.filter((record) => record.menuId === item.menuId && (record.surplusQuantity > 0 || record.productionRecordId === productionId)).map((record) => <option key={record.productionRecordId} value={record.productionRecordId}>{item.name}, {item.category} · {record.surplusQuantity} porsi tersedia</option>))}
                </select><Image src="/listing/chevron.svg" alt="" width={12} height={8} /></label>
                {menu ? <div className="listing-menu-summary">
                  <div className="listing-menu-image"><Image src={image} alt={menu.name} fill sizes="80px" unoptimized /></div>
                  <div><div className="listing-summary-meta"><span>{menu.category}</span><small>Katalog {restaurant.name}</small></div><strong>{menu.name}</strong><p>{menu.description}</p></div>
                </div> : <p className="listing-inline-empty">Belum ada menu dengan catatan produksi dan jumlah surplus. <Link href="/owner/menu/">Tambah menu atau catatan produksi →</Link></p>}
              </section>

              <section className="listing-card">
                <div className="listing-section-heading"><div><span>2</span><h2>Penentuan Harga &amp; Diskon Otomatis</h2></div></div>
                <div className="listing-price-grid"><label><span>Harga Normal Reguler</span><output>{currency(menu?.normalPrice ?? 0)}</output></label><label><span>Harga Surplus (Rp) <b>Diskon {discount}%</b></span><div className="listing-price-input"><span>Rp</span><input type="number" min="1" max={Math.max(1, (menu?.normalPrice ?? 1) - 1)} step="1" value={rescuePrice} onChange={(event) => setRescuePrice(event.target.value)} required aria-label="Harga surplus" /></div></label></div>
                <div className="listing-recommendation"><Image src="/listing/discount.svg" alt="" width={22} height={22} /><span><strong>Menentukan harga surplus:</strong> Pertimbangkan harga reguler, kondisi menu, dan sisa waktu pickup sebelum memilih diskon.</span></div>
              </section>

              <section className="listing-card">
                <div className="listing-section-heading"><div><span>3</span><h2>Jumlah Porsi Surplus</h2></div><small>Tersedia untuk diselamatkan</small></div>
                <div className="listing-quantity-control"><div><strong>Porsi Makanan Siap Ambil</strong><small>Dapur menjaga kualitas makanan standar resto</small></div><div className="listing-stepper"><button type="button" aria-label="Kurangi porsi" disabled={quantity <= Math.max(1, sold)} onClick={() => setQuantity((value) => Math.max(Math.max(1, sold), value - 1))}><Image src="/listing/minus.svg" alt="" width={14} height={2} /></button><input aria-label="Jumlah porsi surplus" type="number" min={Math.max(1, sold)} max={maxQuantity} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /><button type="button" aria-label="Tambah porsi" disabled={quantity >= maxQuantity} onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}><Image src="/listing/plus.svg" alt="" width={14} height={14} /></button></div></div>
                <div className="listing-production-note"><Image src="/listing/sync.svg" alt="" width={14} height={14} /><span>Berdasarkan Catatan Produksi {production?.productionDate ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${production.productionDate}T00:00:00`)) : 'hari ini'}, terdapat estimasi <strong>{Math.max(0, maxQuantity)} porsi</strong> surplus yang bisa diselamatkan.</span></div>
              </section>

              <section className="listing-card">
                <div className="listing-section-heading"><div><span>4</span><h2>Jadwal Pengambilan (Pickup Window)</h2></div></div>
                <div className="listing-pickup-grid"><label><span>Tanggal Pengambilan</span><span className="listing-date-input"><Image src="/listing/calendar.svg" alt="" width={14} height={14} /><input type="date" min={localDate()} value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} required disabled={sold > 0} /></span></label><label><span>Waktu Mulai</span><input type="time" value={pickupStart} onChange={(event) => setPickupStart(event.target.value)} required disabled={sold > 0} /></label><label><span>Waktu Selesai</span><input type="time" value={pickupEnd} onChange={(event) => setPickupEnd(event.target.value)} required disabled={sold > 0} /></label></div>
                {sold > 0 && <small className="listing-field-help">Jadwal dikunci karena {sold} porsi sudah dipesan.</small>}
              </section>

              <section className="listing-card">
                <div className="listing-section-heading"><div><span>5</span><h2>Catatan Tambahan &amp; Instruksi Dapur</h2></div><small>Opsional</small></div>
                <textarea maxLength={250} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Bawa wadah atau tas kain sendiri untuk mendukung gerakan zero waste!" aria-label="Catatan dan instruksi dapur" />
                <div className="listing-note-footer"><span><Image src="/listing/instructions.svg" alt="" width={9} height={12} />Tampak pada detail pesanan dan tiket pickup pelanggan</span><small>{instructions.length} / 250</small></div>
              </section>
              {error && <p className="listing-alert" role="alert">{error}</p>}
              <div className="listing-form-bottom"><button type="button" disabled={saving} onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) void save('Draft', form) }}><Image src="/listing/draft.svg" alt="" width={10} height={14} />Simpan Draft</button><button type="submit" disabled={saving}><Image src="/listing/publish.svg" alt="" width={14} height={14} />{saving ? 'Menyimpan…' : 'Publikasikan Listing'}</button></div>
            </form>

            <aside className="listing-preview-column" aria-label="Pratinjau listing untuk customer">
              <div className="listing-live-label"><span>● LIVE PREVIEW REAL-TIME</span><small>Sinkronisasi Otomatis</small></div>
              <div className="listing-preview-heading"><h2>Tampilan di Aplikasi Customer</h2><p>Simulasi kartu makanan marketplace yang langsung dilihat pembeli.</p></div>
              <article className="customer-food-card">
                <div className="customer-food-photo"><Image src={image} alt={menu?.name ?? 'Pratinjau menu'} fill sizes="370px" unoptimized /><button type="button" aria-label="Simpan ke favorit"><Image src="/listing/favorite.svg" alt="" width={16} height={16} /></button><span className="customer-discount">Hemat {discount}%</span><div className="customer-photo-ribbon"><span><Image src="/listing/pickup.svg" alt="" width={12} height={12} />Pickup {pickupStart}–{pickupEnd} WIB</span><b>Sisa {Math.max(0, quantity - sold)} porsi</b></div></div>
                <div className="customer-food-content"><div className="customer-partner"><span>● {restaurant?.name ?? 'Nama Restoran'}</span><span>Partner Restoran</span></div><h3>{menu?.name ?? 'Nama Menu Surplus'}</h3><p>{instructions || menu?.description || 'Deskripsi menu akan tampil di sini.'}</p><div className="customer-tags"><span>{menu?.category ?? 'Kategori'}</span>{menu?.dietTags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div><div className="customer-price"><div><small>{currency(menu?.normalPrice ?? 0)}</small><strong>{currency(Number(rescuePrice) || 0)}</strong></div><button type="button" disabled>＋ Keranjang</button></div></div>
              </article>
              <section className="listing-impact-card"><h3><Image src="/listing/badge.svg" alt="" width={16} height={16} />Simulasi Dampak Penyelamatan</h3><div><article><small>Limbah dicegah</small><strong>~{(Math.max(0, quantity - sold) * 0.55).toFixed(2)} kg</strong><span>estimasi makanan terselamatkan</span></article><article><small>Potensi pemulihan</small><strong>{currency((Number(rescuePrice) || 0) * Math.max(0, quantity - sold))}</strong><span>pendapatan kembali ke kasir</span></article></div><p>Jika {Math.max(0, quantity - sold)} porsi ini terselamatkan, potensi pendapatan hingga {currency((Number(rescuePrice) || 0) * Math.max(0, quantity - sold))}.</p></section>
              <section className="listing-quality-card"><Image src="/listing/kitchen.svg" alt="" width={16} height={16} /><div><strong>Garansi Kualitas Replate</strong><p>Listing surplus akan otomatis ditutup saat stok habis atau waktu pickup berakhir.</p></div></section>
            </aside>
          </div>
        )}
      </div>
    </MenuShell>
  )
}
