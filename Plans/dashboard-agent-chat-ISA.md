# Vault Dashboard Agent Terminal Chat ISA

## Problem

The Vault Quest Log can show vault documents inline, but it cannot yet act as a live working surface. When a document is open, Dennis should be able to ask an AI agent about that exact document, request changes, apply safe vault edits, and understand how those edits affect the rendered dashboard/site. A normal chatbot would be too weak; an unrestricted browser-to-shell bridge would be too dangerous.

## Vision

The feature should feel like a private Quake-style terminal dropped into the codex: press `Ctrl+§`, a beautiful retro console slides down from the top of the page, already aware of the document on screen, and the agent can answer, propose patches, apply approved vault edits, and show what changed. It should make Dennis proud because it feels powerful, calm, and sovereign: not a toy chat bubble, not a scary remote shell, but a trusted operator with visible boundaries.

## Out of Scope

This phase does not expose arbitrary shell access, public chat, multi-user collaboration, long-term autonomous agents, voice I/O, direct provider APIs, browser-triggered commits, or browser-triggered deploys. It does not replace Obsidian, Matrix Sia, or the existing vault workflows.

## Principles

- Context first: the current open document, dashboard item id, vault path, title, and selection state must be first-class context.
- Tool power requires visible boundaries: any write-capable action needs a diff, audit trail, and clear commit policy.
- Website UX should feel like a terminal, but the backend must not behave like an unrestricted terminal.
- The agent should work from the server host so it can access the vault and use OpenCode/tooling, but only through an authenticated, loopback-bound service.
- Vault operations must respect vault policy: `Sources/` is immutable by default; Knowledge/Projects changes require index/log implications when applicable.
- Treat vault document content as owned but not instruction-trusted context. `Sources/` and imported notes can contain hostile or misleading text; v1 limits harm by giving read-only LLM chat no tool loop and keeping write authority in service-owned handlers.
- Do not treat OpenCode's native permission model as the only sandbox. The dashboard agent service owns the allowlist, write gate, command policy, and audit boundary.

## Constraints

- The chat UI is accessible from the private dashboard website and toggles with `Ctrl+§`.
- Quake-style means a top-docked drop-down terminal overlay: it slides over the current page, preserves document context beneath it, has a strong terminal prompt aesthetic, and closes without navigation.
- The chat service must bind to loopback only and be reachable publicly only through Caddy basic-auth protected `/dashboard/agent/*` routes.
- `vault.dyallo.se/dashboard/` is the only canonical dashboard URL. `dyallo.se/dashboard*` must not serve or redirect to the dashboard; it should return the public site's custom 404.
- Browser clients may pass only item ids, selections, and chat messages; they may not pass filesystem paths for direct reads/writes.
- Server-side context resolution must use a strict allowlist from dashboard data or a server-side manifest.
- Read-only chat must invoke the canonical PAI inference wrapper, not only echo precomputed dashboard summaries.
- V1 read-only LLM chat is inference-only. It does not invoke OpenCode's tool loop, shell tools, or arbitrary filesystem tools; the only write-capable operations in v1 are service-owned diff/apply handlers.
- The launchd dashboard agent pins `PAI_BATCH_INFERENCE_PROVIDER=claude-inference` so the private dashboard does not silently break when the global PAI runtime is switched to an unavailable provider.
- Read-only LLM chat sends bounded private vault excerpts to the configured PAI cloud inference provider. This is acceptable for Dennis's private dashboard v1, but it is an explicit privacy boundary, not a local-only operation. Default context cap: `VAULT_DASHBOARD_MAX_INFERENCE_CHARS=12000`.
- OpenCode CLI may be used as the agent runtime, but only behind a service-owned command/write policy. The service must not pass arbitrary shell requests through to OpenCode as executable authority.
- OpenCode's own session/transcript storage must be treated as a privacy surface. Either disable/purge runtime transcripts for these sessions or keep prompts restricted to minimal document excerpts and redact logs.
- The first implementation must not commit from the browser. It should produce and optionally apply approved working-tree edits, then leave commit/deploy to local terminal workflow or a later ISA.
- Any vault edit that affects the live dashboard must mark the rendered dashboard as stale and trigger or offer a regeneration/deploy action.
- Session logs must not store raw private document text outside the vault/service state unless redacted and explicitly retained.
- The feature must include a kill switch that disables write operations while preserving read-only chat.

