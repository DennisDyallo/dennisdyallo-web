# Vault Dashboard Search Score ISA

## Problem

The dashboard search result cards currently show an internal score badge such as `score 1`. In practice this looks confusing because several documents can show the same score, and `1` reads like a poor rating rather than a relevance/debug value. The UI exposes implementation detail without explaining what the number means.

## Vision

Search results should feel intentional and useful. If score is shown, it should help Dennis understand why a result appeared. If it does not help, it should be hidden. The dashboard should not display debug-looking numbers that make good results look bad.

## Out of Scope

This phase does not redesign the entire search algorithm, add embeddings, add server-side search, or change the privacy model. It only decides and implements the presentation/meaning of result scoring in the existing client-side weighted search.

## Constraints

- The existing weighted grep-style search must continue to rank results by title, subtitle, headings, tags, path, excerpt, and body.
- The result metadata must remain compact; cards should not become noisy.
- No generated private dashboard data may be committed.
- The change must be static/client-side only.

## Goal

Remove or improve the visible search-score badge so search results no longer show unexplained repeated `score 1`, while preserving the existing weighted search behavior.

## Criteria

- [ ] ISC-1: Search result cards no longer show raw `score 1` style debug output.
- [ ] ISC-2: If a score-like indicator remains, it is renamed and normalized into a user-facing concept such as `match`, `strong match`, or `relevance 82%`.
- [ ] ISC-3: If the score is hidden, useful metadata remains visible: result type and document path/date context.
- [ ] ISC-4: Existing weighted ranking behavior remains unchanged for representative queries.
- [ ] ISC-5: `bun run build` passes.
- [ ] Anti-ISC-6 stays false: Results appear unranked or sorted only by date when a query has terms.

## Features

| name | description | satisfies | depends_on | parallelizable |
|---|---|---|---|---|
| Score display decision | Choose hide/rename/normalize/match-reasons based on clarity. | ISC-1, ISC-2, ISC-3 | none | false |
| Ranking regression check | Verify the display change does not alter scoring/sorting. | ISC-4, Anti-ISC-6 | Score display decision | false |

## Test Strategy

| isc | type | check | threshold | tool |
|---|---|---|---|---|
| ISC-1 | UI/static | Search rendered dashboard output or source for raw `score ${...}` badge. | absent or intentionally renamed | rg/read |
| ISC-2 | UI/static | If score remains, inspect label/normalization. | user-facing label | browser/read |
| ISC-3 | UI/static | Inspect result cards after a query. | type/path/date context still visible | browser/read |
| ISC-4 | regression | Compare result ordering before/after for 2-3 queries. | unchanged order | JS probe/manual |
| ISC-5 | build | Run project build. | exit 0 | `bun run build` |
| Anti-ISC-6 | regression | Query with title/path/body matches. | title/path weighted hits still outrank body-only hits | JS probe/manual |

## Decisions

- 2026-07-01: User noticed every result seemed to show the same `score 1`; treat the current score badge as debug leakage unless we make it meaningfully user-facing.
- 2026-07-01: Preferred v1 direction is likely to hide raw score and replace it later with match reasons (`title`, `tag`, `path`, `body`) if useful.

## Verification

Pending implementation.
