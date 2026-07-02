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

- Git commit pushed: `2b33db0` (`Add CRM campaign auto-approve toggle`).
- Local repo currently has uncommitted post-deploy documentation updates plus the hardening changes pending commit.
- Live hardening deployment completed on `/opt/ad-agency-autopilot`.
- VPS backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260702T080357Z-crm-auto-approve`.
- VPS env backup: `/opt/ad-agency-autopilot/data/backups/env-20260702T090811Z/.env.before-hardening`.
- VPS post-deploy file snapshot: `/opt/ad-agency-autopilot/data/backups/deploy-20260702T090955Z-hardening-post`.
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

- Add a valid physical mailing address to local and VPS `OUTBOUND_POSTAL_ADDRESS`, then run a safe test campaign send.
- Reconcile local vs public runtime data before launch if the local desktop DB is still expected to mirror production.
- Move Make/webhook credentials from `credentials.json` to env/secret storage or a protected persistent volume.
- Add smoke/integration tests for CRM lead scrape, campaign approval/send, DNC block, inbound reply pause, and content publish queue.
- Still needed for a full agency: direct ad-platform integrations, platform analytics, client reporting, billing/contracts, calendar booking, multi-client isolation, and durable server-side content scheduling.
