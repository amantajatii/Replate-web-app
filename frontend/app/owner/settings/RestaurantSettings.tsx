'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { apiUrl } from '../../../lib/api'
import MenuShell from '../menu/MenuShell'
import OwnerChoiceGroup from '../OwnerChoiceGroup'
import CustomerIcon from '../../customer/CustomerIcon'

type Restaurant = {
  restaurantId?: number
  name: string
  address: string
  phone: string
  businessEmail: string | null
  description: string | null
  tags: string[]
  logoUrl: string | null
  coverUrl: string | null
  pickupDirections: string | null
  latitude: number | null
  longitude: number | null
  openingStart: string | null
  openingEnd: string | null
  pickupStart: string | null
  pickupEnd: string | null
  isOpen: boolean
  notifyEmail: boolean
  notifyPush: boolean
}

const empty: Restaurant = {
  name: '',
  address: '',
  phone: '',
  businessEmail: null,
  description: null,
  tags: [],
  logoUrl: null,
  coverUrl: null,
  pickupDirections: null,
  latitude: null,
  longitude: null,
  openingStart: null,
  openingEnd: null,
  pickupStart: null,
  pickupEnd: null,
  isOpen: true,
  notifyEmail: true,
  notifyPush: true,
}
type Tab = 'profile' | 'hours' | 'notifications' | 'security'

function token() {
  for (const storage of [sessionStorage, localStorage]) {
    try {
      const session = JSON.parse(storage.getItem('replate-session') ?? 'null')
      if (
        session?.role === 'RestaurantOwner' &&
        session?.token &&
        Date.parse(session.expiresAt) > Date.now()
      )
        return session.token as string
    } catch {
      /* malformed local session */
    }
  }
  return null
}

