# Bukti integrasi database lokal — 9 Oktober 2026

Semua bukti di folder ini menggunakan **SQL Server 2022 Developer di Docker, database ReplateLocal**, Express API asli, dan production build frontend. Tidak ada fixture store atau interception API dalam demo browser. Bukti ini belum merupakan pengujian deployment VPS.

- `api-results.json`: hasil pengujian HTTP serta assertion langsung terhadap SQL melalui Prisma; ID data uji tercatat.
- `browser-results.json`: hasil QA browser dan ID order yang digunakan pada video/screenshot.
- `00-customer-checkout.png`: checkout berhasil melalui UI.
- `01-customer-history.png`: riwayat order tersimpan.
- `02-customer-pickup-code.png`: order Pending dan kode pickup.
- `03-owner-wrong-code.png`: kode salah ditolak.
- `04-owner-completed.png`: verifikasi benar, order selesai, waktu verifikasi.
- `05-production-history.png`: histori produksi yang dibaca dari SQL dengan filter menu.
- `06-customer-completed.png`: status Selesai dan kode pickup disembunyikan.
- `07-customer-mobile.png`: detail Completed pada 390 px, tanpa overflow halaman.
- `order-pickup-local.mp4` dan `.webm`: video checkout sampai Completed, serta histori produksi.

Pengujian API juga memastikan stok habis tidak membuat order tambahan, kode sudah dipakai menghasilkan HTTP 409, akun owner/customer lain tidak bisa mengakses data, validasi produksi tidak konsisten ditolak, dan perubahan status/pickup bertahan di SQL.

Akun demo hanya untuk lingkungan lokal. Kredensial dan token tidak dimasukkan ke folder bukti atau Git. Lihat `docs/local-database.md` untuk menjalankan ulang.
