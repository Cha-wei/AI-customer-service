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

## Project layout

- `src/app`: Next.js UI and Internal API routes
- `src/modules`: replaceable MVP business capability boundaries
- `src/test`: shared test setup
- `prisma`: local SQLite data model configuration

See `PRD.md`, `ARCHITECTURE.md`, `DEVELOPMENT_RULES.md`, and `TESTING.md` before implementing a new major feature.
