> Historical design proposal. Current implementation runs on an ordinary VPS with a private Python batch. See [AI implementation](README.md) for the actual data, date, evaluation and API contract.

# AI Production Recommendation Scope

## 1. Deskripsi Fitur

AI Production Recommendation merupakan fitur pada Replate yang membantu
Restaurant Owner menentukan jumlah produksi makanan untuk periode berikutnya
berdasarkan pola historis produksi, penjualan, dan surplus.

Fitur ini memanfaatkan data operasional yang dicatat oleh Restaurant Owner
untuk menganalisis pola atau tren surplus dan menghasilkan rekomendasi jumlah
produksi. Fitur ini ditujukan untuk membantu mengurangi potensi kelebihan
produksi dan food waste.

## 2. Input yang Dibutuhkan

Data utama berasal dari `PRODUCTION_RECORD` dan dicatat berdasarkan menu dan
tanggal produksi.

| Data | Keterangan |
|---|---|
| `menu_id` | Identitas menu yang dianalisis |
| `production_date` | Tanggal pencatatan produksi |
| `produced_quantity` | Jumlah makanan yang diproduksi |
| `sold_quantity` | Jumlah makanan yang terjual |
| `surplus_quantity` | Jumlah makanan yang menjadi surplus |

Data tersebut digunakan untuk menganalisis pola produksi, penjualan, dan
surplus pada masing-masing menu.

## 3. Output yang Dihasilkan

Hasil rekomendasi disimpan pada `PRODUCTION_RECOMMENDATION`.

| Output | Keterangan |
|---|---|
| `menu_id` | Menu yang direkomendasikan |
| `target_date` | Tanggal/periode target rekomendasi |
| `predicted_demand` | Perkiraan jumlah permintaan pada periode target |
| `recommended_quantity` | Jumlah produksi yang direkomendasikan |
| `insight` | Informasi yang mendukung hasil rekomendasi |
| `model_version` | Versi model yang digunakan |
| `generated_at` | Waktu rekomendasi dihasilkan |

Output ditampilkan kepada Restaurant Owner untuk membantu perencanaan jumlah
produksi.

## 4. Batasan Scope

- Rekomendasi AI dihasilkan berdasarkan data historis yang tersedia. Jika data
  historis masih terbatas, hasil rekomendasi dapat memiliki akurasi yang lebih
  rendah dan tetap perlu dipertimbangkan oleh Restaurant Owner dalam
  menentukan jumlah produksi.
- Analisis dan rekomendasi menggunakan data historis dari masing-masing
  restoran dan tidak menggunakan data lintas restoran pada scope ini.
- Model hanya menggunakan data yang tersedia dalam sistem dan tidak
  mempertimbangkan faktor eksternal seperti cuaca, event lokal, hari libur,
  atau aktivitas kompetitor pada scope ini.
- Rekomendasi bersifat saran, bukan otomatisasi. Sistem tidak mengunci atau
  memaksa jumlah produksi yang ditentukan oleh Restaurant Owner.
- Fitur hanya memberikan rekomendasi jumlah produksi dan tidak mencakup
  pengaturan harga, pengelolaan stok, proses produksi, maupun penilaian
  keamanan makanan.
- Hasil rekomendasi merupakan estimasi berdasarkan pola historis dan tidak
  menjamin bahwa jumlah produksi akan sesuai dengan permintaan aktual.