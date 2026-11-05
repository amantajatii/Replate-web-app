> Historical design proposal. Current implementation runs on an ordinary VPS with a private Python batch. See [AI implementation](../../AI/README.md) for the actual data, date, evaluation and API contract.

![Cloud Deployment Architecture Diagram](Cloud%20Deployment%20Architecture%20Diagram.png)
# Catatan Pendamping Replate Cloud Deployment Architecture Diagram

## Keterangan Alur

| No | Alur |
|---|---|
| 1 | Pengguna memuat frontend dari Static Web Apps (HTTPS). |
| 2 | Browser memanggil Backend API di App Service (HTTPS + JWT). |
| 3 | App Service membaca dan menulis Azure SQL melalui Prisma (TLS 1.2). Firewall hanya mengizinkan IP outbound App Service. |
| 4a | App Service mengunggah gambar menu ke Storage dengan Managed Identity, lalu membuat SAS URL read-only berumur pendek. |
| 4b | Browser mengambil gambar langsung dari Storage memakai SAS URL tersebut. |
| 5 | Timer Trigger menjalankan Azure Functions sesuai jadwal. |
| 6 | Functions memanggil endpoint bulk-read internal di App Service (HTTPS + token internal). |
| 7 | Functions mengirim hasil rekomendasi ke endpoint internal, lalu App Service menulis ke `PRODUCTION_RECOMMENDATION`. |
| 8 | App Service dan Functions mengambil secret dari Key Vault dengan Managed Identity (Microsoft Entra ID). |
| 9 | Push ke `main` memicu GitHub Actions (lint, test, build), lalu deploy ke Static Web Apps, App Service, dan Functions. |

## Kontrol Keamanan

| Komponen | Firewall / akses | Autentikasi | Enkripsi |
|---|---|---|---|
| Static Web Apps | Publik | - | HTTPS otomatis |
| App Service | Publik; CORS hanya `FRONTEND_URL`; FTP dimatikan | JWT (pengguna), token internal (AI) | HTTPS Only, TLS min 1.2 |
| Azure SQL | Firewall rule: hanya IP outbound App Service; opsi Allow Azure services dimatikan | Login SQL kuat, disimpan di Key Vault | TLS min 1.2, `encrypt=true` |
| Storage | Akses anonim dimatikan | Managed Identity (backend), SAS read-only (browser) | Secure transfer (HTTPS), TLS min 1.2 |
| Key Vault | Hanya identitas dengan peran RBAC | Managed Identity + Azure RBAC | HTTPS |
| Functions | Tidak ada endpoint HTTP publik (timer) | Managed Identity | HTTPS |
| GitHub Actions | - | Kredensial deploy di GitHub Secrets | HTTPS |

## Daftar Resource, Nama, dan Tier

| Lapisan | Layanan | Nama resource (usulan) | Tier |
|---|---|---|---|
| - | Resource Group | `rg-replate` | - |
| Presentasi | Azure Static Web Apps | `swa-replate` | Free |
| Aplikasi | App Service Plan + Web App | `asp-replate` / `app-replate-api` | Basic B1 (Linux) |
| AI | Function App | `func-replate-ai` | Flex Consumption |
| Data | SQL Server + Database | `sql-replate` / `sqldb-replate` | Free offer (serverless) |
| Data | Storage Account | `streplate<akhiran>` | Standard, LRS, Hot |
| Keamanan | Key Vault | `kv-replate` | Standard |
| Aplikasi dan AI | Managed Identity (fitur bawaan) | system-assigned pada `app-replate-api` dan `func-replate-ai` | Gratis |
| Pemantauan | Application Insights | `appi-replate` | Opsional |

## Catatan Tambahan

- Private endpoint tidak dipakai untuk menghemat kredit Azure for Students. Keamanan dijaga lewat firewall rule, autentikasi, dan enkripsi koneksi.
- Functions tidak mengakses database secara langsung, sehingga firewall SQL cukup mengizinkan App Service.
- Functions juga memakai Storage Account sebagai host storage dengan Managed Identity.
- Migrasi Prisma dijalankan dari App Service (startup) agar firewall SQL tidak perlu dibuka untuk GitHub Actions.
- IP outbound App Service di firewall SQL perlu diperbarui jika tier App Service diubah.
- Semua resource berada di satu region yang diizinkan akun Azure for Students.
