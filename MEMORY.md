# Project Memory

Last updated: 2026-07-01

## Durable Facts

- Project: Ad Agency Autopilot / Autonomous Sales CRM for selling Real Estate CRM Pro.
- GitHub repo: `https://github.com/mcssc25/automatedadagency.git`, branch `main`.
- Production app URL: `https://agents.realestatecrmpro.com`.
- VPS app path: `/opt/ad-agency-autopilot`.
- VPS runtime is separate from ClaimPilot and uses Docker Compose.
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

## Working Agreements

- At the end of each meaningful update, refresh both `MEMORY.md` and `handoff.md`.
- Keep `MEMORY.md` short and prune stale details instead of appending forever.
- Keep `handoff.md` focused on latest state, verification, blockers, and next steps.

