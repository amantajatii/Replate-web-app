# Replate

<p align="center">
  <img src="frontend/public/Replate-logo.png" alt="Logo Replate" width="240">
</p>

Replate adalah *food rescue marketplace* yang membantu restoran menjual makanan surplus yang masih layak konsumsi dengan harga lebih terjangkau. Data produksi dan surplus digunakan dalam pipeline analitik dan rekomendasi produksi per menu. Dampak terhadap *food waste* masih perlu diukur pada data operasional.

## Color palette

<p align="center">
  <img src="figma-make/Replate-color-palette.png" alt="Color palette Replate" width="700">
</p>

## Typography

Replate menggunakan `"Plus Jakarta Sans", Arial, sans-serif` pada seluruh interface.

| Style | Size / line height | Weight | Penggunaan |
| --- | --- | --- | --- |
| Display | 48 / 56 px | Bold | Hero dan headline utama |
| Heading 1 | 32 / 40 px | Bold | Judul halaman |
| Heading 2 | 24 / 32 px | Bold | Judul section |
| Heading 3 | 20 / 28 px | SemiBold | Judul card |
| Body | 16 / 24 px | Regular | Konten utama |
| Body Small | 14 / 20 px | Regular | Konten pendukung |
| Button dan Label | 14–16 px | SemiBold | Tombol dan label input |
| Caption | 12 / 18 px | Medium | Metadata dan keterangan |

Harga, pickup code, jumlah, dan data dashboard menggunakan tabular numbers.

## Arsitektur

```text
Replate-web-app/
├── frontend/   # Next.js static frontend → Caddy di VPS
├── backend/    # Express REST API + Prisma → Docker di VPS
├── diagram/    # ERD, use case, dan wireframe
└── docs/       # Dokumentasi proyek
```

Database menggunakan SQL Server secara lokal maupun pada rancangan deployment VPS. Frontend hanya berkomunikasi dengan database melalui REST API.

Foto menu diunggah melalui backend dan disimpan sebagai berkas di direktori `MENU_UPLOAD_DIR` (default `menu-uploads` relatif terhadap direktori kerja backend). SQL Server hanya menyimpan URL dan urutan foto pada tabel `MenuPhotos`, bukan isi berkas gambar. Konfigurasi VPS menggunakan volume persisten untuk foto.

## Analitik & AI

Halaman owner **Analitik & AI** menampilkan produksi, surplus, dan rekomendasi tersimpan. Pipeline Python memakai evaluasi berdasarkan urutan waktu dan pembanding weekday. [Panduan dan demo sintetis](AI/README.md) · [Deployment VPS](deploy/README.md). Tidak memerlukan Azure.

## Menjalankan aplikasi

Gunakan Node.js 24 dan pnpm 10.

```bash
pnpm install
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
pnpm dev
```

Frontend berjalan di `http://localhost:3000` dan backend di `http://localhost:5000`. Isi `DATABASE_URL` dan ganti `JWT_SECRET` di `backend/.env` sebelum menjalankan backend.

Perintah workspace:

```bash
pnpm lint
pnpm test
pnpm build
```

Build frontend menghasilkan static export di `frontend/out`.

