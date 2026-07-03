# Handoff

Last updated: 2026-07-03

## Start Here

- Production is the Hetzner VPS app at `https://agents.realestatecrmpro.com`, not a local-only app.
- VPS host is `178.156.178.56`; app path is `/opt/ad-agency-autopilot`.
- Docker Compose service/container is `ad-agency-autopilot`, bound on `127.0.0.1:3100->3000`, with Cloudflare Tunnel in front.
- This VPS is shared with ClaimPilot. Only touch `/opt/ad-agency-autopilot`; do not touch ClaimPilot or `fluffysbait.com`.
- Deploys are file-copy based, not `git pull`: back up changed files under `/opt/ad-agency-autopilot/data/backups/deploy-<timestamp>`, copy only changed files, rebuild/restart only `ad-agency-autopilot` when needed.

## Current Repo / Deploy State

- Branch: `main`.
- Latest CRM rework commit: `4b7b1a2 Rework CRM research visibility`, pushed to `origin/main` and deployed live.
- A follow-up docs-only commit records the deployment verification.
- CRM rework changed `app.js`, `db.js`, `server.js`, `index.html`, `index.css`, `MEMORY.md`, and `handoff.md`.
- Deployment backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260703T210917Z-crm-research-visibility`.
- Production container was healthy after the Coldwell Banker raw-email extractor deployments.
- Runtime secrets/data are ignored and must stay out of git: `.env`, `credentials.json`, DB files, backups, logs, downloaded media, and `node_modules`.
- OpenRouter and Make.com webhook settings persist in production runtime `data/credentials.json` on the mounted `/opt/ad-agency-autopilot/data` volume.

## Latest CRM Rework

- Sales CRM now has visible work sections:
  - Brokerage Research: shows brokerages being researched, systems they offer, inferred strengths/gaps, campaign angle notes, office harvest status, and backend worker flow.
  - Agent Roster: shows roster contacts with name, email, phone, brokerage, city/state, source links, socials when available, and search/filter controls.
  - Lead Communication: preserves the prior clicked-lead info header and conversation log layout, now as its own tab.
- Added read-only backend endpoint `GET /api/crm-intelligence` backed by new `db.js` helpers:
  - `getBrokerageResearch`
  - `getRosterContacts`
  - `getRosterContactsCount`
- Frontend CRM polling refreshes brokerage/roster data while those tabs are active. Manual Lead Intelligence runs and lead scrapes also refresh the new CRM intelligence views.
- Existing campaign verification, outreach campaigns, and autopilot settings tabs remain available.
- Production authenticated endpoint smoke after deploy returned `3` sampled brokerages, `3` sampled roster contacts, `64` total roster contacts, and lead-intelligence status.
- Follow-up local change improves the brokerage research agent: it now explicitly searches official sources plus Reddit/forum/agent-review chatter, stores source evidence and campaign angles in `techStackJson`, shows agent chatter/evidence in CRM, and runs after roster contact harvesting. Compose default for `LEAD_INTELLIGENCE_RESEARCH_TECH_STACK` is now `true` unless env overrides it.

## Lead Intelligence Worker

- Hidden backend-only worker builds a private brokerage/agent email database in SQLite hidden tables: `market_cities`, `brokerage_profiles`, `brokerage_offices`, `roster_contacts`, and `intelligence_runs`.
- Browser controls are live:
  - Agency Onboarding has a Lead Intelligence Worker toggle.
  - Dashboard Workflow Status lists the worker, shows hidden DB counts, and has a Run Now button.
- Main endpoints: `GET /api/lead-intelligence/status`, `POST /api/lead-intelligence/settings`, `POST /api/lead-intelligence/seed`, `POST /api/lead-intelligence/run-once`.
- Run Now uses the async path `/api/lead-intelligence/run-once?async=true` to avoid Cloudflare/proxy timeout alerts.
- Production worker config:
  - `LEAD_INTELLIGENCE_ENABLED=true`
  - `LEAD_INTELLIGENCE_INTERVAL_MS=3600000`
  - `LEAD_INTELLIGENCE_START_DELAY_MS=120000`
  - `LEAD_INTELLIGENCE_MAX_OFFICES_PER_CYCLE=8`
  - `LEAD_INTELLIGENCE_STOP_AFTER_CONTACTS=true`
  - `LEAD_INTELLIGENCE_SUPPRESS_BRAND_AFTER_FAILURE=true`
  - `LEAD_INTELLIGENCE_RESEARCH_TECH_STACK=true` after the Reddit/agent-chatter research upgrade

## Important Breakthrough

- The working path for public brokerage emails is raw/static extraction first, not browser DOM scraping or AI discovery.
- Coldwell Banker city rosters expose public agent records in server-returned HTML with fields like `fullName`, `emailAddress`, `businessPhoneNumber`, and profile `url`.
- Deterministic Coldwell Banker roster URL pattern:
  - `https://www.coldwellbanker.com/city/{state}/{city}/agents`
