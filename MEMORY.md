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
- OpenRouter can be configured from the browser Integrations UI; saved key lives in ignored production/runtime `credentials.json`, not browser localStorage or git. Env fallback still works with `OPENROUTER_ENABLED=true` and `OPENROUTER_API_KEY`.

## Product Direction

- Goal is a review-first AI marketing operator: business research, competitor discovery, content/ad generation, lead discovery, and email campaigns.
- User wants to see each automation part work and approve outputs before full autonomy.
- Dashboard/support activity should distinguish real records/jobs from demo simulation; no fake leads, fake chats, fake KPI movement, fake publish success, fake email sends, fake engagement metrics, or mock trend fallbacks.

## Lead Intelligence

- Hidden nationwide lead intelligence engine is backend-only today. It stores market cities, brokerage profiles, brokerage offices, roster contacts, and run logs in SQLite hidden tables.
- Production Docker config enables the hourly worker with `LEAD_INTELLIGENCE_ENABLED=true`, `LEAD_INTELLIGENCE_INTERVAL_MS=3600000`, and `LEAD_INTELLIGENCE_START_DELAY_MS=120000`.
- The worker seeds 20 mid-market cities and 14 brokerage brand searches per city, researches brokerage/office roster URLs, and browser-harvests public roster pages into `roster_contacts`.
- Browser controls were added locally on 2026-07-03: Agency Onboarding includes a Lead Intelligence Worker toggle, and Dashboard Workflow Status includes agent toggles, hidden DB counts, and a Lead Intelligence Run Now button.
- Lead Intelligence browser toggle persists to ignored runtime `data/lead-intelligence-settings.json`; the hourly worker reads that setting before running. Backend endpoints: `GET /api/lead-intelligence/status`, `POST /api/lead-intelligence/settings`, `POST /api/lead-intelligence/seed`, and `POST /api/lead-intelligence/run-once`.
- Lead-intelligence research can prefer OpenRouter with free-model rotation and Gemini fallback. OpenRouter web search is opt-in and may use credits.
- Known limitation: KW-style protected roster pages can show Cloudflare/security verification to production headless Chromium and should be marked `Blocked`; a managed/stealth browser provider may be needed for those.
- Realtor directory discovery may use Zillow/Realtor.com/Redfin/Homes.com as profile-discovery signals only; do not bypass robots, logins, CAPTCHAs, paywalls, or private APIs.

## CRM / Email Safeguards

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
- Key deployed commits include hardening `c35051f`, async lead scrape `43c3054`, brokerage-roster-first `649b399`, realtor dedupe/privacy `1d500a7`, CRM auto-approve `2b33db0`, trend preservation `8eb10bd`, lead intelligence base `a91eb02`, lead intelligence reliability `caea108`, OpenRouter provider `e484757`, and OpenRouter Integrations UI `f562eee`.
- OpenRouter Integrations UI/model rotation commit `f562eee` is deployed live. Production reports `configured=false` until the user pastes a key in Integrations or configures `OPENROUTER_API_KEY` in env.
- Lead intelligence production smoke previously seeded 20 cities and 280 brand/city offices; KW Birmingham was marked `Blocked` due to Cloudflare security verification in production headless Chromium.
- Lead Intelligence dashboard/onboarding controls are implemented and locally tested but not yet committed/deployed at the time of this memory update.
- Research & Trends is onboarding-aware and should not invent engagement numbers.
- Latest production container was healthy after the OpenRouter Integrations deployment.

## Working Agreements

- After every meaningful update, refresh both `MEMORY.md` and `handoff.md`.
- Keep `MEMORY.md` compact and high-signal; prune stale details instead of appending forever.
- Keep `handoff.md` focused on latest state, verification, blockers, repo/deploy status, and next steps.
- User preference: after completing project updates, push/deploy live by default unless there is a clear blocker, explicit pause, or safety issue.
