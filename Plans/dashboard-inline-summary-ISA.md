# Vault Dashboard Next Phases ISA

## Problem

The Vault Quest Log is now visually strong and useful, but the next improvements are beginning to stack: shell-like search completion, clearer search-score semantics, a fast People/Dossier lane, live-feeling daemon health, AI summaries for long inline documents, and a context-aware agent terminal. Without a phase stack, these improvements risk blending into one oversized task. The dashboard also exposes a subtle architecture constraint: the current item pages are static Astro output, while on-open summaries and agent chat require server-side components with vault access and PAI inference/tool access.

## Vision

The dashboard should evolve into a private RPG codex for the vault: fast keyboard search, one-click dossier browsing, and inline pages that immediately explain what a document is about before showing the raw note. Cached summaries should appear immediately; first-generation summaries should show an honest progress state while the model runs. The feature set must not corrupt source material, violate the vault's layer rules, or leak sensitive notes to untrusted providers.

## Out of Scope

This plan does not implement the features yet. It does not replace the existing vault-dashboard generator, introduce a full CMS, make the private dashboard public, run a global summary pass across all historical notes, solve semantic search, add embeddings, or expose unrestricted shell access through the browser. Each phase should remain independently shippable.

## Principles

- Preserve the vault's source-of-truth model: raw sources remain raw unless explicitly approved otherwise.
- Prefer small sequential phases over one large dashboard refactor.
- Prefer lazy computation over precomputing everything: summarize only what is opened.
- Summaries should be useful, compact, and clearly model-generated.
- The private boundary is more important than convenience: no unauthenticated summary endpoint, no document text in public logs.
- Provider-side privacy is part of the private boundary: model routing must account for document sensitivity, not only latency.

## Constraints

- Current `/dashboard/item/[id]` pages are static Astro output; on-open inference requires a server-side endpoint or local daemon with vault access.
- All batch LLM calls must go through `_System/Daemons/shared/inference.ts` via `callInference(...)`; do not call provider APIs directly.
- Any summary endpoint must be behind the same Caddy basic-auth boundary as `/dashboard*`.
- Summary services must not log raw document contents, prompts, or model outputs unless explicitly redacted.
- Any local service for summaries or agent chat must bind to loopback only and be reachable publicly only through Caddy-protected routes.
- Item-id to path resolution must be a strict allowlist from generated dashboard data or a server-side manifest. No client-supplied filesystem path, traversal segment, symlink escape, or unindexed vault file is acceptable.
- `Sources/` is immutable by vault policy. Summary write-back to files under `Sources/` is out unless Dennis explicitly overrides that rule. Default behavior for immutable sources is sidecar persistence.
- Mutable summary write-back may target `Projects/`, `Knowledge/`, and selected `_System/` notes only after marker-based idempotency is implemented.
- Summary persistence must be idempotent: opening the same unchanged document again returns the existing summary, not a duplicate block.
- Summary cache keys must include document path and content hash so stale summaries can be detected.
- Sensitive documents (`Sources/Journal`, `Sources/DreamJournal`, `Sources/Messages`, `Knowledge/People`, relationship/therapy/persona material) must use only an explicitly allowed privacy-reviewed provider. Free/community models are disabled for these paths by default.
- Free OpenCode Zen models may only be used for low-sensitivity/project/public-ish documents after an explicit opt-in flag.
- The People/Dossier shortcut and Daemon Party health colors are separate small phases and should not depend on the inference summary backend.
- Agent chat is a separate phase and should not be implemented until the command/session safety model is explicit.

## Goal

Define and stage the next dashboard phases so they can be implemented one after another: tab completion, search-score semantics, People/Dossier shortcut, Daemon Party health colors, authenticated on-demand inline summaries with safe persistence, and a context-aware agent terminal that can safely operate on vault documents.

## Phase Stack

| phase | name | intent | implementation size | source artifact |
|---|---|---|---:|---|
| Phase 1 | Tab completion | Shell-like `Tab` completion in omni search. | small | `Plans/dashboard-tab-completion-ISA.md` |
| Phase 2 | Search score semantics | Decide whether score is hidden, renamed, normalized, or made meaningful in search results. | small | `Plans/dashboard-search-score-ISA.md` |
| Phase 3 | People/Dossier shortcut | Add a selectable People lane/button near the existing dashboard activity filters to show all vault person dossiers quickly. | small | this ISA |
| Phase 4 | Daemon Party health | Show actual daemon health in the Daemon Party panel with green/yellow/red status indicators. | small | this ISA |
| Phase 5 | Inline document summaries | On-demand AI summary on each inline item page, with cache/write-back and sensitivity-gated model routing. | medium | this ISA |
| Phase 6 | Agent terminal chat | Toggleable context-aware terminal chat that can discuss and safely edit the currently open vault document through a server-hosted agent session. | large | `Plans/dashboard-agent-chat-ISA.md` |

