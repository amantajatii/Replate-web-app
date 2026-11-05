# Bukti QA histori produksi — fixture

Screenshot pada folder ini diambil dari production build lokal menggunakan Chrome terisolasi dengan API fixture. Nama restoran berlabel **fixture**. Screenshot ini tidak membuktikan persistensi database.

- `history-fixture-desktop.png`: histori produksi pada viewport 1440 × 1000.
- `history-fixture-mobile.png`: viewport 390 × 844; tabel memiliki scroll horizontal di dalam container, halaman tidak overflow.
- `history-fixture-empty.png`: hasil histori kosong.
- `history-fixture-error.png`: API gagal dengan tombol Coba Lagi.

QA browser lulus: render histori, request filter menu dan rentang tanggal, pergantian restoran, empty state, error/retry, tanpa sesi owner, layout mobile tanpa overflow halaman, dan tidak ada JavaScript page error.

Bukti ini untuk review UI #67, bukan deliverable demo database asli #66. Rincian blocker dan pengujian lanjutan ada di `docs/progress-issues-65-67.md`.
