"""Daily per-menu forecast. Only prior observed regular sales are features/labels."""
import argparse
from datetime import date, datetime, timedelta
import json
import math
import os
from pathlib import Path
import sys
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

MIN_HISTORY = 35
HOLDOUT = 7


def clean_records(records, target_date):
    target = date.fromisoformat(target_date)
    valid, rejected = [], 0
    for row in records:
        try:
            day = date.fromisoformat(row['productionDate'])
            quantities = [row[key] for key in ('producedQuantity', 'soldQuantity', 'surplusQuantity')]
            if not all(type(n) is int and 0 <= n <= 100000 for n in quantities):
                raise ValueError('Invalid quantity')
            if quantities[1] + quantities[2] != quantities[0]:
                raise ValueError('Unbalanced production')
            if not target - timedelta(days=180) <= day < target:
                raise ValueError('Outside training window')
            valid.append(dict(row, productionDate=day.isoformat()))
        except (KeyError, TypeError, ValueError):
            rejected += 1
    if not valid:
        return [], rejected
    frame = pd.DataFrame(valid).sort_values('productionDate')
    duplicates = frame.duplicated('productionDate', keep=False)
    rejected += int(duplicates.sum())
    return frame[~duplicates].to_dict('records'), rejected


def baseline(history, day):
    same_weekday = [r['soldQuantity'] for r in history if date.fromisoformat(r['productionDate']).weekday() == day.weekday()][-4:]
    values = same_weekday or [r['soldQuantity'] for r in history[-7:]]
    return sum(values) / len(values)


def features(history, day):
    previous = history[-1]
    recent = [r['soldQuantity'] for r in history[-7:]]
    weekday = day.weekday() * 2 * math.pi / 7
    return [math.sin(weekday), math.cos(weekday), previous['soldQuantity'],
            sum(recent) / len(recent), baseline(history, day),
            previous['surplusQuantity'] / max(1, previous['producedQuantity']),
            (day - date.fromisoformat(history[0]['productionDate'])).days]


def forecast(menu, target_date):
    records, rejected = clean_records(menu['records'], target_date)
    report = {'menuId': menu['menuId'], 'name': menu['name'], 'synthetic': menu.get('synthetic', False),
              'validObservations': len(records), 'rejectedRows': rejected, 'targetDate': target_date}
    if len(records) < MIN_HISTORY:
        return dict(report, status='insufficient-history', minimumObservations=MIN_HISTORY)
    # Missing calendar days are unknown, never inserted as zero-sales days.
    x = [features(records[:i], date.fromisoformat(records[i]['productionDate'])) for i in range(7, len(records))]
    y = [r['soldQuantity'] for r in records[7:]]
    model = RandomForestRegressor(n_estimators=80, min_samples_leaf=3, random_state=42, n_jobs=1)
    # Select on the validation week; reserve the last week for independent testing.
    model.fit(x[:-2 * HOLDOUT], y[:-2 * HOLDOUT])
    validation_forest_mae = float(mean_absolute_error(y[-2 * HOLDOUT:-HOLDOUT], model.predict(x[-2 * HOLDOUT:-HOLDOUT])))
    validation_start = len(records) - 2 * HOLDOUT
    first_test = len(records) - HOLDOUT
    validation_baseline = [baseline(records[:i], date.fromisoformat(records[i]['productionDate'])) for i in range(validation_start, first_test)]
    validation_baseline_mae = float(mean_absolute_error(y[-2 * HOLDOUT:-HOLDOUT], validation_baseline))
    use_forest = validation_forest_mae < validation_baseline_mae
    model.fit(x[:-HOLDOUT], y[:-HOLDOUT])
    forest_mae = float(mean_absolute_error(y[-HOLDOUT:], model.predict(x[-HOLDOUT:])))
    baseline_predictions = [baseline(records[:i], date.fromisoformat(records[i]['productionDate'])) for i in range(first_test, len(records))]
    baseline_mae = float(mean_absolute_error(y[-HOLDOUT:], baseline_predictions))
    day = date.fromisoformat(target_date)
    if use_forest:
        model.fit(x, y)
        prediction = float(model.predict([features(records, day)])[0])
        version = 'random-forest-v1'
    else:
        prediction = baseline(records, day)
        version = 'weekday-v1'
    prediction = round(min(100000, max(0, prediction)), 2)
    selected_mae = forest_mae if use_forest else baseline_mae
    provenance = 'Data demo sintetis. ' if menu.get('synthetic') else ''
    insight = (f'{provenance}{len(records)} catatan valid hingga {records[-1]["productionDate"]}. '
               f'Uji 7 observasi terakhir: MAE terpilih {selected_mae:.2f}, baseline {baseline_mae:.2f} porsi. '
               f'Dipilih {version}; perkiraan penjualan reguler, dibulatkan ke atas tanpa buffer. '
               f'Penjualan teramati dapat dibatasi stok; ini saran, bukan jaminan permintaan. '
               f'{rejected} baris di luar jendela/tidak valid/duplikat diabaikan.')
    recommendation = {'menuId': menu['menuId'], 'targetDate': target_date, 'predictedDemand': prediction,
                      'recommendedQuantity': math.ceil(prediction), 'modelVersion': version, 'insight': insight}
    return dict(report, status='ready', trainingObservations=len(y) - 2 * HOLDOUT, validationObservations=HOLDOUT, testObservations=HOLDOUT,
                validationForestMAE=round(validation_forest_mae, 4), validationBaselineMAE=round(validation_baseline_mae, 4),
                testStart=records[first_test]['productionDate'], testEnd=records[-1]['productionDate'],
                forestMAE=round(forest_mae, 4), baselineMAE=round(baseline_mae, 4), selectedMAE=round(selected_mae, 4),
                recommendation=recommendation)


def api_request(base_url, key, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    request = Request(base_url.rstrip('/') + path, data=data,
                      headers={'X-AI-Key': key, 'Content-Type': 'application/json'})
    with urlopen(request, timeout=60) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target-date', default=datetime.now(ZoneInfo('Asia/Jakarta')).date().isoformat(), type=lambda s: date.fromisoformat(s).isoformat())
    parser.add_argument('--input', type=Path, help='Offline training-data JSON; never publishes')
    parser.add_argument('--report', type=Path, default=Path('evaluation.json'))
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    results = []
    base, key = os.environ.get('AI_API_URL', 'http://localhost:5052'), os.environ.get('AI_SERVICE_KEY', '')
    if not args.input and len(key) < 32:
        parser.error('AI_SERVICE_KEY must contain at least 32 characters')
    def process(menus):
        for menu in menus:
            result = forecast(menu, args.target_date)
            if not args.input and not args.dry_run and result['status'] == 'ready':
                api_request(base, key, '/api/internal/ai/recommendations', result['recommendation'])
                result['published'] = True
            results.append(result)
    if args.input:
        process(json.loads(args.input.read_text())['menus'])
    else:
        after = 0
        while True:
            page = api_request(base, key, f'/api/internal/ai/training-data?targetDate={args.target_date}&afterMenuId={after}')
            process(page['menus'])
            if page['nextMenuId'] is None:
                break
            after = page['nextMenuId']
    report = {'targetDate': args.target_date, 'evaluation': 'chronological validation (7) and independent test (7); one-step-ahead features',
              'generatedAt': datetime.now(ZoneInfo('UTC')).isoformat(), 'results': results}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(f'{len(results)} menus; {sum(r["status"] == "ready" for r in results)} ready; report: {args.report}')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Batch failed: {type(error).__name__}. Check API availability, credentials and input data.', file=sys.stderr)
        sys.exit(1)
