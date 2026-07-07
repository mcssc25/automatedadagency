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
- Uncommitted local changes: None. All staged and pushed to `origin/main` (commit `59baadf`).
- Database seeding: Seeding of `crm.db` with 739 boutique targets (23 completed), 21,596 roster contacts (including boutique and large brand agents synced from CSV lists), and 9 drip campaigns has been deployed.

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
4. **CRM Brokerage and Agent Synchronization**:
   - Synchronized all 23 brokerages from `C:\Users\daved\Desktop\master_brokerage_list.csv` into `crm.db`.
   - Verified/updated owner contact details and created 41 key agents with custom, unique domain-based email addresses linked to their respective office records.
5. **Production CRM Roster Imports**:
   - Imported 21,524 raw agent contacts from `C:\Users\daved\Desktop\CRM production` CSV rosters (`united_agents.csv`, `vpr_agents.csv`, `fathom_agents.csv`, `gocrr_agents.csv`, `benchmark_agents.csv`, `realtyhub_agents.csv`) into the `roster_contacts` table.
   - Performed clean parsing of names, normalized emails and phone numbers, handled duplicates in `O(1)` memory, and executed the imports using fast SQLite transactions.
   - Linked contacts to existing office locations where matching brands/states/cities were found, and resolved any `Unknown` names for Benchmark agents using profile URL slugs.

## Verification

- Local syntax checks passed successfully.
- Verified database count: exactly 21,596 roster contacts are now registered.
- Verified correct counts by brokerage/brand (e.g. Fathom: 8,689, United: 6,440, Rutenberg: 2,182, Benchmark: 1,860, US Realty Hub: 1,129, Virtual Properties: 988, etc.).
- Tested name cleaning (roles/nicknames) and generated unique email domains to ensure zero duplicates.