## Criteria

- [ ] ISC-1: `/dashboard/item/[id]` renders a summary panel that can show `loading`, `ready`, `cached`, `generated`, and `error` states without hiding the raw document.
- [ ] ISC-2: An authenticated backend endpoint accepts an item id, resolves it to a vault path using the generated dashboard index or a server-side source map, and rejects unknown ids.
- [ ] ISC-3: The backend reads the document from the vault, computes a stable content hash, and checks both sidecar cache and in-document marker before invoking inference.
- [ ] ISC-4: The backend calls `callInference(systemPrompt, userPrompt, 'fast', ...)` with a sensitivity-gated configured model and a strict JSON summary schema.
- [ ] ISC-5: The backend persists generated summaries idempotently: sidecar for immutable `Sources/`, marker block write-back only for approved mutable paths.
- [ ] ISC-6: Reopening an unchanged document returns the persisted summary without another model call.
- [ ] ISC-7: If a document changes, the stale summary is detected by hash mismatch and either regenerated or clearly marked stale.
- [ ] ISC-8: The model output is validated as JSON with `summary`, `key_points`, `action_items`, and `tags` before display or persistence.
- [ ] ISC-9: The endpoint never logs raw document content or full model prompts/output.
- [ ] ISC-10: Caddy protects `/dashboard/api/*` with the same basic-auth credentials as `/dashboard*`.
- [ ] ISC-11: `bun run build` still passes and the existing dashboard privacy verifier still passes.
- [ ] ISC-12: Live unauthenticated requests to `/dashboard` and `/dashboard/api/*` return `401` after deploy.
- [ ] ISC-13: Sensitive paths route only to privacy-reviewed allowed providers; free/community model routing hard-rejects by default for those paths rather than silently falling back.
- [ ] ISC-14: Phase 2 resolves the visible search-score issue so users no longer see an unexplained repeated `score 1` in results.
- [ ] ISC-15: Phase 3 adds a People/Dossier selectable shortcut near the existing dashboard lane buttons.
- [ ] ISC-16: The People/Dossier shortcut filters to person dossier items from `Knowledge/People/` and any existing person-type dashboard items without requiring inference infrastructure.
- [ ] ISC-17: The People/Dossier shortcut has a count badge and uses the same visual grammar as the existing activity lane cards.
- [ ] ISC-18: Summary and agent services bind to loopback only; direct access to the service port from non-loopback interfaces is not possible.
- [ ] ISC-19: Crafted ids, traversal strings, and unindexed paths are rejected before any vault file read.
- [ ] ISC-20: Phase 4 Daemon Party health uses green/yellow/red status indicators based on daemon health data, not static decoration.
- [ ] ISC-21: Daemon Party health has a freshness timestamp or stale state so old health snapshots are visibly yellow/stale rather than misleadingly green.
- [ ] ISC-22: Daemon Party health data comes from a bounded generated snapshot or authenticated loopback endpoint and does not expose logs, secrets, PIDs, or raw error traces publicly.
- [ ] ISC-23: Phase 6 has a dedicated ISA before implementation begins.
- [ ] Anti-ISC-24 stays false: Opening a `Sources/` journal/dream/message item mutates the original file without explicit override.
- [ ] Anti-ISC-25 stays false: A failed inference call removes, hides, or corrupts the raw inline document.
- [ ] Anti-ISC-26 stays false: The People/Dossier shortcut changes or weakens the existing weighted omni search behavior.
- [ ] Anti-ISC-27 stays false: A daemon error message or log excerpt appears in dashboard HTML/JSON without redaction.

## Features

