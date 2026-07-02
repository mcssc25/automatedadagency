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

- Fixed social post media previews so AI video assets display as portrait previews instead of being cropped into the old short landscape frame.
- `app.js` now assigns media previews a `media-video` or `media-image` class and removes inline `max-height: 180px` / `object-fit: cover` rules from draft, scheduled, and sent-log cards.
- `index.css` now gives video previews a centered `9 / 16` frame using `object-fit: contain`, image previews a `16 / 9` frame using `object-fit: cover`, and card action rows `flex-wrap: wrap`.
- The generation request path already sends `aspectRatio: "9:16"` to `/api/generate-video`; no backend aspect-ratio change was needed.

## Verification

- `node --check app.js` passed.
- `node --check server.js` passed.
- Temporary local smoke server on `PORT=3132` with auth disabled returned 200 for `/`.
- Temporary local server was stopped after the check.
- In-app browser was connected and viewport reset afterward, but its sandbox blocked synthetic draft/card seeding (`data:` URLs and storage/DOM writes), so no browser screenshot of a seeded video card was captured.
- No AI image/video generation, real publish, campaign send, or production mutation was triggered.

## Repo / Deployment Status

- Social video preview layout commit created locally with message `Fix social video preview layout`.
- Not yet pushed or deployed for this video-preview fix.
- Last pushed/deployed commit remains `2e0a824` (`Add CRM lead management controls`).
- Runtime secrets/data remain uncommitted.
- Previously deployed commits:
  - `2e0a824` (`Add CRM lead management controls`)
  - `c35051f` (`Harden agency app deployment`)
  - `43c3054` (`Make lead scraping async`)
  - `0ae31d0` (`Add realtor directory lead discovery`)
  - `4946727` (`Add brokerage roster lead scraping`)
  - `2b33db0` (`Add CRM auto-approve campaign setting`)

## Deployment Notes

- If deploying this fix, copy only `app.js`, `index.css`, `MEMORY.md`, and `handoff.md`.
- Rebuild/restart should target only `ad-agency-autopilot`; leave scraper sidecar and other VPS projects alone.
- Do not copy ignored runtime files or local DB/log/smoke artifacts.

## Next Steps

- Browser-check a real/generated AI video draft on desktop and mobile to confirm the portrait preview and wrapped buttons match the expected card layout.
- Push and deploy the preview fix if the local changes are accepted for release.
- Add a valid physical mailing address to local and VPS `OUTBOUND_POSTAL_ADDRESS`, then run a safe test campaign send.
- Add smoke/integration tests for CRM lead scrape, campaign approval/send, DNC block, inbound reply pause, manual lead pause, and manual lead delete.
- Still needed for a full agency: direct ad-platform integrations, platform analytics, client reporting, billing/contracts, calendar booking, multi-client isolation, and durable server-side content scheduling.
