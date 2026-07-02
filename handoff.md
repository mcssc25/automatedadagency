# Ad Agency Autopilot Handoff

Last updated: 2026-07-02

## Current State

- Local project is a Git repository on branch `main`.
- Remote repo: `https://github.com/mcssc25/automatedadagency.git`.
- Production app: `https://agents.realestatecrmpro.com`.
- VPS path: `/opt/ad-agency-autopilot`.
- Runtime is on the shared ClaimPilot VPS `178.156.178.56`, but this project is separate; only modify `/opt/ad-agency-autopilot`.
- VPS deployment is file-copy based, not a Git checkout.
- Do not modify ClaimPilot or `fluffysbait.com`.

## Latest Update

- Changed realtor lead scraping to prioritize brokerage roster discovery from grounded Google/Gemini search instead of starting with Google Maps place rows.
- Realtor queries now first discover brokerage/office websites and likely public roster URLs, then crawl those roster/team/agent/profile pages for visible individual agent emails.
- Maps enrichment is now a fallback when brokerage roster discovery does not fill the requested count; it can be disabled with `LEAD_MAPS_FALLBACK=false`.
- New bounded knobs: `LEAD_BROKERAGE_SEARCH_TIMEOUT_MS` defaults to 120 seconds, and `LEAD_BROKERAGE_SEARCH_MAX_BROKERAGES` defaults to 12.
- Discovery filters out Zillow/Realtor.com/Redfin/Homes.com as crawl targets and normalizes only real URL/domain-looking brokerage links before crawling.

## Previous Update

- Fixed a realtor scrape UX failure where a Gulf Shores scrape could keep spinning without an obvious completed/error result.
- Production logs showed Maps found 20 places, stricter brokerage/business filters rejected the Maps business rows, several brokerage websites returned 403/500/timeouts, the directory fallback timed out after 120 seconds, and then generic Gemini fallback kept the job waiting.
- Realtor scrape jobs now use a bounded `LEAD_REALTOR_DIRECTORY_TIMEOUT_MS` fallback timeout, default 45 seconds.
- Generic Gemini fallback is skipped for realtor queries unless `LEAD_GENERIC_GEMINI_FALLBACK_FOR_REALTORS=true` is explicitly set.
- If no public individual agent emails are found, the job completes with 0 leads plus warnings instead of failing silently or waiting through long fallbacks.
- The CRM UI now logs and alerts the warning text when a scrape completes with no imported leads.

## Previous Update

- Fixed realtor scrape lead quality and count behavior after a Gulf Shores scrape inserted brokerage/business rows.
- Root cause: Maps/business website enrichment was creating candidates before brokerage roster scraping, using the Maps place title as the lead name; then candidate slicing happened before duplicate/invalid filtering, so asking for 5 could insert only 4.
- Realtor queries now crawl brokerage roster/team/agent pages first from Maps-discovered brokerage websites.
- Maps-derived row candidates are only allowed for realtor queries when the Maps title looks like an individual agent name, not a brokerage/business/team name.
- Generic office/admin-style emails such as `admin@`, `info@`, `office@`, `sales@`, `support@`, and `bugreport@` are filtered from lead insertion.
- Insert logic now continues past duplicate/DNC/invalid candidates until it inserts up to the requested count when enough valid candidates exist.
- Existing production leads were inspected but not deleted; the bad Gulf Shores business-name rows remain until the user chooses to delete/purge them.

## Previous Update

- Fixed social post media previews so AI video assets display as portrait previews instead of being cropped into the old short landscape frame.
- `app.js` now assigns media previews a `media-video` or `media-image` class and removes inline `max-height: 180px` / `object-fit: cover` rules from draft, scheduled, and sent-log cards.
- `index.css` now gives video previews a centered `9 / 16` frame using `object-fit: contain`, image previews a `16 / 9` frame using `object-fit: cover`, and card action rows `flex-wrap: wrap`.
- The generation request path already sends `aspectRatio: "9:16"` to `/api/generate-video`; no backend aspect-ratio change was needed.

## Verification

- `node --check server.js` passed after the brokerage-roster-first change.
- `git diff --check` passed with normal Windows CRLF warnings only.
- VPS deployment verification after brokerage-roster-first update:
  - `ad-agency-autopilot` rebuilt and restarted healthy on `127.0.0.1:3100->3000`.
  - `docker exec ad-agency-autopilot node --check /app/server.js` passed.
  - Deployed `/app/server.js` contains `discoverBrokerageRosterTargetsWithSearch`, `LEAD_BROKERAGE_SEARCH_TIMEOUT_MS`, and `LEAD_MAPS_FALLBACK`.
  - Public URL returned `401`, expected because production/admin Basic auth is enabled.
