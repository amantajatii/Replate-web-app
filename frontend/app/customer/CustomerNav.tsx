import Link from 'next/link'
import CustomerIcon from './CustomerIcon'

export default function CustomerNav({ cartCount, active = 'home' }: { cartCount: number; active?: 'home' | 'cart' | 'orders' }) {
  return (
    <nav className="customer-bottom-nav" aria-label="Navigasi customer">
      <Link className={active === 'home' ? 'selected' : ''} aria-current={active === 'home' ? 'page' : undefined} href="/customer/"><CustomerIcon name="home" />Beranda</Link>
      <Link className={active === 'cart' ? 'selected' : ''} aria-current={active === 'cart' ? 'page' : undefined} href="/customer/cart/"><CustomerIcon name="cart" />Keranjang{cartCount > 0 && <b aria-label={`${cartCount} porsi di keranjang`}>{cartCount}</b>}</Link>
      <Link className={active === 'orders' ? 'selected' : ''} aria-current={active === 'orders' ? 'page' : undefined} href="/customer/orders/"><CustomerIcon name="orders" />Pesanan</Link>
    </nav>
  )
}
