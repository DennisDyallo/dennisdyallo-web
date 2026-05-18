---
title: dyallo.se — Session Handoff
session_date: 2026-05-18
session_duration: ~one focused build session
session_outcome: Live Convergence Node site with three-phase rollout shipped
current_tag: v2.10-library-moonkin
current_commit: 35883c46edf2ff45e18d9d7758e1a592a4f11741
live_url: https://dyallo.se
status: shipped — backlog awaits next session
---

# dyallo.se — Session Handoff

> **Read this first if you are resuming the dyallo.se work in a fresh agent context.** Every claim here points at a real file or git ref you can verify directly. The full audit trail lives in the vault at `~/Documents/Sunthings_AppStorage_EU_e2e/Projects/Dyallo Blog/`.

---

## What Shipped This Session

**Built from "I want to publish blogs" → live Convergence Node site at https://dyallo.se** in one session. Three-phase rollout coordinated through written PRDs and cross-vendor agent comparison (Engineer Claude Sonnet ↔ Codex CLI gpt-5.5). Engineer scaffolded; Codex did content + polish; Engineer refined; Sia (Opus) orchestrated, caught regressions, and shipped.

**Live verifiable:**
- Convergence Node homepage with hero (Rupicola signature SVG + sovereignty sentence)
- 5 register pages with real long-form content + Imagen-4-Ultra hero illustrations
- 3 blog posts (Hello, Bokio dispute, Engineer vs Codex routing)
- /now, /about, /library (Recently Finished list + curated categories)
- Sticky site nav with active-page underline, theme toggle, home link
- Dark mode default (warm-black + sun-orange), light-mode opt-in
- SoundCloud Moonkin DJ Sets embed on /music
- Buttondown subscribe form
- Vault → site publishing pipeline (`bun run publish`)
- All SEO: sitemap, RSS, robots, JSON-LD Article + Person, Satori OG images
- Lighthouse production: **Performance 100, Accessibility 100, Best Practices 100, SEO 100**

---

## Git State

**Current HEAD:** `35883c4` on `main`, in sync with `origin/main`.
**Working tree:** clean except for `Plans/lighthouse-phase3.report.{html,json}` (deliberately untracked Lighthouse output).
**Remote:** `github.com/DennisDyallo/dennisdyallo-web`.

**All tags shipped this session (newest first):**

| Tag | What it ships | Rollback to here = |
|---|---|---|
| `v2.10-library-moonkin` | /library Recently Finished list (16 books); moonkinsounds.com link on /music | current production |
| `v2.9-ornaments-integrated` | Engineer's Phase 3 ornament library wired (DotSequence on blog posts, TriangleChain on /about) | drop ornaments |
| `v2.8-moonkin-embed` | SoundCloud DJ Sets iframe with sun-orange color param | drop music embed |
| `v2.7-site-nav` | Sticky header with home-link + nav + theme toggle | no nav |
| `v2.6.1-echological-link` | echological.fm rename + live link | "Echological Infrastructure" no link |
| `v2.6-engineering-edits` | Yubico.NET.SDK, Speaksheet added; NanoClaw removed; PAI renamed; GitHub links | older engineering page |
| `v2.5-tight-bird-all-heroes` | Tight Rupicola viewBox (441×640) + 4 missing register heroes wired | bird padded, 4 heroes missing |
| `v2.4-register-heroes` | 5 Imagen-4-Ultra register-page hero illustrations | no register heroes |
| `v2.3-rupicola-glyph` | Real Rupicola signature mark (Imagen → potrace vectorized) replacing Engineer's pumpkin glyph | placeholder glyph |
| `v2.2.2-toggle-mobile` | Theme toggle moved to footer + mobile newsletter sizing fix | floating toggle, tall input bug |
| `v2.2.1-dark-default-fix` | Dark mode unconditional default (was prefers-color-scheme gated) | light mode for light-OS users |
| `v2.2-phase3-refinement` | A11y fixes (94→100), /library page, 5 ornament components, snake-rose audit | A11y 94, no library, no ornaments |
| `v2.1-phase2-content` | Codex Phase 2: real register content, OG route, wikilink plugin, refined Rupicola, completed tokens | placeholder pages |
| `v2.0-astro-convergence` | Engineer Phase 1: Astro scaffold, blog pipeline, Convergence homepage | scaffold-only state |
| `v1.0-legacy-static` | The original hand-rolled single-page index.html + Caddy deploy.sh | **the original site** |

