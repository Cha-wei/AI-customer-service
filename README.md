# AI Customer Service Workbench

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

- POST /api/internal/conversations creates a conversation from customerId and initialMessage.
- GET /api/internal/conversations lists conversations with their latest message.
- GET /api/internal/conversations/:conversationId returns the conversation and ordered message history.
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

## Project layout

- `src/app`: Next.js UI and Internal API routes
- `src/modules`: replaceable MVP business capability boundaries
- `src/test`: shared test setup
- `prisma`: local SQLite data model configuration

See `PRD.md`, `ARCHITECTURE.md`, `DEVELOPMENT_RULES.md`, and `TESTING.md` before implementing a new major feature.
