# Module Boundaries

Business capabilities will be introduced as vertical slices under this directory.

Planned MVP boundaries:

- `conversations`: conversation and ticket lifecycle
- `agent-runtime`: orchestration only
- `knowledge`: enterprise knowledge provider
- `customer-context`: customer and order context provider
- `tools`: replaceable business actions
- `policy`: automatic execution and approval rules
- `approvals`: approval request lifecycle
- `handoff`: escalation to human support

Each replaceable capability should expose a small interface. Mock and real adapters must implement the same contract so infrastructure changes do not require rewriting the runtime.

Current replaceable boundaries:

- `internal-auth` authenticates internal API callers and enforces customer ownership at HTTP boundaries. The MVP binds opaque bearer credentials to customer/operator identities using local environment configuration.

- `customer-context` exposes `CustomerContextProvider`; the MVP implementation serves mock customer and order data.
- `tools` exposes a uniform `Tool` call/result contract; `OrderQueryTool` reads orders and logistics through `CustomerContextProvider`.
