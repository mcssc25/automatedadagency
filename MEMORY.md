# Project Memory

Last updated: 2026-07-02

## Durable Facts

- Project: Ad Agency Autopilot / Autonomous Sales CRM for selling Real Estate CRM Pro.
- GitHub repo: `https://github.com/mcssc25/automatedadagency.git`, branch `main`.
- Production app URL: `https://agents.realestatecrmpro.com`; VPS path: `/opt/ad-agency-autopilot`.
- Production runs on shared ClaimPilot VPS `178.156.178.56`; only touch `/opt/ad-agency-autopilot`, never ClaimPilot or `fluffysbait.com`.
- VPS deploys are file-copy based, not `git pull`: backup changed runtime files under `/opt/ad-agency-autopilot/data/backups/deploy-<timestamp>`, copy only this app's files, then rebuild `ad-agency-autopilot`.
- Runtime secrets/data are ignored. Never commit `.env`, `mailgun api.txt`, `credentials.json`, DB files, backups, downloads, logs, or `node_modules`.
- Mailgun outreach domain: `outreach.realestatecrmpro.com`.
- Gemini key rotations may use `C:\Users\daved\Desktop\Gemini Key for AI Ad Agency.txt`; never store the key in docs/git.

## Product Direction

- Goal is a review-first AI marketing operator: business research, competitor discovery, content/ad generation, lead discovery, and email campaigns.
- User wants to see each automation part work and approve outputs before full autonomy.
- Dashboard/support activity should distinguish real records/jobs from demo simulation; no fake leads, fake chats, fake KPI movement, fake publish success, fake email sends, fake engagement metrics, or mock trend fallbacks.
- Onboarding scan should produce deep business intelligence: company crawl, Gemini grounded research, competitor profiles/social links, SWOT, and business report.

## CRM / Email Safeguards

- Lead emails are normalized before storage; scraping skips invalid emails, existing lead emails, and DNC emails.
- DNC/unsubscribe entries are permanent by default; outbound sending blocks DNC recipients and DNC removal requires `ALLOW_DNC_REMOVAL=true`.
- Mailgun inbound replies post to `/api/webhooks/inbound-email`; CRM polls on `#crm`.
- `OUTBOUND_POSTAL_ADDRESS` is still blank, so outbound Mailgun sends fail closed until the user supplies a valid physical mailing address.
- Lead scraping uses async jobs: `POST /api/scrape-leads` starts a job, `/api/scrape-leads/jobs/:id` polls status, and completed jobs insert/dedupe leads.
- Preferred realtor scraping route is brokerage-roster-first: grounded Google/Gemini search discovers local brokerage and office websites plus public roster/team/agent URLs, then the backend crawls those pages for visible individual agent emails. Maps is only a fallback unless `LEAD_MAPS_FALLBACK=false`; Maps business/brokerage names, privacy/legal page titles, generic office/admin emails, and same-person duplicates should not be inserted as agent leads.
- Realtor scrapes should complete with warnings when no public individual agent emails are found; do not let long fallback calls make the UI spin indefinitely. Bounded fallback fix deployed in commit `b0c92e2`; brokerage-roster-first update deployed in commit `649b399`; realtor dedupe/privacy cleanup deployed in commit `1d500a7`. Rob Smith/privacy cleanup DB backup: `/opt/ad-agency-autopilot/data/backups/lead-cleanup-20260702T173550Z-rob-smith-privacy`; code deploy backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260702T173702Z-realtor-dedupe-cleanup`.
- Realtor directory discovery uses Zillow/Realtor.com/Redfin/Homes.com as profile-discovery signals only; do not bypass robots, logins, CAPTCHAs, paywalls, or private APIs.
- Lead records support optional `phone`, `website`, `address`, `sourceUrl`, and `discoveryQuery`.
- CRM has a persistent `campaign_enrollments` ledger so campaign progress is separate from lead pipeline stage.
- Campaign approval targets only `Scraped` leads, sends Step 1 through Mailgun, and stores campaign id/step on leads.
- Backend automation toggles default off: daily scrape, auto-enroll Scraped leads, auto-approve campaigns, and auto-send due follow-ups.
- Auto-pause on reply is supported through Mailgun inbound webhook; manual lead pause/delete controls were added locally on 2026-07-02.
- Manual pause stops active campaign enrollment for one lead and logs a timeline note. Manual delete removes the lead and their enrollment rows but does not add DNC.
- Open/click/signup routing is not connected yet; only inbound replies are tracked.

## Current Status

- 2026-07-02 hardening is deployed: root static files are allowlisted, production/admin Basic auth is required, CORS is restricted, Mailgun webhook signatures are verified, and outbound compliance footer/List-Unsubscribe are enforced.
- Hardening deployment commit: `c35051f`; async lead scrape commit: `43c3054`; realtor directory commit: `0ae31d0`; brokerage roster commit: `4946727`; realtor roster quality commit: `43cc427`; brokerage-roster-first discovery commit: `649b399`; realtor dedupe/privacy commit: `1d500a7`; CRM auto-approve commit: `2b33db0`.
- Latest deployed update makes Content Studio Research & Trends onboarding-aware: `/api/trends` builds keyword plans from business description, offers, audience, SWOT/report, goals, competitor profiles, and deterministic real-estate CRM terms such as `real estate crm`, `ai for realtors`, and `realtor software`; the UI shows top keyword targets and searched queries.
- Trend research should not invent engagement numbers. If the trend parser lacks real engagement, it returns `Trend score N` or `High engagement signal`.
- Verification for latest update: `node --check app.js`, `node --check server.js`, `git diff --check`, and a bounded local `/api/trends` smoke for Real Estate CRM Pro returned 12 trends, 12 keyword targets, and 4 searched queries.
- Trend-keyword code commit `a89a729` (`Improve trend keyword research`) is pushed to `main`.
- Trend-keyword deployment backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260702T193828Z-trend-keywords`; deployed container syntax checks passed and app is healthy.
- Previous deployed update fixed social post media card previews: video cards render in a portrait `9 / 16` frame with `object-fit: contain`, image cards stay `16 / 9`, and action buttons wrap inside cards.
- Social video preview layout code commit `13ab621` (`Fix social video preview layout`) was pushed and deployed live on 2026-07-02; VPS backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260702T164205Z-video-preview-layout`.
- Lead-management code commit `2e0a824` (`Add CRM lead management controls`) was pushed and deployed live on 2026-07-02; VPS backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260702T160315Z-lead-management`.

## Working Agreements

- After every meaningful update, refresh both `MEMORY.md` and `handoff.md`.
- Keep `MEMORY.md` compact and high-signal; prune stale details instead of appending forever.
- Keep `handoff.md` focused on latest state, verification, blockers, repo/deploy status, and next steps.
- User preference: after completing project updates, push/deploy live by default unless there is a clear blocker, explicit pause, or safety issue.
