---
title: "Two AI Planners Walked Into My Codebase. Their Failure Modes Are the Story."
slug: engineer-vs-codex-routing-pattern
description: "Five real production bugs, two AI planners (Claude Engineer agent vs Codex CLI / GPT-5.5), one scoring rubric. The aggregate verdict was 3–2 in Codex's favour — but the interesting finding is that their failure modes are complementary, and the right routing rule isn't to pick a winner, it's to use them in sequence."
pubDate: 2026-05-16
tags:
  - ai
  - claude
  - codex
  - agents
  - delegation
  - experiment
draft: false
---

*May 2026*

---

I'm shipping a chord-sheet app for musicians. The triage list has a P0 layout bug, a feature request for AI-edit previews, an onboarding flow that needs work, a z-index regression, and a FAB bar that should go vertical on mobile. Five issues. I had two AI planners available — my custom Claude-based **Engineer** agent (pre-loaded with my project conventions) and the **Codex CLI** (running GPT-5.5, cold to my repo).

Both can write a plan. Both will, if asked, write a plan that *looks* reasonable. So I sent them the same five problems, with the same prompt and the same scoring rubric, and judged the results.

The counts came out 3–2 in Codex's favour. That's not the interesting part. The interesting part is that **their failure modes are complementary** — and the right delegation rule isn't "pick the better one," it's "use them in sequence."

This post is the experiment, the evidence, and the rule I'm taking forward.

---

## The Setup

Speaksheet is a Svelte 5 + Capacitor app I'm preparing for the Play Store. Real users, real bugs, real shipping pressure. My triage doc (`Triage 2026-05-16b.md`) lists 15 items by priority — the kind of mixed bag any production codebase accumulates: a measured CSS bug, a feature request from a worship-leader friend, a polish item, an architectural overhaul, a regression from yesterday's z-index sweep.

I have two AI planners I trust enough to use on different things:

- **Engineer** — a Claude Sonnet 4.6 agent with `.claude/agents/engineer.md` in the repo. It already knows my CLAUDE.md rules, my STYLEGUIDE.md tokens, my Biome formatting gotcha, my Modal.svelte wrapper, my shadcn button variants. It also has a `SPEC-CHALLENGE` protocol: when an instruction would violate a project rule or expand scope silently, it's supposed to stop and escalate.

- **Codex CLI** — OpenAI's `codex exec` tool (GPT-5.5), running in `--sandbox read-only` mode. No project pre-loading. It reads my repo files itself, runs commands, traces things, builds its plan from scratch each time.

The natural question: when do I send a task to which one?

---

## The Method

Same prompt template for both. Same six-section deliverable: root cause, files to touch, approach, edge cases, verification, out of scope. Same six-criterion scoring rubric (root cause correctness, scope discipline, repo fit, risk surfacing, verification specificity, format), zero to three points each.

I locked the rubric *before reading any plan*. This matters. Without locking it, I'd score by gut feel and call it methodology.

Two rounds:

- **Round 1:** the open P0 (layout shift on edit-mode toggle) and the P1 FAB bar overhaul.
- **Round 2:** Preview AI Edits (a new feature), Onboarding refresh (UX/IA decision), Dictate-popover z-index overlap (narrow CSS bug).

Five issues total, two plans each, ten plans. Then me, judging.

---

## The Unexpected Finding

I expected one agent to be modestly better. What I got was two agents with **distinct, opposite blind spots**, where each one's strength was the other's weakness.

### Engineer's blind spot

The first issue was a layout shift in the chord sheet's edit mode. My project has a documented Layout Stability Contract — *don't use `{#if}` on flow elements, use `.mode-hidden` instead* — and an audit script (`bun run audit:layout`) that's supposed to catch violations.

Engineer's plan was thorough. It identified four contract violations across `FabBar.svelte`, `MobileNav.svelte`, and a stale `.play-fab--hidden` opacity workaround. It proposed lifting the `.mode-hidden` utility to global CSS, fixing each violation, and extending the audit script. The plan would pass code review. The plan would land.

