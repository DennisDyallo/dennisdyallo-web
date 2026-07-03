# Vault Dashboard Auto Brief Quality ISA

## Problem

The dashboard Auto Brief panel is useful as a layout affordance, but the brief generation is often dull because it is mostly deterministic extraction: frontmatter summary, `## Summary`, first sentences, headings, and regex-detected action lines. Some briefs therefore copy source text verbatim or list headings without inference. This makes the inline item page feel machine-generated in the worst way: visible AI-shaped chrome without actual synthesis.

## Vision

Auto Briefs should feel like a compact Sia-style operator note: what this document is, why it matters, the live signal, the open loops, and the next useful move. They should be short, grounded, and inferential. When the system cannot run inference, it should say it is using an extractive fallback rather than pretending the fallback is an intelligent brief.

## Out of Scope

This phase does not rewrite every historical vault note, create public summaries, use direct provider APIs, publish generated sidecars to git, or block dashboard builds when cloud inference is unavailable. It does not mutate source vault documents.

## Principles

- Synthesis beats extraction.
- Fallbacks must be honest.
- Private generated sidecars remain private build artifacts.
- Briefs should be useful within ten seconds of opening an item page.
- Quality guards should catch copy-paste summaries before they become cached.

## Constraints

- Batch inference must use the existing PAI `callInference(...)` wrapper, not direct provider APIs.
- Sidecars remain content-hash keyed and gitignored.
- Build must still succeed without inference by using labeled deterministic fallback.
- Summary schema remains JSON-compatible with existing dashboard item pages.
- Generated dashboard data and sidecars must continue to pass privacy/githygiene checks.
- Source documents are not modified.

## Goal

Improve Auto Brief generation so sidecars are inferential when inference is available, honest when fallback-derived, and mechanically guarded against near-verbatim copy-paste output.

## Criteria

- [ ] ISC-1: Summary sidecars can include inferential fields without breaking existing item pages.
- [ ] ISC-2: Inference-generated briefs use a strict JSON schema.
- [ ] ISC-3: The brief prompt asks for synthesis, not extraction, with sections equivalent to signal, why it matters, key points, open loops, and next moves.
- [ ] ISC-4: Near-verbatim summaries are rejected or downgraded to extractive fallback.
- [ ] ISC-5: Deterministic fallback is labeled as fallback/extractive, not generated intelligence.
- [ ] ISC-6: Cached sidecars still load by path + content hash.
- [ ] ISC-7: Build/dashboard generation succeeds when inference is unavailable.
- [ ] ISC-8: Item page copy no longer calls every sidecar equally "Auto Brief" without exposing status nuance.
- [ ] ISC-9: Generated private sidecars remain untracked and ignored.
- [ ] ISC-10: Privacy scan still passes after dashboard generation and build.
- [ ] Anti-ISC-11 stays false: Generated brief text is emitted into public routes or shared public assets.
- [ ] Anti-ISC-12 stays false: The generator writes summaries back into vault source documents.

## Features

| name | description | satisfies | depends_on | parallelizable |
|---|---|---|---|---|
| Brief schema v2 | Extend sidecar schema with richer fields while keeping current page compatibility. | ISC-1, ISC-6 | existing sidecars | true |
| Inference synthesis | Call PAI inference for bounded document excerpts and parse strict JSON. | ISC-2, ISC-3 | inference wrapper | false |
| Copy-paste guard | Detect high overlap between brief and source/extractive sentences. | ISC-4 | brief schema | true |
| Honest fallback | Label deterministic summaries as extractive fallback. | ISC-5, ISC-8 | generator | true |
| Privacy regression | Verify generated data stays private and untracked. | ISC-9-12 | existing privacy script | false |

## Test Strategy

| isc | type | check | threshold | tool |
|---|---|---|---|---|
| ISC-1 | generation | Generate dashboard with v2-compatible sidecars. | item JSON still has summary/key_points/action_items | `bun run dashboard:generate` |
| ISC-2 | unit/integration | Mock inference returns strict JSON. | parser accepts valid, rejects malformed | test/generate |
| ISC-3 | read/review | Prompt contains synthesis instructions. | signal/why/open loops/next moves present | read |
| ISC-4 | unit | Feed source-copy output. | rejected/downgraded | test |
| ISC-5 | generation | Disable inference. | status/label indicates fallback | generate/read |
| ISC-6 | generation | Run twice unchanged. | second run uses cached sidecar | generate/read |
| ISC-7 | build | Simulate unavailable inference. | build exits 0 | `bun run build` |
| ISC-8 | UI/read | Inspect item page status language. | status nuance visible | read/build |
| ISC-9 | git | Check generated sidecar tracking. | untracked/ignored | git |
| ISC-10 | privacy | Build privacy verifier. | pass | `bun run build` |
| Anti-ISC-11 | privacy | Search public dist outside dashboard. | no generated tokens | privacy script |
| Anti-ISC-12 | filesystem | Inspect vault docs after generation. | no summary write-back | git/status/read |

## Decisions

- 2026-07-03: The immediate defect is quality, not layout. Keep the page panel but make the content smarter and more honestly labeled.
- 2026-07-03: Build should not become brittle because the dashboard is regenerated often; inference failure falls back, with visible status.
- 2026-07-03: Sidecars remain the persistence mechanism. Do not write generated briefs into the vault source layer.

## Verification

To be populated after implementation.
