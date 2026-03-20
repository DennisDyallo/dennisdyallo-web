# Dennis Dyallo

Official website for Dennis Dyallo.

## Live Site

`dyallo.se`

## Structure

```
.
├── index.html      # Main site (single-page, no build step)
├── deploy.sh       # Deployment script
└── README.md
```

No build process — pure HTML/CSS/JS.

## Deployment

The site is hosted on a VPS via **Docker + Caddy**, served as static files.

To deploy:

```bash
./deploy.sh
```

This copies `index.html` to `~/services/dyallo-se/site/` and reloads Caddy.

### Infrastructure

- **Reverse proxy / HTTPS:** Caddy (Docker container)
- **Config:** `~/services/caddy/Caddyfile`
- **Docker Compose:** `~/services/docker-compose.yml`
- **Site files:** `~/services/dyallo-se/site/`

## Local Development

```bash
python3 -m http.server 8000
# open http://localhost:8000
```
