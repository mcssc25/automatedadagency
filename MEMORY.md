# Project Memory

Last updated: 2026-07-03

## Durable Facts

- Project: Ad Agency Autopilot / Autonomous Sales CRM for selling Real Estate CRM Pro.
- GitHub repo: `https://github.com/mcssc25/automatedadagency.git`, branch `main`.
- Primary runtime is the Hetzner VPS production app, not a local-only app.
- Production app URL: `https://agents.realestatecrmpro.com`.
- Hetzner/VPS host: `178.156.178.56`; production path: `/opt/ad-agency-autopilot`.
- Production runs as Docker Compose service `ad-agency-autopilot` on `127.0.0.1:3100->3000`; Cloudflare Tunnel fronts the public URL.
- VPS is shared with ClaimPilot; only touch `/opt/ad-agency-autopilot`, never ClaimPilot or `fluffysbait.com`.
- VPS deploys are file-copy based, not `git pull`: backup changed runtime files under `/opt/ad-agency-autopilot/data/backups/deploy-<timestamp>`, copy only this app's files, then rebuild/restart only `ad-agency-autopilot`.
- Local workspace is for code editing/dev diagnostics only. Do not describe the app as needing to be hosted locally for normal use.
- Runtime secrets/data are ignored. Never commit `.env`, `mailgun api.txt`, `credentials.json`, DB files, backups, downloads, logs, or `node_modules`.
- Mailgun outreach domain: `outreach.realestatecrmpro.com`.
- OpenRouter and Make.com webhook settings are configured from the browser Integrations UI and persist in ignored production runtime `data/credentials.json`, which is on the mounted `/opt/ad-agency-autopilot/data` volume. Commit `af78dbb` fixed the earlier bug where settings were written to container-local root `credentials.json` and got wiped on rebuilds. Env fallback still works with `OPENROUTER_ENABLED=true` and `OPENROUTER_API_KEY`.

## Product Direction

- Goal is a review-first AI marketing operator: business research, competitor discovery, content/ad generation, lead discovery, and email campaigns.
- User wants to see each automation part work and approve outputs before full autonomy.
- Dashboard/support activity should distinguish real records/jobs from demo simulation; no fake leads, fake chats, fake KPI movement, fake publish success, fake email sends, fake engagement metrics, or mock trend fallbacks.

## Lead Intelligence

- Hidden nationwide lead intelligence engine is backend-only today. It stores market cities, brokerage profiles, brokerage offices, roster contacts, and run logs in SQLite hidden tables.
- Production Docker config enables the hourly worker with `LEAD_INTELLIGENCE_ENABLED=true`, `LEAD_INTELLIGENCE_INTERVAL_MS=3600000`, `LEAD_INTELLIGENCE_START_DELAY_MS=120000`, and `LEAD_INTELLIGENCE_MAX_OFFICES_PER_CYCLE=8`.
- The worker seeds 20 mid-market cities and 14 brokerage brand searches per city, researches brokerage/office roster URLs, and browser-harvests public roster pages into `roster_contacts`.
- Browser controls were added locally on 2026-07-03: Agency Onboarding includes a Lead Intelligence Worker toggle, and Dashboard Workflow Status includes agent toggles, hidden DB counts, and a Lead Intelligence Run Now button.
- Lead Intelligence browser toggle persists to ignored runtime `data/lead-intelligence-settings.json`; the hourly worker reads that setting before running. Backend endpoints: `GET /api/lead-intelligence/status`, `POST /api/lead-intelligence/settings`, `POST /api/lead-intelligence/seed`, and `POST /api/lead-intelligence/run-once`.
- Lead Intelligence Run Now uses the async browser path (`/api/lead-intelligence/run-once?async=true`) so Cloudflare/proxy timeouts do not produce HTML error alerts while a long harvest is still running; deployed hotfix commit `9eb2921`.
- Lead Intelligence URL-discovery model failures should mark only that brokerage office as failed instead of killing the whole worker cycle; deployed resilience fix commit `8f25386`.
- Lead Intelligence cycles should process multiple queued offices per run, not one per hour. Current behavior checks up to 8 offices per cycle, stops early after contacts, and can mark remaining queued offices for the same seeded national brand as `Skipped Brand` after blocked/failed results.
- Lead Intelligence now prioritizes email harvesting over optional tech-stack research; `LEAD_INTELLIGENCE_RESEARCH_TECH_STACK=false` by default so AI research cannot stall extraction.
- Coldwell Banker rosters are deterministic and email-rich: URL pattern `https://www.coldwellbanker.com/city/{state}/{city}/agents`; raw HTML embeds agent JSON fields like `fullName`, `emailAddress`, `businessPhoneNumber`, and profile `url`. Static raw extraction harvested 12 Huntsville contacts and 11 Knoxville contacts in seconds.
- Lead-intelligence research can prefer OpenRouter with free-model rotation and Gemini fallback. OpenRouter web search is opt-in and may use credits.
- OpenRouter 429/rate-limit failures should fall back quickly instead of stalling a harvest. Production roster challenge detection includes Cloudflare, reCAPTCHA, Burrow, "Please Verify You Are Human", and similar blocked-page text.
- Elementor/card-style roster pages need wide ancestor scoping so `mailto:` buttons whose visible text is only "Email" still resolve the actual agent name from the surrounding card.
- Known limitation: KW/IDX-style protected roster pages can show Cloudflare/security verification to production headless Chromium and should be marked `Blocked`; a managed/stealth browser provider may be needed for those.
- Scrapling 0.4.9 was tested manually on the VPS on 2026-07-03. Non-solver Dynamic/Stealthy fetchers did improve access to RealtySouth's roster/profile pages and exposed names/phones/profile links, but still found 0 raw emails; RE/MAX/KW still failed and ARC still returned a human-verification page. Scrapling is not integrated.
- Realtor directory discovery may use Zillow/Realtor.com/Redfin/Homes.com as profile-discovery signals only; do not bypass robots, logins, CAPTCHAs, paywalls, or private APIs.

