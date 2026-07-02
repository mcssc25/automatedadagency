# Ad Agency Autopilot Handoff

Last updated: 2026-07-02

## Current State

- Local project is a Git repository on branch `main`.
- Remote repo: `https://github.com/mcssc25/automatedadagency.git`.
- Production app: `https://agents.realestatecrmpro.com`.
- VPS path: `/opt/ad-agency-autopilot`.
- Runtime is on the shared ClaimPilot VPS `178.156.178.56`, but this project is separate; only modify `/opt/ad-agency-autopilot`.
- VPS deployment is file-copy based, not a Git checkout.
- Do not modify `fluffysbait.com`.

## Latest Update

- Implemented brokerage-roster scraping as the preferred realtor lead strategy.
- For realtor queries, Maps-discovered brokerage websites now get crawled for roster/team/agent pages before the Gemini directory fallback runs.
- The roster crawler looks for pages/links matching agent, agents, associate, broker, realtor, roster, staff, team, professionals, meet-the-team, find-an-agent, and `getagent`.
- On roster/profile pages it extracts agent candidates from `mailto`, `data-email`, `data-contact-email`, email labels/titles, JSON-LD Person/RealEstateAgent data, nearby phone text, and nearby name/card text.
- The crawler follows a limited number of same-site roster/profile/contact links only; defaults are `LEAD_ROSTER_MAX_BROKERAGES=8` and `LEAD_ROSTER_MAX_PAGES_PER_SITE=12`.
- Leads are still inserted only when a valid public email is found; phone-only roster entries are skipped for now.

## Previous Update

- Added realtor-focused lead discovery for the user's main market.
- Realtor queries now run Maps/website enrichment first, then top up from a compliant `real-estate-directories` Gemini grounded-search layer using Zillow/Realtor.com/Redfin/Homes.com as profile discovery signals.
- The directory layer requires a public email on an allowed profile page, agent/brokerage website, schema/metadata, or linked public contact page before a lead can be inserted.
- It explicitly avoids bypassing logins, CAPTCHAs, robots restrictions, paywalls, or private APIs; Realtor.com direct scraping is not implemented because its robots file says scraping is unauthorized without express written permission.
- Daily scrape automation now uses the same shared `runLeadScrape()` path as manual scraping, so realtor-focused discovery applies to scheduled intake too.
- Email extraction now checks common contact attributes such as `data-email`, `data-contact-email`, email-ish `aria-label`, and email-ish `title` in addition to text, mailto, and schema fields.

## Previous Update

- Implemented async CRM lead scraping to prevent Cloudflare/browser request timeouts.
- `POST /api/scrape-leads` now starts an in-memory lead scrape job and returns `202` with a `job.id` immediately.
- Added `GET /api/scrape-leads/jobs/:id` so the UI can poll `queued` / `running` / `completed` / `failed` status.
- The previous synchronous scrape body is now shared by `runLeadScrape()`, preserving Maps sidecar -> Gemini fallback -> insert/dedupe behavior.
- The CRM scrape button now queues a job, polls every 4 seconds, logs progress, refreshes CRM state on completion, and converts HTML proxy/auth/timeout responses into a readable error.
- Diagnosed the original `"realtors in crystal lake, il"` popup: the sidecar found 20 Maps places and inserted 5 `Scraped` leads after the public browser request had already received an HTML timeout/error page.

## Previous Update

- Implemented the first development-hardening pass from the audit.
- Replaced broad `express.static(__dirname)` with an allowlist for `/`, `/index.html`, `/app.js`, `/index.css`, `/config.js`, and `/downloads/*`.
- Added production/admin Basic auth. In production, the server now refuses to start without `ADMIN_PASSWORD` unless `ADMIN_AUTH_ENABLED=false` is deliberately set.
- Restricted CORS to `PUBLIC_APP_URL` / `CORS_ALLOWED_ORIGINS` instead of wildcard.
- Added Mailgun webhook HMAC verification with timestamp freshness and replay-token protection.
- Added `multer` so Mailgun inbound fields can be parsed from multipart posts as well as urlencoded posts.
- Added outbound email compliance safety: sends require `PUBLIC_APP_URL` and `OUTBOUND_POSTAL_ADDRESS` by default, append unsubscribe/mailing-address footer, and set `List-Unsubscribe` headers.
- Fixed scheduled queue "Post Now" to call `publishPostNow(id, 'scheduledPosts')`.
- Updated `.env.example`, `.gitignore`, and `.dockerignore` so new runtime secrets and local data are handled intentionally.

