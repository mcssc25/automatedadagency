# Ad Agency Autopilot Handoff

Last updated: 2026-07-01

## Current State

- Local project is now a Git repository on branch `main`.
- Remote repo: `https://github.com/mcssc25/automatedadagency.git`.
- Initial project backup was pushed to GitHub at commit `1aebfc5a8b59ec5ee45febc4edf4a8b6950cad7f`.
- Production app is hosted at `https://agents.realestatecrmpro.com`.
- VPS app path: `/opt/ad-agency-autopilot`.
- Runtime is separate from ClaimPilot even though it uses the same VPS.
- VPS deployment is currently file-copy based, not a Git checkout.
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

- Built the durable CRM lead pipeline automation engine.
- Git commit pushed: `6c6aed4` Build CRM lead pipeline automation engine.
- Added `campaign_enrollments` SQLite table plus `lastStepTime` on leads.
- Campaign approval and bypass sending now create enrollment records and use the shared campaign-step sender.
- Added backend worker endpoint: `POST /api/crm-pipeline/run`.
- Added 5-minute backend interval that only acts when explicit automation toggles are enabled.
- Added Autopilot Settings controls:
  - Daily scrape search and enable toggle
  - Auto-enroll Scraped leads into Campaign 1
  - Auto-send due follow-up steps
  - Run Pipeline Now
- Inbound replies now move leads to `Two-Way Conversation`, pause active enrollments when auto-pause is on, and AI handoff moves leads to `Needs Human Action`.
- Unsubscribes/DNC now move leads to `Quarantined` and pause enrollments.
- Live deployment backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T094123`.
- Production verified: app healthy, new `/api/crm-state` automation fields present, live `/api/crm-pipeline/run` smoke test completed with `scraped/enrolled/sent/transitioned/skipped = 0` because automation toggles are off.

## Previous Update

- Improved the CRM campaign workflow so lead selection and campaign routing are visible.
- Git commit pushed: `aac1c99` Clarify CRM campaign enrollment workflow.
- Campaigns tab now includes a Campaign Enrollment Workflow panel showing:
  - current Scraped audience count for the next Step 1 send
  - Emailed and Hot Lead counts
  - configured Campaign 1, Campaign 2, and Campaign 3
  - manual/bypass launch rule
  - reply tracking vs missing open/click/signup tracking
- Autopilot Settings now supports a third follow-up campaign selector.
- The old wording that implied real scraped leads auto-enroll automatically was changed; real scraped leads remain `Scraped` until a campaign is approved.
- Browser-side simulation can now transition through Campaign 1 -> 2 -> 3, but real Mailgun Step 2/3 scheduling still needs a backend worker.
- Production verified: live HTML contains the workflow UI, `/api/crm-state` includes `leadStageCounts` and `thirdCampaignId`, and containers are healthy.

## Previous Update

- Fixed campaign review ambiguity.
- Git commit pushed: `993f59f` Clarify campaign launch targets and CTA preview.
- CTA links entered in Campaign Builder are saved as `campaign.videoAsset`; the verification queue now previews that real link instead of leaving `[CTA Link]` visible when a CTA exists.
- Pending campaigns now receive `targetLeadsCount` from the server based on current `Scraped` leads.
- Approval now refuses to proceed with zero `Scraped` leads, shows a confirmation with the exact count, and labels the action as sending Step 1 now.
- The server now updates the same campaign to `Active` on approval instead of creating a new campaign and deleting the old one, so enrolled leads keep a valid campaign id.
- Production currently has one lead total, but zero `Scraped` leads; the existing lead is stage `Hot Lead`, so the pending campaign should not email it.
- Important gap: Step 1 is the real Mailgun send. Step 2/3 are still only browser-side simulated drip behavior until a backend scheduler/worker is added.

## Password Prompt Update

- Fixed Chrome password-save prompts caused by the non-login Gemini API key field being interpreted as a credential form.
- The API key input now uses `autocomplete="new-password"` plus password-manager ignore hints, and its visibility toggle is explicitly a button.
- Git commit pushed: `6e56568` Suppress password manager prompt for API key field.
- Deployed to the VPS and verified the live HTML contains the password-manager ignore hints.

## Scraper Update

- Added and deployed the low-cost lead scraper integration.
- Git commits pushed:
  - `c1e42b5` Add maps-based lead scraper sidecar
  - `a835c62` Avoid VPS scraper port conflict
- `docker-compose.yml` now includes a `gosom/google-maps-scraper` sidecar service exposed on VPS loopback at `127.0.0.1:18080`; the Node app talks to it over Docker DNS at `http://lead-scraper:8080`.
- `/api/scrape-leads` now tries the maps scraper first, falls back to Gemini search only when needed, never inserts fake contacts, and imports only candidates with both name and valid email.
- Lead storage and CRM display now include optional `address`, `sourceUrl`, and `discoveryQuery` metadata.

## Deployment Notes

- Runtime files copied to `/opt/ad-agency-autopilot` by `scp` because the VPS app directory is not a Git checkout.
- Pre-deploy backup of replaced runtime files: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T084016`.
- Initial production restart hit a loopback port conflict on `127.0.0.1:8080`; fixed by moving the optional scraper host binding to `127.0.0.1:18080`.

## Verification

- Local code checks passed:
  - `node --check server.js`
  - `node --check app.js`
  - `node --check db.js`
- Local SQLite migration check passed via `db.initDb()`; existing lead rows now expose `address`, `sourceUrl`, and `discoveryQuery`.
- `docker compose config` passed.
- Local Docker verification passed:
  - `lead-scraper` started successfully.
  - App container rebuilt and became healthy.
  - Local `http://127.0.0.1:3100/api/app-config` returned `{"geminiConfigured":true}`.
  - Sidecar accepted a smoke-test REST job payload and returned a job id.
- VPS verification passed:
  - `docker compose ps` shows `ad-agency-autopilot`, `ad-agency-lead-scraper`, and the Cloudflare tunnel running.
  - Public `https://agents.realestatecrmpro.com/api/app-config` returned `{"geminiConfigured":true}`.
  - Public `/api/crm-state` shows the pending campaign has numeric `targetLeadsCount` and a saved CTA asset.
  - Public HTML contains the API-key password-manager ignore hints.
  - App container has `LEAD_SCRAPER_URL=http://lead-scraper:8080`.
  - App container resolves Docker DNS name `lead-scraper`.
  - VPS loopback `http://127.0.0.1:18080/` returned HTTP 200.
- Staged secret-pattern scan passed before pushing the initial backup.
- Git ignored local secrets/runtime data before the backup push.

## Next Steps

- Run a small real scrape from the UI and inspect inserted lead quality.
- Continue database/scraper hardening as needed:
  - Add automated tests for duplicate lead insertion.
  - Add tests for unsubscribe/DNC permanence.
  - Add tests for outbound-send DNC blocking.
