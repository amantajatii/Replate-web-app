# Backend security review — 3 November 2026

Status: local functionality passes, production security approval not granted.

## Scope and evidence

Read-only review of backend auth, configuration, routes, Prisma persistence, upload handlers, and frontend token storage. Backend files were not modified by this review. `pnpm --dir backend test` passed 15 tests in five files; backend TypeScript check passed. These tests use fixtures and do not constitute penetration testing of a deployment.

`pnpm audit --prod --json` was queried against the installed workspace lockfile. Filtering findings to dependency paths starting with `backend>` returned 9 high, 20 moderate, and 3 low advisories. Advisory counts do not prove every affected feature is reachable.

## Priority findings

1. **High: vulnerable request parser is on the public request path.** Express resolves `body-parser@2.3.0`; `backend/src/app.ts` installs `express.json` before authentication with default decompression. [Maintainer advisory GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) describes a denial of service fixed in 2.4.0. Upgrade the supported dependency chain, or reject compressed request bodies consistently on JSON and raw upload parsers if compression is unnecessary. No exploit payload was sent.
2. **Session revocation is absent.** `backend/src/auth.ts` verifies JWT signature, issuer, audience, and expiry; there is no server-side session/revocation/version check. `frontend/lib/session.ts` logout only clears browser storage, and password reset in `backend/src/database.ts` changes the password without invalidating existing JWTs. A previously copied token remains usable until expiry.
3. **Bearer tokens are accessible to page JavaScript.** `frontend/lib/session.ts` stores tokens in sessionStorage/localStorage. A successful same-origin XSS could read them. Consider a coordinated backend/frontend session migration to HttpOnly, Secure cookies with the appropriate CSRF protections. No XSS exploit was established in this review.
4. **Upload and write abuse limits need deployment review.** Individual image uploads are capped at 5 MB, MIME/signature checked, owner-authenticated and randomly named; aggregate upload/storage quotas and non-auth API rate limits are absent in the application code. Auth rate limiting uses process memory, so multi-instance/reverse-proxy behavior needs validation before deployment.
5. **Triage remaining dependency advisories.** Other high findings include Nodemailer, Zod and transitive Prisma/Azure dependencies. Some concern unused options or other database providers; do not treat the full count as confirmed remotely exploitable vulnerabilities. Review reachability and upgrade without forced major-version remediation.

## Controls already present

- Passwords use bcrypt cost 12, with a dummy-hash comparison for unknown accounts.
- JWT verification pins HS256, issuer and audience; expiry and minimum secret length are checked.
- Protected routes enforce role, and database queries scope restaurant/order access to the authenticated owner/customer.
- Zod validation, JSON/image size limits, Helmet headers, and a configured frontend CORS origin are present.
- Stock allocation uses conditional updates inside a transaction; pickup verification uses constant-time comparison, ownership checks and transactional single-use verification.
- Password reset tokens are random, stored hashed, expiring and consumed once.

## Not checked

No deployment/TLS/proxy inspection, load/concurrency stress test, full secret/history scan, live SMTP test, or penetration test was performed. Workspace audit also flagged frontend dependencies; those require separate reachability triage against the static-export deployment and are not included in the backend counts above.