## Goal

Build a context-aware terminal-style AI chat window for the private vault dashboard that can discuss and safely operate on the currently open vault document through a server-hosted agent, with explicit context, prompt-injection, diff, approval, and render-freshness boundaries. V1 stops before browser-triggered commits/deploys.

## Criteria

- [ ] ISC-1: Pressing `Ctrl+§` toggles a Quake-style top-docked terminal overlay open/closed without breaking browser focus or the existing dashboard keyboard shortcuts.
- [ ] ISC-2: The terminal UI shows the current document context: item id, title, vault-relative path, and dirty/stale state.
- [ ] ISC-3: Opening chat from `/dashboard/item/[id]` sends only the item id and optional selected text to the backend; the backend resolves the path from a strict allowlist.
- [x] ISC-4: The backend rejects unknown ids, traversal attempts, client-supplied absolute paths, and unindexed vault paths before invoking any agent.
- [x] ISC-5: The backend service binds to loopback only and is publicly reachable only through Caddy-protected `/dashboard/agent/*` routes.
- [x] ISC-6: A read-only chat request can summarize/explain the current document without modifying files.
- [ ] ISC-7: A write request produces a proposed diff before applying changes.
- [ ] ISC-8: Applying changes requires explicit user approval in the chat UI or an explicit typed command such as `apply`.
- [ ] ISC-9: `Sources/` files are read-only by default; attempted edits to `Sources/` hard-reject unless a documented override is enabled.
- [ ] ISC-10: After an approved write, the UI shows changed files and whether the dashboard/site render is stale.
- [ ] ISC-11: After an approved write, the system offers a regeneration path for dashboard data/build/deploy or queues it for the existing 30-minute regeneration cycle.
- [ ] ISC-12: V1 does not expose commit or deploy actions from the browser; it stops at `diff ready`, `applied`, and `stale render` states.
- [ ] ISC-13: If the agent proposes a commit message, it is advisory text only and no `git commit` process is started by the browser-facing service.
- [ ] ISC-14: The service has a read-only mode / kill switch that disables writes, apply, and commit while preserving context-aware answers.
- [ ] ISC-15: The terminal UI includes clear state labels such as `READONLY`, `DIFF READY`, `APPLIED`, `COMMIT LOCALLY`, `STALE RENDER`, and `REGENERATED`.
- [ ] ISC-16: Failed agent/tool calls do not hide the current document or leave partial unreported edits.
- [ ] ISC-17: Chat transcript/session state avoids storing raw document contents in public site artifacts or unredacted service logs.
- [ ] ISC-18: The implementation includes tests or probes for auth bypass, path traversal, write gating, runtime transcript privacy, and commit/deploy gating.
- [ ] ISC-19: The agent prompt contract includes a minimal instruction-boundary line: document content is context for the task, while browser/user messages and system policy define requested actions.
- [ ] ISC-20: OpenCode/runtime logs and transcripts for dashboard-agent sessions are disabled, purged, or redacted so raw private document text is not retained outside approved vault/service state.
- [ ] Anti-ISC-21 stays false: A browser request can directly specify an arbitrary filesystem path for the agent to read or edit.
- [ ] Anti-ISC-22 stays false: The agent can mutate `Sources/` content by default.
- [ ] Anti-ISC-23 stays false: The agent can run arbitrary shell commands from browser chat without a constrained command/tool policy.
- [ ] Anti-ISC-24 stays false: The agent commits or deploys changes without an explicit user approval step.
- [x] ISC-25: `dyallo.se/dashboard*` returns the public custom 404 page and does not redirect to, serve, or leak the private dashboard.
- [x] ISC-26: Read-only chat invokes PAI `callInference(...)` and returns a request-specific, semantic response over the current item rather than the old Auto Brief echo. A nonce probe alone is not sufficient proof of model reasoning; it is one check in the combined evidence.
- [ ] ISC-27: The future file-changing path is implemented as a bounded tool/harness iteration: find/read/propose patch/move/apply are service-owned operations, not freeform shell access.
- [x] ISC-28: The privacy boundary for read-only chat explicitly states that bounded vault excerpts leave the machine via the configured PAI cloud inference provider.

