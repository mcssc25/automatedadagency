# Project Memory

Last updated: 2026-07-06

## Durable Facts

- Project: Ad Agency Autopilot / Autonomous Sales CRM for selling Real Estate CRM Pro.
- GitHub repo: `https://github.com/mcssc25/automatedadagency.git`, branch `main`.
- Production app URL: `https://agents.realestatecrmpro.com`.
- Hetzner/VPS host: `178.156.178.56`; production path: `/opt/ad-agency-autopilot`.
- Production runs as Docker Compose service `ad-agency-autopilot` on `127.0.0.1:3100->3000`; Cloudflare Tunnel fronts the public URL.
- VPS is shared with ClaimPilot; only touch `/opt/ad-agency-autopilot`, never ClaimPilot or `fluffysbait.com`.
- VPS deploys are file-copy based, not `git pull`: back up changed runtime files under `/opt/ad-agency-autopilot/data/backups/deploy-<timestamp>`, copy only this app's files, then rebuild/restart only `ad-agency-autopilot`.
- Runtime secrets/data are ignored. Never commit `.env`, `mailgun api.txt`, `credentials.json`, DB files, backups, downloads, or `node_modules`.
- Mailgun outreach domain: `outreach.realestatecrmpro.com`.
- OpenRouter and Make.com webhook settings persist in ignored runtime `data/credentials.json` on the mounted `/opt/ad-agency-autopilot/data` volume.

## Product Direction

- Goal is a review-first AI marketing operator: business research, competitor discovery, content/ad generation, lead discovery, and email campaigns.
- User wants to see each automation part work and approve outputs before full autonomy.
- Dashboard/support activity should distinguish real records/jobs from demo simulation; no fake leads, fake chats, fake KPI movement, fake publish success, fake email sends, fake engagement metrics, or mock trend fallbacks.

## Lead Intelligence & CRM Seeding

- SQLite DB (`crm.db`) is seeded with 362 brokerage profiles, 630 offices, 31 agent roster contacts, and 9 outreach campaigns.
- 23 boutique brokerages have detailed profile research status set to 'Complete' (notes, offered tech systems, and campaign angles configured).
- 9 Outreach Campaigns are fully set up in the DB: Benchmark Realty, Fathom Realty, United Real Estate, Virtual Properties Realty (VPR), and 5 region-specific Boutique campaigns (California, Colorado, Florida, Georgia, and General Boutique).
- Outreach templates utilize target links:
  - Free 14-day trial: `https://realestatecrmpro.com`
  - Demo scheduling: `https://realestatecrmpro.com/schedule/realestatecrmpro-demo/`
  - YouTube channel: `https://www.youtube.com/@RealEstateCRMPro`
- Specific YouTube training videos are referenced (such as replacements for software sprawl, CMA walkthroughs, booking tools).

## CRM / Email Safeguards, A/B Split Testing & Roster Harvesting

- Sales CRM exposes Brokerage Research, Agent Roster, Lead Communication, Human Review, Verification Queue, Campaigns, and Autopilot Settings tabs.
- Personalization: `personalizeCampaignBody` in `server.js` replaces `[Brokerage Name]`, `[Brokerage]`, `[Company]`, and `[City]` in template subjects and bodies.
- Batch Sending: Users can trigger a batch campaign enrollment from the Brokerage Research tab. 
  - Front-end displays a "Send Batch" button for brokerages with roster contacts.
  - Clicking "Send Batch" opens a modal to select a campaign and batch size.
  - Endpoint `POST /api/brokerages/send-batch` pulls raw roster contacts, promotes them to the `leads` table as `Scraped` (if not already present), enrolls them in the campaign, and sends the first step immediately.
- A/B Split Testing & Recipient Selection:
  - Supports choosing campaign Variant A and Variant B, running an A/B split where contacts are evenly distributed.
  - Allows selecting specific agent recipients from a preview list in the campaign launch modal.
- Roster Harvesting Queue:
  - DB initializes `roster_scraping_queue` table and indexes.
  - UI exposes a "Harvest Batch" button and displays queue counts (Pending, Completed, Failed).
- Campaign instructions textarea height is set to `240px` via inline style and CSS `#campaign-instructions` `!important` rule, cache-busted with version `20260706-audience-box`.

## Working Agreements

- After every meaningful update, refresh both `MEMORY.md` and `handoff.md`.
- Keep `MEMORY.md` compact and high-signal; prune stale details instead of appending forever.
- Keep `handoff.md` focused on latest state, verification, blockers, repo/deploy status, and next steps.
- User preference: after completing project updates, push/deploy live by default unless there is a clear blocker, explicit pause, or safety issue.
