---
title: Vault Dashboard ISA
created: 2026-06-30
updated: 2026-06-30
status: active
---

# Vault Dashboard ISA

## Problem
Dennis's Obsidian vault now has many simultaneous activity streams: Sia's Lens, journal promotion, dream notes, project work, Knowledge updates, daemon changes, and persona conversations. The information is valuable but hard to regain orientation from because it is spread across folders, logs, daemon reports, and append-only journals.

## Vision
The dashboard feels like a private retro command center for Dennis's life system: Rupicola OS meets a late-90s quest log. It is fast, playful, keyboard-friendly, and useful within seconds. The user should feel delight, recognition, and immediate orientation rather than another sterile analytics panel. The happiness target is explicit: Dennis should grin at the interface, recognize the game/OS lineage instantly, and still trust it as a serious private operating console.

## Out of Scope
V1 does not provide multi-user accounts, live editing, external sharing, AI summarization, or a database-backed full-text service. It does not expose private vault content on public routes. It does not require Elasticsearch unless the static index proves insufficient after real use.

## Principles
- Fun chrome, serious information architecture.
- Static-first performance: search and activity pages are precomputed.
- Privacy boundary first: dashboard data, inline pages, and search index all live under the protected `/dashboard` subtree.
- Exact matches beat cleverness; grep-style expectations matter.
- The visual language evokes 1990-2010 games and operating systems without copying protected characters or assets.

## Constraints
- The implementation lives in the existing Astro repo at `~/Code/other/dyallose`.
- The dashboard route is `/dashboard` and is intended to be served as `vault.dyallo.se/dashboard`.
- Caddy basic auth protects `/dashboard/*` in production.
- Regeneration target is every 30 minutes.
- Source vault path is `~/Documents/Sunthings_AppStorage_EU_e2e`.
- The verified Obsidian vault name for deep links is `Sunthings_AppStorage_EU_e2e`.
- Sensitive activity pages must be excluded from public sitemap/navigation.
- All generated private search/content assets must be served only under `/dashboard/*`; do not emit private data into shared public chunks or public JSON endpoints outside that subtree.
- Generated vault-derived private content must never be committed. The generated data file is ignored by git, build-only, and regenerated locally/deploy-side.
- Inline item pages must be emitted only under `/dashboard/item/*`.
- Production assumes HTTPS plus a long random Caddy basic-auth password; basic auth is acceptable for v1 but should be revisited if wider sharing/invites are needed.

## Goal
Build a private, generated Vault Quest Log dashboard that surfaces recent vault activity, supports weighted grep-style omni search, renders clicked items inline with Markdown formatting, and links each item back into Obsidian.

## Criteria
- [ ] ISC-1: `/dashboard` renders from generated vault activity data without requiring request-time vault reads.
- [ ] ISC-2: The dashboard includes a top omni search bar with keyboard focus via `/`.
- [ ] ISC-3: Search covers titles, subtitles, paths, tags, headings, bold text, and truncated content snippets.
- [ ] ISC-4: Search relevance is implemented by a first-party weighted grep-style scorer where title/H1/H2/tags/path outrank body snippets.
- [ ] ISC-5: Activity cards show type, timestamp, title, subtitle, brief truncation, path, `Open inline`, and `Open in Vault`.
- [ ] ISC-6: Activity types include Sia's Lens, Vault ingestions, Journal, Dream Journal, Conversations, Projects, Knowledge updates, Daemon updates, and Daemon status.
- [ ] ISC-7: Conversations include Oren and Watashi journal sources.
- [ ] ISC-8: Inline item pages render Markdown-ish content with headings, bold text, paragraphs, lists, and preformatted blocks readable in the dashboard style.
- [ ] ISC-9: `Open in Vault` links use `obsidian://open?vault=Sunthings_AppStorage_EU_e2e&file=...`.
- [ ] ISC-10: The UI uses Rupicola orange, earthy colors, Obsidian purple accents, and the Rupicola glyph.
- [ ] ISC-11: The UI has a distinctive retro game/OS quest-log feel without copyrighted character assets.
- [ ] ISC-12: A regeneration/deploy command exists for generating activity data on a 30-minute cadence.
- [ ] ISC-13: Production auth guidance documents Caddy basic auth for `/dashboard/*`.
- [ ] ISC-14: A launchd or cron scheduling template exists for 30-minute regeneration.
- [ ] Anti-ISC-14: Public nav, RSS, and sitemap must not advertise `/dashboard`.
- [ ] Anti-ISC-15: No generated private dashboard data is placed outside the protected `/dashboard` path in the built site.
- [ ] Anti-ISC-16: The implementation must not depend on the local Obsidian app being available at page request time.
- [ ] Anti-ISC-17: Private search data must not be emitted into Astro's shared public asset chunks outside `/dashboard/*`.
- [ ] Anti-ISC-18: Generated private vault data is ignored by git and does not appear in `git status --short` as a staged/tracked generated artifact.