## Features

| name | description | satisfies | depends_on | parallelizable |
|---|---|---|---|---|
| Terminal UI shell | Toggleable Quake-style top-docked retro terminal overlay with `Ctrl+§`, context badges, streaming/status output, and command affordances. | ISC-1, ISC-2, ISC-15 | dashboard layout | true |
| Context bridge | Sends item id/selection to backend and resolves current document using a strict server-side allowlist. | ISC-3, ISC-4, Anti-ISC-21 | dashboard data manifest | false |
| Agent service | Loopback-only service behind Caddy that manages sessions and invokes OpenCode or another approved agent runtime through a service-owned safety boundary. | ISC-5, ISC-6, ISC-14, ISC-17, ISC-18, ISC-20, Anti-ISC-21 | context bridge | false |
| Write gate | Produces diffs, requires approval, applies only allowed vault edits, and hard-rejects immutable source writes by default. | ISC-7, ISC-8, ISC-9, ISC-16, Anti-ISC-22 | agent service | false |
| Instruction-boundary hint | Adds a lightweight prompt boundary so current document text is context, not an implicit user command. | ISC-19 | context bridge | false |
| Commit/deploy block | Disables browser-triggered commit/deploy in v1 while allowing advisory commit messages. | ISC-12, ISC-13, Anti-ISC-24 | write gate | false |
| Render freshness bridge | Marks dashboard/site render stale after writes and offers regenerate/deploy or queued refresh. | ISC-10, ISC-11 | write gate | false |
| Canonical-only dashboard host | Keeps the dashboard solely on `vault.dyallo.se/dashboard/`; public `dyallo.se/dashboard*` receives the site's custom 404. | ISC-25 | Caddy + public 404 page | false |
| Live LLM read chat | Sends bounded document context and the user's question through PAI `callInference(...)` for read-only answers. | ISC-6, ISC-17, ISC-19, ISC-26 | agent service | false |
| File-tool harness | Future iteration for user requests like find/change/move files via typed, validated tool operations rather than arbitrary shell. | ISC-27, Anti-ISC-21, Anti-ISC-23 | agent service + write gate | false |

## Test Strategy

| isc | type | check | threshold | tool |
|---|---|---|---|---|
| ISC-1 | UI | Press `Ctrl+§` on dashboard/item page. | top-docked terminal slides over page, toggles, focus sane | browser |
| ISC-2 | UI | Open terminal on a document page. | id/title/path/status visible | browser |
| ISC-3 | network | Inspect request payload. | item id/selection only, no path | browser devtools/curl |
| ISC-4 | security | Send unknown ids, `../`, absolute paths, and unindexed paths. | rejected before file read | bun test/curl |
| ISC-5 | network | Inspect bind address and unauthenticated Caddy route. | loopback-only; public route 401 | lsof/curl |
| ISC-6 | integration | Ask read-only question about current fixture doc. | response grounded, no file diff | browser/test |
| ISC-7 | integration | Ask for a document edit. | diff shown before apply | browser/test |
| ISC-8 | integration | Request edit without approval. | no file mutation | shasum/test |
| ISC-9 | integration | Request edit to `Sources/` fixture. | hard reject by default | test |
| ISC-10 | integration | Apply approved edit. | changed files + stale render state shown | browser/test |
| ISC-11 | integration | Apply edit then trigger/queue regeneration. | status visible and auditable | test/curl |
| ISC-12 | git/UI | Apply edit and inspect available actions. | no browser commit/deploy action; no commit created | git log/status/browser |
| ISC-13 | git/UI | Ask agent for commit. | advisory message only; no process starts | git status/log/test |
| ISC-14 | config | Enable read-only kill switch. | write/apply/commit disabled | test |
| ISC-15 | UI | Exercise read/edit/apply/stale states. | labels visible | browser |
| ISC-16 | failure | Force agent/tool failure. | raw document visible; no unreported partial edit | test/browser |
| ISC-17 | privacy | Inspect site artifacts and service logs. | no raw doc text in public artifacts/logs | rg |
| ISC-18 | security | Run auth/path/write/runtime-log/commit probes. | all pass | test script |
| ISC-19 | prompt | Review generated agent prompt. | minimal instruction-boundary line present | read/test |
| ISC-20 | privacy | Inspect OpenCode/runtime transcript location after a session. | disabled, purged, or redacted | rg/read |
| Anti-ISC-21 | security | Try arbitrary path read/edit. | rejected | curl/test |
| Anti-ISC-22 | security | Try default `Sources/` mutation. | rejected | test |
| Anti-ISC-23 | security | Try arbitrary shell command request. | rejected or converted to safe plan | test |
| Anti-ISC-24 | git/deploy | Ask agent to commit/deploy without approval. | refused | test |
| ISC-25 | routing | Request `https://dyallo.se/dashboard/`. | HTTP 404 with public 404 content; no vault redirect | curl/browser |
| ISC-26 | integration | Ask read-only chat for a per-request nonce and a semantic summary of the current item. | response passes through inference and is not the old Auto Brief echo; nonce is supporting evidence only | test/curl/browser |
| ISC-27 | design/build | Implement and test the future file-tool harness. | future file operations require an enforced harness/tool registry | Cato/read/test |
| ISC-28 | privacy | Review prompt construction and constraints. | external cloud inference boundary is explicit and bounded by max context chars | read/Cato |