- Implemented in `server.js`:
  - `slugifyBrokeragePathPart`
  - `getDeterministicRosterUrlForOffice`
  - `extractEmbeddedAgentObjectsFromHtml`
  - static/raw extraction in `extractBrokerageAgentCandidatesFromHtml`
  - raw extraction before browser harvesting in `harvestBrokerageOfficeRoster`
- Email harvesting now runs before optional AI tech-stack research, and AI research is off by default so it cannot stall contact extraction.

## Production Proof

- Coldwell Banker Huntsville:
  - URL: `https://www.coldwellbanker.com/city/al/huntsville/agents`
  - Manual run id `48`
  - Harvested `12` contacts in about `7.5s`
  - Browser pages scanned: `0`
- Coldwell Banker Knoxville:
  - URL: `https://www.coldwellbanker.com/city/tn/knoxville/agents`
  - Manual run id `49`
  - Harvested `11` contacts in about `6.3s`
  - Browser pages scanned: `0`
- Hidden DB total after those tests: `54` roster contacts.
- Remaining queued Coldwell Banker rows were restored from `Skipped Brand` to `Pending` after proving the brand is harvestable.
- RE/MAX remains skipped/blocked from earlier protected/franchise-page failures.

## Scrapling Test Result

- Scrapling 0.4.9 was tested manually on the VPS and cleaned up afterward.
- It helped reach some roster/profile pages, but did not reliably produce emails where the current worker could not.
- Pointesouth: found raw emails, but the existing worker already handles that site.
- RealtySouth: exposed names/phones/profile links, but `0` raw emails.
- ARC still returned human verification / 429.
- RE/MAX and KW still failed with response-code/navigation blocks.
- Recommendation: do not integrate Scrapling yet. This product only succeeds when it gets emails, so phone/profile-only output should count as failure for now.

## Verification From Latest Code Work

- Local `node --check server.js` passed.
- Local `node --check app.js` and `node --check db.js` passed after the CRM rework.
- Local `git diff --check` passed with only normal Windows CRLF warnings.
- Latest local research-agent follow-up checks passed: `node --check server.js`, `node --check app.js`, and `git diff --check`.
- Direct DB helper smoke passed: returned brokerage rows, roster totals, and lead-intelligence status from local SQLite.
- HTTP smoke passed on `PORT=3133` with admin auth disabled for the local test: `/api/crm-intelligence?brokerageLimit=3&rosterLimit=3` returned brokerages, roster fields, totals, and status.
- Deployed in-container syntax checks passed for `/app/app.js`, `/app/db.js`, and `/app/server.js`.
- Production container is healthy after rebuild/restart.
- Production manual runs proved the raw Coldwell Banker extractor end to end.
- Deployment backups from the Coldwell work:
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260703T1906-coldwell-raw-email-extractor`
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260703T1932-coldwell-agent-object-refine`
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260703T1938-email-first-lead-intelligence`
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260703T1943-coldwell-deterministic-rosters`

## Next Steps

- Review the new CRM tabs live in the browser and tune copy/columns after seeing the production data density.
- Run the worker through remaining Coldwell Banker cities now that they are restored to `Pending`.
- Build brand-specific raw/network extractors for each major brokerage brand instead of treating every no-DOM-email page as a dead end.
- Investigate each brand in this order: raw HTML, embedded JSON/script payloads, public network responses, browser fallback, AI fallback.
- Keep CAPTCHA/security-verification pages marked `Blocked`; do not spend cycles trying to solve Cloudflare CAPTCHA unless the user explicitly chooses that route.
- Outbound Mailgun sending still fails closed until `OUTBOUND_POSTAL_ADDRESS` is set.
