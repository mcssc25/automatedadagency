# Handoff

Last updated: 2026-07-05

## Start Here

- Production is the Hetzner VPS app at `https://agents.realestatecrmpro.com`, not a local-only app.
- VPS host is `178.156.178.56`; app path is `/opt/ad-agency-autopilot`.
- Docker Compose service/container is `ad-agency-autopilot`, bound on `127.0.0.1:3100->3000`, with Cloudflare Tunnel in front.
- This VPS is shared with ClaimPilot. Only touch `/opt/ad-agency-autopilot`; do not touch ClaimPilot or `fluffysbait.com`.
- Deploys are file-copy based, not `git pull`: back up changed files under `/opt/ad-agency-autopilot/data/backups/deploy-<timestamp>`, copy only changed files, rebuild/restart only `ad-agency-autopilot` when needed.
- Runtime secrets/data are ignored and must stay out of git: `.env`, `mailgun api.txt`, `credentials.json`, DB files, backups, logs, downloaded media, and `node_modules`.

## Current Repo / Deploy State

- Branch: `main`.
- Deployed live to VPS on 2026-07-05 via file copy + Docker rebuild. Latest backup created at `/opt/ad-agency-autopilot/data/backups/deploy-20260705T152923`.
- Uncommitted local changes from this update remain:
  - `server.js`: added brokerage launch preview API; upgraded `/api/brokerages/send-batch` to selected recipients, first-wave limits, Awaiting Launch template activation, and optional A/B split.
  - `app.js`: added brokerage-specific campaign prefill, finished brokerage state, recipient preview/loading, selected-agent launch, and optional A/B send controls.
  - `index.html`: added "Finished List" and upgraded the batch modal into Brokerage Campaign Launch.
  - `index.css`: added brokerage action layout, finished-card styling, launch modal, and recipient picker styling.
  - `MEMORY.md` / `handoff.md`: updated project documentation.
- Pre-existing uncommitted change: `db.js` is modified and currently fails syntax check at line 170. This was not changed in this update.
- Not committed. `db.js` was intentionally not deployed.

## Latest Changes

- Each Brokerage Research card now includes:
  - "Create Email Campaign" to jump to Outreach Campaigns and prefill the AI campaign form with that brokerage's strengths, gaps, systems, agent chatter, evidence, and suggested campaign angle.
  - "Finished" to move the brokerage out of the active research list.
  - "Review & Launch" opens Brokerage Campaign Launch with campaign selection, send wave size, recipient preview/checkboxes, and optional A/B split.
- The Brokerage Research panel header now includes "Finished List" with a count badge.
- Finished brokerages are stored in browser `localStorage` as part of app state and can be restored to the active list.
- Brokerage launch can use Active or Awaiting Launch campaigns; Awaiting Launch templates are activated at send time without using the global approve/send-all route.

## Verification

- Passed: `node --check app.js`.
- Passed: `node --check server.js`.
- Passed: `git diff --check -- app.js index.html index.css server.js`.
- Passed on VPS/container: `node --check app.js`, `node --check server.js`, and `node --check db.js`.
- Passed on VPS/container: copied `server.js`, `app.js`, `index.html`, and `index.css` hashes match local.
- Passed on production URL with authenticated checks:
  - `https://agents.realestatecrmpro.com/` returned 200.
  - `/app.js` contains `loadBrokerageLaunchPreview`.
  - `/index.html` contains `batch-recipient-list`.
  - `/index.css` contains `brokerage-recipient-row`.
  - `/api/brokerages/launch-preview` returned recipient preview data for Coldwell Banker without sending email.
- Local-only blocker remains: local `node --check db.js` fails at `db.js:170` with `SyntaxError: missing ) after argument list`.

## Next Steps

- Fix or reconcile the pre-existing local `db.js` syntax error before running the local real app server or committing.
- Manually verify in the browser on production:
  - Create Email Campaign prefill opens the Outreach Campaign builder.
  - Finished removes the brokerage from active results.
  - Finished List shows completed brokerages and Restore returns them to active.
  - Review & Launch shows recipient checkboxes, selected count, and optional A/B controls.
- Commit after deciding how to handle the unrelated local `db.js` change.