**One-command rollback to any state:**
```bash
cd ~/Code/other/dyallose && git checkout <tag> && ./deploy.sh
```
For the absolute revert to pre-Astro: `git checkout v1.0-legacy-static && ./legacy-deploy.sh` (legacy script preserved alongside).

---

## Vault Artifacts (source of truth)

All under `~/Documents/Sunthings_AppStorage_EU_e2e/Projects/Dyallo Blog/`:

| File | Purpose | Current state |
|---|---|---|
| `ISA.md` | Ideal State Artifact — 41 ISCs, 19 Decisions, 1 Changelog C/R/L entry, all phase decisions | living source of truth; sun-orange palette locked, dark default locked, three phases recorded |
| `StyleGuide.md` | Visual identity v1.0 — palette + mood + composition + avoid-list + prompt template | **approved by Dennis 2026-05-18** — ISC-39 gate open for /Art invocations |
| `Phase2-PRD.md` | The brief Codex executed (content + polish + Imagen prompts) | reference doc, all items shipped |
| `Phase3-PRD.md` | The brief Engineer executed (a11y, /library, ornaments, audit, cadence docs) | reference doc, §A populated with Codex deferrals |
| `Backlog.md` | Living open-items list | 4 items open: Buttondown slug, /now fact-check, Speaksheet audit iter 2, sparse artwork discipline reminder |
| `SpeaksheetAudit.md` | Linter-as-guardrail port plan — DevTeam Improve cycle | **draft v0.2 (concerns)** — Codex Reviewer flagged 3 fails; Engineer iter 2 needed before implementation |
| `_agent-comparison.md` | Cross-vendor retrospective: Engineer (Sonnet) ↔ Codex (gpt-5.5) ↔ Sia (Opus) rubric, per-phase rows, finalization notes | populated for all three phases + Sia finalization rows |
| `posts/` | Vault-side source of blog markdown (3 posts) | `hello-blog.md`, `bokio-dispute-resolution-swedish-contract-law.md`, `engineer-vs-codex-routing-pattern.md` |
| `verification/v2.2/` through `v2.7/` | Playwright screenshots per release for visual audit trail | dark home, light home, blog post, library, register pages, mobile, post-hotfix, Rupicola PNG comparisons |

---

## Code Repo (`~/Code/other/dyallose/`)

Astro 6 static site, TypeScript, bun runtime. Output static HTML; deployed via `./deploy.sh` → rsync to `~/services/dyallo-se/site/` on Dennis's local Caddy + Docker setup, fronted by Cloudflare.

**Key directories:**
- `src/pages/` — Convergence homepage, 6 register pages, `blog/[slug].astro` dynamic route, `og/[slug].png.ts` Satori OG route
- `src/components/` — `RupicolaMark.astro`, `SubscribeForm.astro`, `ornament/` (5 original geometric ornaments + README)
- `src/lib/` — `remark-wikilinks.ts`, `rupicola.ts` (inline SVG + `getRupicolaDataUri`)
- `src/content/blog/` — Astro content collection (3 markdown posts mirrored from vault)
- `src/styles/tokens.css` — design tokens, dark-default palette, full type/spacing/shadow/z-index/transition scales
- `src/layouts/BaseLayout.astro` — site header (nav + home-link + theme toggle), JSON-LD Person, Umami analytics, fonts
- `public/heroes/` — 5 WebP hero images (1600×900 + 800×450 srcset) per register page
- `public/favicon.svg` — Imagen-4-generated Rupicola, vectorized via potrace, tight viewBox 441×640
- `scripts/publish.ts` — vault → site sync (`bun run publish --dry-run` to test)
- `docs/imagery-prompts/` — 6 Imagen prompts (5 register + Rupicola glyph) citing StyleGuide v1.0
- `docs/buttondown-rss-setup.md`, `docs/analytics-review.md`, `docs/content-cadence.md` — operational docs
- `Plans/lighthouse-phase2-live.{json,html}` + `lighthouse-phase3.report.{json,html}` — production audit history
- `legacy-index.html`, `legacy-deploy.sh` — preserved pre-Astro state

