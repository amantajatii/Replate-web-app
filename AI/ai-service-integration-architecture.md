> Historical design proposal. Current implementation runs on an ordinary VPS with a private Python batch. See [AI implementation](README.md) for the actual data, date, evaluation and API contract.

# AI Service Integration Architecture

> Dokumen ini membahas **AI Production Recommendation**. AI Food Safety Classifier dibahas terpisah.

## 1. AI Framework

AI Production Recommendation memakai **Python** dengan **Scikit-Learn** untuk model dan **pandas** untuk mengolah data.

## 2. Inference Mechanism

Inference dilakukan secara terjadwal setiap hari pukul **02.00 WIB (UTC+7)** untuk menghasilkan rekomendasi produksi bagi hari berikutnya (`target_date`). Jadwal ini dipilih agar rekomendasi tersedia sebelum aktivitas operasional restoran dimulai. Dashboard hanya menampilkan hasil rekomendasi yang telah tersimpan.


## 3. Hosting (Deployment)

AI Service berjalan di **Azure Functions** (Python) dengan **timer trigger**. Timer trigger inilah yang menjadi penjadwalnya, jadi tidak perlu layanan penjadwal terpisah. Azure Functions dipilih karena pekerjaannya berkala dan singkat, sehingga tidak perlu server yang menyala terus.

Komponen yang perlu digambar di diagram cloud:

| Komponen | Layanan Azure | Peran |
|---|---|---|
| AI Service | Azure Functions (timer trigger) | Mengambil data, melatih model, membuat rekomendasi |
| Backend API | Azure App Service | Menyediakan data ke AI Service dan menyimpan hasilnya |
| Database | Azure SQL Database | Menyimpan data; hanya diakses oleh Backend API |

## 4. Pelatihan Model

Model dilatih ulang **setiap kali AI Service berjalan**, memakai data historis terbaru, lalu langsung dipakai untuk membuat rekomendasi. Tidak ada file model yang disimpan, jadi tidak perlu tempat penyimpanan tambahan. Pendekatan ini dipilih karena datanya masih kecil.

Kalau nanti waktu pelatihan terlalu lama, pelatihan bisa dipisah dan model disimpan (misalnya di Azure Blob Storage).

Setiap hasil diberi `model_version` sebagai penanda versi pendekatan yang dipakai.

## 5. Input Data

AI Service memperoleh data input melalui Backend API, bukan mengakses database secara langsung.

Data yang digunakan:
- `PRODUCTION_RECORD`
- `ORDER_ITEM` (data penjualan)
- `MENU` (hanya menu aktif)
- `SURPLUS_LISTING`

Penggabungan dan pembersihan data dilakukan oleh AI Service, mengikuti Dataset Schema.

## 6. Output and Data Persistence

AI Service mengirim hasil rekomendasi ke Backend API. Backend API yang menyimpannya ke tabel `PRODUCTION_RECOMMENDATION`.

Data yang dikirim per menu: `menu_id`, `target_date`, `predicted_demand`, `recommended_quantity`, `insight`, `model_version`, `generated_at`. Kolom `recommendation_id` dibuat otomatis oleh database.

Kalau rekomendasi untuk `menu_id` dan `target_date` yang sama sudah ada, Backend API **memperbarui** barisnya, bukan menambah baris baru. Ini supaya aman kalau AI Service terpanggil dua kali.

## 7. Backend API untuk AI Service

Dua endpoint dibutuhkan. Keduanya belum ada di backend saat ini, dan nama di bawah ini masih usulan.

| Endpoint | Fungsi |
|---|---|
| `GET /api/ai/training-data` | Mengembalikan data dari tiga tabel di atas |
| `POST /api/ai/recommendations` | Menerima hasil rekomendasi dan menyimpannya |

**Keamanan:** AI Service membuktikan dirinya lewat **API key** di header request. Key disimpan di pengaturan aplikasi Azure (App Settings), bukan di dalam kode. Request tanpa key yang benar ditolak oleh Backend API.

## 8. Integration Flow

1. Timer trigger menjalankan AI Service sesuai jadwal.
2. AI Service meminta data input ke Backend API (`GET /api/ai/training-data`) dengan API key.
3. Backend API mengambil data dari Azure SQL Database.
4. AI Service membersihkan data, membentuk fitur, melatih model Scikit-Learn, dan membuat rekomendasi.
5. AI Service mengirim hasil ke Backend API (`POST /api/ai/recommendations`).
6. Backend API menyimpan hasil ke `PRODUCTION_RECOMMENDATION`.
7. Restaurant Owner melihat rekomendasi di dashboard, yang membaca dari tabel tersebut.

## 9. AI Development Flow

Proses pengembangan AI Production Recommendation terdiri dari beberapa tahap:

1. Mengambil data historis produksi, penjualan, dan surplus dari Backend API.
2. Melakukan preprocessing dan menyiapkan data untuk model.
3. Melatih model menggunakan Scikit-Learn berdasarkan data historis.
4. Melakukan inference untuk menghasilkan prediksi permintaan.
5. Menghasilkan rekomendasi jumlah produksi untuk periode berikutnya.
6. Mengirim hasil rekomendasi ke Backend API untuk disimpan.