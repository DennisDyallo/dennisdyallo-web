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