## Verification

- Local code checks for brokerage-roster scraper:
  - `node --check server.js` passed.
  - Cheerio selector smoke confirmed case-insensitive class/aria email selectors work.
  - `git diff --check` passed with normal Windows CRLF warnings only.
- VPS deployment verification after brokerage-roster update:
  - `ad-agency-autopilot` rebuilt and restarted healthy; scraper sidecar and tunnel remained running.
  - `docker exec ad-agency-autopilot node --check /app/server.js` passed.
  - Deployed `/app/server.js` contains `BROKERAGE_ROSTER_KEYWORDS`, `scrapeBrokerageRosterCandidatesFromWebsite`, and `LEAD_ROSTER_MAX_BROKERAGES`.
- Local code checks for realtor directory update:
  - `node --check server.js` passed.
  - `git diff --check` passed with normal Windows CRLF warnings only.
  - Temporary local smoke server on `PORT=3334` verified a realtor query enters the new `real-estate-directories` job phase.
  - Local DB check after smoke still showed 3 leads, so no smoke/test realtor leads were inserted.
- VPS deployment verification after realtor directory update:
  - `ad-agency-autopilot` rebuilt and restarted healthy; scraper sidecar and tunnel remained running.
  - `docker exec ad-agency-autopilot node --check /app/server.js` passed.
  - Deployed `/app/server.js` contains `REALTOR_DIRECTORY_DOMAINS` and `real-estate-directories`; deployed `handoff.md` records the no-bypass boundary.
- Local code checks for async scrape update:
  - `node --check server.js` passed.
  - `node --check app.js` passed.
  - `git diff --check` passed with normal Windows CRLF warnings only.
- Temporary local smoke server on `PORT=3333` verified:
  - `POST /api/scrape-leads` returned a queued job id immediately.
  - `GET /api/scrape-leads/jobs/:id` returned running status and then failed status/details on a deliberately disabled scraper/Gemini setup.
- VPS deployment verification after async scrape update:
  - `ad-agency-autopilot` rebuilt and restarted healthy; `ad-agency-lead-scraper` and `ad-agency-autopilot-tunnel` remained running.
  - Public-safe `/api/app-config` returned 200.
  - Authenticated container smoke: empty scrape post returned 400 JSON, missing scrape job returned 404 JSON, and deployed `/app.js` includes `waitForLeadScrapeJob` plus `Lead scrape job queued`.
- Production log check on 2026-07-02:
  - `ad-agency-autopilot`, `ad-agency-lead-scraper`, and `ad-agency-autopilot-tunnel` were running.
  - App log showed `[Scraper] Looking for up to 30 public contacts for: "realtors in crystal lake, il"...`.
  - Sidecar log showed 20 Maps places found and final `scraped successfully`.
  - DB check showed 7 total leads, 6 `Scraped`, with 5 latest leads from `realtors in crystal lake, il` created at `2026-07-02 14:20:36` UTC.
- `node --version`: `v24.13.0`.
- `node --check server.js`, `node --check db.js`, and `node --check app.js` passed.
- `npm audit --omit=dev` reported 0 vulnerabilities.
- `npm ls --depth=0` includes `multer@2.2.0`.
- `git diff --check` passed with only normal Windows CRLF warnings.
- Temporary production-mode smoke server with test auth:
  - unauthenticated `/`, `/app.js`, `/server.js`, `/db.js`, `/data/crm.db`, and `/credentials.json` returned 401 except public `/api/app-config` and `/downloads/fallback_agent.jpg`.
  - authenticated `/` and `/app.js` returned 200.
  - authenticated `/server.js` and `/data/crm.db` returned 404.
