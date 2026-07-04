# Handoff

Last updated: 2026-07-04

## Start Here

- Production is the Hetzner VPS app at `https://agents.realestatecrmpro.com`, not a local-only app.
- VPS host is `178.156.178.56`; app path is `/opt/ad-agency-autopilot`.
- Docker Compose service/container is `ad-agency-autopilot`, bound on `127.0.0.1:3100->3000`, with Cloudflare Tunnel in front.
- This VPS is shared with ClaimPilot. Only touch `/opt/ad-agency-autopilot`; do not touch ClaimPilot or `fluffysbait.com`.
- Deploys are file-copy based, not `git pull`: back up changed files under `/opt/ad-agency-autopilot/data/backups/deploy-<timestamp>`, copy only changed files, rebuild/restart only `ad-agency-autopilot` when needed.
- Runtime secrets/data are ignored and must stay out of git: `.env`, `credentials.json`, DB files, backups, logs, downloaded media, and `node_modules`.

## Current Repo / Deploy State

- Branch: `main`.
- Latest deployed known production changes include CRM visibility `4b7b1a2`, brokerage research signals `17dddd4`, response inbox `e4d8392`, real activity log `561c0ed`, stale research refresh `3124543`, OpenRouter free-model guard `7ddf483`, roster-gated research `32f654f`, and OpenRouter-only suppression `0d435f8`.
- Latest deployed commit: `852be6d Add CRM human review queue`, pushed to `origin/main` and deployed live.
- Prior responder safety commit: `416f8bb Harden inbound AI responder handoff`, pushed to `origin/main` and deployed live.
- Deployment backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260704T101750Z-inbound-responder-handoff`.
- Human Review deployment backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260704T103338Z-human-review-crm`.

## Latest Change

- Added a dedicated Sales CRM `Human Review` tab next to Lead Communication.
- Human Review fetches `/api/leads?stage=Needs%20Human%20Action`, has its own search/pagination state, and shows a tab badge for waiting review items.
- Selecting a review item shows the handoff reason, conversation history, management actions, and preserved `agent-draft` entries.
- `agent-draft` messages now render as an `Unsent AI Draft` bubble in conversation logs.
- Mailgun inbound replies still arrive at `/api/webhooks/inbound-email`, verify signatures, match the sender to a CRM lead, save the Realtor reply, and pause active campaign enrollment when `autoPauseOnReply` is enabled.
- Gemini draft/JSON failures now route the lead to `Needs Human Action` with a handoff reason instead of sending a generic fallback response.
- Inbound AI auto-replies now use `sendMailgunEmailWithRetry` for likely transient Mailgun failures: network/no response, HTTP 429, and HTTP 5xx.
- Non-retryable Mailgun failures, or retry exhaustion, now mark the lead `Needs Human Action`, log the send error, and preserve Gemini's unsent draft in lead history as `agent-draft`.
- The webhook JSON response now reports `handoff:true` when a Mailgun send failure causes human review.

## CRM / Email Behavior Notes

- Campaign approval targets only `Scraped` leads, sends Step 1 through Mailgun, and stores campaign id/step on leads.
- Auto-send due follow-ups is controlled by `autoAdvanceCampaigns`; due sends skip leads already in `Two-Way Conversation`, `Needs Human Action`, `Quarantined`, `DNC`, or `Opted Out`.
- Unsubscribe/stop/remove-me replies are quarantined and added to DNC before Gemini is asked to draft anything.
- Mailgun send failures can still happen even when the replying email address is valid: Mailgun auth/domain issues, rate limits, 5xx outages, network timeouts, compliance fail-closed settings, DNC protection, or provider-side rejection/suppression.
- `OUTBOUND_POSTAL_ADDRESS` must be configured for compliance-required outbound Mailgun sends.

## Verification

- Local `node --check server.js` passed after the inbound responder update.
- Local `node --check app.js` passed after the Human Review tab update.
- Local `git diff --check` passed with only normal Windows CRLF warnings.
- Local smoke on `PORT=3134` with admin auth off returned valid JSON for `/api/leads?stage=Needs%20Human%20Action&page=1&limit=5`.
- Production Docker rebuild/restart of only `ad-agency-autopilot` succeeded.
- Production container reported `healthy`.
- In-container `node --check /app/app.js` and `node --check /app/server.js` passed.
- Production HTTP smoke against `http://127.0.0.1:3100/api/app-config` returned JSON with `geminiConfigured:true` and `openRouterConfigured:true`.
- Production authenticated in-container smoke returned `200` and valid JSON for `/api/leads?stage=Needs%20Human%20Action&page=1&limit=5`.
- No full Mailgun/Gemini webhook integration smoke was run yet; live behavior still needs a controlled inbound reply test.

## Next Steps

- After deploy, run an inbound Mailgun test reply that forces/observes: normal Gemini auto-reply, Gemini failure or invalid JSON handoff, unsubscribe quarantine, and Mailgun delivery failure handoff if safely reproducible.
- Consider adding a visible CRM badge/filter for `agent-draft` history entries so unsent AI drafts are easy to find during human review.