## CRM / Email Safeguards

- CRM was reworked locally on 2026-07-03 to expose hidden lead-intelligence data in the Sales CRM: Brokerage Research, Agent Roster, and Lead Communication tabs. New read-only endpoint: `GET /api/crm-intelligence`.
- Brokerage Research surfaces systems offered (`crmOffering`, `esignOffering`, `leadTools`, `videoEmail`), inferred strengths/gaps, office harvest status, and recent worker run flow so the user can shape brokerage-specific campaigns.
- Agent Roster surfaces `roster_contacts` with search/filter by agent, email, phone, brokerage, city/state, source links, and social fields when found. Lead Communication keeps the prior selected-lead header + conversation-log layout.
- Lead emails are normalized before storage; scraping skips invalid emails, existing lead emails, and DNC emails.
- DNC/unsubscribe entries are permanent by default; outbound sending blocks DNC recipients and DNC removal requires `ALLOW_DNC_REMOVAL=true`.
- Mailgun inbound replies post to `/api/webhooks/inbound-email`; CRM polls on `#crm`.
- `OUTBOUND_POSTAL_ADDRESS` is still blank, so outbound Mailgun sends fail closed until the user supplies a valid physical mailing address.
- Campaign approval targets only `Scraped` leads, sends Step 1 through Mailgun, and stores campaign id/step on leads.
- Backend CRM automation toggles default off: daily scrape, auto-enroll Scraped leads, auto-approve campaigns, and auto-send due follow-ups.
- Auto-pause on reply is supported through Mailgun inbound webhook.
- Open/click/signup routing is not connected yet; only inbound replies are tracked.

## Current Status

- 2026-07-02 hardening is deployed: root static files are allowlisted, production/admin Basic auth is required, CORS is restricted, Mailgun webhook signatures are verified, and outbound compliance footer/List-Unsubscribe are enforced.
- Key deployed commits include hardening `c35051f`, async lead scrape `43c3054`, brokerage-roster-first `649b399`, realtor dedupe/privacy `1d500a7`, CRM auto-approve `2b33db0`, trend preservation `8eb10bd`, lead intelligence base `a91eb02`, lead intelligence reliability `caea108`, OpenRouter provider `e484757`, OpenRouter Integrations UI `f562eee`, agent dashboard controls `64f48bb`, multi-office cycles `8db2269`, and Coldwell Banker raw email extraction `39529c7`.
- OpenRouter Integrations UI/model rotation commit `f562eee` is deployed live. Production now reports OpenRouter configured from the Integrations UI, but free models can return 429 and should fall back to Gemini.
- Make.com webhook was recovered from old host root `credentials.json` into durable `data/credentials.json` on 2026-07-03. OpenRouter key was not recoverable and must be re-entered once in Integrations after the persistence fix.
- Lead intelligence production smoke seeded 20 cities and 280 brand/city offices; KW/IDX-style pages were blocked by bot verification in production headless Chromium.
- Lead Intelligence dashboard/onboarding controls were deployed live in commit `64f48bb`; roster-discovery resilience fix deployed live in commit `8f25386`. Production Run Now after the fix completed for HomeSmart Birmingham with 1 page scanned, 0 contacts, and office counts moved to 268 pending / 20 no-contact / 3 blocked.
- 2026-07-03 production test proved the hidden DB path end to end: Pointe South Realty roster at `https://pointesouth.com/our-team/` harvested 31 contacts into `roster_contacts`; status after cleanup showed 1 harvested office and 31 hidden contacts.
- 2026-07-03 multi-office production test checked 8 offices in one run, harvested 0 new contacts, and skipped 54 same-brand queued offices after bad franchise-brand results. Coldwell Banker was later restored from `Skipped Brand` after raw HTML extraction proved it works; RE/MAX remains skipped/blocked.
- Research & Trends is onboarding-aware and should not invent engagement numbers.
- Latest production container was healthy after the Coldwell Banker raw-email extractor deployment.
- Latest local CRM rework validation: `node --check app.js`, `node --check server.js`, `node --check db.js`, direct DB helper smoke, and HTTP smoke on `PORT=3133` for `/api/crm-intelligence` passed. Not committed or deployed yet.

## Working Agreements

- After every meaningful update, refresh both `MEMORY.md` and `handoff.md`.
- Keep `MEMORY.md` compact and high-signal; prune stale details instead of appending forever.
- Keep `handoff.md` focused on latest state, verification, blockers, repo/deploy status, and next steps.
- User preference: after completing project updates, push/deploy live by default unless there is a clear blocker, explicit pause, or safety issue.
