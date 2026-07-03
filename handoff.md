# Handoff

Last updated: 2026-07-03

## Latest Update

- Rethought the failed Coldwell Banker path and found the real working method: do not rely on browser DOM extraction or AI discovery; fetch the raw roster HTML and parse embedded agent payloads.
- Coldwell Banker city roster pages expose public agent records in the server-returned page HTML with fields like `fullName`, `emailAddress`, `businessPhoneNumber`, and profile `url`.
- Added a deterministic Coldwell Banker roster URL builder:
  - `https://www.coldwellbanker.com/city/{state}/{city}/agents`
- Added a raw embedded-agent extractor that parses name/email/phone/profile URL from HTML before browser harvesting.
- Changed hidden Lead Intelligence to try static/raw roster extraction before browser harvesting.
- Disabled optional brokerage tech-stack AI research by default with `LEAD_INTELLIGENCE_RESEARCH_TECH_STACK=false`; email harvesting now runs first and cannot be stalled by OpenRouter/Gemini research.
- Restored the remaining queued Coldwell Banker offices from `Skipped Brand` back to `Pending` because Coldwell Banker is now proven harvestable.

## Production Test Result

- Coldwell Banker Huntsville:
  - Roster URL: `https://www.coldwellbanker.com/city/al/huntsville/agents`
  - Result: harvested `12` contacts in about `7.5s`
  - Browser pages scanned: `0`
  - Source: raw/static HTML embedded agent payload
- Coldwell Banker Knoxville:
  - Generated URL: `https://www.coldwellbanker.com/city/tn/knoxville/agents`
  - Result: harvested `11` contacts in about `6.3s`
  - Browser pages scanned: `0`
- Hidden DB total after tests: `54` roster contacts.
- Sample saved Coldwell Banker rows now have clean agent profile source URLs, not image URLs.
- Production app container was healthy after each deploy.

## Verification

- Local `node --check server.js` passed.
- Local `git diff --check` passed with normal Windows CRLF warnings only.
- Deployed `/app/server.js` syntax check passed.
- Manual production run id `48` harvested 12 Coldwell Banker Huntsville contacts.
- Manual production run id `49` harvested 11 Coldwell Banker Knoxville contacts using deterministic URL generation.

## Repo / Deployment Status

- Current branch: `main`.
- Runtime data/secrets were not committed.
- Changed source/config/docs in this update: `server.js`, `docker-compose.yml`, `.env.example`, `MEMORY.md`, `handoff.md`.
- Deployment backups created:
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260703T1906-coldwell-raw-email-extractor`
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260703T1932-coldwell-agent-object-refine`
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260703T1938-email-first-lead-intelligence`
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260703T1943-coldwell-deterministic-rosters`

## Next Steps

- Commit and push this update.
- Add deterministic/raw extractors for other brands with similar embedded JSON payloads instead of treating each no-DOM-email page as failure.
- Re-run remaining Coldwell Banker cities now that their queued rows are restored.
- Investigate other brand roster pages by raw HTML/network payload first, browser second, AI last.
