'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ViewTransition, useState, type FormEvent } from 'react'
import { apiUrl } from '../lib/api'
import { saveSession, type Session } from '../lib/session'
import CustomerIcon from './customer/CustomerIcon'

type Mode = 'login' | 'register' | 'forgot' | 'reset'
type Role = 'Customer' | 'RestaurantOwner'

function Brand({ mode }: { mode: Mode }) {
  return (
    <header className="auth-brand">
      <div className="auth-logo">
        <Image
          src="/Replate-logo.png"
          alt="Replate"
          width={50}
          height={50}
          unoptimized
        />
      </div>
      <h1>{mode === 'login' ? 'Selamat datang kembali.' : mode === 'register' ? 'Buat akun Replate.' : 'Replate'}</h1>
      <p>{mode === 'login' ? 'Masuk dan lanjutkan langkah kecilmu untuk mengurangi makanan terbuang.' : mode === 'register' ? 'Mulai selamatkan makanan, atau kelola surplus restoranmu.' : 'Makanan baik, lebih sedikit terbuang.'}</p>
    </header>
  )
}

function RoleChoices({
  role,
  onChange,
}: {
  role: Role
  onChange: (role: Role) => void
}) {
  return (
    <div className="auth-roles" role="group" aria-label="Pilih peran akun">
      <button
        type="button"
        className={role === 'Customer' ? 'selected' : ''}
        onClick={() => onChange('Customer')}
        aria-pressed={role === 'Customer'}
      >
        <CustomerIcon name="profile" />
        <span>
          <strong>Customer</strong>
          <small>Beli makanan surplus</small>
        </span>
      </button>
      <button
        type="button"
        className={role === 'RestaurantOwner' ? 'selected' : ''}
        onClick={() => onChange('RestaurantOwner')}
        aria-pressed={role === 'RestaurantOwner'}
      >
        <CustomerIcon name="store" />
        <span>
          <strong>Pemilik Resto</strong>
          <small>Kelola surplus menu</small>
        </span>
      </button>
    </div>
  )
}

async function post<T>(path: string, body: object): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Tidak dapat terhubung ke server. Coba lagi nanti.')
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      title?: string
    } | null
    const messages: Record<string, string> = {
      'Invalid email or password.': 'Email atau kata sandi salah.',
      'Email is already registered.': 'Email sudah terdaftar.',
      'Password reset is unavailable.':
        'Reset kata sandi belum tersedia. Coba lagi nanti.',
      'Reset link is invalid or expired.':
        'Tautan reset tidak valid atau sudah kedaluwarsa.',
    }
    throw new Error(
      messages[data?.title ?? ''] ??
        data?.title ??
        'Permintaan gagal. Coba lagi.',
    )
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>)
}