## REST API

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password` dan `POST /api/auth/reset-password`
- `GET /api/access/customer` untuk role `Customer`
- `GET /api/access/restaurant-owner` untuk role `RestaurantOwner`
- `GET /api/marketplace/listings` dan `GET /api/marketplace/listings/:listingId`
- `POST /api/customer/orders` untuk checkout listing surplus, serta `GET /api/customer/orders` dan `GET /api/customer/orders/:orderId` untuk riwayat/detail

Register menerima `name`, `email`, `password`, dan `role`. Kirim token dari register/login melalui header `Authorization: Bearer <token>` untuk mengakses endpoint berdasarkan role.

Endpoint surplus dan order:

- `GET /api/marketplace/listings` dan `GET /api/marketplace/listings/:listingId` untuk melihat listing surplus yang tersedia.
- `POST /api/customer/orders`, `GET /api/customer/orders`, dan `GET /api/customer/orders/:orderId` untuk checkout serta status order milik customer.
- `GET /api/owner/orders` untuk melihat order masuk dari restoran milik owner.
- `POST /api/owner/orders/:orderId/verify-pickup` menerima `{ "pickupCode": "A1B2C3D4E5F6" }` untuk memverifikasi pickup.

Kode pickup hanya dapat dipakai sekali. Keberhasilan mengubah status pickup menjadi `Verified`, mengisi `verifiedAt`, dan mengubah order dari `Pending` ke `Completed`. Endpoint owner hanya mengembalikan order untuk restoran yang dimiliki token pemanggil. Order customer hanya dapat dibaca oleh customer pemiliknya.

### Surplus listing owner

Semua endpoint berikut memerlukan token `RestaurantOwner`. ID restoran dan listing tetap diperiksa terhadap owner di token; data owner lain menghasilkan `404`.

- `GET /api/owner/restaurants/:restaurantId/listings` — daftar listing restoran
- `GET /api/owner/listings/:listingId` — detail listing
- `POST /api/owner/restaurants/:restaurantId/listings` — buat listing dari catatan produksi
- `PATCH /api/owner/listings/:listingId` — ubah harga, jumlah awal, atau jendela pickup
- `DELETE /api/owner/listings/:listingId` — tutup listing tanpa menghapus histori order

Contoh `POST` (respons `201`):

```json
{
  "productionRecordId": 12,
  "rescuePrice": 15000,
  "initialQuantity": 5,
  "pickupStart": "2026-09-25T10:00:00+07:00",
  "pickupEnd": "2026-09-25T12:00:00+07:00",
  "pickupInstructions": "Bawa tas sendiri dan tunjukkan kode pickup.",
  "status": "Active"
}
```

Respons memuat `surplusListingId`, `restaurantId`, `menuId`, `menuName`, `availableQuantity`, `status` (`Active`, `Draft`, atau `Closed`), dan field input. Kirim `status: "Draft"` untuk menyimpan sebelum publikasi, lalu `PATCH` dengan `status: "Active"` untuk menerbitkannya. Jumlah listing aktif ditambah jumlah yang sudah terjual dari listing tertutup tidak boleh melebihi `surplusQuantity` pada catatan produksi. Saat mengubah `initialQuantity`, stok tersedia disesuaikan tanpa menghapus jumlah yang sudah terjual. Jendela pickup harus dimulai di masa depan dan berakhir setelah waktu mulai. Input tidak valid menghasilkan `400`, token tidak ada/salah role menghasilkan `401`/`403`, dan data yang bukan milik owner menghasilkan `404`.

## Database migration

Schema Prisma mencakup seluruh entitas pada ERD Replate. Untuk SQL Server yang masih kosong:

```bash
pnpm --dir backend prisma:migrate
```

`DATABASE_URL` memakai format koneksi SQL Server:

```text
sqlserver://host:1433;database=Replate;user=user;password=password;encrypt=true
```

## Deployment VPS

[Konfigurasi Docker Compose, Caddy, volume persisten, dan timer batch AI](deploy/README.md) tersedia di `deploy/`. Frontend dan API berada di balik Caddy; SQL dan endpoint batch tidak dipublikasikan. Deployment ke server dan pengujian produksi belum dijalankan.

## Diagram

![Use Case Diagram Replate](diagram/Replate_Use_Case_Diagram.drawio.png)

![Entity Relationship Diagram Replate](diagram/Raplate_ERD.png)

ERD gambar di atas adalah diagram awal. [Tambahan ERD foto menu](diagram/Menu_Photo_ERD.mmd) memperlihatkan relasi `Menu 1 : 0..* MenuPhoto`. Foto listing surplus berasal dari menu melalui `SurplusListing → ProductionRecord → Menu → MenuPhoto`; belum ada foto tersendiri pada `SurplusListing`.

![Customer Low-Fidelity Wireframe Replate](diagram/Customer_Wireframe.png)

![Restaurant Owner Low-Fidelity Wireframe Replate](diagram/Restaurant_Owner_Wireframe.png)

Kelompok 19:

- Violin Mulya Putra — 24/534192/TK/59201
- Putri Tajudin — 24/535824/TK/59469
- Diaz Amantajati Susilo — 24/545483/TK/60678
