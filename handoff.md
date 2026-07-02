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

- Added manual CRM lead-management controls to the selected lead panel:
  - `Pause Campaign` appears when the selected lead has an active campaign enrollment.
  - `Delete Lead` is always available for the selected lead.
- Added backend routes:
  - `POST /api/leads/:id/pause-campaign` pauses active enrollments for one lead, clears current campaign pointers, and writes a timeline note.
  - `DELETE /api/leads/:id` removes one lead from the pipeline.
- Added `db.deleteLead(id)`, which deletes the lead's campaign enrollment rows before deleting the lead record.
- Important behavior distinction:
  - Pause stops one lead's drip outreach.
  - Delete removes the lead/prospect record and enrollment history.
  - DNC/blacklist remains the permanent "never contact again" path and is unchanged.

## Verification

- `node --check db.js` passed.
- `node --check server.js` passed.
- `node --check app.js` passed.
- `node -e "const db=require('./db'); db.initDb(); console.log(typeof db.deleteLead, typeof db.pauseLeadEnrollments);"` passed and confirmed both helpers export as functions.
- Temporary local smoke server on `PORT=3131` with auth disabled verified:
  - `GET /api/crm-state` returned 200.
  - `POST /api/leads/999999999/pause-campaign` returned 404.
  - `DELETE /api/leads/999999999` returned 404.
- Smoke did not mutate any real lead records.
- No real campaign send was triggered.

## Repo / Deployment Status

- Modified files: `app.js`, `db.js`, `index.css`, `server.js`, `MEMORY.md`, `handoff.md`.
- Latest lead-management commit subject: `Add CRM lead management controls`.
- Latest lead-management update is committed locally at this point, but not pushed or deployed yet.
- Runtime secrets/data remain uncommitted.
- Previously deployed commits:
  - `c35051f` (`Harden agency app deployment`)
  - `43c3054` (`Make lead scraping async`)
  - `0ae31d0` (`Add realtor directory lead discovery`)
  - `4946727` (`Add brokerage roster lead scraping`)
  - `2b33db0` (`Add CRM auto-approve campaign setting`)

## Deployment Notes

- If deploying this latest update, back up changed production files under `/opt/ad-agency-autopilot/data/backups/deploy-<timestamp>`.
- Copy only this app's changed files to `/opt/ad-agency-autopilot`.
- Rebuild/restart only the app service with Docker Compose; keep scraper and tunnel separate unless their status requires attention.
- Do not copy ignored runtime files or local DB/log/smoke artifacts.

## Next Steps

- Commit/push/deploy the lead-management update when ready.
- Browser-check the selected lead panel on desktop and mobile after deploy to confirm the new controls sit cleanly under the lead metadata.
- Add a valid physical mailing address to local and VPS `OUTBOUND_POSTAL_ADDRESS`, then run a safe test campaign send.
- Add smoke/integration tests for CRM lead scrape, campaign approval/send, DNC block, inbound reply pause, manual lead pause, and manual lead delete.
- Still needed for a full agency: direct ad-platform integrations, platform analytics, client reporting, billing/contracts, calendar booking, multi-client isolation, and durable server-side content scheduling.
