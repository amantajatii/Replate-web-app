'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  mediaUrl,
  ownerRequest,
  ownerToken,
  type Menu,
  type MenuInput,
  type Restaurant,
} from '../../../../lib/menu-api'
import MenuShell from '../MenuShell'
import CustomerIcon from '../../../customer/CustomerIcon'

const initial: MenuInput = {
  name: '',
  description: '',
  category: 'Salad & Healthy Bowl',
  normalPrice: 0,
  allergens: [],
  dietTags: [],
  allergenNote: null,
  isActive: true,
  photos: [],
}
const samples = [
  ['Veggie Bowl', '/menu/veggie.jpg'],
  ['Ayam Panggang', '/menu/chicken.jpg'],
  ['Croissant Box', '/menu/pastry.jpg'],
  ['Cold Brew', '/menu/coffee.jpg'],
] as const
const allergenOptions = [
  'Kacang / Nuts',
  'Gluten / Gandum',
  'Dairy / Susu',
  'Telur',
  'Kedelai / Soy',
]
const dietOptions = ['Vegetarian', 'Vegan', 'Halal']

export default function MenuForm() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menuId, setMenuId] = useState<number | null>(null)
  const [form, setForm] = useState<MenuInput>(initial)
  const [gallery, setGallery] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const value = ownerToken()
    Promise.resolve().then(() => {
      setToken(value)
      if (!value) setLoading(false)
    })
    if (!value) return
    const edit = Number(new URLSearchParams(window.location.search).get('edit'))
    Promise.all([
      ownerRequest<Restaurant[]>('/api/owner/restaurants', value),
      ownerRequest<string[]>('/api/owner/menu-media', value),
    ])
      .then(async ([restaurants, photos]) => {
        const first = restaurants[0] ?? null
        setRestaurant(first)
        setGallery(photos)
        if (first && Number.isSafeInteger(edit) && edit > 0) {
          const menus = await ownerRequest<Menu[]>(
            `/api/owner/restaurants/${first.restaurantId}/menus`,
            value,
          )
          const found = menus.find((menu) => menu.menuId === edit)
          if (!found) throw new Error('Menu tidak ditemukan.')
          setMenuId(found.menuId)
          setForm({
            name: found.name,
            description: found.description,
            category: found.category,
            normalPrice: found.normalPrice,
            allergens: found.allergens,
            dietTags: found.dietTags,
            allergenNote: found.allergenNote,
            isActive: found.isActive,
            photos: found.photos,
          })
        }
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Gagal memuat data.'),
      )
      .finally(() => setLoading(false))
  }, [])

  function change<K extends keyof MenuInput>(key: K, value: MenuInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setError('')
  }
  function toggle(key: 'allergens' | 'dietTags', value: string) {
    change(
      key,
      form[key].includes(value)
        ? form[key].filter((item) => item !== value)
        : [...form[key], value],
    )
  }

  async function uploadBlob(blob: Blob) {
    if (!token) return
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) ||
      blob.size > 5 * 1024 * 1024
    )
      throw new Error('Gunakan JPG, PNG, atau WebP maksimal 5 MB.')
    const result = await ownerRequest<{ url: string }>(
      '/api/owner/menu-media',
      token,
      { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob },
    )
    setGallery((current) => [
      result.url,
      ...current.filter((url) => url !== result.url),
    ])
    setForm((current) => ({
      ...current,
      photos: [
        result.url,
        ...current.photos.filter((url) => url !== result.url),
      ].slice(0, 8),
    }))
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError('')
    try {
      await uploadBlob(file)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Gagal mengunggah foto.',
      )
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  async function chooseSample(url: string) {
    setBusy(true)
    setError('')
    try {
      const blob = await (await fetch(url)).blob()
      await uploadBlob(blob)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memilih foto.')
    } finally {
      setBusy(false)
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!token || !restaurant) return
    if (form.photos.length === 0) {
      setError('Pilih setidaknya satu foto menu.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await ownerRequest(
        menuId
          ? `/api/owner/menus/${menuId}`
          : `/api/owner/restaurants/${restaurant.restaurantId}/menus`,
        token,
        {
          method: menuId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      )
      router.push('/owner/menu/')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan menu.')
    } finally {
      setBusy(false)
    }
  }

  const preview = form.photos[0] ? mediaUrl(form.photos[0]) : '/menu/veggie.jpg'
  return (
    <MenuShell restaurant={restaurant?.name ?? ''}>
      <form className="menu-form-page" onSubmit={save}>
        <div className="menu-form-top">
          <Link href="/owner/menu/"><CustomerIcon name="back" />Kembali</Link>
          <small>
            Menu & Produksi　/　{menuId ? 'Edit Menu' : 'Tambah Menu Baru'}
          </small>
          <div>
            <Link href="/owner/menu/">Batal</Link>
            <button type="submit" disabled={busy || loading || !restaurant}>
              <CustomerIcon name="check" />Simpan menu
            </button>
          </div>
        </div>
        <header className="menu-form-heading">
          <h1>{menuId ? 'Edit Menu' : 'Tambah Menu Baru'}</h1>
          <p>
            Daftarkan resep atau item makanan reguler Anda untuk pencatatan
            batch dapur dan persiapan listing surplus Replate.
          </p>
        </header>
        {loading ? (
          <p className="menu-notice">Memuat data...</p>
        ) : !token ? (
          <p className="menu-notice">
            Masuk sebagai pemilik restoran. <Link href="/login/">Masuk</Link>
          </p>
        ) : !restaurant ? (
          <p className="menu-notice">
            Buat profil restoran dahulu.{' '}
            <Link href="/owner/settings/">Buat profil</Link>
          </p>
        ) : (
          <>
            {error && (
              <p className="menu-notice error" role="alert">
                {error}
              </p>
            )}
            <div className="menu-form-grid">
              <div className="menu-form-stack">
                <section className="menu-panel menu-form-card">
                  <h2>
                    Foto Menu Autentik <span>Wajib</span>
                  </h2>
                  <p>
                    Gunakan foto makanan nyata tanpa filter berlebihan untuk
                    membangun kepercayaan pelanggan.
                  </p>
                  <div className="menu-upload">
                    <div className="menu-photo-preview">
                      <Image
                        unoptimized
                        src={preview}
                        alt="Pratinjau foto menu"
                        width={350}
                        height={210}
                      />
                    </div>
                    <label className="menu-upload-action">
                      <CustomerIcon name="plus" />Unggah foto
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={upload}
                      />
                    </label>
                  </div>
                  <small>Atau pilih dari galeri dapur tersimpan:</small>
                  <div className="menu-gallery">
                    {gallery.map((url) => (
                      <button
                        type="button"
                        key={url}
                        onClick={() =>
                          change(
                            'photos',
                            [
                              url,
                              ...form.photos.filter((item) => item !== url),
                            ].slice(0, 8),
                          )
                        }
                      >
                        <Image
                          unoptimized
                          src={mediaUrl(url)}
                          alt="Foto tersimpan"
                          width={68}
                          height={55}
                        />
                      </button>
                    ))}
                    {samples.map(([name, url]) => (
                      <button
                        type="button"
                        key={url}
                        onClick={() => chooseSample(url)}
                        disabled={busy}
                      >
                        <Image
                          unoptimized
                          src={url}
                          alt={name}
                          width={68}
                          height={55}
                        />
                        <small>{name}</small>
                      </button>
                    ))}
                  </div>
                  <small>
                    Foto utama: {form.photos[0] ? 'tersimpan' : 'belum dipilih'}{' '}
                    · Maksimal 8 foto, 5 MB per foto.
                  </small>
                  {form.photos.length > 0 && (
                    <button
                      className="menu-text-button"
                      type="button"
                      onClick={() => change('photos', form.photos.slice(1))}
                    >
                      Hapus foto utama
                    </button>
                  )}
                </section>
                <section className="menu-panel menu-form-card">
                  <h2>Informasi Utama Menu</h2>
                  <div className="menu-form-fields">
                    <label>
                      NAMA MENU <b>*</b>
                      <input
                        required
                        minLength={2}
                        maxLength={150}
                        value={form.name}
                        onChange={(event) => change('name', event.target.value)}
                        placeholder="Veggie Bowl Sehat & Segar"
                      />
                    </label>
                    <div className="menu-two">
                      <label>
                        KATEGORI MENU <b>*</b>
                        <select
                          value={form.category}
                          onChange={(event) =>
                            change('category', event.target.value)
                          }
                        >
                          {[
                            'Salad & Healthy Bowl',
                            'Pasta',
                            'Sup',
                            'Nasi & Lauk',
                            'Roti & Pastry',
                            'Minuman',
                            'Lainnya',
                          ].map((item) => (
                            <option key={item}>{item}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        HARGA NORMAL REGULER <b>*</b>
                        <input
                          required
                          type="number"
                          min="0"
                          max="1000000000"
                          step="1"
                          value={form.normalPrice || ''}
                          onChange={(event) =>
                            change('normalPrice', Number(event.target.value))
                          }
                          placeholder="Rp 35000"
                        />
                      </label>
                    </div>
                    <label>
                      DESKRIPSI MENU <b>*</b>
                      <textarea
                        required
                        minLength={2}
                        maxLength={1000}
                        rows={4}
                        value={form.description}
                        onChange={(event) =>
                          change('description', event.target.value)
                        }
                        placeholder="Jelaskan bahan dan rasa menu..."
                      />
                    </label>
                  </div>
                </section>
                <section className="menu-panel menu-form-card">
                  <h2>Informasi Alergen & Karakteristik Diet</h2>
                  <p>
                    Penting bagi pelanggan yang memiliki intoleransi makanan
                    atau pola makan khusus.
                  </p>
                  <div className="menu-check-grid">
                    {allergenOptions.map((item) => (
                      <label key={item}>
                        <input
                          type="checkbox"
                          checked={form.allergens.includes(item)}
                          onChange={() => toggle('allergens', item)}
                        />{' '}
                        {item}
                      </label>
                    ))}
                    {dietOptions.map((item) => (
                      <label key={item}>
                        <input
                          type="checkbox"
                          checked={form.dietTags.includes(item)}
                          onChange={() => toggle('dietTags', item)}
                        />{' '}
                        {item}
                      </label>
                    ))}
                  </div>
                  <label>
                    Catatan alergen spesifik lainnya
                    <input
                      maxLength={500}
                      value={form.allergenNote ?? ''}
                      onChange={(event) =>
                        change('allergenNote', event.target.value || null)
                      }
                      placeholder="Contoh: Mengandung biji wijen"
                    />
                  </label>
                </section>
                <section className="menu-panel menu-form-card menu-status-card">
                  <div>
                    <h2>Status Menu Dapur</h2>
                    <p>
                      Jika aktif, menu ini tersedia di pendataan batch produksi.
                    </p>
                  </div>
                  <label className="menu-switch">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) =>
                        change('isActive', event.target.checked)
                      }
                    />{' '}
                    {form.isActive ? 'Aktif' : 'Nonaktif'}
                  </label>
                </section>
                <div className="menu-form-bottom">
                  <Link href="/owner/menu/">← Batal & Kembali ke Menu</Link>
                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        ...initial,
                        name: 'Veggie Bowl Sehat & Segar',
                        description:
                          'Quinoa organik dipadukan dengan alpukat, edamame manis, kubis ungu, tomat ceri panggang, dan dressing tahini wijen gurih.',
                        normalPrice: 35000,
                        dietTags: ['Vegetarian'],
                      })
                      chooseSample('/menu/veggie.jpg')
                    }}
                    disabled={busy}
                  >
                    Isi Contoh Cepat
                  </button>
                  <button type="submit" disabled={busy}>
                    <CustomerIcon name="check" />Simpan menu {menuId ? '' : 'Baru'}
                  </button>
                </div>
              </div>
              <aside className="menu-preview-column">
                <div className="menu-live">
                  <small>LIVE PREVIEW REAL-TIME</small>
                  <strong>Bagaimana menu ini akan tampil</strong>
                  <p>
                    Perubahan yang Anda ketik pada formulir langsung
                    tersinkronisasi pada pratinjau.
                  </p>
                </div>
                <div className="menu-panel menu-customer-preview">
                  <small>TAMPILAN KARTU CUSTOMER</small>
                  <div className="menu-customer-image">
                    <Image
                      unoptimized
                      src={preview}
                      alt="Pratinjau kartu pelanggan"
                      width={320}
                      height={200}
                    />
                  </div>
                  <span className="menu-chip">{form.category}</span>
                  <h3>{form.name || 'Nama Menu'}</h3>
                  <p>
                    {form.description || 'Deskripsi menu akan tampil di sini.'}
                  </p>
                  <small>
                    {form.dietTags.join(' · ') || 'Diet belum dipilih'}
                  </small>
                  <hr />
                  <strong>Rp {form.normalPrice.toLocaleString('id-ID')}</strong>
                </div>
                <div className="menu-panel menu-owner-preview">
                  <small>TAMPILAN BARIS TABEL DI OWNER/MENU</small>
                  <div>
                    <Image
                      unoptimized
                      src={preview}
                      alt=""
                      width={44}
                      height={44}
                    />
                    <strong>{form.name || 'Nama Menu'}</strong>
                    <span>{form.isActive ? '● Aktif' : '○ Nonaktif'}</span>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </form>
    </MenuShell>
  )
}
