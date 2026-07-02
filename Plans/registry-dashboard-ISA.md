---
title: Registry Dashboard Integration ISA
created: 2026-07-02
updated: 2026-07-02
status: active
---

# Registry Dashboard Integration ISA

## Problem

The Project Registry now knows the canonical projects, service paths, daemon labels, domains, and dashboard participation rules, but the Vault Dashboard only surfaces vault activity and partial repo activity. Dennis still has to remember which services exist, which projects are canonical, which daemons back them, and whether the registry daemon is healthy by reading registry files or daemon output directly.

## Vision

The dashboard becomes the private mission-control screen for the actual operating substrate: projects, services, daemons, and recent repo activity appear as first-class quest lanes beside the already-working vault streams. It should feel like the existing Rupicola OS dashboard got a new "Systems" cartridge, not like a separate admin console.

## Out of Scope

This iteration does not auto-edit the registry from the dashboard, manage Docker/Caddy, restart daemons, expose service secrets, or build a public portfolio page from private registry data. It does not replace the registry daemon, the registry CLI, or existing daemon health tooling.

## Principles

- Follow the existing static-first dashboard architecture: generate private JSON at build/deploy time and render under `/dashboard/*` only.
- The registry remains canonical; dashboard code displays derived views and never becomes a second source of truth.
- Useful beats exhaustive: show orientation, health snapshot age, and next-click context rather than every registry field.
- Sia product lens: make the screen reduce Dennis's cognitive load, not increase his obligations.
- Privacy first: project paths, service paths, daemon labels, domains, and Matrix metadata stay behind the protected dashboard boundary.

## Constraints

- Implementation lives in `~/Code/other/dyallose` and follows existing `scripts/generate-vault-dashboard.ts` plus Astro dashboard patterns.
- Source registry is `~/Documents/Sunthings_AppStorage_EU_e2e/_System/PAI/Identity/project-registry.json`.
- Registry health comes from deterministic local artifacts and commands only; no AI-generated health claims.
- Static health is explicitly a generated snapshot. The dashboard must show when it was checked so Dennis does not mistake build-time health for live telemetry.
- Generated registry-derived data must remain private and must pass `bun run dashboard:verify-private`.
- Dashboard must keep working if a repo/service path listed in the registry is currently missing; missing paths degrade to visible status, not build failure.

## Goal

Integrate Project Registry projects, services, daemon associations, and registry-daemon health into the private dyallose Vault Dashboard using the existing generated-data and quest-log UI patterns, then deploy and commit the verified result.

## Criteria

- [ ] ISC-1: `Plans/registry-dashboard-ISA.md` exists and defines the dashboard integration scope, non-goals, verification, and Sia product lens.
- [ ] ISC-2: Dashboard generator reads `project-registry.json` and emits at least one `registry-project` item per registry project.
- [ ] ISC-3: Dashboard generator emits registry service/system items for registry entries with `kind: "service"` or `paths.service`.
- [ ] ISC-4: Registry project/service items include useful private orientation fields: status, kind, domains, daemon names/labels when present, safe path presence status, and generated snapshot time.
- [ ] ISC-5: The dashboard has visible lanes/cards for Registry Projects, Services, and Repo Activity using the existing lane-card/card/side-panel visual language.
- [ ] ISC-6: Registry daemon health is visible as a dashboard item or panel and includes evidence from `project-registry` doctor/report/launchd plus a visible checked-at timestamp.
- [ ] ISC-7: Search supports registry items via `type:registry-project`, `type:registry-service`, and terms from project names, ids, domains, daemons, and descriptions.
- [ ] ISC-8: Registry-derived inline item pages render under `/dashboard/item/*` with the same dashboard item template as other activity.
- [ ] ISC-9: `bun run build` passes, including the dashboard privacy scan.
- [ ] ISC-10: `./deploy.sh` completes, places the built dashboard into the configured service site directory, and the deployed local file tree contains `/dashboard/index.html`.
- [ ] ISC-11: A dyallose git commit captures the ISA plan and working dashboard implementation after deploy succeeds.
- [ ] Anti-ISC-12: No private registry tokens leak outside `dist/dashboard/` in built output.
- [ ] Anti-ISC-13: The dashboard does not mutate `project-registry.json`, launchd, Docker, Caddy, services, or git remotes.
- [ ] Anti-ISC-14: The dashboard does not expose registry data on public nav, RSS, sitemap, or routes outside `/dashboard/*`.
- [ ] Anti-ISC-15: The privacy scanner explicitly considers registry project ids/names, repo/service/vault/docs paths, domains, Matrix room ids/names, daemon labels/names, and semantic identity probe values, then enforces high-signal private tokens so public low-entropy strings do not create false positives.

