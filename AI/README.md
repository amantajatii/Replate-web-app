# Replate production analytics (VPS batch)

An executable portfolio slice: SQL production records → authenticated extraction → quality checks → per-menu forecasting → chronological evaluation → recommendation upsert → owner dashboard at `/owner/insights/`. Runs as a Python batch alongside the Node API and SQL Server on a VPS; no hosted model or GPU is required.

## Reproduce the offline demo

Python 3.12 and pinned dependencies:

```sh
python3.12 -m venv AI/.venv
AI/.venv/bin/pip install -r AI/requirements.txt
cd AI
.venv/bin/python -m unittest discover -s tests -v
mkdir -p artifacts
.venv/bin/python demo_data.py artifacts/demo-data.json
.venv/bin/python recommend.py --input artifacts/demo-data.json --target-date 2026-11-04 --report artifacts/evaluation-demo.json
```

The generator deterministically creates 90 observations each for two fictional menus. All generated data and reports are ignored by Git. `--input` always stays offline, even without `--dry-run`. Results on these fixtures demonstrate reproducibility; they do not establish restaurant accuracy or a reduction in food waste.

## Target and evaluation

- Target: **observed regular sold quantity**, not discounted surplus orders. Sales are stock-capped observations, not unconstrained demand. The existing SQL field `predictedDemand` stores this sales estimate.
- Train each menu separately on at most 180 calendar days, strictly before `targetDate`. No restaurant/customer identity features, external weather or listing joins.
- Nonnegative integer quantities must balance (`sold + surplus = produced`). Reject malformed/out-of-window rows and all copies of duplicate dates. Never fill absent calendar dates with zero. Minimum 35 valid observed days; seven warm-up observations are used for features.
- Features: weekday sine/cosine, previous observed sales, mean of the last seven observations, same-weekday baseline, previous surplus ratio and elapsed days. No current-day produced/sold/surplus feature.
- Chronological partition: older data for fitting, next seven observations for model selection, final seven for independent testing. Compare Random Forest with the mean of the last four matching weekdays (fallback: seven observations). Choose only on validation MAE, then report independent test MAEs for both candidates. Selection does **not** guarantee winning on the test week.
- Test features use already observed previous test-day outcomes, matching daily one-step-ahead operation. This is not a seven-day-ahead forecast. Features are built from prior observations only; a future/target-day record cannot affect predictions.
- Refit the selected forest on all available history before predicting, or use the selected baseline. Persist two-decimal nonnegative estimates and `ceil(estimate)` portions without an arbitrary buffer.
- No persisted pickle or model registry: the inexpensive per-menu model is rebuilt on each batch. `modelVersion` identifies the strategy implementation, not a trained artifact. Reports preserve data counts, windows, provenance and evaluation. Store/back up reports separately if audit history is required; the current SQL upsert retains the latest result per menu/date.

For the evaluation rationale see the [official scikit-learn time-series example](https://scikit-learn.org/stable/auto_examples/applications/plot_time_series_lagged_features.html). Historical edits are not point-in-time versioned in the current production table, so retrospective evaluation is a development estimate rather than an audited production backtest.

## API and local SQL demo

Set a random `AI_SERVICE_KEY` of at least 32 characters on the backend and the batch environment. Never put it in a `NEXT_PUBLIC_` variable or browser storage. Run the existing backend with Node 24. Endpoints:

- `GET /api/internal/ai/training-data?targetDate=YYYY-MM-DD&afterMenuId=0`: private key in `X-AI-Key`; 50 active menus per page; follow `nextMenuId` until null. Only menu metadata and production quantities, without customer/order/owner contact data.
- `POST /api/internal/ai/recommendations`: one validated recommendation, same private key. Upsert on SQL's existing `(menuId,targetDate)` unique index. Server generates the timestamp. Key missing from config → 503; bad/missing caller key → 401.
- `GET /api/owner/restaurants/:id/recommendations?date=YYYY-MM-DD`: RestaurantOwner JWT plus restaurant ownership check. Returns only that restaurant's active menus/history and saved results. Public clients cannot publish recommendations.

```sh
# From repo root; use today's Jakarta date for a current-date demo.
AI/.venv/bin/python AI/demo_data.py AI/artifacts/demo-data.json 2026-11-04
pnpm --dir backend db:seed-ai-demo
# Export matching AI_SERVICE_KEY privately, and AI_API_URL (default http://localhost:5052).
AI/.venv/bin/python AI/recommend.py --target-date 2026-11-04 --report AI/artifacts/evaluation-api.json
# Repeat the same command: existing menu/date recommendations are updated.
```

Seeding refuses all databases except `ReplateLocal` on localhost:14339. It creates a dedicated `[DEMO SINTETIS]` restaurant with no marketplace listings and preserves existing records on reruns. Initial random demo login credentials are written once to ignored, owner-readable `backend/.env.ai-demo-account`; they are never printed. Log in using that account, open **Analitik & AI**, and select the seeded target date. A real restaurant stays empty until it has enough production records. `--dry-run` fetches/evaluates without publishing.

Run the full local round-trip check after seeding:

```sh
AI_PYTHON=/absolute/path/to/AI/.venv/bin/python pnpm --dir backend test:ai-local
```

It starts a temporary API listener, runs the real Python HTTP batch twice, checks SQL row IDs remain unchanged, verifies the owner dashboard and denies another owner. The listener closes at the end; demo records remain for inspection.

## Operational boundaries

A failed request exits nonzero. A retry safely republishes existing menu/date results; a failed batch may have published earlier menus, so inspect the exit status and rerun. Menus with insufficient valid data are skipped, never fabricated. Automatic daily results target **today in Asia/Jakarta at 02:00**, using records through yesterday. The batch uses the same target-date contract as the owner dashboard.

See [VPS setup](../deploy/README.md). No remote deployment is performed by these files. Scale evidence is local/small-data until a real dataset and measured load test exist; describe this as analytics/ML engineering in your portfolio rather than claiming big-data production scale.
