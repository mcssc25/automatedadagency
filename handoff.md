# Handoff

Last updated: 2026-07-02

## Latest Update

- Added OpenRouter API key management to the Integrations/API Configuration screen.
- The UI now has an OpenRouter key field, enable toggle, web-search toggle, daily request cap, and editable free-model rotation list.
- Saved OpenRouter keys are stored server-side in ignored runtime `credentials.json`; the browser only sees configured/enabled status and never receives the saved key back.
- Lead-intelligence OpenRouter calls now rotate through free models before falling back to Gemini. The default order starts with `openai/gpt-oss-120b:free`, then `google/gemma-4-31b-it:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `poolside/laguna-m.1:free`, Qwen, Llama, Hermes, Gemma 4 26B, Nemotron Nano, GPT OSS 20B, and other free slugs.
- The server still falls back to Gemini grounding when OpenRouter is disabled, the key is missing, the daily cap is reached, or all OpenRouter model attempts fail.
- OpenRouter web search remains opt-in because it may consume OpenRouter credits even with free text models.

## Previous Update

- Wired OpenRouter as an optional low-cost LLM provider for hidden lead-intelligence research.
- Added OpenRouter config knobs: `OPENROUTER_ENABLED`, `OPENROUTER_API_KEY`, `OPENROUTER_DEFAULT_MODEL`, `OPENROUTER_RESEARCH_MODEL`, `OPENROUTER_WEB_SEARCH_ENABLED`, `OPENROUTER_WEB_SEARCH_MAX_RESULTS`, `OPENROUTER_DAILY_REQUEST_LIMIT`, `OPENROUTER_APP_NAME`, and `LEAD_INTELLIGENCE_RESEARCH_PROVIDER`.
- Brokerage discovery, specific brokerage roster URL lookup, and brokerage tech-stack research now prefer OpenRouter when enabled and fall back to Gemini grounding if OpenRouter is unavailable, capped, or errors.
- JSON repair can use OpenRouter first when available, then falls back to Gemini.
- `/api/app-config` and `/api/lead-intelligence/status` now expose OpenRouter configuration status, selected models, web-search setting, daily cap, and in-process daily requests used.
- Important limitation: OpenRouter text models can help structure and reason over scraped/retrieved content, and OpenRouter web search can help find current brokerage pages, but it does not bypass Cloudflare/CAPTCHA-protected roster pages. KW-style blocked rosters still need Firecrawl/managed browser fallback or should remain marked `Blocked`.

## Previous Update

- Clarified Research & Trends card metrics after the user saw orange lines that looked like notifications.
- Root cause: grounded search fallback may return qualitative source-backed trend rationale when public view/like/comment counts are not visible. The UI was still labeling that text as `Viral engagement`, which made it look like engagement metrics.
- UI now displays `Engagement` in orange only when a numeric views/likes/comments/shares/reposts/replies metric is present.
- UI now displays qualitative fallback text as cyan `Trend signal`.
- Grounded trend research now asks for `engagementMetrics` separately from `trendSignal` so future cards can distinguish public metrics from rationale cleanly.

## Previous Update

- Built the first backend-only lead intelligence engine for nationwide realtor database building.
- Added hidden SQLite tables for `market_cities`, `brokerage_profiles`, `brokerage_offices`, `roster_contacts`, and `intelligence_runs`.
- Seeded the first 20 mid-market/mid-income cities for discovery, starting with Birmingham, Huntsville, Knoxville, Chattanooga, Greenville, Columbia, Pensacola, Lakeland, Tulsa, Omaha, and others.
- Added deterministic brokerage-brand seeds across those cities for `Keller Williams`, `RE/MAX`, `Coldwell Banker`, `Realty ONE Group`, `EXIT Realty`, `Better Homes and Gardens Real Estate`, `Century 21`, `Berkshire Hathaway HomeServices`, `eXp Realty`, `Real Broker`, `United Real Estate`, `HomeSmart`, `Fathom Realty`, and `Realty Executives`.
- Added a one-cycle worker that discovers local/regional/100% commission/flat-fee brokerage offices for a city, researches brokerage tech offerings, finds official office/roster URLs, browser-harvests public roster pages with Playwright/Chromium, paginates where possible, and stores contacts in hidden `roster_contacts` instead of the visible CRM pipeline.
- Added backend controls: `GET /api/lead-intelligence/status`, `POST /api/lead-intelligence/seed`, and `POST /api/lead-intelligence/run-once`.
- Added Docker runtime support for browser harvesting: `playwright-core`, system `chromium`, and `BROWSER_CHROMIUM_PATH=/usr/bin/chromium`.
- `docker-compose.yml` enables the hourly worker with `LEAD_INTELLIGENCE_ENABLED=true`, one run per hour, 40 roster pages max, and 250 contacts max per roster cycle.
- The worker keeps existing safeguards: public pages only, no login/CAPTCHA/private API bypass, strict useful-email and individual-agent filters.
- Follow-up fix: brokerage seed upserts now create missing targets without blanking discovered `website`/`rosterUrl` values or downgrading existing statuses back to `Pending`; intelligence run updates can store `brokerageOfficeId` and `cityId`.
- Follow-up fix: browser roster harvesting now detects Cloudflare/security-verification/CAPTCHA-style challenge pages and marks those runs as `Blocked` instead of `No Contacts`.

## Previous Update

- Follow-up fix after production testing: trend cards could disappear when a later refresh returned zero parsed posts.
- Root cause: the VPS cannot run the Windows `py` launcher or the local Windows last30days plugin path, so the first trend parser always returned no posts in production. The grounded Gemini fallback sometimes returned valid cards, but when a later fallback response contained malformed JSON, `/api/trends` returned zero trends and the browser saved that empty result over the previously visible cards.
- Backend now skips the unavailable last30days script cleanly, uses JSON repair for keyword/trend grounded responses, and caches the last successful trend set for a business context.
- Frontend now ignores stale/out-of-order trend refresh responses and preserves the last good trend cards if a refresh returns no parsed posts, showing a warning note instead of wiping the grid.

## Previous Update

- Made Content Studio `Research & Trends` smarter and onboarding-aware.
- Frontend now sends `/api/trends` the saved business description/offers, audience, SWOT, business report, agency goal, core message, competitor domains, and competitor profiles.
- Backend now builds a keyword plan from onboarding context, grounded Gemini keyword research when available, deterministic business-category fallback terms, and competitor brand/category combinations.
- Real estate CRM profiles now explicitly seed searches such as `real estate crm`, `ai for realtors`, `realtor software`, `crm for realtors`, `real estate lead follow up`, and `real estate ai tools`.
- `/api/trends` now runs multiple platform-intent searches instead of a single 3-4 word query, ranks parsed results by trend score/engagement signal, and falls back to grounded search synthesis only when the last30days parser returns no posts.
- The trend response now includes `trends`, `keywords`, `searchedQueries`, and `keywordPlan`.
- The UI now renders a `Top keyword targets` card above trend cards, shows the keyword that produced each card, supports source links when present, and gives a useful no-results message listing searched terms.
- Removed user-visible fake engagement metrics from parsed trend output: unparsed engagement now displays `Trend score N` or `High engagement signal` instead of random likes/comments.

## Verification

- `node --check server.js` passed after the OpenRouter Integrations UI and model-rotation update.
- `node --check app.js` passed.
- `git diff --check` passed with normal Windows CRLF warnings only.
- Local API smoke on a temporary port verified `/api/openrouter-settings` load/save and `/api/app-config` reporting: saved OpenRouter config returned enabled/configured, first model `openai/gpt-oss-120b:free`, and app config reflected OpenRouter enabled.
- `node --check server.js` passed after the OpenRouter provider wiring.
- `git diff --check` passed with normal Windows CRLF warnings only.
- `node --check server.js` passed after the lead-intelligence worker.
- `node --check db.js` passed.
- `node --check app.js` passed.
- `git diff --check` passed.
- Local DB smoke initialized the new tables, seeded a Birmingham market row, and returned a hidden intelligence status summary.
- Browser runtime was verified inside the rebuilt production container: `playwright-core` loads and `/usr/bin/chromium` exists.
- Production smoke after initial deploy seeded 20 cities and 280 brand/city offices. Several local brokerage cycles completed with 0 contacts due to missing/blocked pages.
- Targeted KW Birmingham smoke opened `https://kwbham.yourkwoffice.com/our-agents` in production Chromium but received a Cloudflare security-verification page (`Just a moment...`) instead of the visible roster, confirming that KW-style sites may need a managed/stealth browser provider rather than plain VPS headless Chromium.
- Final production status after reliability fixes: app container healthy, deployed `server.js`/`db.js`/`app.js` syntax checks passed, KW Birmingham is marked `Blocked`, and stale run rows from deploy restarts are marked `Interrupted`.
- `node --check server.js` passed.
- `node --check app.js` passed.
- `git diff --check` passed with normal Windows CRLF warnings only.
- Missing-script smoke with `LAST30DAYS_SCRIPT_PATH` pointed at a nonexistent file returned 12 trend cards, 12 keyword targets, and 4 searched queries, confirming the production fallback path works without `py`.
- Production `/api/trends` smoke from inside the deployed container returned 6 trend cards, 12 keyword targets, and 12 searched queries.
- Bounded local smoke request to `/api/trends` for `Real Estate CRM Pro` with `TREND_RESEARCH_MAX_QUERIES=4` returned:
  - 12 trend cards
  - 12 keyword targets
  - 4 searched queries
  - keyword examples including `real estate crm` and `ai for realtors`
