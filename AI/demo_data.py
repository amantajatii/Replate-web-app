"""Generate deterministic synthetic history. No real restaurant/customer data."""
from datetime import date, timedelta
import json
from pathlib import Path
import random
import sys


def dataset(target_date='2026-11-04'):
    target = date.fromisoformat(target_date)
    rng = random.Random(42)
    menus = []
    for menu_id, name, base in [(1, 'Nasi ayam demo', 24), (2, 'Roti sayur demo', 16)]:
        records = []
        for i in range(90):
            day = target - timedelta(days=90 - i)
            sold = base + (10 if day.weekday() >= 5 else 0) + i // 20 + rng.randint(-3, 3)
            surplus = rng.randint(2, 9)
            records.append({'productionDate': day.isoformat(), 'producedQuantity': sold + surplus,
                            'soldQuantity': sold, 'surplusQuantity': surplus})
        menus.append({'menuId': menu_id, 'restaurantId': 1, 'name': name, 'synthetic': True, 'records': records})
    return {'menus': menus}


if __name__ == '__main__':
    output = Path(sys.argv[1] if len(sys.argv) > 1 else 'demo-data.json')
    output.write_text(json.dumps(dataset(sys.argv[2] if len(sys.argv) > 2 else '2026-11-04'), indent=2) + '\n')
    print(f'Synthetic demo: {output}')