## Test Strategy

| ISC | Type | Check | Threshold | Tool |
|---|---|---|---|---|
| ISC-1 | file review | Read `Plans/registry-dashboard-ISA.md` | required sections present | read |
| ISC-2/3/4 | generated data | `bun run dashboard:generate` then inspect `src/data/vault-dashboard.json` counts/types | registry project/service items present | shell/read |
| ISC-5/7/8 | build/code review | `bun run build` plus inspect dashboard page type lanes/search labels | exit 0 and labels present | shell/read |
| ISC-6 | generated data/code review | Inspect generated registry health item content and generator source | doctor/report/launchd evidence and checked-at timestamp present | read/grep |
| ISC-9 | build | `bun run build` | exit 0 | shell |
| ISC-10 | deploy | `./deploy.sh` and `test -f ~/services/dyallo-se/site/dashboard/index.html` | exit 0 and deployed dashboard file exists | shell |
| ISC-11 | git | `git status --short`, `git diff --cached --check`, `git commit` | only intended files committed | shell |
| Anti-ISC-12/14/15 | privacy | `bun run dashboard:verify-private` after build and read scanner token extraction | zero high-signal leaks and registry fields covered | shell/read |
| Anti-ISC-13 | code review | Generator/dashboard code has no write paths to registry/services/launchd/docker | no mutation calls | grep/read |

## Features

| name | description | satisfies | depends_on | parallelizable |
|---|---|---|---|---|
| registry-inventory-generator | Read registry JSON and convert projects/services into dashboard activity items | ISC-2, ISC-3, ISC-4, ISC-7, ISC-8 | existing generator | yes |
| registry-health-card | Surface project-registry daemon/doctor status from deterministic evidence | ISC-6 | registry-inventory-generator | yes |
| registry-dashboard-ui | Add lanes, labels, filters, side panel, and styling for registry/project/service/repo activity | ISC-5, ISC-7 | registry-inventory-generator | yes |
| privacy-hardening | Ensure registry private tokens stay covered by existing privacy scan | Anti-ISC-12, Anti-ISC-14 | registry-dashboard-ui | yes |
| deploy-and-commit | Build, deploy, verify status, and commit intended dyallose files only | ISC-9, ISC-10, ISC-11 | all features | no |

## Decisions

- 2026-07-02: Treat the earlier repo-activity integration as a partial foundation, not the complete feature. Full integration needs explicit registry project/service/health lanes.
- 2026-07-02: Keep the dashboard read-only. Registry mutation remains in the ProjectRegistry CLI and maintainer workflow because automatic registry edits need conservative deterministic tooling.
- 2026-07-02: Use the existing activity item model instead of a separate dashboard data shape. This preserves inline item pages, search, privacy scanning, and visual continuity.
- 2026-07-02: Sia product lens: this should answer "what exists, what is alive, where do I go next?" in seconds. Avoid adding a dense infrastructure spreadsheet.
- 2026-07-02: Cato warned that static build-time health can be mistaken for live telemetry. The dashboard will label registry health as a snapshot and show the checked-at timestamp.
- 2026-07-02: Cato warned that privacy and health-source claims need stronger mechanical checks. Criteria now require explicit scanner token coverage for registry fields and evidence-bearing health content.

## Changelog

- conjectured: First-class registry items can reuse the existing activity-card and inline-item mechanics without new routes.
  refuted by: Pending implementation/build verification.
  learned: Pending.
  criterion now: ISC-2 through ISC-8 verify generated data, UI visibility, search, and inline rendering.

## Verification

Pending implementation.