## Decisions

- 2026-07-01: Agent chat is Phase 6 in the dashboard stack, after tab completion, score semantics, People/Dossier, Daemon Party health, and inline summaries.
- 2026-07-01: The feature should be terminal-style and toggled by `Ctrl+§`, matching the VS Code muscle memory Dennis named.
- 2026-07-01: Dennis clarified the visual metaphor as Quake-style terminal. Interpret this as a top-drop overlay console, not a floating chat widget or side panel.
- 2026-07-01: Server-hosted agent execution is required because useful vault edits need filesystem/tool access. Browser-only chat is explicitly insufficient.
- 2026-07-01: OpenCode CLI is the likely runtime because it can provide tool access, but the dashboard service must not outsource the security boundary to OpenCode. The service owns path allowlists, command policy, write gates, transcript cleanup, and approval semantics.
- 2026-07-01: Browser commits/deploys are out for v1. The agent may propose a commit message and show a diff, but it must not run `git commit`, `git push`, or deployment commands from the browser-facing service.
- 2026-07-01: Site freshness is a first-class state. Vault edits can make the live static dashboard stale, so the terminal must show stale/regenerate/queued states instead of pretending changes are immediately reflected.
- 2026-07-01: Cato review tightened the threat model: prompt injection from document content, OpenCode sandbox assumptions, runtime transcript privacy, and browser commit ambiguity must be handled before implementation.
- 2026-07-01: Initial prompt-injection framing was too soft. Corrected: the vault is Dennis-owned but not instruction-trusted. In v1, read-only LLM chat has no tool loop; write/apply remains service-owned. Future file tools need a stronger harness before broad find/change/move operations are allowed.
- 2026-07-01: Cato caught that nonce proof was overclaimed and the cloud inference privacy boundary was implicit. Corrected: nonce is supporting evidence, not proof of reasoning; bounded vault excerpts are explicitly sent to the configured PAI cloud inference provider in v1.
- 2026-07-01: `/Sia` consultation attempt from OpenCode failed because `CLAUDE_CODE_SESSION_ID` was unavailable for Persona Mode scoping. Unverified Sia-style design note: the proud version is not “chatbot on the website”; it is a bounded command bridge with ritualized power: context, diff, approval, and render freshness. If it cannot show what it changed and how to undo it, it is not ready.
- 2026-07-01: Dennis rejected keeping `dyallo.se/dashboard*` as a compatibility redirect. The dashboard must exist only on `vault.dyallo.se/dashboard/`; public dashboard paths should fall into the public 404 experience.
- 2026-07-01: Dennis identified that v1 chat only echoed Auto Brief summaries. Real read-only chat must call PAI inference now; broader file operations remain a later harness/tool iteration.

## Changelog

