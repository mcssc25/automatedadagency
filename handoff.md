# Handoff

Last updated: 2026-07-02

## Latest Update

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

- `node --check server.js` passed.
- `node --check app.js` passed.
- `git diff --check` passed with normal Windows CRLF warnings only.
- Missing-script smoke with `LAST30DAYS_SCRIPT_PATH` pointed at a nonexistent file returned 12 trend cards, 12 keyword targets, and 4 searched queries, confirming the production fallback path works without `py`.
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

- Files changed: `server.js`, `app.js`, `MEMORY.md`, `handoff.md`.
- Runtime secrets/data remain uncommitted.
- Last completed code commit pushed to `main`: `a89a729` (`Improve trend keyword research`).
- Pending follow-up repo/deploy step: commit, push, and deploy the refresh-preservation fix.
- Deployed live to `/opt/ad-agency-autopilot` on 2026-07-02.
- Deployment copied only `server.js`, `app.js`, `MEMORY.md`, and `handoff.md`.
- Deployment backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260702T193828Z-trend-keywords`.
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
