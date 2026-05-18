# Analytics Review Cadence

## Dashboard

**URL:** https://analytics.dyallo.se  
**Platform:** Umami (self-hosted)  
**Tracking:** Privacy-respecting pageview analytics only (no user tracking, no third-party scripts)

## Review Schedule

**Cadence:** Last Sunday of each month  
**Duration:** 15-30 minutes  
**Format:** Solo review + notes capture

## What to Review

### 1. Traffic Overview
- **Total pageviews** — Overall site traffic trend
- **Unique visitors** — Returning vs new audience
- **Top pages** — Which content is landing
- **Top referrers** — Where traffic originates (search, social, direct)

### 2. Content Performance
- **Blog post views** — Which essays resonate
- **Register pages** — Which practices attract attention (Engineering, Music, Coaching, Writing)
- **Bounce rate** — Are visitors exploring beyond the landing page?
- **Average session duration** — Engagement depth

### 3. Search Terms (if available)
- What queries bring people to the site
- Keyword patterns revealing audience intent
- SEO opportunities

### 4. Geographic & Device
- Where readers are located (Sweden, US, Europe, elsewhere)
- Mobile vs desktop ratio
- Browser distribution (relevant for performance optimization)

## Where to Record Insights

Capture findings in one of two locations:

### Option A: Vault (Recommended)
Create monthly entries in `Sources/Analytics/` directory:
- `Sources/Analytics/2026-05-analytics.md`
- `Sources/Analytics/2026-06-analytics.md`
- etc.

Template:
```markdown
# Analytics Review — [Month YYYY]

**Period:** [Date range]  
**Reviewed:** [Date of review]

## Key Metrics
- Pageviews: X
- Unique visitors: X
- Top post: "[Title]" (X views)
- Top referrer: [Source]

## Observations
- [Notable pattern or change]
- [Audience insight]
- [Content opportunity]

## Actions
- [ ] [If any follow-up needed]
```

### Option B: ISA Changelog
If findings impact site strategy, log them directly to the ISA Changelog at:  
`Projects/Dyallo Blog/ISA.md` under the `## Changelog` section.

## Action Triggers

Analytics should inform, not dictate. Act when:
- **A post performs 3x above average** → Consider follow-up content on that theme
- **Referrer pattern shifts** → Investigate new audience source (e.g., sudden HN traffic)
- **Mobile bounce rate >70%** → Review mobile UX
- **Top 3 posts haven't changed in 6 months** → Publishing cadence may need adjustment

Otherwise, treat as passive observation — the site compounds slowly, not virally.

## Anti-Patterns

- ❌ Obsessing over daily fluctuations (noise, not signal)
- ❌ Changing content strategy based on <30 days of data
- ❌ Chasing virality at the expense of depth
- ❌ Adding tracking pixels or third-party analytics beyond Umami

## Notes

- **First review:** June 2026 (after ~1 month of live traffic)
- **Baseline period:** May 2026 (site launch month — expect low traffic, mostly direct/search)
- **Compounding horizon:** 12-24 months before SEO authority materializes

The goal is not optimization for growth — it's passive observation of what resonates, so future writing can align with demonstrated reader interest.
