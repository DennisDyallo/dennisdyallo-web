# Vault Dashboard Runbook

Private dashboard route: `/dashboard`

Intended public hostname: `https://vault.dyallo.se/dashboard`

The dashboard is static Astro output generated from the local Obsidian vault. Generated vault-derived content is private and gitignored; build and deploy must run on a machine that can read:

```text
~/Documents/Sunthings_AppStorage_EU_e2e
```

## Commands

Generate the private activity index only:

```bash
bun run dashboard:generate
```

Build the site and run the dashboard privacy scan:

```bash
bun run build
```

Regenerate and deploy:

```bash
bash scripts/regenerate-vault-dashboard.sh
```

## Caddy Basic Auth

Protect the entire dashboard subtree, including inline item pages and any future private assets. This must apply to **every hostname that serves this same `dist/` tree**. If both `dyallo.se` and `vault.dyallo.se` point at the same static root, both hosts must protect or deny `/dashboard*`.

```caddyfile
vault.dyallo.se {
  encode zstd gzip

  route /dashboard* {
    basicauth {
      dennis <HASHED_PASSWORD_FROM_CADDY_HASH_PASSWORD>
    }
    root * /home/dennis/services/dyallo-se/site
    file_server
  }

  respond / 404
}
```

For the main `dyallo.se` host, add the same auth block or deny the route before the normal public `file_server`:

```caddyfile
dyallo.se {
  encode zstd gzip

  route /dashboard* {
    basicauth {
      dennis <HASHED_PASSWORD_FROM_CADDY_HASH_PASSWORD>
    }
    root * /home/dennis/services/dyallo-se/site
    file_server
  }

  root * /home/dennis/services/dyallo-se/site
  file_server
}
```

Alternative if the dashboard should only ever resolve on `vault.dyallo.se`:

```caddyfile
dyallo.se {
  respond /dashboard* 404
  root * /home/dennis/services/dyallo-se/site
  file_server
}
```

Generate the password hash on the host running Caddy:

```bash
caddy hash-password --plaintext 'long-random-password-here'
```

Requirements:

- HTTPS only.
- Use a long random password stored outside git.
- Keep `/dashboard/*` out of public navigation, RSS, and sitemap.
- Upgrade to Cloudflare Access or Tailscale-only access if sharing beyond Dennis.

## 30-Minute Regeneration

Use launchd on the machine that has both this repo and the vault. The checked-in template is:

```text
ops/se.dyallo.vault-dashboard.plist
```

Install it as:

```text
~/Library/LaunchAgents/se.dyallo.vault-dashboard.plist
```

The dashboard page includes a 5-minute browser refresh, so an open tab will pick up the next deployed static build automatically.

Current template:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>se.dyallo.vault-dashboard</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/Dennis.Dyall/Code/other/dyallose/scripts/regenerate-vault-dashboard.sh</string>
  </array>
  <key>StartInterval</key>
  <integer>1800</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/Users/Dennis.Dyall/Code/other/dyallose/Logs/vault-dashboard.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/Dennis.Dyall/Code/other/dyallose/Logs/vault-dashboard.error.log</string>
</dict>
</plist>
```

Install:

```bash
mkdir -p /Users/Dennis.Dyall/Code/other/dyallose/Logs
cp /Users/Dennis.Dyall/Code/other/dyallose/ops/se.dyallo.vault-dashboard.plist ~/Library/LaunchAgents/se.dyallo.vault-dashboard.plist
launchctl load ~/Library/LaunchAgents/se.dyallo.vault-dashboard.plist
```

Reload after edits:

```bash
launchctl unload ~/Library/LaunchAgents/se.dyallo.vault-dashboard.plist
launchctl load ~/Library/LaunchAgents/se.dyallo.vault-dashboard.plist
```

## Privacy Checks

`bun run build` runs `scripts/verify-dashboard-privacy.ts` after Astro build. It reads the generated private dashboard data and scans built files outside `dist/dashboard/` for real generated IDs, titles, subtitles, excerpts, and paths.

This catches the main static-site leak class: private dashboard payload accidentally landing in public routes or shared `/_astro/` chunks.

Generated private data file:

```text
src/data/vault-dashboard.json
```

This file is intentionally ignored by git.