| name | description | satisfies | depends_on | parallelizable |
|---|---|---|---|---|
| Search score semantics | Hide, rename, normalize, or explain the score badge so search result metadata feels intentional. | ISC-14 | existing weighted search scoring | true |
| People lane filter | Add a person/dossier shortcut card or selectable button that filters the dashboard to person dossiers. | ISC-15, ISC-16, ISC-17, Anti-ISC-26 | existing dashboard item data | true |
| Daemon health snapshot | Add daemon health status/freshness to dashboard data using green/yellow/red semantics. | ISC-20, ISC-21, ISC-22, Anti-ISC-27 | daemon-health or health.sh output | true |
| Provider policy | Classify path sensitivity and choose allowed models before inference. | ISC-4, ISC-13 | model benchmark config | false |
| Model benchmark config | Configure primary/fallback fast model based on measured latency, quality, and provider privacy. | ISC-4, ISC-13 | none | true |
| Summary API service | Loopback-only local Bun service or dyallose API route that resolves item ids, reads allowlisted vault files, invokes inference, and returns validated JSON. | ISC-2, ISC-3, ISC-4, ISC-8, ISC-9, ISC-13, ISC-18, ISC-19 | provider policy | false |
| Persistence layer | Summary marker/sidecar storage keyed by path + content hash with immutable-source guardrails. | ISC-5, ISC-6, ISC-7, Anti-ISC-24 | Summary API service | false |
| Inline summary panel | Client-side fetch on item page with loading/error/cached/generated states. | ISC-1, Anti-ISC-25 | Summary API service | true |
| Caddy route protection | Proxy `/dashboard/api/*` to the local service and protect it with basic auth. | ISC-10, ISC-12 | Summary API service | false |
| Agent terminal planning | Dedicated ISA for a context-aware website terminal that can operate on the vault through a safe server-side agent. | ISC-23 | none | true |

## Test Strategy

| isc | type | check | threshold | tool |
|---|---|---|---|---|
| ISC-1 | UI/static | Open an item page and verify summary panel states exist in markup/script. | present | browser/read |
| ISC-2 | API | Request a known id and an unknown id. | known 200, unknown 404 | curl |
| ISC-3 | unit/API | Hash unchanged fixture twice and check sidecar/marker lookup. | identical hash, no second inference | bun test/curl |
| ISC-4 | integration | Stub or live-call `callInference` through the selected model. | valid JSON | bun test/live probe |
| ISC-5 | integration | Generate summary for mutable fixture and immutable fixture. | mutable marker or sidecar, Sources sidecar only | bun test |
| ISC-6 | integration | Open same unchanged item twice. | second response says cached and model call count unchanged | bun test/curl |
| ISC-7 | integration | Modify fixture content after summary. | stale/regenerated status visible | bun test |
| ISC-8 | unit | Feed malformed model output. | rejected, raw doc preserved | bun test |
| ISC-9 | log audit | Trigger summary and inspect logs. | no source text/prompt/output body | grep/read logs |
| ISC-10 | live Caddy | Request `/dashboard/api/summary/test` without auth. | HTTP 401 | curl |
| ISC-11 | build | Build site. | exit 0 | `bun run build` |
| ISC-12 | live | Request `/dashboard` and `/dashboard/api/*` without auth. | HTTP 401 | curl |
| ISC-13 | unit/integration | Attempt sensitive-path request with free model enabled globally. | hard reject with explicit policy error | bun test |
| ISC-14 | UI/static | Run a representative search and inspect score/result metadata. | no unexplained repeated `score 1` | browser/read |
| ISC-15 | UI/static | People/Dossier shortcut appears beside existing lane controls. | visible | browser/read |
| ISC-16 | UI/static | Activate People/Dossier shortcut. | only person dossier items shown | browser/manual or JS probe |
| ISC-17 | UI/static | People/Dossier shortcut has count badge and established lane-card styling. | present | read/browser |
| ISC-18 | network | Inspect service bind address and attempt direct non-Caddy access. | loopback-only, no LAN/public bind | lsof/curl |
| ISC-19 | security | Request traversal/crafted ids such as `../CLAUDE.md` and unindexed files. | 400/404 before file read | bun test/curl |
| ISC-20 | UI/data | Generate/render daemon health states. | green/yellow/red statuses visible | bun run build/browser |
| ISC-21 | data/UI | Force old health snapshot timestamp. | dashboard shows stale/yellow | fixture/JS probe |
| ISC-22 | privacy | Inspect generated dashboard JSON/HTML for daemon logs/secrets/PIDs. | no raw logs/secrets/PIDs | rg/privacy scan |
| ISC-23 | planning | `Plans/dashboard-agent-chat-ISA.md` exists and has Cato/Sia consultation notes. | present | read |
| Anti-ISC-24 | integration | Summarize a `Sources/` fixture. | original file byte-identical | shasum/bun test |
| Anti-ISC-25 | UI/API | Force inference failure. | raw document still rendered | browser/curl |
| Anti-ISC-26 | regression | Run existing free-text search before/after People shortcut. | same result count/order for representative queries | JS probe |
| Anti-ISC-27 | privacy | Search dashboard output for daemon log fragments or stack traces. | zero matches | rg |

