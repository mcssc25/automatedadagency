# Project Memory

Last updated: 2026-07-04

## Durable Facts

- Project: Ad Agency Autopilot / Autonomous Sales CRM for selling Real Estate CRM Pro.
- GitHub repo: `https://github.com/mcssc25/automatedadagency.git`, branch `main`.
- Production app URL: `https://agents.realestatecrmpro.com`.
- Hetzner/VPS host: `178.156.178.56`; production path: `/opt/ad-agency-autopilot`.
- Production runs as Docker Compose service `ad-agency-autopilot` on `127.0.0.1:3100->3000`; Cloudflare Tunnel fronts the public URL.
- VPS is shared with ClaimPilot; only touch `/opt/ad-agency-autopilot`, never ClaimPilot or `fluffysbait.com`.
- VPS deploys are file-copy based, not `git pull`: back up changed runtime files under `/opt/ad-agency-autopilot/data/backups/deploy-<timestamp>`, copy only this app's files, then rebuild/restart only `ad-agency-autopilot`.
- Runtime secrets/data are ignored. Never commit `.env`, `mailgun api.txt`, `credentials.json`, DB files, backups, downloads, logs, or `node_modules`.
- Mailgun outreach domain: `outreach.realestatecrmpro.com`.
- OpenRouter and Make.com webhook settings persist in ignored runtime `data/credentials.json` on the mounted `/opt/ad-agency-autopilot/data` volume.

## Product Direction

- Goal is a review-first AI marketing operator: business research, competitor discovery, content/ad generation, lead discovery, and email campaigns.
- User wants to see each automation part work and approve outputs before full autonomy.
- Dashboard/support activity should distinguish real records/jobs from demo simulation; no fake leads, fake chats, fake KPI movement, fake publish success, fake email sends, fake engagement metrics, or mock trend fallbacks.

## Lead Intelligence

- Hidden nationwide lead intelligence engine is backend-only. It stores market cities, brokerage profiles, brokerage offices, roster contacts, and run logs in SQLite hidden tables.
- Lead Intelligence auto-schedule is off by default unless explicitly enabled in runtime settings; avoid surprise hourly AI spend.
- Worker seeds mid-market cities and brokerage brand searches, researches brokerage/office roster URLs, and harvests public roster pages into `roster_contacts`.
- Browser controls exist in Agency Onboarding and Dashboard Workflow Status; endpoints include `GET /api/lead-intelligence/status`, `POST /api/lead-intelligence/settings`, `POST /api/lead-intelligence/seed`, and `POST /api/lead-intelligence/run-once`.
- Run Now uses `/api/lead-intelligence/run-once?async=true` to avoid proxy timeout alerts during long harvests.
- Lead-intelligence research is OpenRouter-first/OpenRouter-only and must not fall back to Gemini; route only to `openrouter/free` or model IDs ending in `:free`.
- Roster harvesting is gated before AI brokerage research: only research brokerage systems after at least one roster contact, and mark unharvestable/zero-contact brokerages `Do Not Scrape`.
- Coldwell Banker rosters are deterministic/email-rich at `https://www.coldwellbanker.com/city/{state}/{city}/agents`; raw HTML embeds agent JSON fields.
- KW/IDX-style protected roster pages can show Cloudflare/security verification to production headless Chromium and should be marked `Blocked`; do not try CAPTCHA bypasses unless explicitly requested.
- Realtor directory discovery may use Zillow/Realtor.com/Redfin/Homes.com as profile-discovery signals only; do not bypass robots, logins, CAPTCHAs, paywalls, or private APIs.

## CRM / Email Safeguards

- Sales CRM exposes Brokerage Research, Agent Roster, Lead Communication, Verification Queue, Campaigns, and Autopilot Settings tabs.
- Agent Roster surfaces `roster_contacts`; Lead Communication filters to responded leads via `/api/leads?respondedOnly=1`.
- Lead emails are normalized before storage; scraping skips invalid emails, existing lead emails, and DNC emails.
- DNC/unsubscribe entries are permanent by default; outbound sending blocks DNC recipients and DNC removal requires `ALLOW_DNC_REMOVAL=true`.
- `OUTBOUND_POSTAL_ADDRESS` must be configured for compliance-required outbound Mailgun sends.
- Campaign approval targets only `Scraped` leads, sends Step 1 through Mailgun, and stores campaign id/step on leads.
- Backend CRM automation toggles default off: daily scrape, auto-enroll Scraped leads, auto-approve campaigns, and auto-send due follow-ups.
- Auto-pause on reply is supported through Mailgun inbound webhook.
- Mailgun inbound replies post to `/api/webhooks/inbound-email`; webhook signatures are verified when `REQUIRE_MAILGUN_WEBHOOK_SIGNATURE=true`.
- Inbound responder flow: save Realtor reply, pause active campaign if enabled, quarantine unsubscribe requests, ask Gemini for JSON reply/handoff decision, send through Mailgun only when no handoff is needed.
- As of 2026-07-04, Gemini draft/JSON failures route the lead to `Needs Human Action` instead of sending a generic fallback.
- As of 2026-07-04, inbound auto-replies use limited retries for transient Mailgun/network failures; if delivery still fails, preserve the draft and mark `Needs Human Action`.
- Open/click/signup routing is not connected yet; only inbound replies are tracked.

## Current Status

- 2026-07-02 hardening is deployed: root static files are allowlisted, production/admin Basic auth is required, CORS is restricted, Mailgun webhook signatures are verified, and outbound compliance footer/List-Unsubscribe are enforced.
- Key deployed commits include hardening `c35051f`, async lead scrape `43c3054`, brokerage-roster-first `649b399`, realtor dedupe/privacy `1d500a7`, CRM auto-approve `2b33db0`, lead intelligence base `a91eb02`, OpenRouter provider/UI `e484757`/`f562eee`, agent dashboard controls `64f48bb`, multi-office cycles `8db2269`, Coldwell Banker extraction `39529c7`, CRM visibility `4b7b1a2`, response inbox `e4d8392`, activity log `561c0ed`, OpenRouter free guard `7ddf483`, roster-gated research `32f654f`, and OpenRouter-only suppression `0d435f8`.
- Production tests proved hidden DB path end to end; Pointe South Realty harvested 31 contacts, Coldwell Banker Huntsville/Knoxville harvested 23 contacts total, and production roster contacts reached at least 64.
- OpenRouter free models can return 429; Lead Intelligence should fail closed rather than spend Gemini budget.
- Research & Trends is onboarding-aware and should not invent engagement numbers.

## Working Agreements

- After every meaningful update, refresh both `MEMORY.md` and `handoff.md`.
- Keep `MEMORY.md` compact and high-signal; prune stale details instead of appending forever.
- Keep `handoff.md` focused on latest state, verification, blockers, repo/deploy status, and next steps.
- User preference: after completing project updates, push/deploy live by default unless there is a clear blocker, explicit pause, or safety issue.
