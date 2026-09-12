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

The default `RuleIntentProvider` is a deterministic Chinese/English keyword demo,
not an LLM. `IntentProvider`, `AgentRuntime`, and the typed `RuntimeTools` registry
are injectable; only the read-only order tool is registered. No model key is required.
The run guard is process-local, not a distributed lock. Reply persistence and status
updates are separate operations; crash recovery and transactional execution records
remain future work. Internal endpoints assume a trusted local caller and must not
be exposed publicly without authentication and customer ownership checks.

## Project layout

- `src/app`: Next.js UI and Internal API routes
- `src/modules`: replaceable MVP business capability boundaries
- `src/test`: shared test setup
- `prisma`: local SQLite data model configuration

See `PRD.md`, `ARCHITECTURE.md`, `DEVELOPMENT_RULES.md`, and `TESTING.md` before implementing a new major feature.