export default function AuthScreen({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [role, setRole] = useState<Role>('Customer')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if ((mode === 'register' || mode === 'reset') && password !== confirm) {
      setError('Konfirmasi kata sandi tidak sama.')
      return
    }
    const token =
      mode === 'reset'
        ? (new URLSearchParams(window.location.search).get('token') ?? '')
        : ''
    if (mode === 'reset' && !token) {
      setError('Tautan reset tidak valid.')
      return
    }
    setPending(true)
    try {
      if (mode === 'forgot') {
        await post('/api/auth/forgot-password', { email })
        setMessage(
          'Jika email terdaftar, tautan reset akan dikirim. Periksa kotak masuk Anda.',
        )
      } else if (mode === 'reset') {
        await post('/api/auth/reset-password', { token, password })
        setMessage('Kata sandi berhasil diperbarui. Silakan masuk kembali.')
      } else {
        const session = await post<Session>(
          mode === 'login' ? '/api/auth/login' : '/api/auth/register',
          mode === 'login'
            ? { email, password }
            : { name, email, phone, password, role },
        )
        if (mode === 'login' && session.role !== role)
          throw new Error('Peran yang dipilih tidak sesuai dengan akun ini.')
        saveSession(session, mode === 'login' && remember)
        router.push(
          session.role === 'RestaurantOwner' ? '/owner/' : '/customer/',
        )
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Terjadi kesalahan. Coba lagi.',
      )
    } finally {
      setPending(false)
    }
  }

  const isLogin = mode === 'login'
  const isRegister = mode === 'register'
  return (
    <main className={`auth-page ${(isLogin || isRegister) ? 'auth-entry' : ''} ${isRegister ? 'register-page' : ''}`}>
      <div className="auth-frame">
        {(isLogin || isRegister) && <aside className="auth-story" aria-label="Tentang Replate">
          <Link href="/" className="auth-story-brand"><Image src="/Replate-logo.png" alt="" width={46} height={46} unoptimized /><strong>Replate</strong></Link>
          <div className="auth-story-copy"><h2>Makanan baik.<br />Kesempatan baru.</h2><p>Hubungkan makanan surplus yang masih layak dengan orang yang ingin menikmatinya.</p></div>
          <div className="auth-story-photo"><picture><source media="(min-width: 900px)" srcSet="/menu/veggie.jpg" /><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" alt="Semangkuk makanan dengan sayuran segar" width={720} height={450} loading="eager" fetchPriority="high" /></picture></div>
          <p className="auth-story-note"><CustomerIcon name="leaf" />Lebih sedikit terbuang, lebih banyak dinikmati.</p>
        </aside>}
      <div className="auth-shell">
        <Brand mode={mode} />
        {(isLogin || isRegister) && (
          <nav className="auth-tabs" aria-label="Autentikasi">
            <ViewTransition name="auth-tab-indicator" share="auth-tab-move" default="none"><span className={`auth-tab-indicator${isRegister ? ' at-register' : ''}`} aria-hidden="true" /></ViewTransition>
            <ViewTransition name="auth-tab-login" share="auth-tab-label" default="none">
            <Link className={isLogin ? 'active' : ''} aria-current={isLogin ? 'page' : undefined} href="/login/" transitionTypes={['auth-back']}>
              Masuk
            </Link>
            </ViewTransition>
            <ViewTransition name="auth-tab-register" share="auth-tab-label" default="none">
            <Link className={isRegister ? 'active' : ''} aria-current={isRegister ? 'page' : undefined} href="/register/" transitionTypes={['auth-next']}>
              Daftar
            </Link>
            </ViewTransition>
          </nav>
        )}
        <ViewTransition key={mode} name="auth-form" share={{ default: 'none', 'auth-next': 'auth-slide-forward', 'auth-back': 'auth-slide-back' }} default="none">
        <form
          className="auth-form"
          aria-busy={pending}
          onSubmit={submit}
        >
          {(isLogin || isRegister) && (
            <div className="field-group">
              <div className="field-head">
                <span>{isLogin ? 'Masuk sebagai' : 'Daftar sebagai'}</span>
              </div>
              <RoleChoices role={role} onChange={setRole} />
            </div>
          )}
          {mode === 'forgot' && (
            <>
              <h2>Lupa kata sandi?</h2>
              <p className="auth-help">
                Masukkan email akun Replate untuk menerima tautan reset.
              </p>
            </>
          )}
          {mode === 'reset' && (
            <>
              <h2>Atur ulang kata sandi</h2>
              <p className="auth-help">Buat kata sandi baru untuk akun Anda.</p>
            </>
          )}
          {isRegister && (
            <label className="auth-field">
              Nama Lengkap <span>*</span>
              <input
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                placeholder="Alya Putri"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}
          {mode !== 'reset' && (
            <label className="auth-field">
              Email <span>{isRegister && '*'}</span>
              <input
                required
                type="email"
                autoComplete="email"
                placeholder="contoh@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}
          {isRegister && (
            <label className="auth-field">
              Nomor Telepon <span>*</span>
              <input
                required
                type="tel"
                minLength={6}
                maxLength={30}
                autoComplete="tel"
                placeholder="+62 812 3456 7890"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
          )}
          {(isLogin || isRegister || mode === 'reset') && (
            <div className="auth-field">
              <label htmlFor="auth-password">Kata sandi{isRegister && <span className="auth-required" aria-hidden="true"> *</span>}</label>
              <div className="password-wrap">
                <input
                  id="auth-password"
                  required
                  minLength={isLogin ? undefined : 8}
                  maxLength={128}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  placeholder={
                    isRegister ? 'Minimal 8 karakter' : 'Masukkan kata sandi'
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-pressed={showPassword}
                  aria-label={
                    showPassword
                      ? 'Sembunyikan kata sandi'
                      : 'Tampilkan kata sandi'
                  }
                >
                  <CustomerIcon name={showPassword ? 'eyeOff' : 'eye'} />
                </button>
              </div>
            </div>
          )}
          {(isRegister || mode === 'reset') && (
            <label className="auth-field">
              Konfirmasi Kata Sandi <span>*</span>
              <input
                required
                minLength={8}
                maxLength={128}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Ulangi kata sandi"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
          )}
          {isLogin && (
            <div className="auth-options">
              <label>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />{' '}
                Ingat saya
              </label>
              <Link href="/forgot-password/">Lupa kata sandi?</Link>
            </div>
          )}
          {error && (
            <p className="auth-feedback error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="auth-feedback success" role="status">
              {message}
            </p>
          )}
          <button className="auth-submit" disabled={pending} type="submit">
            {pending
              ? 'Memproses...'
              : isLogin
                ? 'Masuk'
                : isRegister
                  ? 'Buat Akun'
                  : mode === 'forgot'
                    ? 'Kirim Tautan Reset'
                    : 'Simpan Kata Sandi'}
          </button>
        </form>
        </ViewTransition>
        <ViewTransition name="auth-footer" share="auth-footer-move" default="none">
        <p className="auth-footer">
          {isLogin ? (
            <>
              Belum punya akun? <Link href="/register/" transitionTypes={['auth-next']}>Daftar</Link>
            </>
          ) : isRegister ? (
            <>
              Sudah punya akun? <Link href="/login/" transitionTypes={['auth-back']}>Masuk</Link>
            </>
          ) : (
            <Link href="/login/">Kembali ke Masuk</Link>
          )}
        </p>
        </ViewTransition>
      </div>
      </div>
    </main>
  )
}
