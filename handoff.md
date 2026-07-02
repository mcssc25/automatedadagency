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

- Added a CRM **Auto-Approve New Campaigns** toggle in CRM Autopilot Settings.
- Renamed the older Settings checkbox copy from bypass verification to Auto-Approve New CRM Campaigns.
- Added `autoApproveCampaigns` to frontend/backend CRM settings while preserving legacy `bypassEmailVerification` compatibility.
- Auto-approved generated campaigns now become `Active` and call the normal Mailgun launch path immediately for Step 1.
- Fixed the fallback campaign-generation path so it also honors auto-approve instead of always staying `Awaiting Launch`.
- Campaign creation now reports how many Step 1 emails were sent/failed when auto-approve runs.
- Auto-follow-up timing remains controlled by the existing **Auto-Send Due Follow-Up Steps** toggle. Delayed steps are processed by the backend worker every 5 minutes when enabled.

## Verification

- `node --check app.js` passed.
- `node --check server.js` passed.
- `git diff --check` passed with only normal Windows CRLF warnings.
- Local server on port 3000 was restarted from current `server.js`.
- Local `/api/app-config` returned `geminiConfigured: true`.
- Local `/api/crm-state` returned the SQLite-backed shape and reported:
  - `campaignsListCount: 0`
  - `verificationQueueCount: 0`
  - `autoApproveCampaigns: false`
  - `bypassEmailVerification: false`
  - `autoAdvanceCampaigns: false`
  - `scrapedCount: 1`
  - `dncCount: 2`
- No test campaign was generated and no email send was triggered during verification.

## Repo / Deployment Status

- Local changed files: `app.js`, `index.html`, `server.js`, `MEMORY.md`, `handoff.md`.
- Runtime secrets/data remain uncommitted.
- Production has not yet been updated with this change in this handoff state.

## Next Steps

- Commit/push the CRM auto-approve update.
- Deploy changed files to `/opt/ad-agency-autopilot` and rebuild only the `ad-agency-autopilot` service.
- Live smoke test after deploy:
  - Public `/api/app-config`.
  - Public `/api/crm-state` for the new `autoApproveCampaigns` field.
  - UI check that CRM Autopilot Settings shows the new toggle.
- To fully exercise the drip, use a safe test lead/domain, enable Auto-Approve plus Auto-Send Due Follow-Up Steps, generate a campaign, then verify Step 1 sends and `campaign_enrollments.nextActionAt` is populated for Step 2.
