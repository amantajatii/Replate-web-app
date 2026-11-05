import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import CustomerIcon from './customer/CustomerIcon'
import './landing.css'

export const metadata: Metadata = {
  title: 'Replate — Makanan baik, kesempatan baru',
  description: 'Temukan makanan surplus dari restoran dengan harga lebih hemat. Pesan di Replate dan ambil langsung sesuai jadwal pickup.',
}

const questions = [
  ['Apa yang dimaksud makanan surplus?', 'Makanan surplus adalah makanan dari produksi restoran yang belum terjual. Di Replate, restoran dapat menawarkan porsi tersebut dengan harga surplus dan jadwal pengambilan yang ditentukan.'],
  ['Bagaimana cara mengambil pesanan?', 'Setelah memesan, lihat jadwal dan petunjuk pickup pada pesananmu. Datang langsung ke restoran sesuai jadwal, lalu tunjukkan kode pickup kepada staf untuk diverifikasi.'],
  ['Apakah pilihan makanannya selalu sama?', 'Pilihan menu dan jumlah porsi mengikuti surplus yang tersedia di masing-masing restoran. Periksa listing untuk melihat harga, ketersediaan, dan jadwal pickup terbaru.'],
  ['Bagaimana jika aku punya alergi makanan?', 'Periksa deskripsi, informasi alergen, dan catatan menu sebelum memesan. Jika masih ada yang belum jelas, tanyakan langsung kepada restoran.'],
  ['Bagaimana cara bergabung sebagai mitra restoran?', 'Buat akun dengan memilih peran Pemilik Resto. Setelah itu, lengkapi profil restoran, tambahkan menu dan catatan produksi, lalu buat listing untuk porsi surplus yang tersedia.'],
] as const

