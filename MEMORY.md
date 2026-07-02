# Project Memory

Last updated: 2026-07-02

## Durable Facts

- Project: Ad Agency Autopilot / Autonomous Sales CRM for selling Real Estate CRM Pro.
- GitHub repo: `https://github.com/mcssc25/automatedadagency.git`, branch `main`.
- Production app URL: `https://agents.realestatecrmpro.com`.
- VPS app path: `/opt/ad-agency-autopilot`.
- Production runs on the ClaimPilot/shared VPS at `178.156.178.56`; only touch `/opt/ad-agency-autopilot` there, never the separate ClaimPilot project.
- VPS deploys are file-copy based, not `git pull` based: backup changed runtime files under `/opt/ad-agency-autopilot/data/backups/deploy-<timestamp>`, copy only this app's files, then `docker compose up -d --build ad-agency-autopilot`.
- Cloudflare Tunnel routes the app hostname to the VPS. Do not alter `fluffysbait.com`.
- Mailgun outreach sending domain: `outreach.realestatecrmpro.com`.
- App secrets live outside git in ignored env/runtime files. Never commit `.env`, `mailgun api.txt`, `credentials.json`, DB files, backups, downloads, logs, or `node_modules`.
- Gemini key rotations may use `C:\Users\daved\Desktop\Gemini Key for AI Ad Agency.txt`; keep the key itself only in ignored `.env` files and never in docs/git.

## Product Direction

- Goal is a review-first AI marketing operator: deep business research, competitor discovery, viral social research/adaptation, lead discovery, and email campaigns.
- User wants to see each automation part work and approve outputs before turning on full autonomy.
- Dashboard/support activity should distinguish real records/jobs from demo simulation; no fake leads, fake support chats, fake KPI movement, fake publishing success, fake email sends, or mock trend fallbacks.
- Content Studio can recommend today's post, draft copy, and attach locally saved generated images through `/api/generate-image-prompt` + `/api/generate-image`.
- Onboarding scan is intended to produce deep business intelligence: company crawl, Gemini grounded research, competitor profiles/social links, SWOT, and business report.

## CRM / Email Safeguards

- Lead emails are normalized before storage; scraping skips invalid emails, existing lead emails, and DNC emails.
- DNC/unsubscribe entries are permanent by default; outbound sending blocks DNC recipients.
- DNC removal is disabled unless `ALLOW_DNC_REMOVAL=true` is intentionally set for admin recovery.
- Mailgun inbound replies post to `/api/webhooks/inbound-email`; CRM polls on `#crm`.
- Lead scraping prefers `LEAD_SCRAPER_URL=http://lead-scraper:8080`; if Maps has a website but no email, the backend crawls homepage/contact-style pages for public emails before Gemini fallback.
- Lead records support optional `phone`, `website`, `address`, `sourceUrl`, and `discoveryQuery`.
- Sales asset settings persist in CRM settings: booking/calendar link, sales page URL, default demo YouTube video, and YouTube page/channel.
- Campaign copy can use `[CTA Link]`, `[Booking Link]`, `[Demo Link]`, `[YouTube Link]`, `[Sales Page]`, and `[Website]`.
- Campaign approval targets only leads with stage `Scraped`, sends Step 1 immediately through Mailgun, and stores campaign id/step on those leads.
- CRM has a persistent `campaign_enrollments` ledger so campaign progress is separate from lead pipeline stage.
- Backend pipeline automation is behind explicit toggles: daily scrape, auto-enroll Scraped leads into Campaign 1, auto-approve new campaigns, and auto-send due follow-up steps. Defaults are off.
- Auto-approved campaigns launch Step 1 immediately; delayed campaign steps are sent by the backend worker only when auto-follow-up is enabled.
- Open/click/signup routing is not connected yet; only inbound replies are tracked through Mailgun inbound webhook.

## Current Local Status

- 2026-07-02 dev hardening update: `server.js` now serves only allowlisted root frontend files plus `/downloads`; source, DB, credentials, logs, and runtime files are no longer static assets.
- Production/container mode now requires `ADMIN_PASSWORD` unless `ADMIN_AUTH_ENABLED=false`; Basic auth protects dashboard/API while `/api/app-config`, `/api/unsubscribe`, `/api/webhooks/inbound-email`, and `/downloads/*` remain public.
- CORS is restricted to `PUBLIC_APP_URL` / `CORS_ALLOWED_ORIGINS` instead of wildcard.
- Mailgun inbound webhook now verifies timestamp/token/signature HMAC and supports urlencoded or multipart fields via `multer`.
- Outbound Mailgun sends now require `PUBLIC_APP_URL` and `OUTBOUND_POSTAL_ADDRESS` by default, append unsubscribe/mailing-address footer, and set `List-Unsubscribe` headers.
- Scheduled post "Post Now" from the scheduled queue now passes `'scheduledPosts'` correctly.
- Current local/Docker state checked on 2026-07-02: 3 leads, 1 Scraped lead, 2 DNC entries, 0 campaigns, auto-approve/auto-follow-up off.
- Hardening update was deployed to VPS on 2026-07-02 with `ADMIN_PASSWORD`, `PUBLIC_APP_URL`, `MAILGUN_WEBHOOK_SIGNING_KEY`, auth enabled, and restricted CORS.
- Public verification after deploy: unauthenticated dashboard/API/source/DB requests are blocked; authenticated dashboard/CRM works; source/DB paths return 404 even with auth; Mailgun unsigned webhook rejects and valid signed webhook passes.
- `OUTBOUND_POSTAL_ADDRESS` is still blank, so outbound Mailgun sends fail closed until the user supplies a valid physical mailing address.
- Latest code adds `autoApproveCampaigns` while keeping legacy `bypassEmailVerification` as a compatibility alias.
- Commit `2b33db0` was pushed and deployed live on 2026-07-02; VPS backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260702T080357Z-crm-auto-approve`.

## Working Agreements

- At the end of each meaningful update, refresh both `MEMORY.md` and `handoff.md`.
- Keep `MEMORY.md` short and prune stale details instead of appending forever.
- Keep `handoff.md` focused on latest state, verification, blockers, and next steps.
- User preference: after completing project updates, push/deploy them live by default unless there is a clear blocker, explicit pause, or safety issue.
