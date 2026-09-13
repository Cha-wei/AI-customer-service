# Web Chat login and deployment acceptance

## Current identity boundary

The repository has operator/customer Internal API credentials and a separate shared
admin password. Neither authenticates a real end customer in a browser. Customer
Context and orders are Mock providers. There is no customer account database, OIDC
configuration, trusted host login implementation, or saved remote deployment target.

The only existing trusted issuer is the authenticated host server calling
`POST /api/internal/web-chat/session` with an operator token. It must derive
`customerId` from its verified login context and a server-maintained mapping to
Customer Context. A submitted customer ID, email, URL parameter, or browser header
is not sufficient evidence of identity. The account discriminator used by chat
requests only prevents stale drafts; it cannot issue a session.

Before real-login acceptance, supply the host login implementation or identity
provider configuration, stable subject-to-customer mapping, callback/public origin,
and test accounts representing two different customers. Keep operator and provider
credentials in server environment configuration. The host must forward Set-Cookie
only to the corresponding authenticated browser on the chat origin, revoke the
previous chat cookie before account replacement, and coordinate host logout.
The chat logout endpoint does not log out an upstream identity provider.

## Deployment prerequisites

1. Provide the HTTPS staging address and authorized deployment mechanism.
2. Use a single persistent server/database for this SQLite MVP. Back up the database,
   install dependencies, run `pnpm db:generate`, and apply
   `pnpm exec prisma migrate deploy` before starting the new build.
3. Configure `DATABASE_URL`, `WEB_CHAT_SESSION_SECRET`, `INTERNAL_API_TOKENS`,
   `ADMIN_UI_PASSWORD`, `ADMIN_UI_SESSION_SECRET`, and the exact HTTPS `APP_ORIGIN`
   in the deployment secret store. Signing secrets must be independent.
4. Run `pnpm build` and `pnpm start` behind the HTTPS proxy. Restrict direct access
   to the upstream HTTP port. Do not cache authenticated API responses.
5. Test actual host login, expiry, logout/replay, account switching and two-customer
   isolation. Query orders and approve/reject a Mock refund through the admin UI.
   Verify browser requests, responses and bundles contain no internal credentials.

## Verification performed / remaining

The automated HTTPS harness (`pnpm test:e2e:chat:https`) starts an isolated production
Next server behind a loopback TLS proxy, migrates a disposable database and generates
temporary credentials. It requires PowerShell 7 and Playwright Chromium (or
`PLAYWRIGHT_CHANNEL=msedge`). It generates a one-hour localhost certificate without
installing trust globally. The HTTP test client trusts that certificate explicitly;
the test browser permits only its generated public-key fingerprint. Temporary keys
and database are removed on exit. No real customer data or payment operation is used.

Checks include browser order query/history, explicit refund selection, admin
approve/reject and customer result polling, cross-customer reads/writes/order access,
account-switch cleanup, logout cookie replay rejection, and browser bundle credential
scanning. Unit tests cover expiration, revocation failure and stale-account POSTs.

This is local HTTPS transport acceptance. Remote deployment, public certificate/DNS,
real customer login callbacks, subject mapping and upstream logout remain unverified
until the missing environment and identity configuration are supplied.