## Test Strategy
| ISC | Type | Check | Threshold | Tool |
|---|---|---|---|---|
| ISC-1 | build | `bun run dashboard:generate && bun run build` | exit 0 | shell |
| ISC-2 | file review | dashboard page script contains `/` focus handler | present | read |
| ISC-3/4 | file review | search data contains weighted fields and first-party rank logic | present | read |
| ISC-5/6/7 | generated data | `src/data/vault-dashboard.json` contains expected types | present | shell/read |
| ISC-8/9 | build/file review | item route renders content and Obsidian links | present | read/build |
| ISC-10/11 | visual/code review | CSS contains Rupicola OS/quest-log styling | present | read/browser |
| ISC-12/13/14 | docs/script | regeneration command, Caddy auth docs, and 30-minute scheduler template exist | present | read |
| Anti-ISC-14/15/16/17 | automated privacy scan | after build, scan `dist/` outside `dist/dashboard/` for dashboard-only sentinel strings | zero matches | script |
| Anti-ISC-18 | git hygiene | `git check-ignore src/data/vault-dashboard.json` succeeds and file is not tracked | pass | shell |

## Features
| name | description | satisfies | depends_on | parallelizable |
|---|---|---|---|---|
| activity-generator | Bun script scans vault sources and emits normalized dashboard JSON | ISC-1, ISC-3, ISC-6, ISC-7 | none | yes |
| search-index | First-party weighted client-side grep-style search over generated fields | ISC-2, ISC-3, ISC-4 | activity-generator | yes |
| dashboard-ui | Rupicola OS / Vault Quest Log dashboard page | ISC-5, ISC-10, ISC-11 | activity-generator | yes |
| inline-item-pages | Dynamic static Astro pages for each activity item under `/dashboard/item/*` | ISC-8, ISC-9, Anti-ISC-15 | activity-generator | yes |
| regeneration-docs | Script and docs for 30-minute generation + Caddy auth | ISC-12, ISC-13 | activity-generator | yes |

## Decisions
- 2026-06-30: Use static generated JSON for v1 instead of Elasticsearch. This keeps ops low and performance high while preserving an upgrade path if real search usage exceeds the client index.
- 2026-06-30: Use Caddy basic auth outside Astro because the current site is static output; auth belongs at the web-server boundary.
- 2026-06-30: Use a retro UI metaphor: Rupicola OS / Vault Quest Log. The implementation evokes Win98, N64 pause menus, RPG quest logs, and Toonami HUDs without copying protected characters or art.
- 2026-06-30: Cato warned that Pagefind does not guarantee the custom field weighting Dennis wants. V1 therefore uses a first-party weighted scorer over generated fields as the primary omni search. Pagefind/Meilisearch/Tantivy remain future options if the local index becomes too large or query needs exceed the simple scorer.
- 2026-06-30: Cato warned that static private content can leak if generated into shared assets. Implementation must keep the search payload inline on `/dashboard` or otherwise under `/dashboard/*`, never in shared public Astro chunks.
- 2026-06-30: Cato warned that basic auth is a real but thin privacy boundary for journal/dream/conversation content. V1 keeps Caddy basic auth but documents HTTPS, long random password, no public links, and an upgrade path to Cloudflare Access/Tailscale-only access.
- 2026-06-30: Cato failed the ISA on the version-control vector: generated private JSON/pages inside the Astro repo can bypass Caddy if committed. Criterion added: generated private data is gitignored/build-only, and verification must prove it is ignored and not tracked.
- 2026-06-30: Cato warned that route prefix and public-chunk leakage need mechanical checks. V1 item pages must be `/dashboard/item/*`, and verification includes a privacy scan of built output outside `dist/dashboard/` for dashboard-only sentinel strings.

## Verification
Populated after implementation.
