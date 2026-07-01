# Project Memory

Last updated: 2026-07-01

## Durable Facts

- Project: Ad Agency Autopilot / Autonomous Sales CRM for selling Real Estate CRM Pro.
- GitHub repo: `https://github.com/mcssc25/automatedadagency.git`, branch `main`.
- Production app URL: `https://agents.realestatecrmpro.com`.
- VPS app path: `/opt/ad-agency-autopilot`.
- VPS runtime is separate from ClaimPilot and uses Docker Compose.
- Production deploys are currently file-copy based on the VPS, not `git pull` based.
- Cloudflare Tunnel routes the app hostname to the VPS. Do not alter `fluffysbait.com`.
- Mailgun outreach sending domain: `outreach.realestatecrmpro.com`.
- Mailgun account/domain should remain separate from the Real Estate CRM Pro product Mailgun account to protect product deliverability.
- App secrets live outside git in local/VPS env files. Never commit `.env`, `mailgun api.txt`, `credentials.json`, DB files, backups, downloads, logs, or `node_modules`.

## Current Safeguards

- Lead emails are normalized before storage.
- Scraping skips invalid emails, existing lead emails, and DNC emails.
- DNC/unsubscribe entries are intended to be permanent.
- Outbound email sending blocks DNC recipients.
- DNC removal is disabled unless `ALLOW_DNC_REMOVAL=true` is intentionally set for admin recovery.
- Inbound Mailgun replies post to `/api/webhooks/inbound-email` and should appear in the CRM conversation after polling refresh.
- Lead scraping now prefers the `gosom/google-maps-scraper` sidecar via `LEAD_SCRAPER_URL=http://lead-scraper:8080`, falls back to Gemini search only if the sidecar fails, never creates fake contacts, and imports only leads with both name and valid email.
- Lead records now support optional `phone`, `website`, `address`, `sourceUrl`, and `discoveryQuery`.
- The Gemini API key field is masked but marked with password-manager ignore hints so Chrome does not save campaign text as credentials.

## Working Agreements

- At the end of each meaningful update, refresh both `MEMORY.md` and `handoff.md`.
- Keep `MEMORY.md` short and prune stale details instead of appending forever.
- Keep `handoff.md` focused on latest state, verification, blockers, and next steps.
