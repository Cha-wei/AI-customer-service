# MVP customer login acceptance

## Implemented identity source

`/chat/login` submits only a login name and password to `/api/chat/session`. The
server verifies a salted scrypt hash in CustomerAccount, checks enabled state and
Customer Context existence, and uses the stored customerId mapping. It directly
issues the existing signed HttpOnly cookie; no internal token enters the browser.
Local-account cookies include account ID and session version. Password reset,
disable and enable increment the version. Every chat request rechecks the account.
Operator credentials and the separate admin login remain privileged; a customer
session cannot approve refunds or provision another identity.

The account management CLI validates mappings against the current Mock customer
provider, enforces unique names/customer mappings and never prints passwords.
The README documents creation and maintenance commands. Accounts are not seeded
automatically into production. There is no public registration or password reset.

## Local HTTPS acceptance

Run `pnpm build`, then `pnpm test:e2e:chat:https`, using PowerShell 7, Node.js 22.18+
and Playwright Chromium or `PLAYWRIGHT_CHANNEL=msedge`. The harness migrates a
fresh disposable SQLite database and creates alice/customer-1 and bob/customer-2
through the management CLI, with generated temporary passwords. Both authenticate
through the actual browser login form; normal login does not inject cookies.

A loopback TLS proxy uses an ephemeral one-hour localhost certificate. The HTTP
client trusts that certificate explicitly and the browser permits only its generated
public-key fingerprint; no machine-wide trust or certificate bypass is installed.
The test removes its database and private key on exit. This needs no server or domain.

Acceptance covers order queries and persisted history, explicit refund selection,
admin approve/reject and customer polling, customer separation and denied customer
approval, account switching across tabs with draft clearing, revocation on switch
and logout, disabled accounts and old sessions after re-enable, uniform invalid-login
responses, login throttling, and browser bundle credential scans. Unit tests also
cover expiry, changed account mappings/versions and storage failure.

Orders and refunds remain Mock operations; there is no real money movement.

## Future external trial

External deployment is outside this local phase. When needed, use one persistent
server/database behind HTTPS, back up SQLite, run `pnpm db:generate` and
`pnpm db:migrate`, then build/start. Configure independent server
secrets and an exact HTTPS APP_ORIGIN, restrict access to the upstream HTTP port,
and disable caching of authenticated responses. Recheck public certificates, DNS,
proxy origin behavior and browser login in that environment.

The in-memory login budget resets on restart and is shared only within one process.
Distributed deployments require a shared limiter and a database topology change.
The optional host-issued Internal API sessions remain a separate privileged path;
local password version changes apply to local-account sessions only.