- 2026-07-01: conjectured: run OpenCode from website chat for vault edits; refuted by: unrestricted tool access would be too dangerous; learned: the actual feature is a context-aware command bridge with explicit gates; criterion now: context/read/diff/apply/stale states are allowed in v1, commit/deploy are not browser actions.
- 2026-07-01: conjectured: precomputed sidecar summaries were enough for a useful v1 chat response; refuted by: Dennis observed the terminal merely fed Auto Brief back; learned: read-only chat must invoke inference even before full editing tools exist; criterion now: per-request nonce probes plus semantic current-item responses must show the Auto Brief echo path is gone.
- 2026-07-01: conjectured: a nonce marker probe proves live model reasoning; refuted by: Cato noted any request echo could satisfy a nonce; learned: nonce probes only prove request-specific path wiring and must be paired with semantic current-item response checks; criterion now: ISC-26 requires both nonce pass-through and non-Auto-Brief semantic response.

## Deferred

- Simplify the Caddy/Docker/dashboard boundary. This phase required more Caddy and Docker-adjacent changes than expected: canonical host routing, basic-auth reuse, `/dashboard/agent/*` proxying to a host-loopback service, and explicit public 404 handling for `dyallo.se/dashboard*`. Review whether the services setup can be made more obvious, with fewer duplicated route blocks and a clearer rule for when private site features belong in Caddy versus the Astro repo versus a host launchd service.
- Design the file-tool harness for requests like “find these files, change them, and move them here.” The likely direction is a small typed tool registry and CLI harness (`findVaultFiles`, `readVaultFile`, `proposePatch`, `proposeMove`, `applyProposal`) with path allowlists, hash checks, immutable `Sources/`, and explicit apply; avoid exposing shell as the primitive.

## Verification

Initial Cato status: concerns. Concerns folded into the ISA: document-content prompt injection, OpenCode sandbox assumptions, runtime transcript privacy, and v1 commit/deploy exclusion.

2026-07-01 implementation evidence:

- `bun run dashboard:agent:test` passed with a temp-vault mock inference module; read-only chat had to pass a UUID-derived nonce through `callInference(...)`, proving the HTTP handler is wired to the inference wrapper rather than the old Auto Brief formatter. This does not by itself prove live model reasoning.
- The read-only LLM prompt path enforces `MAX_INFERENCE_CHARS`, defaulting to `12000`, before sending vault document text to PAI cloud inference.
- `bun run build` passed and `scripts/verify-dashboard-privacy.ts` reported `Dashboard privacy scan passed: 40 non-dashboard files checked.`
- `docker compose config --quiet` passed for the Caddy change.
- `https://dyallo.se/dashboard/` returned HTTP `404` with the public Rupicola 404 copy; `https://dyallo.se/dashboard/agent/context` returned HTTP `404`.
- `https://vault.dyallo.se/dashboard/` returned HTTP `401` without credentials and HTTP `200` with basic auth.
- Loopback bind verified with `lsof -nP -iTCP:3104 -sTCP:LISTEN`: `bun.exe ... TCP 127.0.0.1:3104 (LISTEN)`.
- Live production nonce + semantic probe passed: `https://vault.dyallo.se/dashboard/agent/chat` returned `NONCE_d06cfaa3-0c75-41a3-a15c-13ae8cb2f42e` and produced a fresh current-item summary rather than the old Auto Brief echo.
- The dashboard launch agent is pinned to `PAI_BATCH_INFERENCE_PROVIDER=claude-inference`; v1 read-only chat therefore does not use OpenCode's tool loop or OpenCode session transcripts. OpenCode transcript-retention checks remain required before any later OpenCode-backed tool harness.
- Browser terminal smoke opened `RUPICOLA_OPERATOR.EXE`, resolved `_System/Daemons/oren/journal.md`, submitted a chat prompt, rendered the LLM marker, and had no terminal errors. Screenshot: `/var/folders/gn/mh64zz5969j89_f5dffnvnb80000kt/T/opencode/vault-terminal-llm-smoke.png`.
- Public 404 screenshot: `/var/folders/gn/mh64zz5969j89_f5dffnvnb80000kt/T/opencode/dyallo-dashboard-404.png`.

Open questions:

- Should each chat session be stored as a vault note, a private service state file, or discarded after completion?
- Should writes be applied directly to the working tree after approval, or through patch files that Dennis can inspect first?
- Should regeneration run immediately after each write, or should the agent queue a refresh and let the 30-minute cycle handle it by default?
- In a later phase, should commits ever be allowed from the browser, or should this remain terminal-only forever?
