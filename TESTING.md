# Testing

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