export default function Home() {
  return (
    <div className="landing" id="beranda">
      <a className="landing-skip" href="#konten">Langsung ke konten</a>
      <header className="landing-header">
        <div className="landing-header-inner">
          <Link href="/" className="landing-brand" aria-label="Replate, beranda"><Image src="/Replate-logo.png" alt="" width={46} height={46} unoptimized /><span>Replate</span></Link>
          <nav className="landing-nav" aria-label="Navigasi utama"><a href="#cara-kerja">Cara kerja</a><a href="#mitra">Untuk restoran</a><a href="#faq">Tanya jawab</a></nav>
          <div className="landing-account"><Link href="/login/">Masuk</Link><Link className="landing-button small" href="/register/">Daftar</Link></div>
        </div>
      </header>

      <main id="konten">
        <section className="landing-hero landing-width" aria-labelledby="hero-title">
          <div className="landing-hero-copy">
            <h1 id="hero-title">Makanan baik.<br />Kesempatan <span>baru.</span></h1>
            <p>Masih enak, masih layak, sayang kalau terbuang. Temukan makanan surplus dari restoran dan nikmati dengan harga lebih hemat.</p>
            <div className="landing-hero-actions"><Link href="/login/" className="landing-button">Mulai cari makanan <CustomerIcon name="share" /></Link><a href="#mitra" className="landing-text-link">Punya restoran? <span>Jadi mitra</span></a></div>
            <div className="landing-pickup-note"><CustomerIcon name="pin" /><span>Pesan di Replate. Ambil langsung di restoran.</span></div>
          </div>
          <figure className="landing-hero-photo">
            <Image src="/menu/veggie.jpg" alt="Semangkuk makanan dengan sayuran, alpukat, dan kacang-kacangan di meja restoran" fill sizes="(max-width: 700px) 90vw, 48vw" loading="eager" unoptimized />
            <figcaption><CustomerIcon name="leaf" /><span>Lebih sedikit terbuang.<br /><strong>Lebih banyak dinikmati.</strong></span></figcaption>
          </figure>
        </section>

        <div className="landing-promise"><div className="landing-width"><span>Makanan yang masih punya cerita.</span><p>Kamu menikmati. Restoran terbantu. Surplus mendapat kesempatan baru.</p><CustomerIcon name="leaf" /></div></div>

        <section className="landing-how landing-width" id="cara-kerja" aria-labelledby="how-title">
          <div className="landing-section-heading"><h2 id="how-title">Dari dapur,<br />sampai ke kamu.</h2><p>Tiga langkah kecil untuk menikmati makanan baik yang belum terjual.</p></div>
          <ol className="landing-steps">
            <li><span className="landing-step-number">01</span><div><h3>Temukan yang kamu suka</h3><p>Jelajahi menu surplus. Cek harga, jumlah porsi, informasi menu, dan jadwal pickup sebelum memilih.</p></div></li>
            <li><span className="landing-step-number">02</span><div><h3>Pesan porsimu</h3><p>Tambahkan makanan ke keranjang, buat pesanan, dan lihat kode pickup di halaman pesananmu.</p></div></li>
            <li><span className="landing-step-number">03</span><div><h3>Ambil, lalu nikmati</h3><p>Datang sesuai jadwal dan tunjukkan kode pickup ke staf restoran. Makananmu siap mendapat cerita baru.</p></div></li>
          </ol>
        </section>

        <section className="landing-food landing-width" aria-labelledby="food-title">
          <div className="landing-section-heading"><div><h2 id="food-title">Ada banyak cara<br />menikmati yang baik.</h2><p>Dari menu makan siang sampai teman ngopi. Pilihan mengikuti surplus restoran yang tersedia.</p></div><Link className="landing-text-link" href="/login/">Cari pilihan makanan <CustomerIcon name="share" /></Link></div>
          <div className="landing-food-grid">
            <figure><div><Image src="/menu/chicken.jpg" alt="Nasi dengan ayam panggang dan sayuran" fill sizes="(max-width: 700px) 85vw, 32vw" unoptimized /></div><figcaption><h3>Seporsi yang mengenyangkan.</h3><span>Makanan utama</span></figcaption></figure>
            <figure><div><Image src="/menu/pastry.jpg" alt="Pilihan roti dan pastry" fill sizes="(max-width: 700px) 85vw, 32vw" unoptimized /></div><figcaption><h3>Teman jeda soremu.</h3><span>Roti & kue</span></figcaption></figure>
            <figure><div><Image src="/menu/coffee.jpg" alt="Minuman kopi di meja" fill sizes="(max-width: 700px) 85vw, 32vw" unoptimized /></div><figcaption><h3>Pelengkap momen kecil.</h3><span>Minuman & lainnya</span></figcaption></figure>
          </div>
          <p className="landing-photo-note">Foto ilustrasi kategori. Menu yang tersedia dapat berubah.</p>
        </section>

        <section className="landing-partner" id="mitra" aria-labelledby="partner-title"><div className="landing-width landing-partner-inner">
          <div className="landing-partner-photo"><Image src="/restaurant/cover.jpg" alt="Suasana restoran dengan meja dan kursi di area gerai" fill sizes="(max-width: 700px) 90vw, 44vw" unoptimized /></div>
          <div className="landing-partner-copy"><h2 id="partner-title">Sudah dibuat<br />dengan baik.<br /><span>Jangan berakhir sia-sia.</span></h2><p>Beri makanan surplus di restoranmu kesempatan untuk dinikmati. Kelola dari dapur sampai pickup dalam satu tempat.</p><ul><li><CustomerIcon name="check" />Catat produksi, penjualan, dan porsi surplus.</li><li><CustomerIcon name="check" />Atur harga surplus dan jadwal pengambilan.</li><li><CustomerIcon name="check" />Kelola pesanan dan verifikasi kode pickup.</li></ul><Link className="landing-button light" href="/register/">Gabung sebagai mitra <CustomerIcon name="share" /></Link><small>Pilih peran Pemilik Resto saat mendaftar.</small></div>
        </div></section>

        <section className="landing-faq landing-width" id="faq" aria-labelledby="faq-title"><div><h2 id="faq-title">Masih penasaran?</h2><p>Kenali Replate sedikit lebih dekat sebelum mulai.</p></div><div className="landing-faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<CustomerIcon name="plus" /></summary><p>{answer}</p></details>)}</div></section>

        <section className="landing-last landing-width" aria-labelledby="last-title"><CustomerIcon name="leaf" /><h2 id="last-title">Makanan baik layak<br />dapat kesempatan kedua.</h2><p>Mulai dari satu porsi yang kamu pilih hari ini.</p><Link href="/register/" className="landing-button">Mulai bersama Replate <CustomerIcon name="share" /></Link></section>
      </main>

      <footer className="landing-footer landing-width"><div><Link href="/" className="landing-brand"><Image src="/Replate-logo.png" alt="" width={40} height={40} unoptimized /><span>Replate</span></Link><p>Makanan baik, lebih sedikit terbuang.</p></div><nav aria-label="Navigasi footer"><a href="#cara-kerja">Cara kerja</a><a href="#mitra">Jadi mitra</a><Link href="/login/">Masuk</Link><a href="#beranda">Kembali ke atas <CustomerIcon name="share" /></a></nav><small>Replate · Setiap porsi punya kesempatan.</small></footer>
    </div>
  )
}
