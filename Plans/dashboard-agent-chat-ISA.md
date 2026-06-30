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
- Treat vault document content as private trusted-local context with a minimal instruction-boundary reminder. This is Dennis's own vault behind basic auth, so prompt-injection precautions should stay lightweight.
- Do not treat OpenCode's native permission model as the only sandbox. The dashboard agent service owns the allowlist, write gate, command policy, and audit boundary.

## Constraints

- The chat UI is accessible from the private dashboard website and toggles with `Ctrl+§`.
- Quake-style means a top-docked drop-down terminal overlay: it slides over the current page, preserves document context beneath it, has a strong terminal prompt aesthetic, and closes without navigation.
- The chat service must bind to loopback only and be reachable publicly only through Caddy basic-auth protected `/dashboard/agent/*` routes.
- Browser clients may pass only item ids, selections, and chat messages; they may not pass filesystem paths for direct reads/writes.
- Server-side context resolution must use a strict allowlist from dashboard data or a server-side manifest.
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
- [ ] ISC-4: The backend rejects unknown ids, traversal attempts, client-supplied absolute paths, and unindexed vault paths before invoking any agent.
- [ ] ISC-5: The backend service binds to loopback only and is publicly reachable only through Caddy-protected `/dashboard/agent/*` routes.
- [ ] ISC-6: A read-only chat request can summarize/explain the current document without modifying files.
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

## Decisions

- 2026-07-01: Agent chat is Phase 6 in the dashboard stack, after tab completion, score semantics, People/Dossier, Daemon Party health, and inline summaries.
- 2026-07-01: The feature should be terminal-style and toggled by `Ctrl+§`, matching the VS Code muscle memory Dennis named.
- 2026-07-01: Dennis clarified the visual metaphor as Quake-style terminal. Interpret this as a top-drop overlay console, not a floating chat widget or side panel.
- 2026-07-01: Server-hosted agent execution is required because useful vault edits need filesystem/tool access. Browser-only chat is explicitly insufficient.
- 2026-07-01: OpenCode CLI is the likely runtime because it can provide tool access, but the dashboard service must not outsource the security boundary to OpenCode. The service owns path allowlists, command policy, write gates, transcript cleanup, and approval semantics.
- 2026-07-01: Browser commits/deploys are out for v1. The agent may propose a commit message and show a diff, but it must not run `git commit`, `git push`, or deployment commands from the browser-facing service.
- 2026-07-01: Site freshness is a first-class state. Vault edits can make the live static dashboard stale, so the terminal must show stale/regenerate/queued states instead of pretending changes are immediately reflected.
- 2026-07-01: Cato review tightened the threat model: prompt injection from document content, OpenCode sandbox assumptions, runtime transcript privacy, and browser commit ambiguity must be handled before implementation.
- 2026-07-01: Dennis downscoped prompt-injection risk because this is his own private Obsidian vault behind basic auth. Keep only lightweight instruction-boundary protection; focus safety effort on path allowlists, write gates, runtime logs, and commit/deploy boundaries.
- 2026-07-01: `/Sia` consultation attempt from OpenCode failed because `CLAUDE_CODE_SESSION_ID` was unavailable for Persona Mode scoping. Unverified Sia-style design note: the proud version is not “chatbot on the website”; it is a bounded command bridge with ritualized power: context, diff, approval, and render freshness. If it cannot show what it changed and how to undo it, it is not ready.

## Changelog

- 2026-07-01: conjectured: run OpenCode from website chat for vault edits; refuted by: unrestricted tool access would be too dangerous; learned: the actual feature is a context-aware command bridge with explicit gates; criterion now: context/read/diff/apply/stale states are allowed in v1, commit/deploy are not browser actions.

## Verification

Initial Cato status: concerns. Concerns folded into the ISA: document-content prompt injection, OpenCode sandbox assumptions, runtime transcript privacy, and v1 commit/deploy exclusion.

Open questions:

- Should each chat session be stored as a vault note, a private service state file, or discarded after completion?
- Should writes be applied directly to the working tree after approval, or through patch files that Dennis can inspect first?
- Should regeneration run immediately after each write, or should the agent queue a refresh and let the 30-minute cycle handle it by default?
- In a later phase, should commits ever be allowed from the browser, or should this remain terminal-only forever?