## Decisions

- 2026-07-01: A static-only summary implementation is insufficient. The feature needs a small authenticated server-side component because the browser cannot safely read/write local vault files or call PAI `shared/inference.ts`.
- 2026-07-01: Default summary persistence should be sidecar-first because much of the dashboard currently points at `Sources/`, which the vault policy treats as immutable raw material.
- 2026-07-01: If Dennis wants literal write-back into `Sources/` documents, that is a vault policy override and should be explicit before implementation.
- 2026-07-01: Benchmark path used the canonical PAI wrapper: `_System/Daemons/shared/inference.ts` `callInference(...)`, with `PAI_BATCH_INFERENCE_PROVIDER=opencode` and per-model `opencodeModel` overrides.
- 2026-07-01: Benchmark results are an initial scouting run, not a final production evaluation. The implementation phase should repeat top candidates across at least three runs and at least two fixtures before changing defaults.
- 2026-07-01: Provisional primary model for sensitive documents is `google-vertex/claude-haiku-4-5@20251001`: fastest measured via `callInference` at 4.635s with 9/10 summary quality, and routes through the existing PAI Vertex path rather than a free/community model.
- 2026-07-01: `opencode/nemotron-3-ultra-free` is a speed/quality winner in the scouting benchmark, but it is not acceptable as an automatic fallback for journals, dreams, messages, people notes, or other sensitive material until provider data handling is reviewed.
- 2026-07-01: `openai/gpt-5.4-mini` is a plausible paid fallback after privacy review and repeated benchmarking: 6.759s with 10/10 heuristic quality and stable structured output in the scouting run.
- 2026-07-01: Search score semantics is Phase 2. The current `score 1` badge looks like an accidental/debug artifact and should be removed or made meaningful before adding more dashboard controls.
- 2026-07-01: People/Dossier shortcut is Phase 3 and should be implemented independently before the summary backend because it is small, static, and useful immediately.
- 2026-07-01: Cato review tightened the summary backend plan: loopback-only service binding, strict id allowlist path resolution, hard rejection for free-model use on sensitive paths, and traversal tests are required.
- 2026-07-01: Daemon Party health is Phase 4: small, visible, and valuable before heavier backend work. It should use red/yellow/green from bounded health snapshots and avoid exposing raw daemon logs.
- 2026-07-01: Agent terminal chat is Phase 6 and needs a dedicated ISA because it crosses from read-only dashboard into write-capable vault operations.

## Verification

Benchmark fixture: synthetic vault-shaped Markdown note about a Roskilde fire-practice circle. No private vault source text was used in benchmark logs or committed artifacts.

Wrapper path: `_System/Daemons/shared/inference.ts` via `callInference(...)`.

| model | latency | heuristic quality | result |
|---|---:|---:|---|
| `google-vertex/claude-haiku-4-5@20251001` | 4.635s | 9/10 | fastest in scouting run; provisional sensitive-doc primary |
| `opencode/nemotron-3-ultra-free` | 6.435s | 10/10 | good low-sensitivity candidate only after explicit opt-in/privacy review |
| `openai/gpt-5.4-mini` | 6.759s | 10/10 | plausible paid fallback after privacy review and repeated tests |
| `opencode/big-pickle` | 6.803s | 10/10 | good quality, slightly slower than Nemotron/GPT mini |
| `opencode/deepseek-v4-flash-free` | 7.514s | 10/10 | good quality, slower than fallback candidates |
| `openai/gpt-5.4-fast` | 8.471s | 9/10 | good but not faster than mini in this test |
| `opencode/north-mini-code-free` | 33.046s | 10/10 | quality ok, too slow through wrapper in this run |

Open questions:

- Should mutable-path summaries be inserted into the source note by default, or should v1 use sidecars for every document to keep the vault pristine and avoid auto-editing personal notes?
- Which providers are acceptable for sensitive journals/dreams/messages after privacy review?
- Should Phase 2 remove the score badge entirely, rename it to relevance, normalize it to a percentage, or show match reasons instead?
- Should Phase 3 People/Dossier include only `Knowledge/People/` dossier pages, or also journal/project items tagged with people?
- Should Phase 4 Daemon Party health read from `daemon-health` state, `health.sh`, or a small redacted dashboard-specific health snapshot?
- Should Phase 6 agent sessions ever commit vault edits from the browser, or should browser sessions stop at applied diffs and leave commits to local terminal workflow?