- Deployed `docker exec ad-agency-autopilot node --check /app/server.js` passed.
- Deployed `docker exec ad-agency-autopilot node --check /app/app.js` passed.
- `docker compose ps ad-agency-autopilot` reported the app container healthy.
- No AI image/video generation, campaign send, email send, or production data mutation was triggered by local verification.

## Repo / Deployment Status

- Files changed for OpenRouter Integrations UI/model rotation: `server.js`, `app.js`, `index.html`, `.env.example`, `docker-compose.yml`, `MEMORY.md`, `handoff.md`.
- Runtime secrets/data remain uncommitted; no OpenRouter key has been committed.
- OpenRouter Integrations UI/model rotation is verified locally and pending commit/deploy in the current turn.
- Files changed for OpenRouter lead-intelligence provider wiring: `server.js`, `.env.example`, `docker-compose.yml`, `MEMORY.md`, `handoff.md`.
- Runtime secrets/data remain uncommitted; no OpenRouter key has been committed.
- OpenRouter wiring commit pushed to `main`: `e484757` (`Add OpenRouter lead intelligence provider`).
- Docs/deploy-status commit pushed to `main`: `a1c9dd9` (`Document OpenRouter provider update`).
- OpenRouter provider code is deployed live. Production `/api/app-config` reports `openRouterConfigured=false` because the production `.env` does not yet contain an enabled OpenRouter key.
- Files changed for lead-intelligence work: `Dockerfile`, `db.js`, `docker-compose.yml`, `package.json`, `package-lock.json`, `server.js`, `MEMORY.md`, `handoff.md`.
- Runtime secrets/data remain uncommitted.
- Lead-intelligence code is pushed and deployed. Main commits: `a91eb02` (`Add brokerage lead intelligence engine`), `66340d0` (`Seed brokerage brand city searches`), `c7434e6` (`Preserve discovered brokerage targets`), `fb0284b` (`Keep seeded offices queue position`), `6fb7bd3` (`Detect blocked roster browser pages`), `caea108` (`Mark interrupted intelligence runs`).
- Latest code commit pushed to `main`: `caea108` (`Mark interrupted intelligence runs`).
- Refresh-preservation deployment backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260702T202056Z-trend-refresh-preserve`.
- Deployed `ad-agency-autopilot` container is healthy.
- OpenRouter provider deployment backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260702T212622Z-openrouter-lead-intelligence`.
- OpenRouter provider deployment copied only `server.js`, `docker-compose.yml`, `.env.example`, `MEMORY.md`, and `handoff.md`, then rebuilt/restarted only `ad-agency-autopilot`.
- Production verification after OpenRouter deploy: container healthy, `docker exec ad-agency-autopilot node --check /app/server.js`, `/app/db.js`, and `/app/app.js` passed; `/api/app-config` returned OpenRouter model settings with `openRouterConfigured=false`; authenticated `/api/lead-intelligence/status` returned `researchProvider: "gemini"` and OpenRouter disabled until the key/env flags are set.
- Trend refresh preservation deployed live to `/opt/ad-agency-autopilot` on 2026-07-02.
- Deployment copied only `server.js`, `app.js`, `MEMORY.md`, and `handoff.md`.
- Deployment backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260702T193828Z-trend-keywords`.
- Lead-intelligence deployment backups:
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260702T202330Z-lead-intelligence-engine`
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260702T203149Z-brand-city-seeds`
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260702T203422Z-preserve-brokerage-targets`
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260702T203617Z-keep-seed-queue-position`
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260702T203847Z-detect-blocked-rosters`
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260702T204126Z-interrupted-intelligence-runs`
- `ad-agency-autopilot` was rebuilt/restarted only for that service; the lead scraper sidecar remained running.
- Production container is healthy on `127.0.0.1:3100->3000`.
- Public URL returned `401`, expected because production/admin Basic auth is enabled.
- Documentation was updated after push to record the final commit/deploy status.

## Deployment Notes

- Keep deploy scoped to `/opt/ad-agency-autopilot`; do not touch ClaimPilot or `fluffysbait.com`.
- Copy only changed source/docs files. Do not copy `.env`, `credentials.json`, `mailgun api.txt`, DB files, downloads, logs, backups, or `node_modules`.
- Backup already created at `/opt/ad-agency-autopilot/data/backups/deploy-20260702T193828Z-trend-keywords`.
- Rebuild/restart targeted only the `ad-agency-autopilot` service; the lead scraper sidecar and other VPS projects were left alone.

## Next Steps

- Check the production Content Studio tab with a real onboarded profile to confirm keyword chips and trend cards render as expected.
- Add a valid physical mailing address to `OUTBOUND_POSTAL_ADDRESS`, then run a safe outbound campaign send test.
- Add integration tests for `/api/trends` response shape, deterministic real-estate CRM keyword seeding, and no-fake-engagement behavior.
