# Production recommendation: portfolio slice

Build a VPS-compatible batch pipeline, not a new chat service. Keep the existing SQL Server schema and application auth.

- Extract at most 180 days of production records per active menu, without joining listings/orders or exposing customer data.
- Forecast observed regular sales per menu with chronological validation plus independent test; compare Random Forest against a weekday baseline. Skip menus with fewer than 35 valid observations.
- Publish one recommendation per menu/date through a private, authenticated endpoint. Repeated runs update the existing row.
- Show history, surplus and saved recommendations in the owner shell with ownership checks and honest empty states.
- Provide deterministic synthetic demo data, offline evaluation, automated checks and VPS batch scheduling instructions. Label synthetic results explicitly.

Acceptance: Python leakage/data-quality tests, backend authentication/ownership/validation tests, frontend checks/build, and a local SQL/API round trip. No Azure dependency, remote deployment, production accuracy claim or food-safety classifier.
