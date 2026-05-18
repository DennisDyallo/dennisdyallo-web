# dyallo.se — Convergence Node

Official website for Dennis Dyall. Built with Astro, deployed to VPS via rsync.

## Live Site

`https://dyallo.se`

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## Publishing Workflow

Posts are written in the Obsidian vault at:
`~/Documents/Sunthings_AppStorage_EU_e2e/Projects/Dyallo Blog/posts/`

To publish:

```bash
# Dry run (see what would be copied)
bun run publish --dry-run

# Sync non-draft posts, commit, and push
bun run publish
```

Posts with `draft: true` are never copied to the site.

## Writing a New Post

Create a markdown file in the vault posts directory with this frontmatter:

```yaml
---
title: "Your Post Title"
slug: "url-slug"
description: "One-sentence description for SEO and social."
pubDate: 2026-05-18
tags: ["tag1", "tag2"]
draft: false
---
```

The `slug` field determines the URL (`/blog/url-slug`), not the filename.

Obsidian-style wikilinks are supported in post markdown. Known internal routes render as links, for example `[[About]]`; unknown pages render as plain text.

## Site Sections

Phase 2 fills the Convergence Node register pages:

- `/about` — long-form four-register narrative
- `/now` — dated snapshot across building, music, practice, reading, and curiosities
- `/coaching` — Zen coaching service page with inquiry CTA
- `/dev` — engineering positioning and project highlights
- `/music` — Moonkin, Echological roster, fire arts, and flow community
- `/projects` — case-study index for dyallo.se, PAI, and Echological

## Open Graph Images

Blog posts get deterministic generated share images at `/og/<slug>.png`. The Astro build uses Satori plus a local TTF font and Sharp to create 1200 × 630 PNGs with the post title, date, dyallo.se wordmark, and Rupicola signature mark.

## Newsletter

The subscribe form posts to Buttondown's embedded endpoint for the `dyallo` newsletter:

```text
https://buttondown.email/api/emails/embed-subscribe/dyallo
```

RSS-to-email setup is documented in [`docs/buttondown-rss-setup.md`](docs/buttondown-rss-setup.md). Dennis still needs to verify the full live flow with a real email address and the Buttondown dashboard.

## Imagery Prompt Workflow

No AI-generated imagery is committed in this repo. Phase 2 only authors prompt files in `docs/imagery-prompts/`, each citing the StyleGuide gate at:

```text
~/Documents/Sunthings_AppStorage_EU_e2e/Projects/Dyallo Blog/StyleGuide.md
```

After Dennis reviews StyleGuide v1.0, image generation happens separately through PAI `/Art`.

## Deployment

The site is hosted on a VPS via **Docker + Caddy**, served as static files.

To deploy:

```bash
./deploy.sh
```

This:
1. Runs `bun run build` (generates `dist/`)
2. Rsyncs `dist/` to `~/services/dyallo-se/site/` on the VPS
3. Reloads Caddy

## Design

- **Palette:** Rupicola Editorial (recalibrated from tattoo)
- **Dark mode:** Default (warm-black bg, parchment ink, sun-orange primary)
- **Fonts:** Source Serif 4 (body) + Inter (UI)
- **Reading width:** ≤70ch for blog posts
