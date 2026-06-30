# Vault Dashboard Omni Search Tab Completion ISA

## Problem

The private Vault Quest Log omni search feels like a shell, but the input does not yet behave like one. Users can type weighted grep-style queries, but `Tab` still moves focus instead of accepting the most likely completion. This breaks the command-line illusion and makes repeated vault searches slower than they should be.

## Vision

The search box should feel like a tiny terminal embedded in the Rupicola OS dashboard. A partial query such as `zen co` or `type:jou` should let the user press `Tab` and watch the shell complete the most obvious next token. It should feel intelligent, editable, and unsurprising.

## Out of Scope

This feature does not add fuzzy search libraries, server-side search, keyboard result navigation, command history, or a visible dropdown/autosuggest UI. It also does not change the existing weighted scoring model beyond reusing it to choose the top completion.

## Constraints

- The dashboard remains a static Astro page served behind Caddy basic auth.
- Generated vault data remains private and uncommitted.
- Completion logic must work without external JavaScript dependencies.
- `Tab` may only be intercepted when the search box can actually complete something; otherwise normal focus traversal should remain available.
- The current query language must keep working: free terms, quoted phrases, and `type:`, `person:`, `after:`, `before:` filters.
- Completion only applies when the caret is at the end of the input and no text is selected; mid-string edits keep normal browser behavior.
- Free-text completion must use prefix candidates derived from titles, not the weighted contains-anywhere search rank.
- A safe free-text completion token contains no colon, quote, or reserved filter prefix (`type:`, `person:`, `after:`, `before:`). Unsafe title tokens are skipped rather than inserted.

## Goal

Add shell-like `Tab` completion to `/dashboard` omni search so the best available completion is accepted into the input, results update immediately, and no public/private boundary or existing search behavior regresses.

## Criteria

- [ ] ISC-1: `src/pages/dashboard/index.astro` contains a `keydown` handler on the search input for `event.key === 'Tab'`.
- [ ] ISC-2: Pressing `Tab` with an incomplete filter token completes supported filter prefixes or known filter values such as activity types and people.
- [ ] ISC-3: Pressing `Tab` with a free-text query completes the trailing text toward the shortest safe title-prefix continuation without opening a result or changing focus.
- [ ] ISC-4: Completion updates the input value and re-renders search results in the same interaction.
- [ ] ISC-5: If there is no useful completion, the handler does not call `preventDefault()`, preserving normal keyboard focus behavior.
- [ ] ISC-6: Existing `/` focus shortcut, `Escape` clear behavior, lane buttons, and weighted search result rendering still work.
- [ ] ISC-7: `bun run build` passes, including the dashboard privacy scan.
- [ ] ISC-8: Completion does not intercept `Tab` when the caret is not at the end of the input or when text is selected.
- [ ] ISC-9: Free-text completion does not create accidental `type:`, `person:`, `after:`, or `before:` filter tokens from title text.
- [ ] Anti-ISC-10: The built dashboard HTML does not include the public site header/nav tokens `site-header` or `site-nav`.

## Features

| name | description | satisfies | depends_on | parallelizable |
|---|---|---|---|---|
| Completion candidate resolver | Determine the best completion for filter prefixes, filter values, or safe free-text title-prefix continuation. | ISC-2, ISC-3, ISC-5, ISC-9 | dashboard data titles and filter vocabularies | false |
| Input Tab handler | Intercept `Tab` only when resolver returns a new value and the caret is at the end; update input and render results. | ISC-1, ISC-4, ISC-5, ISC-6, ISC-8 | Completion candidate resolver | false |
| Query-safety guard | Avoid accidental filter tokens from free-text completions. | ISC-9 | Completion candidate resolver | false |
| Verification pass | Build, inspect dashboard HTML, deploy, and smoke-check live auth separately from feature acceptance. | ISC-7, Anti-ISC-10 | implementation | false |

## Test Strategy

| isc | type | check | threshold | tool |
|---|---|---|---|---|
| ISC-1 | static | Search source for `event.key === 'Tab'` near the input handler. | present | `rg` |
| ISC-2 | behavioral | Exercise resolver/helper with fixture vocabulary: `type:jou` -> `type:journal`, `person:o` -> `person:oren`. | exact expected completions | temporary node/js probe or browser console |
| ISC-3 | behavioral | Exercise resolver/helper with fixture titles: `zen co` -> `zen coaching`, while `misc before` does not complete to `before:bed`. | exact expected completions | temporary node/js probe or browser console |
| ISC-4 | static | Search source for resolver result assigning `input.value` and calling `renderResults`. | present | `rg` |
| ISC-5 | static | Confirm `preventDefault()` occurs only after a completion candidate is found. | present | `Read` |
| ISC-6 | static/build | Existing shortcut and lane-button handlers remain in source and build succeeds. | pass | `rg`, `bun run build` |
| ISC-7 | build | Run project build. | exit 0 | `bun run build` |
| ISC-8 | behavioral/static | Confirm Tab handler exits before `preventDefault()` unless selectionStart and selectionEnd are both at the input end. | present and/or probe pass | `Read`, temporary node/js probe |
| ISC-9 | behavioral/static | Confirm free-text completion excludes colon/quote/reserved-prefix tokens unless completing an explicit filter token. | probe pass | temporary node/js probe |
| Anti-ISC-10 | static build | Search built dashboard for public header/nav tokens. | zero matches | `rg` |

## Decisions

- 2026-07-01: Keep v1 as inline shell completion rather than a visible suggestion dropdown to preserve the terminal feel and minimize UI churn.
- 2026-07-01: Use existing dashboard item data for completion, but choose free-text completions by safe title-prefix matching rather than weighted search rank.
- 2026-07-01: Accept Cato feedback: make completion end-caret-only, avoid accidental filter-token injection, and add behavioral probes instead of relying only on static source checks.
- 2026-07-01: Accept second Cato feedback: decouple completion from weighted search ranking, use deterministic fixture probes, define safe free-text tokens, and move live auth to post-deploy smoke verification rather than feature acceptance.
