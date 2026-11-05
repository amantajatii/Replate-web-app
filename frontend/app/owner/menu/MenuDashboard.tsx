'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import CustomerIcon from '../../customer/CustomerIcon'
import {
  mediaUrl,
  ownerRequest,
  ownerToken,
  type Menu,
  type Production,
  type Restaurant,
} from '../../../lib/menu-api'
import MenuShell from './MenuShell'
import OwnerChoiceGroup from '../OwnerChoiceGroup'
import OwnerEmptyState from '../OwnerEmptyState'

function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
const emptyRecord = {
  producedQuantity: 0,
  soldQuantity: 0,
  surplusQuantity: 0,
}

export default function MenuDashboard({ home = false }: { home?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [token, setToken] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menus, setMenus] = useState<Menu[]>([])
  const [production, setProduction] = useState<Production[]>([])
  const [date, setDate] = useState(today)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Semua')
  const [refresh, setRefresh] = useState(0)
  const [editing, setEditing] = useState<Menu | null>(null)
  const [quantities, setQuantities] = useState(emptyRecord)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const value = ownerToken()
    Promise.resolve().then(() => {
      setToken(value)
      setLoading(Boolean(value))
      setError('')
    })
    if (!value) return
    ownerRequest<Restaurant[]>('/api/owner/restaurants', value)
      .then(async (restaurants) => {
        const first = restaurants[0] ?? null
        setRestaurant(first)
        if (!first) {
          setMenus([])
          setProduction([])
          return
        }
        const [items, records] = await Promise.all([
          ownerRequest<Menu[]>(
            `/api/owner/restaurants/${first.restaurantId}/menus`,
            value,
          ),
          ownerRequest<Production[]>(
            `/api/owner/restaurants/${first.restaurantId}/production?date=${date}`,
            value,
          ),
        ])
        setMenus(items)
        setProduction(records)
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Gagal memuat data.'),
      )
      .finally(() => setLoading(false))
  }, [date, refresh])

  useEffect(() => {
    if (editing) dialog.current?.showModal()
  }, [editing])

  const categories = useMemo(
    () => ['Semua', ...new Set(menus.map((menu) => menu.category))],
    [menus],
  )
  const visible = menus.filter(
    (menu) =>
      (category === 'Semua' || menu.category === category) &&
      `${menu.name} ${menu.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  const totals = production.reduce(
    (sum, record) => ({
      produced: sum.produced + record.producedQuantity,
      sold: sum.sold + record.soldQuantity,
      surplus: sum.surplus + record.surplusQuantity,
    }),
    { produced: 0, sold: 0, surplus: 0 },
  )

  function editProduction(menu: Menu) {
    const record = production.find((item) => item.menuId === menu.menuId)
    setQuantities(
      record
        ? {
            producedQuantity: record.producedQuantity,
            soldQuantity: record.soldQuantity,
            surplusQuantity: record.surplusQuantity,
          }
        : emptyRecord,
    )
    setEditing(menu)
    setError('')
    setMessage('')
  }

  async function saveProduction(event: FormEvent) {
    event.preventDefault()
    if (!editing || !token) return
    if (
      quantities.soldQuantity + quantities.surplusQuantity !==
      quantities.producedQuantity
    ) {
      setError('Terjual + surplus harus sama dengan jumlah diproduksi.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await ownerRequest(
        `/api/owner/menus/${editing.menuId}/production/${date}`,
        token,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(quantities),
        },
      )
      dialog.current?.close()
      setEditing(null)
      setMessage('Catatan produksi tersimpan.')
      setRefresh((count) => count + 1)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Gagal menyimpan produksi.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <MenuShell restaurant={restaurant?.name ?? ''} active={home ? 'dashboard' : 'menu'}>
      <header className="menu-header">
        <div>
          <h1>{home ? 'Ringkasan restoran' : 'Menu & produksi'}</h1>
          <p>
            Pantau riwayat batch harian, volume penjualan, dan estimasi surplus
            makanan.
          </p>
        </div>
        <Link className="menu-primary" href="/owner/menu/new/">
          <CustomerIcon name="plus" />Tambah menu
        </Link>
      </header>
      {loading ? (
        <p className="menu-notice">Memuat menu...</p>
      ) : !token ? (
        <OwnerEmptyState title="Masuk sebagai pemilik restoran" action={<Link href="/login/">Masuk</Link>} />
      ) : error && !restaurant ? (
        <OwnerEmptyState title="Data restoran belum dapat dimuat" action={<button className="menu-secondary" type="button" onClick={() => setRefresh((count) => count + 1)}>Coba lagi</button>}><span role="alert">{error}</span></OwnerEmptyState>
      ) : !restaurant ? (
        <OwnerEmptyState title="Restoranmu belum diatur" action={<Link className="menu-primary" href="/owner/settings/">Buat profil restoran</Link>}>Buat profil restoran untuk mulai menambahkan menu, mencatat produksi, dan menawarkan makanan surplus. Menu serta riwayat produksi akan muncul setelah kamu mengisinya.</OwnerEmptyState>
      ) : (
        <>
          {error && !editing && (
            <p className="menu-notice error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="menu-notice success" role="status">
              {message}
            </p>
          )}
          <div className="menu-stats">
            <div>
              <small>TOTAL MENU AKTIF</small>
              <strong>
                {menus.filter((menu) => menu.isActive).length} Menu
              </strong>
              <span>{categories.length - 1} kategori aktif terdaftar</span>
            </div>
            <div>
              <small>TOTAL DIPRODUKSI</small>
              <strong>{totals.produced} Porsi</strong>
              <span>Sesi produksi terpilih</span>
            </div>
            <div>
              <small>TERJUAL REGULER</small>
              <strong>{totals.sold} Porsi</strong>
              <span>
                {totals.produced
                  ? Math.round((totals.sold / totals.produced) * 100)
                  : 0}
                % terserap reguler
              </span>
            </div>
            <div>
              <small>SURPLUS / TERSEDIA</small>
              <strong>{totals.surplus} Porsi</strong>
              <span>
                {production.filter((item) => item.surplusQuantity > 0).length}{' '}
                menu dengan surplus
              </span>
            </div>
          </div>
          <div className="menu-toolbar">
            <input
              aria-label="Cari menu"
              placeholder="Cari menu atau kategori…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <OwnerChoiceGroup label="Filtrasi kategori menu" className="menu-filters" value={category} onChange={setCategory} options={categories.map((item) => ({ value: item, label: item }))} />
            <input
              aria-label="Tanggal produksi"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <button
              type="button"
              aria-label="Muat ulang"
              onClick={() => setRefresh((count) => count + 1)}
            >
              <CustomerIcon name="refresh" />
            </button>
          </div>
          <section className="menu-panel">
            <div className="menu-panel-title">
              <h2>
                Katalog Menu & Riwayat Produksi Harian{' '}
                <span>{visible.length} Menu</span>
              </h2>
              <small>●　Data catatan diperbarui setelah disimpan</small>
            </div>
            <div className="menu-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>FOTO & MENU</th>
                    <th>KATEGORI</th>
                    <th>DIPRODUKSI</th>
                    <th>TERJUAL</th>
                    <th>SURPLUS</th>
                    <th>STATUS</th>
                    <th>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((menu) => {
                    const record = production.find(
                      (item) => item.menuId === menu.menuId,
                    )
                    return (
                      <tr key={menu.menuId}>
                        <td>
                          <div className="menu-name">
                            {menu.photos[0] ? (
                              <Image
                                unoptimized
                                src={mediaUrl(menu.photos[0])}
                                width={42}
                                height={42}
                                alt=""
                              />
                            ) : (
                              <span className="menu-photo-empty"><CustomerIcon name="store" /></span>
                            )}
                            <div>
                              <strong>{menu.name}</strong>
                              <small>{menu.description}</small>
                              <small>
                                Harga: Rp
                                {menu.normalPrice.toLocaleString('id-ID')}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="menu-chip">{menu.category}</span>
                        </td>
                        <td>
                          <strong>{record?.producedQuantity ?? 0}</strong> porsi
                        </td>
                        <td>
                          <strong>{record?.soldQuantity ?? 0}</strong> porsi
                        </td>
                        <td>
                          <span className="menu-surplus">
                            {record?.surplusQuantity ?? 0} porsi
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              menu.isActive
                                ? 'menu-status'
                                : 'menu-status muted'
                            }
                          >
                            ●　{menu.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td>
                          <div className="menu-row-actions">
                            <Link
                              href={`/owner/menu/new/?edit=${menu.menuId}`}
                              aria-label={`Edit ${menu.name}`}
                            >
                              <CustomerIcon name="edit" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => editProduction(menu)}
                            >
                              Catat Produksi
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {visible.length === 0 && (
                <p className="menu-empty">
                  Belum ada menu yang sesuai.{' '}
                  <Link href="/owner/menu/new/">Tambah menu pertama</Link>
                </p>
              )}
            </div>
            <footer>Catatan produksi disimpan per menu dan tanggal.</footer>
          </section>
        </>
      )}
      <dialog ref={dialog} className="menu-dialog" aria-labelledby="production-dialog-title" onClose={() => setEditing(null)} onCancel={(event) => { if (busy) event.preventDefault() }}>
        {editing && <form onSubmit={saveProduction}>
            <h2 id="production-dialog-title">Catat produksi</h2>
            <p>
              {editing.name} · {date}
            </p>
            <label>
              Jumlah Diproduksi
              <input
                required
                type="number"
                min="0"
                step="1"
                value={quantities.producedQuantity}
                onChange={(event) =>
                  setQuantities({
                    ...quantities,
                    producedQuantity: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Terjual Reguler
              <input
                required
                type="number"
                min="0"
                step="1"
                value={quantities.soldQuantity}
                onChange={(event) =>
                  setQuantities({
                    ...quantities,
                    soldQuantity: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Surplus
              <input
                required
                type="number"
                min="0"
                step="1"
                value={quantities.surplusQuantity}
                onChange={(event) =>
                  setQuantities({
                    ...quantities,
                    surplusQuantity: Number(event.target.value),
                  })
                }
              />
            </label>
            {error && (
              <p className="menu-notice error" role="alert">
                {error}
              </p>
            )}
            <div className="menu-dialog-actions">
              <button type="button" disabled={busy} onClick={() => dialog.current?.close()}>
                Batal
              </button>
              <button type="submit" disabled={busy}>
                Simpan Produksi
              </button>
            </div>
          </form>}
      </dialog>
    </MenuShell>
  )
}