**Common commands:**
```bash
cd ~/Code/other/dyallose
bun run dev               # local dev server
bun run build             # static build → dist/
bun run preview           # serve dist/ locally
bun run publish           # sync vault posts → src/content/blog → commit
bun run publish --dry-run # see what would happen, no commit/push
./deploy.sh               # build + rsync to VPS + reload Caddy (manual; Sia never runs this without Dennis approval)
```

---

## Fitness-for-Purpose Assessment

**Target user inferred from README, CLAUDE.md, ISA Vision:** Dennis Dyall — Senior Software Engineer at Yubico, artist manager (Echological), Zen coach, writer. The site's job: be the **public Convergence Node** where his four registers (engineering, music, coaching, writing) are visibly one practice with sovereignty as the throughline.

### Coverage Table

| Area | Status | Notes |
|---|---|---|
| **Convergence homepage** | ✅ | Bird + sentence + 4 register cards + latest posts + newsletter |
| **Engineering page** | ✅ | Hero, content, 6 highlight projects with GitHub links where public, CTA |
| **Music page** | ✅ | Hero, Moonkin SoundCloud embed, artist roster, fire-arts mention |
| **Coaching page** | ✅ | Hero, content, booking CTA above fold, FAQs, pricing placeholder |
| **Projects page** | ✅ | 4 case studies with GitHub links where public |
| **/about** | ✅ | ~900-word narrative + TriangleChain ornament |
| **/now** | ⚠️ | Renders, but content is Codex's plausible guesses — needs Dennis fact-check |
| **/library** | ✅ | Recently Finished (16 books) + 6 curated categories |
| **/blog (index + posts)** | ✅ | 3 posts live, RSS, OG images, drop cap, sticky nav |
| **Blog publishing pipeline** | ✅ | Vault → `bun run publish` → site (tested end-to-end) |
| **Newsletter (Buttondown)** | ⚠️ | Form works, slug `dyallo` returned 404 in Codex probe — needs Dennis live submission to confirm correct slug |
| **Site nav** | ✅ | Sticky header, home-link, 5 destinations, theme toggle, active underline |
| **Dark mode** | ✅ | Unconditional default (after v2.2.1 hotfix), light opt-in, manual toggle persists |
| **Rupicola signature mark** | ✅ | Real Imagen-4 glyph vectorized, hero (160px) + footer (24px) + favicon |
| **SEO** | ✅ | Sitemap, RSS, robots.txt, JSON-LD Article+Person, OG meta, canonical |
| **Lighthouse production** | ✅ | All four 100/100/100/100 on /blog/hello-blog/ |
| **Accessibility** | ✅ | Main landmark, heading order, ≥WCAG AA contrast both modes |
| **Mobile** | ✅ | Responsive 4-register grid stacks, hero bird shrinks 110px, newsletter form column-stacks |
| **Rollback path** | ✅ | 15 tags on origin, one-command checkout + deploy |
| **Build/CI rule enforcement** | ❌ | No automated lint guardrails yet — see Speaksheet audit (concerns) |
| **Imagery generation pipeline** | ✅ | /Art skill + Imagen 4 Ultra working; 6 prompts authored; 6 images shipped |
| **Cross-vendor agent verification** | ✅ | DevTeam pattern proven: Codex caught 3 real Engineer failures Codex review the Speaksheet audit |

### Overall Readiness

🟢 **Shipped — production live with backlog awaiting next session.** All stated phase goals delivered. Performance and a11y at ceiling. Three real blog posts, five register pages with content + hero illustrations, working publishing pipeline. Two items genuinely need Dennis input (Buttondown slug verification, /now fact-check); one needs Engineer iteration 2 (Speaksheet audit fixes). Nothing blocks the site from receiving real traffic *right now*.

### Critical Next Step

**Dennis submits a real email to the Buttondown subscribe form and checks the Buttondown dashboard.** This is the only currently-deployed thing whose behavior isn't fully verified. If the `dyallo` slug is wrong, every visitor who tries to subscribe today fails silently. 30-second task, blocks nothing on Sia's side.

---

## Open Items

### 🤝 Dennis-blocked (need human input)

1. **Buttondown slug verification** — submit real email, check dashboard, tell Sia correct slug if not `dyallo` (then she updates `src/components/SubscribeForm.astro` form action URL)
2. **/now content fact-check** — Codex authored plausible-but-unverified statements about current reading list, NanoClaw status, practice cadence; Dennis reviews `src/pages/now.astro` and corrects