- Production investigation showed no new rows inserted for the latest Gulf Shores scrape; lead count remained 2, with only the old scraped Dave/Kelly lead plus the hot test lead.
- `docker logs ad-agency-autopilot` showed the scrape reached directory/Gemini fallback after roster/site failures, explaining the no-result/no-error perception.
- `node --check server.js` and `node --check app.js` passed after the bounded-fallback/no-leads-warning fix.
- `git diff --check` passed with normal Windows CRLF warnings only.
- VPS deployment verification after bounded fallback fix:
  - `ad-agency-autopilot` rebuilt and restarted healthy; scraper sidecar and tunnel remained running.
  - `docker exec ad-agency-autopilot node --check /app/server.js` and `/app/app.js` passed.
  - Deployed code contains `LEAD_REALTOR_DIRECTORY_TIMEOUT_MS`, `LEAD_GENERIC_GEMINI_FALLBACK_FOR_REALTORS`, the no-public-agent-emails warning, and the UI no-leads warning.
- Production investigation showed the Gulf Shores scrape created business-name leads from Maps rows (`Coastal Resort Realty`, `Kim Ward Realty, LLC`, `Living My Best Life Realty`, `Realty Executives Gulf Coast`) and inserted 4 because one candidate email was duplicate-filtered.
- `node --check server.js` passed after the realtor scrape filter/order/count fix.
- Cheerio selector smoke for case-insensitive class/aria selectors passed.
- `git diff --check` passed with normal Windows CRLF warnings only.
- VPS deployment verification after realtor roster quality fix:
  - `ad-agency-autopilot` rebuilt and restarted healthy; scraper sidecar and tunnel remained running.
  - `docker exec ad-agency-autopilot node --check /app/server.js` passed.
  - Deployed `/app/server.js` contains `isLikelyIndividualAgentLeadName`, `realtorContactsOnly`, generic email filtering, and count-limited insertion after skips.
- `node --check app.js` passed.
- `node --check server.js` passed.
- Temporary local smoke server on `PORT=3132` with auth disabled returned 200 for `/`.
- Temporary local server was stopped after the check.
- In-app browser was connected and viewport reset afterward, but its sandbox blocked synthetic draft/card seeding (`data:` URLs and storage/DOM writes), so no browser screenshot of a seeded video card was captured.
- No AI image/video generation, real publish, campaign send, or production mutation was triggered.

## Repo / Deployment Status

- Brokerage-roster-first code commit pushed and deployed: `649b399` (`Prioritize brokerage roster discovery`).
- Social video preview layout code commit pushed and deployed: `13ab621` (`Fix social video preview layout`).
- Realtor roster quality code commit pushed and deployed: `43cc427` (`Prioritize realtor roster lead quality`).
- Bounded realtor fallback code commit pushed and deployed: `b0c92e2` (`Bound realtor scrape fallback time`).
- This handoff includes post-deploy documentation for the latest scraper quality fix and the prior video-preview release.
- Runtime secrets/data remain uncommitted.
- Previously deployed commits:
  - `13ab621` (`Fix social video preview layout`)
  - `2e0a824` (`Add CRM lead management controls`)
  - `c35051f` (`Harden agency app deployment`)
  - `43c3054` (`Make lead scraping async`)
  - `0ae31d0` (`Add realtor directory lead discovery`)
  - `4946727` (`Add brokerage roster lead scraping`)
  - `43cc427` (`Prioritize realtor roster lead quality`)
  - `b0c92e2` (`Bound realtor scrape fallback time`)
  - `649b399` (`Prioritize brokerage roster discovery`)
  - `2b33db0` (`Add CRM auto-approve campaign setting`)

## Deployment Notes

- Latest deployment copied only `app.js`, `index.css`, `MEMORY.md`, and `handoff.md`.
- Brokerage-roster-first deployment copied `server.js`, `MEMORY.md`, and `handoff.md`; backup created at `/opt/ad-agency-autopilot/data/backups/deploy-20260702T171906Z-brokerage-search-first`.
- Backup created at `/opt/ad-agency-autopilot/data/backups/deploy-20260702T164205Z-video-preview-layout`.
- Realtor roster quality deployment copied `server.js`, `MEMORY.md`, and `handoff.md`; backup created at `/opt/ad-agency-autopilot/data/backups/deploy-20260702T115554Z-realtor-roster-quality`.
- Bounded realtor fallback deployment copied `server.js`, `app.js`, `MEMORY.md`, and `handoff.md`; backup created at `/opt/ad-agency-autopilot/data/backups/deploy-20260702T120757Z-bound-realtor-fallback`.
- Rebuild/restart targeted only `ad-agency-autopilot`; scraper sidecar and other VPS projects were left alone.
- Deployed container checks passed for `node --check /app/app.js` and `node --check /app/server.js`.
- `docker compose ps ad-agency-autopilot` reported the app container healthy on `127.0.0.1:3100->3000`.
- Public URL check returned `401`, expected because production/admin Basic auth is enabled.
- Do not copy ignored runtime files or local DB/log/smoke artifacts.

## Next Steps

- Browser-check a real/generated AI video draft on desktop and mobile to confirm the portrait preview and wrapped buttons match the expected card layout.
- Add a valid physical mailing address to local and VPS `OUTBOUND_POSTAL_ADDRESS`, then run a safe test campaign send.
- Add smoke/integration tests for CRM lead scrape, campaign approval/send, DNC block, inbound reply pause, manual lead pause, and manual lead delete.
- Still needed for a full agency: direct ad-platform integrations, platform analytics, client reporting, billing/contracts, calendar booking, multi-client isolation, and durable server-side content scheduling.
