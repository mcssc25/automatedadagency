# Handoff

Last updated: 2026-07-05

## Start Here

- Production is the Hetzner VPS app at `https://agents.realestatecrmpro.com`, not a local-only app.
- VPS host is `178.156.178.56`; app path is `/opt/ad-agency-autopilot`.
- Docker Compose service/container is `ad-agency-autopilot`, bound on `127.0.0.1:3100->3000`, with Cloudflare Tunnel in front.
- This VPS is shared with ClaimPilot. Only touch `/opt/ad-agency-autopilot`; do not touch ClaimPilot or `fluffysbait.com`.
- Deploys are file-copy based, not `git pull`: back up changed files under `/opt/ad-agency-autopilot/data/backups/deploy-<timestamp>`, copy only changed files, rebuild/restart only `ad-agency-autopilot` when needed.
- Runtime secrets/data are ignored and must stay out of git: `.env`, `credentials.json`, DB files, backups, logs, downloaded media, and `node_modules`.

## Current Repo / Deploy State

- Branch: `main`.
- Uncommitted local changes exist in:
  - `server.js` (templates subject personalization, [Brokerage Name]/[City] support, and `/api/brokerages/send-batch` route)
  - `index.html` (added `batch-campaign-modal` overlay)
  - `app.js` (added "Send Batch" buttons and modal open/close/submit methods)
  - `MEMORY.md` & `handoff.md` (updated documentation)
- Database seeding: Run `.\.venv\Scripts\python.exe C:\Users\daved\.gemini\antigravity\brain\c9996b1a-3198-4c21-a960-532453972852\scratch\seed_crm_db.py` to seed `crm.db` database with 739 boutique targets (23 completed), 31 roster contacts, and 9 drip campaigns. Done locally.

## Latest Changes

1. **Email Personalization & Subject Lines**:
   - Updated `personalizeCampaignBody` in `server.js` to process and substitute `[Brokerage Name]`, `[Brokerage]`, `[Company]`, and `[City]` placeholders.
   - Updated `sendCampaignStepToLead` to apply personalization to the subject lines (`customizedSubject`) to ensure catchy, custom headlines go out.
2. **Outreach Campaigns Seeding**:
   - Created and inserted 9 custom 3-step drip campaign templates in SQLite:
     - 4 Major Brokerages: Benchmark Realty, Fathom Realty, United Real Estate, Virtual Properties Realty.
     - 5 Boutique Brokerages: California Boutique, Colorado Boutique, Florida Boutique, Georgia Boutique, and General Boutique.
   - Embedded correct links: Free 14-day trial (`https://realestatecrmpro.com`), Dave's demo scheduling (`https://realestatecrmpro.com/schedule/realestatecrmpro-demo/`), and YouTube channel (`https://www.youtube.com/@RealEstateCRMPro`).
3. **Database Seeding**:
   - Seeded 739 boutique targets, detailed research profiles (CRM, e-sign, video tour, gaps, strengths, email angles) for 23 researched boutique targets, and 31 agent roster contacts.
4. **Campaign Batch Sending**:
   - Added `POST /api/brokerages/send-batch` backend endpoint to enroll a batch of roster contacts for a given brokerage into a selected campaign, promoting them to the `leads` table and sending Step 1 immediately.
   - Updated Brokerage Research UI to show a "Send Batch" button for brokerages with roster contacts.
   - Added `batch-campaign-modal` to index.html and event handlers in app.js.

## Verification

- Local `node -c server.js` passed successfully.
- Local `node -c app.js` passed successfully.
- Local SQLite database `crm.db` verifies 362 profiles, 630 offices, 31 roster contacts, and 9 campaigns.

## Next Steps

- Push the local changes to GitHub `origin/main`.
- Deploy the updated app files (`server.js`, `app.js`, `index.html`) to the Hetzner production server (`/opt/ad-agency-autopilot`).
- Back up changed production files under `/opt/ad-agency-autopilot/data/backups/deploy-20260705T...` before overriding.
- Restart/rebuild the production Docker container `ad-agency-autopilot` and verify it boots up cleanly.