async function request<T>(
  path: string,
  bearer: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${bearer}`, ...options?.headers },
  })
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      title?: string
    } | null
    throw new Error(data?.title ?? `Permintaan gagal (${response.status}).`)
  }
  return response.json() as Promise<T>
}

export default function RestaurantSettings() {
  const [bearer, setBearer] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant>(empty)
  const [saved, setSaved] = useState<Restaurant>(empty)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('profile')
  const [tag, setTag] = useState('')
  const [editingPin, setEditingPin] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const value = token()
    Promise.resolve().then(() => setBearer(value))
    if (!value) {
      Promise.resolve().then(() => setLoading(false))
      return
    }
    request<Restaurant[]>('/api/owner/restaurants', value)
      .then((items) => {
        if (items[0]) {
          setRestaurant(items[0])
          setSaved(items[0])
        }
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : 'Gagal memuat profil.',
        ),
      )
      .finally(() => setLoading(false))
  }, [])

  function change<K extends keyof Restaurant>(key: K, value: Restaurant[K]) {
    setRestaurant((current) => ({ ...current, [key]: value }))
    setMessage('')
  }

  async function upload(
    event: ChangeEvent<HTMLInputElement>,
    key: 'logoUrl' | 'coverUrl',
  ) {
    const file = event.target.files?.[0]
    if (!file || !bearer) return
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError('Gunakan JPG, PNG, atau WebP maksimal 5 MB.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await request<{ url: string }>(
        '/api/owner/media',
        bearer,
        { method: 'POST', headers: { 'Content-Type': file.type }, body: file },
      )
      change(key, result.url)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Gagal mengunggah foto.',
      )
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  async function save(event?: FormEvent) {
    event?.preventDefault()
    if (!bearer) return
    if (
      (restaurant.openingStart && !restaurant.openingEnd) ||
      (!restaurant.openingStart && restaurant.openingEnd) ||
      (restaurant.pickupStart && !restaurant.pickupEnd) ||
      (!restaurant.pickupStart && restaurant.pickupEnd)
    ) {
      setError('Isi kedua batas jam, atau kosongkan keduanya.')
      setTab('hours')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { restaurantId, ...body } = restaurant
      const result = await request<Restaurant>(
        restaurantId
          ? `/api/owner/restaurants/${restaurantId}`
          : '/api/owner/restaurants',
        bearer,
        {
          method: restaurantId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      setRestaurant(result)
      setSaved(result)
      setMessage('Perubahan restoran berhasil disimpan.')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Gagal menyimpan profil.',
      )
    } finally {
      setBusy(false)
    }
  }

  const image = (url: string | null, fallback: string) =>
    url ? `${apiUrl}${url}` : fallback
  return (
    <MenuShell restaurant={restaurant.name || 'Restoran baru'} active="settings">
      <section className="rs-main">
        <div className="rs-top">
          <div>
            <div className="rs-crumb">
              {restaurant.name || 'Restoran'}　›　Pengaturan　›　
              <strong>Pengaturan Restoran & Akun</strong>
            </div>
            <div className="rs-heading">
              <h1>
                {restaurant.restaurantId
                  ? 'Pengaturan Restoran'
                  : 'Buat Profil Restoran'}
              </h1>
              <span>
                ●　Status Restoran:{' '}
                {restaurant.isOpen ? 'Aktif Menerima Pesanan' : 'Tutup'}
              </span>
            </div>
          </div>
          <div className="rs-actions">
            <button
              type="button"
              onClick={() => {
                setRestaurant(saved)
                setError('')
                setMessage('')
              }}
            >
              Batal
            </button>
            <button
              form="restaurant-form"
              type="submit"
              disabled={busy || loading || !bearer}
            >
              <CustomerIcon name="check" />{busy ? 'Menyimpan…' : 'Simpan perubahan'}
            </button>
          </div>
        </div>
        <OwnerChoiceGroup<Tab> tabs label="Pengaturan restoran" className="rs-tabs" value={tab} onChange={setTab} options={[
          { value: 'profile', label: 'Profil & lokasi' },
          { value: 'hours', label: 'Jam & pickup' },
          { value: 'notifications', label: 'Notifikasi' },
          { value: 'security', label: 'Akun & keamanan' },
        ]} />
        {loading ? (
          <p>Memuat profil restoran...</p>
        ) : !bearer ? (
          <div className="rs-card">
            <h2>Masuk sebagai pemilik restoran</h2>
            <p>Masuk untuk membuat dan mengubah profil restoran.</p>
            <Link href="/login/">Masuk</Link>
          </div>
        ) : (
          <form id="restaurant-form" onSubmit={save}>
            {error && (
              <p className="rs-alert error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="rs-alert success" role="status">
                {message}
              </p>
            )}
            {tab === 'profile' && (
              <>
                <section className="rs-card">
                  <header>
                    <h2>Profil Restoran & Branding</h2>
                    <p>
                      Identitas visual dan informasi publik yang ditampilkan
                      kepada pelanggan di aplikasi Replate.
                    </p>
                  </header>
                  <div className="rs-grid">
                    <div>
                      <label className="rs-label">
                        Logo & Foto Sampul Gerai
                      </label>
                      <div
                        className="rs-cover"
                        style={{
                          backgroundImage: `url('${image(restaurant.coverUrl, '/restaurant/cover.jpg')}')`,
                        }}
                      >
                        <label className="rs-cover-button">
                          Ubah sampul
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(event) => upload(event, 'coverUrl')}
                          />
                        </label>
                        <span className="rs-logo">
                          {restaurant.logoUrl ? (
                            <Image
                              unoptimized
                              src={image(restaurant.logoUrl, '')}
                              alt="Logo restoran"
                              width={42}
                              height={42}
                            />
                          ) : (
                            restaurant.name.slice(0, 2).toUpperCase() || 'RP'
                          )}
                        </span>
                        <span className="rs-cover-caption">
                          Logo Restoran<small>Rasio 1:1 disarankan</small>
                        </span>
                      </div>
                      <div className="rs-photo-actions">
                        <label>
                          Ganti logo
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(event) => upload(event, 'logoUrl')}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            change('logoUrl', null)
                            change('coverUrl', null)
                          }}
                        >
                          Hapus
                        </button>
                      </div>
                      <small className="rs-hint">
                        JPG, PNG, atau WebP. Maksimal 5 MB per foto.
                      </small>
                    </div>
                    <div className="rs-fields">
                      <label>
                        Nama Restoran <b>*</b>
                        <input
                          required
                          minLength={2}
                          maxLength={150}
                          value={restaurant.name}
                          onChange={(event) =>
                            change('name', event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Deskripsi Restoran
                        <textarea
                          maxLength={1000}
                          rows={3}
                          value={restaurant.description ?? ''}
                          onChange={(event) =>
                            change('description', event.target.value || null)
                          }
                        />
                      </label>
                      <label>Kategori Kuliner & Tag Partner</label>
                      <div className="rs-tag-box">
                        {restaurant.tags.map((item) => (
                          <button
                            type="button"
                            key={item}
                            onClick={() =>
                              change(
                                'tags',
                                restaurant.tags.filter(
                                  (value) => value !== item,
                                ),
                              )
                            }
                          >
                            {item} ×
                          </button>
                        ))}
                        <input
                          aria-label="Tambah tag"
                          maxLength={40}
                          placeholder="+ Tambah Tag"
                          value={tag}
                          onChange={(event) => setTag(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              const value = tag.trim()
                              if (
                                value &&
                                !restaurant.tags.includes(value) &&
                                restaurant.tags.length < 8
                              )
                                change('tags', [...restaurant.tags, value])
                              setTag('')
                            }
                          }}
                        />
                      </div>
                      <div className="rs-two">
                        <label>
                          Nomor Telepon Bisnis
                          <input
                            required
                            type="tel"
                            minLength={6}
                            maxLength={30}
                            value={restaurant.phone}
                            onChange={(event) =>
                              change('phone', event.target.value)
                            }
                          />
                        </label>
                        <label>
                          Email Operasional
                          <input
                            type="email"
                            value={restaurant.businessEmail ?? ''}
                            onChange={(event) =>
                              change(
                                'businessEmail',
                                event.target.value || null,
                              )
                            }
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </section>
                <section className="rs-card">
                  <header>
                    <h2>Lokasi & Titik Pengambilan Surplus</h2>
                    <p>
                      Informasi navigasi akurat agar pembeli menemukan titik
                      penjemputan dengan mudah.
                    </p>
                  </header>
                  <div className="rs-grid">
                    <div className="rs-fields">
                      <label>
                        Alamat Lengkap Gerai <b>*</b>
                        <textarea
                          required
                          minLength={5}
                          maxLength={500}
                          rows={3}
                          value={restaurant.address}
                          onChange={(event) =>
                            change('address', event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Petunjuk Arah & Lokasi Kasir Pickup
                        <textarea
                          maxLength={1000}
                          rows={3}
                          value={restaurant.pickupDirections ?? ''}
                          onChange={(event) =>
                            change(
                              'pickupDirections',
                              event.target.value || null,
                            )
                          }
                        />
                      </label>
                      <div className="rs-coords">
                        Koordinat GPS{' '}
                        <strong>
                          {restaurant.latitude ?? '—'},{' '}
                          {restaurant.longitude ?? '—'}
                        </strong>
                      </div>
                    </div>
                    <div>
                      <label className="rs-label">
                        Lokasi pickup
                      </label>
                      <div
                        className="rs-map"
                        style={{ backgroundImage: 'url(/restaurant/map.png)' }}
                      >
                        <span>●　{restaurant.name || 'Titik Pickup'}</span>
                        <button
                          type="button"
                          onClick={() => setEditingPin(!editingPin)}
                        >
                          Ubah koordinat
                        </button>
                      </div>
                      {editingPin && (
                        <div className="rs-two rs-pin">
                          <label>
                            Latitude
                            <input
                              type="number"
                              step="any"
                              min="-90"
                              max="90"
                              value={restaurant.latitude ?? ''}
                              onChange={(event) =>
                                change(
                                  'latitude',
                                  event.target.value
                                    ? Number(event.target.value)
                                    : null,
                                )
                              }
                            />
                          </label>
                          <label>
                            Longitude
                            <input
                              type="number"
                              step="any"
                              min="-180"
                              max="180"
                              value={restaurant.longitude ?? ''}
                              onChange={(event) =>
                                change(
                                  'longitude',
                                  event.target.value
                                    ? Number(event.target.value)
                                    : null,
                                )
                              }
                            />
                          </label>
                        </div>
                      )}
                      <small className="rs-hint">
                        Koordinat digunakan untuk navigasi pickup.
                      </small>
                    </div>
                  </div>
                </section>
              </>
            )}
            {tab === 'hours' && (
              <section className="rs-card">
                <header>
                  <h2>Jam Operasional & Pickup</h2>
                  <p>
                    Atur waktu restoran beroperasi dan waktu pengambilan
                    surplus.
                  </p>
                </header>
                <div className="rs-two">
                  <label>
                    Jam Buka
                    <input
                      type="time"
                      value={restaurant.openingStart ?? ''}
                      onChange={(event) =>
                        change('openingStart', event.target.value || null)
                      }
                    />
                  </label>
                  <label>
                    Jam Tutup
                    <input
                      type="time"
                      value={restaurant.openingEnd ?? ''}
                      onChange={(event) =>
                        change('openingEnd', event.target.value || null)
                      }
                    />
                  </label>
                  <label>
                    Mulai Pickup
                    <input
                      type="time"
                      value={restaurant.pickupStart ?? ''}
                      onChange={(event) =>
                        change('pickupStart', event.target.value || null)
                      }
                    />
                  </label>
                  <label>
                    Selesai Pickup
                    <input
                      type="time"
                      value={restaurant.pickupEnd ?? ''}
                      onChange={(event) =>
                        change('pickupEnd', event.target.value || null)
                      }
                    />
                  </label>
                </div>
                <label className="rs-check">
                  <input
                    type="checkbox"
                    checked={restaurant.isOpen}
                    onChange={(event) => change('isOpen', event.target.checked)}
                  />{' '}
                  Restoran aktif menerima pesanan
                </label>
              </section>
            )}
            {tab === 'notifications' && (
              <section className="rs-card">
                <header>
                  <h2>Preferensi Notifikasi</h2>
                  <p>Pilih cara menerima pemberitahuan terkait restoran.</p>
                </header>
                <label className="rs-check">
                  <input
                    type="checkbox"
                    checked={restaurant.notifyEmail}
                    onChange={(event) =>
                      change('notifyEmail', event.target.checked)
                    }
                  />{' '}
                  Notifikasi email
                </label>
                <label className="rs-check">
                  <input
                    type="checkbox"
                    checked={restaurant.notifyPush}
                    onChange={(event) =>
                      change('notifyPush', event.target.checked)
                    }
                  />{' '}
                  Notifikasi aplikasi
                </label>
              </section>
            )}
            {tab === 'security' && (
              <section className="rs-card">
                <header>
                  <h2>Akun & Keamanan</h2>
                  <p>Kelola akses akun pemilik restoran.</p>
                </header>
                <p>
                  Untuk mengganti kata sandi, gunakan tautan reset melalui email
                  akun.
                </p>
                <Link href="/forgot-password/">Atur ulang kata sandi →</Link>
              </section>
            )}
          </form>
        )}
      </section>
    </MenuShell>
  )
}
