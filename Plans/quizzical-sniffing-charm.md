# Plan: SEO + Self-Hosted Umami Analytics (All Sites)

## Context

The user hosts multiple sites on a Mac Mini via Colima/Docker + Caddy. None have analytics. SEO coverage varies: feliciafalck.com has full SEO, echological.fm has OG/Twitter tags, dyallo.se and moonkinsounds.com have minimal SEO. No site has robots.txt or sitemap.xml. The goal is to bring all sites to a consistent baseline: robots.txt, sitemap.xml, and Umami tracking — plus full SEO for dyallo.se specifically.

---

## Site Inventory & Current SEO State

| Site | Source Repo | OG Tags | Canonical | JSON-LD | robots.txt | sitemap.xml | Deploy method |
|---|---|---|---|---|---|---|---|
| dyallo.se | `dennisdyallo-web/index.html` | Missing | Missing | Missing | Missing | Missing | cp + caddy reload |
| echological.fm | `echologicalfm/src/index.html` | Has | Missing | Missing | Missing | Missing | npm build → cp dist/ |
| feliciafalck.com | `feliciafalck/index.html` | Has | Has | Has | Missing | Missing | cp |
| moonkinsounds.com | `~/services/moonkinsounds/site/index.html` (no source repo) | Missing | Missing | Missing | Missing | Missing | direct edit |
| Artist subpages (hazaaheli, naomiruna, andreaslang, sophievonmatern) | Separate repos, deployed under echological.fm | Varies | Varies | — | N/A (subpaths) | N/A (included in echological.fm sitemap) | cp to echological-fm/site/ |

---

## Part 1: Umami Infrastructure (shared by all sites)

### Files to modify
- `~/services/docker-compose.yml` — add umami + umami-db services + volume
- `~/services/.env` — add UMAMI_DB_PASSWORD and UMAMI_APP_SECRET
- `~/services/caddy/Caddyfile` — add analytics.dyallo.se block after line 121

### docker-compose.yml additions (insert before `networks:` at line 146)

```yaml
  # Umami Analytics
  umami-db:
    image: postgres:15-alpine
    container_name: umami-db
    restart: unless-stopped
    volumes:
      - umami_db_data:/var/lib/postgresql/data
    networks:
      - web
    environment:
      POSTGRES_DB: umami
      POSTGRES_USER: umami
      POSTGRES_PASSWORD: ${UMAMI_DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U umami"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    container_name: umami
    restart: unless-stopped
    expose:
      - "3000"
    networks:
      - web
    environment:
      DATABASE_URL: postgresql://umami:${UMAMI_DB_PASSWORD}@umami-db:5432/umami
      APP_SECRET: ${UMAMI_APP_SECRET}
    depends_on:
      umami-db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://localhost:3000/api/heartbeat || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
```

Add `umami_db_data:` to existing `volumes:` section.

### .env additions (generate with `openssl rand -base64 32`)
```
UMAMI_DB_PASSWORD=<generated>
UMAMI_APP_SECRET=<generated>
```

### Caddyfile addition (after www.dyallo.se block, line 121)
```caddy
# analytics.dyallo.se - Umami Analytics
analytics.dyallo.se {
    reverse_proxy umami:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
    }
}
```

### Umami websites (4 in one dashboard)
| Website name | Domain | Tracks |
|---|---|---|
| dyallo.se | dyallo.se | Personal site |
| echological.fm | echological.fm | Main + all artist subpages |
| feliciafalck.com | feliciafalck.com | Artist site (own domain) |
| moonkinsounds.com | moonkinsounds.com | DJ label site |

---

## Part 2: Per-Site SEO & Tracking

### 2a. dyallo.se (full SEO overhaul)

**Source:** `~/Code/other/dennisdyallo-web/index.html`

Add after line 7 (after `<meta name="description">`):
```html
<meta name="author" content="Dennis Dyall">
<meta name="theme-color" content="#B8894A">
<link rel="canonical" href="https://dyallo.se/">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:title" content="Dennis Dyall">
<meta property="og:description" content="Dennis Dyall — developer, artist manager, and creative practitioner based in Gothenburg, Sweden.">
<meta property="og:url" content="https://dyallo.se/">
<meta property="og:site_name" content="Dennis Dyall">
<meta property="og:image" content="https://dyallo.se/og-image.jpg">

<!-- Twitter/X -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Dennis Dyall">
<meta name="twitter:description" content="Dennis Dyall — developer, artist manager, and creative practitioner based in Gothenburg, Sweden.">
<meta name="twitter:image" content="https://dyallo.se/og-image.jpg">
```

Add before `</head>` — JSON-LD + Umami script:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Dennis Dyall",
  "jobTitle": ["Senior Software Engineer", "Artist Manager", "Zen Coach"],
  "worksFor": { "@type": "Organization", "name": "Yubico" },
  "address": { "@type": "PostalAddress", "addressLocality": "Gothenburg", "addressCountry": "SE" },
  "url": "https://dyallo.se",
  "sameAs": [
    "https://github.com/DennisDyallo",
    "https://www.linkedin.com/in/dennis-dyallo",
    "https://www.instagram.com/ddyallo",
    "https://www.facebook.com/ddyallo",
    "https://echological.fm"
  ]
}
</script>
<script defer src="https://analytics.dyallo.se/script.js" data-website-id="PLACEHOLDER_DYALLO"></script>
```

**Create:** `robots.txt`, `sitemap.xml`, `og-image.jpg` (crop from image00001.jpeg via `sips -z 630 1200`)

**Update deploy.sh** line 10 to also copy `robots.txt`, `sitemap.xml`, `og-image.jpg`.

### 2b. echological.fm (add canonical, robots.txt, sitemap, tracking)

**Source:** `~/Code/other/echologicalfm/src/index.html`

Already has: OG tags, Twitter tags, theme-color, favicons.

Add after line 42 (after Twitter image tag):
```html
<link rel="canonical" href="https://echological.fm/">
```

Add before `</head>` (before line 62):
```html
<script defer src="https://analytics.dyallo.se/script.js" data-website-id="PLACEHOLDER_ECHOLOGICAL"></script>
```

**Create in `~/Code/other/echologicalfm/`:**

`robots.txt`:
```
User-agent: *
Allow: /
Disallow: /scout/

