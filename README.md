# AI Customer Service Workbench

## Management workbench

Configure `ADMIN_UI_PASSWORD` (12+ characters) and `ADMIN_UI_SESSION_SECRET` (32+ characters) in ignored local `.env`. Visit `/login`; production requires HTTPS for the Secure session cookie. Internal API Bearer credentials remain separate.

The list queries 20 conversations per page in the database and preserves search/status filters. Detail pages initially show the latest 50 messages and can prepend older 50-message pages without moving the reader's visible position. Execution records are also paginated in groups of 50. Open conversations can be handed off or resolved, and handed-off conversations can be resolved. Running executions block manual changes. Successful changes append a system message in the same transaction.

Login has a shared single-process budget of five attempts per 15 minutes, reset on success. Restarting clears the budget; multiple instances need a shared limiter before deployment. All administrators share the cooldown. Login, logout and status POST requests require a matching Origin header; configure a reverse proxy to preserve the public origin.

A modular AI customer service platform MVP. The current repository contains the runnable foundation only; customer service business modules will be added as independently testable vertical slices.

## Requirements

- Node.js 20.9 or newer
- pnpm 10 or newer

## Setup

```bash
pnpm install
Copy-Item .env.example .env
pnpm db:push
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The health endpoint is available at [http://localhost:3000/api/health](http://localhost:3000/api/health).

On macOS or Linux, replace the environment-file command with `cp .env.example .env`.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Conversation Internal API

Workbench search matches customer IDs or any historical message; the summary still displays the latest message. Execution history is chronological, 50 records per page; an empty out-of-range workbench page returns to the first page. Apply `pnpm exec prisma migrate deploy` to install the composite pagination indexes. Substring message search may still scan content; these indexes support ordering and customer/status scoping, not full-text search.

- POST /api/internal/conversations creates a conversation from customerId and initialMessage.
- GET /api/internal/conversations lists conversations with their latest message, 20 at a time. Pass `?page=2` for later pages; the response includes `{ data, page, pageSize, total }`.
- GET /api/internal/conversations/:conversationId returns the conversation and ordered message history.
- GET /api/internal/conversations/:conversationId/messages returns the latest 50 messages in chronological display order. Pass the opaque `nextCursor` back as `?before=...` to load earlier messages. Customer credentials can only read their own conversations.
- POST /api/internal/conversations/:conversationId/messages appends a customer, agent, or system message.

New conversations start as open. Status transitions are enforced by the Conversation service and remain internal until the runtime, approval, and handoff modules use them.

## MVP Agent Runtime

After creating a conversation, call `POST /api/internal/conversations/:conversationId/run`
with no body. It processes the latest unanswered customer message, queries orders
using the conversation's customer ID, persists an agent reply, and returns
`{ status, reply, toolResult }`. Successful queries leave the conversation `open`;
missing customers, failed tools, and unsupported requests enter `human_handoff`.
Repeated runs without a new customer message return 409.

Read execution history with `GET /api/internal/conversations/:conversationId/executions`.
The response is `{ executions, nextOffset }`: up to 50 records in chronological
order, including status, decoded tool result, failure code, and timestamps.
Pass `?offset=<nextOffset>` for the next page; `null` marks the last page.
Existing conversations without executions return an empty list; missing conversations
return 404. Responses are not cached. This is a trusted internal diagnostic endpoint
and returns customer/order data contained in tool results.

The default `RuleIntentProvider` is a deterministic Chinese/English keyword demo,
not an LLM. `IntentProvider`, `AgentRuntime`, and the typed `RuntimeTools` registry
are injectable; only the read-only order tool is registered. No model key is required.
Execution claims and reply completion use database transactions. `RuntimeExecution`
records the customer message, tool result, completion status, and sanitized failure code.
Each message can start only one execution. Apply migrations with `pnpm exec prisma migrate deploy`
before running the updated app. Call `POST /api/internal/runtime/recover` after a restart
or during maintenance to move executions older than 15 minutes to human handoff.
Recovery never repeats a tool call; a late worker cannot commit a recovered execution.
There is no automatic scheduler or tool cancellation; tool results are recorded at
completion, so results from a crashed worker may be absent. Internal endpoints assume a trusted local caller and must not
be exposed publicly without authentication and customer ownership checks.

## Optional OpenAI intent classification

The default `INTENT_PROVIDER=rule` remains offline. To opt in, configure local
`.env` with `INTENT_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL` (an
account-accessible model supporting Responses API Structured Outputs). Restart
the server after changing configuration. Never commit a populated environment file.
`OPENAI_TIMEOUT_MS` defaults to 15000 and must be between 1 and 120000.
Invalid configuration fails instead of silently selecting another provider.

The adapter uses [Responses Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
with `store: false`, and sends only the current customer question to OpenAI.
The question itself may contain personal data. Profiles and order results are not
sent to the model. The model chooses only `order_query` or `handoff`; customer IDs
still come from the conversation, and replies use actual tool data.
Timeouts, HTTP/network errors, refusals, and invalid output produce a handoff reply
and a persisted `MODEL_*` failure code, without exposing raw upstream messages.
Requests are not automatically retried. Tests mock HTTP and require no API key;
a live model smoke test must be run separately with local credentials.

## Optional DeepSeek intent classification

In local `.env`, set `INTENT_PROVIDER=deepseek`, `DEEPSEEK_API_KEY`,
`DEEPSEEK_BASE_URL=https://api.deepseek.com`, `DEEPSEEK_MODEL=deepseek-flash`, and
`DEEPSEEK_TIMEOUT_MS=30000`. Model names are configurable; use one available to
your account. Restart the server after configuration. OpenAI credentials are not
needed in this mode. The default remains offline `rule`.

