# Handoff

Last updated: 2026-07-06

## Start Here

- Production is the Hetzner VPS app at `https://agents.realestatecrmpro.com`, not a local-only app.
- VPS host is `178.156.178.56`; app path is `/opt/ad-agency-autopilot`.
- Docker Compose service/container is `ad-agency-autopilot`, bound on `127.0.0.1:3100->3000`, with Cloudflare Tunnel in front.
- This VPS is shared with ClaimPilot. Only touch `/opt/ad-agency-autopilot`; do not touch ClaimPilot or `fluffysbait.com`.
- Deploys are file-copy based, not `git pull`: back up changed files under `/opt/ad-agency-autopilot/data/backups/deploy-<timestamp>`, copy only changed files, rebuild/restart only `ad-agency-autopilot` when needed.
- Runtime secrets/data are ignored and must stay out of git: `.env`, `credentials.json`, DB files, backups, logs, downloaded media, and `node_modules`.

## Current Repo / Deploy State

- Branch: `main`.
- Uncommitted local changes: None. All staged and pushed to `origin/main` (commit `5e185d6`).
- Database seeding: Seeding of `crm.db` with 739 boutique targets (23 completed), 31 roster contacts, and 9 drip campaigns has been deployed and verified on the VPS.

## Latest Changes

1. **Campaign Instructions Size & Cache-Busting**:
   - Resized the campaign instructions `<textarea>` under "Target Audience & Core Message / Video Angle" to `240px` in `index.html` inline style.
   - Added `#campaign-instructions` `min-height: 240px !important; height: 240px !important;` rule to the end of `index.css` to force the height even if browsers use a cached version of `index.html`.
   - Cache-busted `index.css` and `app.js` links in `index.html` using version parameter `?v=20260706-audience-box` to force browser cache invalidation.
2. **A/B Split Campaign Launching**:
   - Added checkbox and dropdown controls to select a Variant B campaign, splitting waves evenly between two different campaigns.
   - Populated a recipient checkbox list inside the launch modal allowing selective enrolling.
3. **Roster Harvesting Queue**:
   - Added `roster_scraping_queue` schema, indexes, and methods to `db.js`.
   - UI shows a new "Harvesting Queue" card on the CRM dashboard and a "Harvest Batch" button in the Agent Roster panel.

## Verification

- Local syntax checks passed successfully.
- Production container is active and `healthy` (uptime verified, curl returned JSON config).
- Styling change verified. Cache-busting parameter will force the browser to request the updated CSS asset immediately.
