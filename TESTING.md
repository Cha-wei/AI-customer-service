# Testing

Web Chat checks: `pnpm test:e2e:chat` after `pnpm build` runs a real headless browser
against a disposable production server/database. Set `PLAYWRIGHT_CHANNEL=msedge`
to use installed Edge, or install Playwright Chromium. Coverage includes order queries,
history after reload, explicit refund selection, approval and rejection polling,
failed-send draft retention and retry, mobile overflow, expired sessions, cross-customer
reads/writes, forged roles/identities, CSRF, pending-state guards and client bundle secrets.
Unit/component tests additionally cover history prepending, invalid configuration,
tampered/expired signatures, provider/runtime failure sanitization and unanswered-message guards.

## Goals

Tests should protect meaningful behavior and module contracts. Prefer focused tests over coverage-driven test volume.

The MVP test suite should prioritize:

- core customer service flows
- replaceable module interfaces
- policy decisions
- tool execution
- approval transitions
- error handling and human handoff

## Test levels

- Unit tests cover domain behavior and policy decisions.
- Integration tests cover module adapters, persistence, and API boundaries.
- Component tests cover important management interface behavior.
- End-to-end tests are added when the first complete customer flow exists.

## Commands

```bash
pnpm test
pnpm test:watch
pnpm typecheck
pnpm lint
pnpm build
```

Before a stage is committed, run all relevant checks and ensure no secrets or local database files are included.

Refund integration tests apply every migration to an isolated temporary SQLite database.
They cover Policy gating, pending/approve/reject, duplicate and concurrent decisions,
duplicate order requests, customer/order isolation, ambiguous orders, provider/tool
failure, expired executions and transaction rollback on failed reply persistence.
Admin route tests check session and Origin protection. Production acceptance also
exercises refund forms, approve/reject outcomes and duplicate decision rejection.

After `pnpm build`, run `node scripts/verify-admin.mjs` for production HTTP acceptance: login, cookie flags, protected pages, mock order execution, status updates, logout and throttling. It uses temporary credentials/database and cleans them up. It tests cookie transport with an HTTP client; production browser access still requires HTTPS.