The adapter uses [DeepSeek Chat Completions JSON Output](https://api-docs.deepseek.com/guides/json_mode/)
with thinking disabled and validates the intent locally. Only the current question
is sent to DeepSeek; profiles and order results stay local. Only official API base
URLs (`https://api.deepseek.com`, optionally `/v1`) are accepted. There are no
automatic retries. Empty/truncated/invalid output, refusals, timeout and HTTP errors
use the existing `MODEL_*` failure codes and human handoff. All automated tests
mock HTTP; real credentials remain in ignored local environment files.
An optional live smoke test sends one synthetic question using local `.env`:
in PowerShell, set `$env:RUN_DEEPSEEK_LIVE='1'` and run `pnpm test`.
Remove that environment variable afterwards; the live test is skipped by default.

## Live order acceptance

The live test commands require Node.js 22 or newer.
After configuring DeepSeek credentials in local `.env`, run `pnpm build` then
`pnpm test:live:orders`. This opt-in test starts the production server on a loopback
port with a temporary SQLite database, applies migrations, and exercises the real
HTTP API from conversation creation through DeepSeek intent classification, mock
order lookup, reply/history persistence and duplicate-run rejection. It sends one
synthetic question to DeepSeek and may incur API usage. It stops its own server
and removes its temporary database afterwards; the normal database is untouched.

## Internal API authentication

All `/api/internal/*` routes require `Authorization: Bearer <token>`. Configure
`INTERNAL_API_TOKENS` in local `.env` as a JSON array of credentials, for example:

```dotenv
INTERNAL_API_TOKENS='[{"token":"REPLACE_WITH_RANDOM_CUSTOMER_TOKEN","role":"customer","customerId":"customer-1"},{"token":"REPLACE_WITH_RANDOM_OPERATOR_TOKEN","role":"operator"}]'
```

Replace each example token with a distinct cryptographically random value of at
least 32 characters. Missing/invalid configuration returns 503, missing/invalid
credentials return 401. Customer credentials can create and list only their own
conversations, read/run only owned conversations and append only customer messages.
Foreign conversation IDs return 404. Operator credentials can access all customers
and call the recovery endpoint; customer recovery calls return 403.
This MVP uses server-managed credentials, not end-user login or a full IAM system.
Keep operator tokens server-side, use HTTPS outside loopback, and rotate tokens by
replacing local configuration and restarting. `/api/health` stays unauthenticated.
The live acceptance script generates temporary customer credentials in memory and
checks anonymous access, impersonation, foreign records and forged message roles.

## Project layout

- `src/app`: Next.js UI and Internal API routes
- `src/modules`: replaceable MVP business capability boundaries
- `src/test`: shared test setup
- `prisma`: local SQLite data model configuration

See `PRD.md`, `ARCHITECTURE.md`, `DEVELOPMENT_RULES.md`, and `TESTING.md` before implementing a new major feature.
