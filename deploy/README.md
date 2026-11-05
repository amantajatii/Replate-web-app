# Ordinary VPS deployment

These files replace the proposed Azure compute/storage architecture. The executable app uses Express + SQL Server, static Next.js export served by Caddy, persistent image volumes, and a private scheduled Python container. No cloud migration or remote deployment has been executed.

Use an x86-64 Linux VPS compatible with SQL Server 2022 requirements, Docker Compose and systemd. Budget memory for SQL Server and the application in addition to the batch's 768 MB limit; this is not a configuration for a tiny 1 GB VPS. SQL Express is the default; choose the licensed SQL edition appropriate to actual use. Do not deploy Developer Edition for a production workload. See [Microsoft's container configuration documentation](https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-configure-docker?view=sql-server-ver17).

## Prepare

1. Copy this repository to `/opt/replate`. Copy `deploy/vps.env.example` to `/opt/replate/.env.vps`, set real hostname/passwords, and restrict permissions (`chmod 600 .env.vps`). Use different random JWT and AI secrets. Point DNS to the VPS and allow only web ports plus your restricted administration access.
2. Start SQL: `docker compose --env-file .env.vps -f deploy/compose.vps.yml up -d database`.
3. With an admin SQL connection, create the `Replate` database and a dedicated SQL application login mapped to it. Apply existing Prisma migrations with a separate schema-maintenance login. Grant the application only required data read/write permissions; keep the SA password out of the API container. The Compose file deliberately does not provision users or run schema changes at startup. For a fresh setup, migrations can be run with `docker compose ... run --rm -e DATABASE_URL api pnpm prisma:migrate` after exporting the **migration** connection URL privately in the current shell. Replace `...` with the same env-file and compose arguments above. Back up before migrating an existing database.
4. Build and start: `docker compose --env-file .env.vps -f deploy/compose.vps.yml -f deploy/compose.ai.yml up -d --build`.
5. Run the first batch: `docker compose --env-file .env.vps -f deploy/compose.vps.yml -f deploy/compose.ai.yml run --rm ai`.

The hostname is passed into the frontend build as `NEXT_PUBLIC_API_URL`; rebuild if it changes. API/SQL/AI publish no host ports. Caddy obtains HTTPS and serves static exported routes, proxies `/api/*` and image paths, and returns 404 for `/api/internal/*` before proxying. The private batch still requires its shared key. Do not expose port 5000 through another proxy/firewall rule. Image and database data stay in named volumes across container replacement; `docker compose down` preserves them, `down -v` destroys them.

## Daily batch

Copy `deploy/systemd/replate-ai.{service,timer}` to `/etc/systemd/system/`, then `systemctl daemon-reload` and `systemctl enable --now replate-ai.timer`. The service expects `/usr/bin/docker` and `/opt/replate`; adjust these paths if the VPS differs. It runs at 02:00 Asia/Jakarta, catches a missed run after downtime, and targets the date when actually executed. It does not backfill every missed day. Verify with `systemctl list-timers replate-ai.timer`, inspect `journalctl -u replate-ai.service`, and validate syntax with `systemd-analyze calendar '*-*-* 02:00:00 Asia/Jakarta'`. See [systemd time expressions](https://www.freedesktop.org/software/systemd/man/latest/systemd.time.html).

Reports live in the `ai-reports` volume, overwritten on each successful batch. To export the latest report from a shell:

```sh
docker compose --env-file .env.vps -f deploy/compose.vps.yml -f deploy/compose.ai.yml run --rm --entrypoint cat ai /reports/evaluation.json > evaluation.json
```

Stop future runs: `systemctl disable --now replate-ai.timer`. This does not interrupt an in-progress run. Stop the stack with `docker compose --env-file .env.vps -f deploy/compose.vps.yml down`.

SMTP is not configured in this minimum Compose stack; configure the existing SMTP environment variables on the API before using password-reset email. Run the existing security review/remediation and verify TLS, backups/restore, database privileges, resource limits, uploads, scheduled execution and real data on the target VPS before production use. This configuration is a deployment starting point, not evidence of a hardened live deployment.
