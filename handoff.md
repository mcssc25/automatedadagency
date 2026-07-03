# Handoff

Last updated: 2026-07-03

## Latest Update

- Changed the hidden Lead Intelligence Worker so one failure no longer burns an entire hourly cycle.
- A worker run now checks up to `LEAD_INTELLIGENCE_MAX_OFFICES_PER_CYCLE` offices per cycle; production default is `8`.
- The run stops early if it harvests contacts, otherwise it keeps moving through failures/no-contact/blocked offices until the cap is hit.
- Added seeded-brand suppression: when a seeded national/franchise brand fails or is blocked in a way that likely applies across markets, remaining queued offices for that same brand are marked `Skipped Brand` instead of consuming future cycles.
- Existing queued `Coldwell Banker` and `RE/MAX` offices were manually moved to `Skipped Brand` after their prior production failures/blocks.

## Production Test Result

- Manual async run id `44` proved the new loop:
  - Started at `EXIT Realty in Huntsville, AL (1/8)`.
  - Advanced through all 8 offices in the same run.
  - Final message: `Checked 8 office(s); no contacts harvested.`
  - Pages scanned: `5`.
  - Same-brand queued offices suppressed during the run: `54`.
- Final live hidden DB status after the test:
  - `roster_contacts`: `31`
  - `brokerage_offices`: `1 Harvested`, `6 Blocked`, `7 Failed`, `26 No Contacts`, `164 Pending`, `90 Skipped Brand`
- The successful harvested contacts are still the 31 Pointe South Realty contacts from `https://pointesouth.com/our-team/`.
- The app container was healthy after deployment.

## Verification

- Local `node --check server.js` passed.
- Local `node --check db.js` passed.
- Local `git diff --check` passed with normal Windows CRLF warnings only.
- Deployed `/app/server.js` and `/app/db.js` syntax checks passed.
- Production `/api/lead-intelligence/status` exposes `maxOfficesPerCycle: 8`, `stopAfterContacts: true`, and `suppressBrandAfterFailure: true`.
- Production manual async run completed and recorded structured per-office attempts in `intelligence_runs.statsJson`.

## Repo / Deployment Status

- Current branch: `main`.
- Runtime data/secrets were not committed.
- Changed source/docs in this update: `server.js`, `db.js`, `docker-compose.yml`, `.env.example`, `MEMORY.md`, `handoff.md`.
- Deployment backup created:
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260703T1722-lead-intelligence-multi-office-cycle`

## Next Steps

- Commit and push this multi-office worker update.
- Improve queue quality next: prioritize public local/team pages and independent brokerages over seeded national franchise pages that often block or return no contacts.
- Consider a managed browser provider only later for protected pages; do not bypass logins, CAPTCHAs, paywalls, or private APIs.