The bug would remain.

I knew this only because Codex ran the audit script as part of *its* diagnosis — got "CLEAN, no violations found" — and asked the obvious next question: *"if it's clean, why does Dennis still see jitter?"* It traced through to `app.css:2275`:

```css
.sheet:not(.edit-mode) .chord-badge:not(.empty) { min-height: 44px }
```

That CSS rule makes chord badges 44px tall in idle mode but 20px tall in edit mode. The chord rows literally change height between modes. That's what I was reporting — *"chord/verse/chorus heights change"* — and the audit doesn't catch it because the audit only looks at `{#if}` patterns, not at CSS rules that fire on a class toggle.

Engineer trusted the audit. The audit was wrong. Engineer would have shipped the wrong fix.

### Codex's blind spot

The second issue was the FAB bar overhaul. The spec said *"Visible button order: Zoom, BPM, Autoscroll, Edit; Mic + AI Edit appear only in edit mode."* That list looks like five buttons in one component.

But Zoom and BPM aren't in `FabBar.svelte`. They live in `Sheet.svelte` with completely different mode-gating semantics. Including them in the FAB bar means a cross-component refactor — moving controls out of `Sheet.svelte`, reconciling state, touching unrelated code.

Engineer flagged this immediately: *"this spec assumes a 1-file change but it actually touches more — flagging for SPEC-CHALLENGE escalation."* It planned the minimal change (FAB visibility for Mic + AI Edit) and asked me to confirm scope before expanding.

Codex didn't. Codex silently planned the cross-component refactor — extracting Zoom and BPM into FabBar, with new shadcn Button wrappers, with a coordinated z-index against `Sheet.svelte`'s existing zoom controls. The plan was internally consistent. It also would have been substantially more work than I asked for, with regression surface I hadn't sized up. No escalation, no flag, just expanded scope.

Engineer protected me from a much bigger change than I'd meant to request.

### Three more issues, same pattern

The Preview AI Edits feature went to Engineer — clean scope, used the Modal.svelte wrapper, flagged the Biome single-file write gotcha, called out the Carlos fast-path as future work. Codex's plan was technically richer but proposed eight file touches including STYLEGUIDE.md additions for a feature add.

Onboarding refresh went to Codex — Engineer recommended collapsing the Role and Genre steps into one combined persona step, which sounds clean until you check `starter-library.ts` and discover the data model is keyed by *both* dimensions. Codex read that file *first*, found the keying, and recommended keeping both steps but renaming "Vibe" to "music style." Same UX problem, no upstream refactor. Engineer made the UX call without checking what the data could support.

The dictate popover overlap went to Codex on a tiebreak. Both agents identified the right z-index conflict. Engineer's fix was minimal — lower the chevron from 901 to 210, done. Codex's fix was architecturally deeper — *also* raise `.dictation-bar` from 250 to 950 because *it's semantically a popover, not nav chrome, and the 250 classification is the actual category error*. Both fixes work. Codex's fixes the misclassification too.

---

## The Pattern

After five issues, the pattern is consistent enough to name:

**Engineer is the executor.** It applies the codebase's documented patterns reflexively. It honors escalation protocols. It produces tight scope. It catches house-style traps (Biome gotcha, column-flex hover rule, theme variable contract). It fails by trusting the project's own filters — when the audit is silent on a real bug, Engineer is silent too.

**Codex is the detective.** It runs scripts during diagnosis. It reads constraining files before recommending. It catches architectural category errors (component-class-vs-actual-role mismatches). It fails by silently absorbing scope ambiguity — when a spec is unclear, it picks an interpretation and expands.

Their failure modes don't overlap. Engineer fails by under-investigating; Codex fails by over-implementing. In sequence, they cancel each other out: Codex investigates, Engineer executes the result.

---

## The Routing Rule

The rule I'm going to use, one line:

> **If you know what needs to change, send it to Engineer. If you're not sure what's actually wrong, send it to Codex first.**

A more complete matrix:

| Task shape | Route to | Why |
|---|---|---|
| Bug exists, audit/lint silent, symptom doesn't match obvious cause | Codex first → Engineer with findings | Codex traces; Engineer fixes once cause is named |
| Implement feature with documented project conventions | Engineer | House style is encoded in `engineer.md` |
| Responsive layout / refactor with ambiguous scope | Engineer | Honors SPEC-CHALLENGE protocol |
| UX/IA decision where data model constrains the answer | Codex | Reads constraining files first |
| CSS layering / z-index / category-error debugging | Codex | Catches misclassifications |
| Refactor following an explicit documented pattern | Engineer | Applies the pattern precisely |
| Trivial fix (typo, one-line) | Either | Equivalent output |

I retroactively applied this matrix to round 1 to check it isn't overfit. The matrix predicts both round-1 winners (Codex on the audit-silent bug, Engineer on the spec-ambiguous refactor). Not gaming the rubric.

---

## The Aggregate Agent

The two-stage pattern wants to be a skill. Sketch:

```
INTAKE
  │
  ▼
[Triage: is the cause known?] ─── NO ──→ Codex (diagnose) ─┐
  │ YES                                                     │
  ▼                                                         ▼
[Triage: is scope clear?]    ─── NO ──→ Engineer (escalate via SPEC-CHALLENGE)
  │ YES                                                     │
  ▼                                                         ▼
Engineer (execute) ←──────────────────────────────────────┘
                        (Engineer receives Codex's finding as PRD input)
```

The triage step itself is small — a fast classifier on the intake: *is the bug or the cause clearer? Is the scope unambiguous?* Two yes/no decisions, four quadrants, three of them route. The skill is the wrapper that asks those questions, spawns the right agent, and pipes findings into the next one.

If you've built one of these, the operating insight is that the diagnosis output is the PRD input. Codex's "the cause is `app.css:2275`" becomes line 1 of Engineer's brief. Engineer doesn't re-derive; it executes.

---

## The Numbers

| | Engineer | Codex |
|---|---|---|
| Issues won | 2 | 3 |
| Avg files touched per plan | 2.8 | 3.4 |
| Catches house-style traps | Often | Sometimes |
| Catches architectural category errors | Sometimes | Often |
| Runs scripts during diagnosis | Never | Often |
| Surfaces spec ambiguity (SPEC-CHALLENGE) | Always | Never |
| Reads constraining files before recommending | Sometimes | Always |

---

## Caveats

N=5 is small. The pattern is consistent across all five issues but isn't statistically airtight. I'd want N=15 or so before committing to the matrix as a hard rule.

The comparison is also not a clean "model A vs model B" benchmark — Engineer has `engineer.md` pre-loading, Codex starts cold. That's *intentional*, because it reflects how I actually use them, but it means part of what I'm measuring is the value of the pre-loading itself, not just the underlying model.

And Codex's outputs were 30–45KB session logs — I had to extract the actual plan from session metadata to compare them to Engineer's clean output. If you build the Aggregate Agent, plan for the codex-output-extraction step.

---

## What I'm Doing Next

Two paths forward, both worth doing:

1. **Build the Aggregate Agent skill** — encode the routing matrix as a real triage step, spawn the right agent, pipe diagnosis into execution. One-time investment, recurring leverage.
2. **Apply the routing manually right now** — the actual P0 layout-shift fix is ready: hand Engineer Codex's `app.css:2275` finding plus the "DictationBar should be popover-layer" pattern, and let Engineer execute the merged PRD. This is the demonstration that the matrix produces a real fix.

The single-agent question — *"is Claude or GPT better?"* — turns out to be the wrong question for this kind of work. The right question is **which one fails in a way that matters less for your specific task**, and the answer for production code is: it depends, and the right move is often to use both in sequence.

---

*Dennis Dyall is a developer in Sweden building Speaksheet, a chord-sheet app for gigging musicians and worship leaders. The Engineer and Codex outputs from this experiment, plus the full aggregated verdict, live in the Speaksheet repo under `Plans/exp-engineer-vs-codex/`.*
