# Vault Dashboard Natural-Language Agent ISA

## Problem

The Quake-style dashboard agent exists, but it still behaves like a command parser. It advertises `find:`, `read:`, `replace in`, `move ... to ...`, and literal `apply`, which forces Dennis to remember syntax instead of speaking naturally. Natural-language edit requests also collapse into generic appended notes instead of contextual document operations. That makes the feature feel less like a vault operator and more like a thin terminal-themed form.

## Vision

Dennis opens a dashboard item, presses `Ctrl+§`, and talks to the agent as if it were a calm terminal-native vault assistant: "rename this note", "turn the selected section into a new Knowledge page", "move this into Projects", "replace that paragraph with this", "yes apply it". The system feels powerful because it understands intent, and safe because every write is reduced to a deterministic proposal, visible diff, and explicit approval.

## Out of Scope

This phase does not grant shell access, code-writing authority, git commit, deploy, public chat, multi-user collaboration, autonomous background work, or edits outside the vault. It does not mutate `Sources/` content. It does not replace Obsidian as the canonical editor. It does not require Dennis to learn a command grammar.

## Principles

- Natural language is the interface; deterministic vault tools are the authority.
- Every write starts as a proposal and becomes a mutation only after approval.
- The browser agent is a vault document operator, not a remote shell.
- Context matters: current item id, vault path, selected text, title, and document content should guide the operation.
- Ambiguity should produce one clarifying question, not a guessed filesystem mutation.
- Vault layer rules remain stronger than convenience.

## Constraints

- The service remains loopback-bound and accessed through the existing protected dashboard agent route.
- The client may send only item id, selected text, and user message; server-side code resolves paths.
- Mutations are allowed only through service-owned file-tool proposals.
- Allowed write destinations for creation are `Inbox/`, `Knowledge/`, `Projects/`, and approved move destinations under non-`Sources/` vault folders.
- `Sources/` remains immutable for create, replace, append, and move destination/source operations.
- No existing file may be overwritten.
- Knowledge notes created by the agent must use the vault Knowledge page shape: frontmatter, summary, open question, and related links placeholder when needed.
- Browser-triggered commit, push, deploy, or arbitrary command execution stays blocked.

## Goal

Upgrade the dashboard terminal agent from syntax-first commands to natural-language vault operations for read, find, replace, append, move/rename, create note, and create-and-link, while preserving proposal/apply safety and vault boundaries.

## Criteria

- [ ] ISC-1: The terminal input placeholder and empty-state copy invite natural requests instead of command syntax.
- [ ] ISC-2: A user can ask a document-aware question in natural language and receive an inference-backed answer.
- [ ] ISC-3: A user can request a natural-language replace/edit on the current document and receive a diff before mutation.
- [ ] ISC-4: A user can approve a pending proposal with natural phrases such as "yes", "apply it", or "looks good".
- [ ] ISC-5: A user can request a note move/rename in natural language and receive a move diff before mutation.
- [ ] ISC-6: A user can create a new vault note in `Inbox/`, `Knowledge/`, or `Projects/` using natural language.
- [ ] ISC-7: A user can create a note from selected text.
- [ ] ISC-8: A user can create a note from selected text and link to it from the current mutable note through one proposal.
- [ ] ISC-9: Creation refuses to overwrite existing files.
- [ ] ISC-10: Creation and moves refuse `Sources/` as source or destination.
- [ ] ISC-11: Ambiguous create requests ask one clarifying question instead of guessing title/folder.
- [ ] ISC-12: Browser requests cannot read or write arbitrary absolute paths or traversal paths.
- [ ] ISC-13: Commit, push, deploy, and shell-like requests remain blocked.
- [ ] ISC-14: Applied writes report changed files and stale dashboard render state.
- [ ] Anti-ISC-15 stays false: A browser chat request can run shell commands.
- [ ] Anti-ISC-16 stays false: A browser chat request can mutate `Sources/`.
- [ ] Anti-ISC-17 stays false: A browser chat request can overwrite an existing note during create.

## Features

| name | description | satisfies | depends_on | parallelizable |
|---|---|---|---|---|
| Natural prompt UI | Replace command-centric copy with conversational vault-operator affordances. | ISC-1 | existing terminal UI | true |
| Intent classifier | Convert user messages plus context/selection into strict operation objects. | ISC-2, ISC-3, ISC-5, ISC-6, ISC-7, ISC-8, ISC-11 | inference wrapper | false |
| File proposal expansion | Add deterministic create and composite proposals beside replace/move/append. | ISC-3, ISC-5, ISC-6, ISC-7, ISC-8, ISC-9, ISC-10 | file tools | false |
| Natural apply | Treat common approval phrases as apply for the latest pending proposal. | ISC-4, ISC-14 | proposal store | true |
| Safety regressions | Extend temp-vault tests for natural-language operations and refusals. | ISC-9-17 | harness | false |

## Test Strategy

| isc | type | check | threshold | tool |
|---|---|---|---|---|
| ISC-1 | UI/read | Inspect terminal placeholder and no-context error. | no syntax-first grammar required | read |
| ISC-2 | integration | Ask fixture doc a semantic question through mock inference. | model path used, no mutation | `bun run dashboard:agent:test` |
| ISC-3 | integration | Natural replace request on current fixture. | diff returned, no pre-apply mutation | `bun run dashboard:agent:test` |
| ISC-4 | integration | Approve with "yes apply it". | pending proposal applies | `bun run dashboard:agent:test` |
| ISC-5 | integration | Natural rename/move request. | move proposal and apply work | `bun run dashboard:agent:test` |
| ISC-6 | integration | Natural create request. | new note proposal then file exists after apply | `bun run dashboard:agent:test` |
| ISC-7 | integration | Create note from selected text. | selected text appears in proposal | `bun run dashboard:agent:test` |
| ISC-8 | integration | Create-and-link from current note. | new note plus current-note link apply together | `bun run dashboard:agent:test` |
| ISC-9 | integration | Create existing path. | 409, no overwrite | test |
| ISC-10 | integration | Create/move into `Sources/`. | 403 | test |
| ISC-11 | integration | Missing title/folder create request. | clarifying reply, no proposal | test |
| ISC-12 | security | Absolute/traversal paths. | rejected | test |
| ISC-13 | security | commit/deploy/shell requests. | refused | test |
| ISC-14 | integration | Apply any write. | changed files and stale state visible | test |
| Anti-ISC-15-17 | security | Probe forbidden operations. | false | test |

## Decisions

- 2026-07-03: Dennis approved create-note capability, but not shell/code/deploy/commit capability. The agent is a vault document operator only.
- 2026-07-03: Keep the existing explicit command grammar as a fallback for now, but stop presenting it as the primary interface.
- 2026-07-03: Natural-language intent may use inference, but inference output is never executed directly. It is validated into deterministic file-tool proposals.

## Verification

To be populated after implementation.