### 🤖 Agent-actionable (no Dennis needed)

3. **Speaksheet audit Engineer iteration 2** — Codex Reviewer flagged 3 fails in `SpeaksheetAudit.md`:
   - Rule 1 wikilink script false-positives against existing `[[About]]`; must read from `src/lib/remark-wikilinks.ts` route map
   - Rule 2 `astro check --minimumSeverity` flag doesn't exist; replace with `astro sync` + frontmatter parser
   - Rule 4 accent budget claims "current count: 3" but actual is 7 (includes token declarations); exclude `src/styles/tokens.css` from grep or count only `var(--accent-rose)` consumers
   - **Resumption:** spawn Engineer with prompt "read SpeaksheetAudit.md § Cross-Vendor Review v0.2, fix the 3 fails, re-run Codex review pass"
4. **Vectorize ornament library** — 5 ornaments shipped but only 2 integrated (DotSequence on blog, TriangleChain on /about); 3 others (StepPattern, ArcBracket, LineWeave) waiting for a use site

### ⏳ Wait-on-event

5. **RSS-to-email** — only testable after Dennis's first real subscriber
6. **Lighthouse monthly re-audit** — first due ~June 2026; cadence documented in `docs/analytics-review.md`
7. **Image optimization (ISC-14)** — kicks in when first blog post with raster images ships
8. **"Currently exploring" /now section** — future evolution, not urgent

---

## Resumption Pointer

**To resume in a fresh agent context, the user runs:**
```
/resume-handoff
```
**Which reads this file** at `~/Code/other/dyallose/Plans/handoff.md` and re-enters the project state.

**First action on resume (in order of expected user intent):**
1. If user says "buttondown" / "newsletter" / "subscribe" → that's the critical-next-step verification path
2. If user says "/now" / "fact-check" → open `src/pages/now.astro` for Dennis correction
3. If user says "Speaksheet" / "audit" / "linter" → spawn Engineer with SpeaksheetAudit § "Cross-Vendor Review v0.2" as fix-list
4. If user says "write a post" → drop `.md` in vault `Projects/Dyallo Blog/posts/`, then `bun run publish`
5. If user says nothing specific → check the live site at https://dyallo.se, then ask what they want next

---

## Session-Wide Wisdom-Frame Candidates

Worth promoting to durable rules in a later /Evolve pass:

1. *"Tag before you delegate. The rollback target must exist before the work that could need rolling back begins."* — captured 18:00 when v1.0-legacy-static was tagged before Engineer's Phase 1.
2. *"Mechanical-build-passes is not visual-correctness. A UI claim without a visual check is a false positive."* — captured when ISC-30 "dark mode default" passed across two phases on the media query alone; browser screenshot caught the regression.
3. *"False positives propagate across phases. The first agent's miss becomes the second agent's inherited assumption."* — same incident.
4. *"For any generation pipeline, the style guide is the first artifact and the gate, not a documentation pass after the fact."* — captured when StyleGuide gate was added pre-Phase-2 imagery work.
5. *"When the user provides a personal symbol as design anchor, ask for the actual artifact before proposing a palette."* — captured when the Rupicola palette was rebuilt from the tattoo photo (crimson-on-cream → sun-orange-on-warm-black).
6. *"Anti-criteria distinguish kind, not degree. A scoped exception with written rationale preserves the rule; silently bending it destroys the rule."* — captured when SoundCloud iframe was scoped as exception to ISC-17 (no third-party trackers) rather than treated as violation.
7. *"Brand wordmarks and natural prose follow different casing rules in the same document — protect both."* — captured when `Echological Infrastructure` → `echological.fm` (wordmark lowercase, prose sentence-case).
8. *"Cross-vendor agent review pays for itself when same-lineage models share a blind spot."* — captured when Codex caught Engineer's "current count: 3" claim that was actually 7.
9. *"An autonomous grant operates inside declared gates, not over them. Gates the user wrote down stay; gates I derive on his behalf bend."* — captured when StyleGuide-review gate was respected despite "drive all phases autonomously" being broadly worded.

---

*End of handoff. Live site: https://dyallo.se · Repo: github.com/DennisDyallo/dennisdyallo-web · Vault root: ~/Documents/Sunthings_AppStorage_EU_e2e/Projects/Dyallo Blog/*