- Production-mode startup without `ADMIN_PASSWORD` fails fast with `ADMIN_PASSWORD must be configured when admin authentication is enabled.`
- Temporary dev-mode smoke server without auth:
  - `/` and `/app.js` returned 200.
  - `/server.js`, `/db.js`, `/data/crm.db`, and `/credentials.json` returned 404.
  - `/downloads/fallback_agent.jpg` and `/api/app-config` returned 200.
- Mailgun webhook checks on temporary production-mode server:
  - unsigned urlencoded post returned 401.
  - valid signed urlencoded post returned 200 with `Sender not found in CRM`.
  - valid signed multipart post returned 200 with `Sender not found in CRM`.
- Local and VPS `.env` now have generated admin auth, `PUBLIC_APP_URL`, restricted CORS, and Mailgun webhook signing configured.
- `OUTBOUND_POSTAL_ADDRESS` is present but blank; outbound email sends intentionally fail closed until a valid physical mailing address is supplied.
- No real campaign was generated, no email send was triggered, and no records were intentionally mutated. Live webhook verification used an unknown sender and did not modify CRM records.

## Repo / Deployment Status

- Async lead scrape implementation commit pushed and deployed: `43c3054` (`Make lead scraping async`).
- Realtor directory discovery commit pushed and deployed: `0ae31d0` (`Add realtor directory lead discovery`).
- Brokerage roster scraping commit pushed and deployed: `4946727` (`Add brokerage roster lead scraping`).
- Post-deploy documentation has been updated to reflect the async scrape, realtor directory, and brokerage roster releases plus VPS smoke checks.
- Latest hardening code/config commit pushed: `c35051f` (`Harden agency app deployment`).
- A post-deploy handoff/memory documentation sync was pushed after the hardening commit.
- Local repo status after the documentation sync: clean on `main...origin/main`.
- Live hardening deployment completed on `/opt/ad-agency-autopilot`.
- Live async scrape deployment completed on `/opt/ad-agency-autopilot`.
- VPS backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260702T080357Z-crm-auto-approve`.
- VPS env backup: `/opt/ad-agency-autopilot/data/backups/env-20260702T090811Z/.env.before-hardening`.
- VPS post-deploy file snapshot: `/opt/ad-agency-autopilot/data/backups/deploy-20260702T090955Z-hardening-post`.
- VPS async scrape backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260702T092935Z-async-lead-scrape`.
- VPS realtor directory discovery backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260702T095955Z-realtor-directory-discovery`.
- VPS brokerage roster backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260702T101539Z-brokerage-roster-scrape`.
- Runtime secrets/data remain uncommitted.

## Live Verification

- VPS `docker compose ps ad-agency-autopilot` reported healthy after rebuild.
- Public unauthenticated:
  - `/api/app-config` returned 200.
  - `/`, `/app.js`, `/api/crm-state`, `/server.js`, `/db.js`, `/package.json`, `/data/crm.db`, and `/credentials.json` returned 401.
  - `/downloads/fallback_agent.jpg` returned 200 as public media.
- Public authenticated:
  - `/`, `/app.js`, and `/api/crm-state` returned 200.
  - `/server.js` and `/data/crm.db` returned 404.
- Public CORS:
  - evil origin did not receive `Access-Control-Allow-Origin`.
  - `https://agents.realestatecrmpro.com` received the expected allowed origin.
- Public Mailgun webhook:
  - unsigned urlencoded post returned 401.
  - valid signed urlencoded post returned 200 with `Sender not found in CRM`.

## Next Steps

- Run one authenticated real realtor lead scrape from the browser when ready to confirm end-to-end UX with live progress messages; no fake production scrape was started during deployment smoke.
- Add a valid physical mailing address to local and VPS `OUTBOUND_POSTAL_ADDRESS`, then run a safe test campaign send.
- Reconcile local vs public runtime data before launch if the local desktop DB is still expected to mirror production.
- Move Make/webhook credentials from `credentials.json` to env/secret storage or a protected persistent volume.
- Add smoke/integration tests for CRM lead scrape, campaign approval/send, DNC block, inbound reply pause, and content publish queue.
- Still needed for a full agency: direct ad-platform integrations, platform analytics, client reporting, billing/contracts, calendar booking, multi-client isolation, and durable server-side content scheduling.
