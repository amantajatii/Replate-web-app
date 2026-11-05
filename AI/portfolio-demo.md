# Portfolio evidence: synthetic production analytics

This feature demonstrates data extraction, validation, feature engineering, chronological evaluation, authenticated integration, SQL idempotency and a customer-facing owner dashboard. It does not demonstrate production-scale big data or measured food-waste reduction.

## Reproducible example

Target date: 2026-11-04. Two deterministic fictional menus, 90 observations each. Seven observations warm up historical features, 69 fit the initial forest, seven select the strategy, seven independently test it. The selected forest is refitted before its test prediction, then again on all usable history for the final recommendation.

| Synthetic menu | Validation forest MAE | Validation baseline MAE | Chosen strategy | Independent test MAE | Test baseline MAE |
| --- | ---: | ---: | --- | ---: | ---: |
| Nasi ayam demo | 1.5247 | 2.0000 | Random Forest | 2.2393 | 2.4643 |
| Roti sayur demo | 1.9037 | 1.1071 | Weekday baseline | 2.4286 | 2.4286 |

MAE is measured in portions. These are fixture results, not accuracy estimates for a real restaurant. Selection uses validation; the independent test never decides the winner. Reproduce with the commands in [README](README.md); the full JSON report contains counts, periods, both candidates and the saved recommendation payload. Floating-point results may vary slightly by platform.

## Presenting the work

Suggested portfolio description (adapt contribution claims to your actual work):

> Replate: pipeline analitik produksi dan surplus makanan dengan Python, pandas, scikit-learn, Express, dan SQL Server. Mengintegrasikan rekomendasi per menu ke dashboard restoran, membandingkan model dengan baseline menggunakan validasi dan pengujian berurutan, serta menyiapkan batch harian untuk VPS. Evaluasi demo memakai data sintetis yang dapat direproduksi.

Show the owner dashboard with the synthetic banner, then explain the evaluation JSON and the repeat-publication/ownership check. Distinguish your own analysis and decisions from assisted implementation when discussing the project. Have a real-data validation plan: gather balanced daily records with permission, monitor missing/late entries and stockouts, compare forecast error against the baseline over several future weeks, and only then measure any change in surplus.

## Local verification

- Backend: 18 tests passed, including private-key auth, owner authorization, invalid dates and recommendation validation.
- Python: seven tests passed, including future-row invariance, chronological evaluation, invalid/duplicate rows, insufficient history, zero sales and baseline selection.
- Frontend: three existing tests passed; lint and Node 24 backend/frontend production build passed.
- Real local SQL round trip: two synthetic menu recommendations persisted; publishing twice preserved both row IDs; the owner dashboard returned both results and a different owner received 404.
- Desktop browser: guest-session login, owner navigation, pending-result state, switching target date, chart and saved 30/17-portion recommendations inspected against the local API.
- Compose configuration validated. Docker image builds, Linux/systemd execution, mobile visual checks and a remote VPS deployment remain unverified.
