# Ad Agency Autopilot Handoff

Last updated: 2026-07-01

## Current State

- Local project is now a Git repository on branch `main`.
- Remote repo: `https://github.com/mcssc25/automatedadagency.git`.
- Initial project backup was pushed to GitHub at commit `1aebfc5a8b59ec5ee45febc4edf4a8b6950cad7f`.
- Production app is hosted at `https://agents.realestatecrmpro.com`.
- VPS app path: `/opt/ad-agency-autopilot`.
- Runtime is separate from ClaimPilot even though it uses the same VPS.
- Do not modify `fluffysbait.com`; it is a real production site.

## Production Setup

- Node/Express app runs in Docker on the VPS.
- Cloudflare Tunnel exposes the app at `agents.realestatecrmpro.com`.
- Local deployment files:
  - `Dockerfile`
  - `docker-compose.yml`
  - `docker-compose.tunnel.yml`
  - `.dockerignore`
- Sensitive/runtime files are intentionally excluded from git:
  - `.env`
  - `.cloudflared.env`
  - `mailgun api.txt`
  - `credentials.json`
  - `data/*` except `data/.gitkeep`
  - `downloads/*` except `downloads/.gitkeep`
  - logs and `node_modules`

## Mailgun / Email

- Outreach sending domain: `outreach.realestatecrmpro.com`.
- Sender configured for outreach: `Sales at Real Estate CRM Pro <sales@outreach.realestatecrmpro.com>`.
- This outreach Mailgun setup is separate from the Real Estate CRM Pro product Mailgun account to avoid harming product-user deliverability.
- Inbound route forwards replies to `https://agents.realestatecrmpro.com/api/webhooks/inbound-email`.
- Inbound parser handles Mailgun form posts and normalizes display-name senders to bare lowercase emails.
- CRM view polls while on `#crm` so new replies should appear in the selected conversation after refresh.

## Database / DNC Safeguards

- SQLite database is local runtime data and is not committed.
- Lead and DNC emails are normalized to lowercase/trimmed before storage.
- Duplicate lead/DNC emails are deduped during DB initialization.
- Case-insensitive indexes exist for lead email, lead name, and DNC email.
- Scraper skips invalid emails, DNC emails, and existing lead emails before insert.
- Outbound Mailgun sending refuses DNC recipients.
- Setting a lead to `DNC` or `Opted Out` adds the email to the permanent DNC table.
- DNC removal API is disabled unless `ALLOW_DNC_REMOVAL=true` is intentionally set for admin recovery.
- VPS DB backup before DNC migration: `/opt/ad-agency-autopilot/data/backups/crm-20260701T080419Z-pre-dedupe.db`.

## Latest Update

- Added root `AGENTS.md` with project operating rules.
- Added compact `MEMORY.md` for durable future-session context.
- Rewrote this handoff to remove stale setup steps and focus on current state.
- New rule: after every meaningful update, refresh both `MEMORY.md` and `handoff.md`.

## Known Working Tree Item

- `db.js` currently has an uncommitted change adding lead metadata fields: `address`, `sourceUrl`, and `discoveryQuery`.
- This docs update did not create or commit that code change. Review it before deciding whether to commit, deploy, or discard it.

## Verification

- Before the GitHub backup commit, these passed:
  - `node --check server.js`
  - `node --check app.js`
  - `node --check db.js`
- Staged secret-pattern scan passed before pushing the initial backup.
- Git ignored local secrets/runtime data before the backup push.

## Next Steps

- Review the separate `db.js` working-tree change and decide whether it belongs in the next code update.
- Continue database/scraper hardening as needed:
  - Add automated tests for duplicate lead insertion.
  - Add tests for unsubscribe/DNC permanence.
  - Add tests for outbound-send DNC blocking.
- After future production code changes, deploy to `/opt/ad-agency-autopilot` and verify `https://agents.realestatecrmpro.com/api/app-config`.