Sitemap: https://echological.fm/sitemap.xml
```

`sitemap.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://echological.fm/</loc><lastmod>2026-04-02</lastmod><priority>1.0</priority></url>
  <url><loc>https://echological.fm/hazaaheli/en/</loc><lastmod>2026-04-02</lastmod><priority>0.8</priority></url>
  <url><loc>https://echological.fm/naomiruna/</loc><lastmod>2026-04-02</lastmod><priority>0.8</priority></url>
  <url><loc>https://echological.fm/andreaslang/</loc><lastmod>2026-04-02</lastmod><priority>0.8</priority></url>
  <url><loc>https://echological.fm/sophievonmatern/</loc><lastmod>2026-04-02</lastmod><priority>0.8</priority></url>
</urlset>
```

**Update deploy.sh** to copy robots.txt and sitemap.xml to site dir alongside the dist/ output.

### 2c. feliciafalck.com (add robots.txt, sitemap, tracking)

**Source:** `~/Code/other/feliciafalck/index.html`

Already has: full OG, Twitter, canonical, JSON-LD, favicon. No changes to existing tags needed.

Add before `</head>`:
```html
<script defer src="https://analytics.dyallo.se/script.js" data-website-id="PLACEHOLDER_FELICIA"></script>
```

**Create in `~/Code/other/feliciafalck/`:**

`robots.txt`:
```
User-agent: *
Allow: /

Sitemap: https://feliciafalck.com/sitemap.xml
```

`sitemap.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://feliciafalck.com/</loc><lastmod>2026-04-02</lastmod><priority>1.0</priority></url>
</urlset>
```

**Update deploy.sh** line 10 to also copy `robots.txt` and `sitemap.xml`.

### 2d. moonkinsounds.com (add robots.txt, sitemap, tracking)

**Source:** `~/services/moonkinsounds/site/index.html` (no source repo — edit deployed file directly)

Add before `</head>`:
```html
<script defer src="https://analytics.dyallo.se/script.js" data-website-id="PLACEHOLDER_MOONKIN"></script>
```

**Create in `~/services/moonkinsounds/site/`:**

`robots.txt`:
```
User-agent: *
Allow: /

Sitemap: https://moonkinsounds.com/sitemap.xml
```

`sitemap.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://moonkinsounds.com/</loc><lastmod>2026-04-02</lastmod><priority>1.0</priority></url>
</urlset>
```

### 2e. Artist subpages (tracking script only)

These are subpaths of echological.fm — no separate robots.txt/sitemap needed (covered by echological.fm's sitemap). Just add the Umami tracking script with echological.fm's website-id.

| Source file | Add Umami script |
|---|---|
| `~/Code/other/hazaaheli/index.html` | Yes (echological.fm ID) |
| `~/Code/other/hazaaheli/epk/index.html` | Yes (echological.fm ID) |
| `~/Code/other/hazaaheli/en/index.html` (if exists) | Yes |
| `~/Code/other/hazaaheli/fr/index.html` (if exists) | Yes |
| `~/Code/other/hazaaheli/sv/index.html` (if exists) | Yes |
| `~/Code/other/naomiruna/index.html` | Yes |
| `~/Code/other/andreaslang/index.html` | Yes |
| `~/Code/other/sophievonmatern/index.html` | Yes |

All get: `<script defer src="https://analytics.dyallo.se/script.js" data-website-id="PLACEHOLDER_ECHOLOGICAL"></script>`

---

## Execution Order

1. **Create all robots.txt + sitemap.xml files** (dyallo, echological, feliciafalck, moonkinsounds)
2. **SEO tags for dyallo.se** (OG, Twitter, canonical, JSON-LD, og-image)
3. **Add Umami tracking `<script>` to all HTML files** (with PLACEHOLDER IDs)
4. **Update all deploy.sh scripts** to copy new files
5. **Umami infrastructure**: generate secrets in .env, add to docker-compose.yml, add Caddyfile block
6. **Manual: DNS** — create A record for `analytics.dyallo.se` at Loopia
7. **Deploy Umami**: `docker compose up -d umami-db umami`, reload Caddy
8. **First login**: change password, create 4 websites, copy website-ids
9. **Replace all PLACEHOLDERs** with real UUIDs
10. **Redeploy all sites** (run each deploy.sh)

---

## Verification

- `curl -s https://dyallo.se/ | grep 'og:title'` — OG tags present
- `curl -s https://dyallo.se/robots.txt` — robots.txt served
- `curl -s https://echological.fm/robots.txt` — robots.txt served
- `curl -s https://feliciafalck.com/robots.txt` — robots.txt served
- `curl -s https://moonkinsounds.com/robots.txt` — robots.txt served
- `curl -s https://analytics.dyallo.se/api/heartbeat` — Umami healthy
- `docker ps | grep umami` — both containers running + healthy
- Browser DevTools on each site — confirm script.js loads
- Umami dashboard — confirm pageview events from all 4 sites
