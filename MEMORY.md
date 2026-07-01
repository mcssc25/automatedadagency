# Project Memory

Last updated: 2026-07-01

## Durable Facts

- Project: Ad Agency Autopilot / Autonomous Sales CRM for selling Real Estate CRM Pro.
- GitHub repo: `https://github.com/mcssc25/automatedadagency.git`, branch `main`.
- Production app URL: `https://agents.realestatecrmpro.com`.
- VPS app path: `/opt/ad-agency-autopilot`.
- Production Ad Agency Autopilot runs on the ClaimPilot/shared VPS at `178.156.178.56`; only touch `/opt/ad-agency-autopilot` there, never the separate ClaimPilot project.
- VPS runtime is separate from ClaimPilot and uses Docker Compose.
- Production deploys are currently file-copy based on the VPS, not `git pull` based.
- Live deploy method: SSH/SCP as `root@178.156.178.56` using `$HOME/.ssh/id_ed25519`; backup changed runtime files under `/opt/ad-agency-autopilot/data/backups/deploy-<timestamp>`; copy only this app's files; run `docker compose up -d --build ad-agency-autopilot`; verify public URL and `docker compose ps`.
- Cloudflare Tunnel routes the app hostname to the VPS. Do not alter `fluffysbait.com`.
- Mailgun outreach sending domain: `outreach.realestatecrmpro.com`.
- Mailgun account/domain should remain separate from the Real Estate CRM Pro product Mailgun account to protect product deliverability.
- App secrets live outside git in local/VPS env files. Never commit `.env`, `mailgun api.txt`, `credentials.json`, DB files, backups, downloads, logs, or `node_modules`.

## Current Safeguards

- Lead emails are normalized before storage.
- Scraping skips invalid emails, existing lead emails, and DNC emails.
- DNC/unsubscribe entries are intended to be permanent.
- Outbound email sending blocks DNC recipients.
- DNC removal is disabled unless `ALLOW_DNC_REMOVAL=true` is intentionally set for admin recovery.
- Inbound Mailgun replies post to `/api/webhooks/inbound-email` and should appear in the CRM conversation after polling refresh.
- Lead scraping now prefers the `gosom/google-maps-scraper` sidecar via `LEAD_SCRAPER_URL=http://lead-scraper:8080`, falls back to Gemini search only if the sidecar fails, never creates fake contacts, and imports only leads with both name and valid email.
- Lead records now support optional `phone`, `website`, `address`, `sourceUrl`, and `discoveryQuery`.
- The Gemini API key UI is a read-only server-config status field, not a password input, to avoid Chrome password-save prompts.
- Sales asset settings persist in CRM settings: booking/calendar link, sales page URL, default demo YouTube video, and YouTube page/channel.
- Campaign generation, outbound placeholder replacement, and inbound AI replies can use saved sales assets through `[CTA Link]`, `[Booking Link]`, `[Demo Link]`, `[YouTube Link]`, `[Sales Page]`, and `[Website]`.
- Campaign approval targets only leads with stage `Scraped`, sends Step 1 immediately through Mailgun, and stores the campaign id/step on those leads.
- CRM Campaigns now has a visible Campaign Enrollment Workflow panel showing current Scraped/Emailed/Hot Lead counts, Campaign 1/2/3 chain selections, launch rule, and tracking status.
- Open/click/signup routing is not connected yet; only inbound replies are tracked through the Mailgun inbound webhook.
- CRM now has a persistent `campaign_enrollments` ledger so campaign progress is separate from lead pipeline stage.
- Backend pipeline automation exists behind explicit toggles: daily scrape, auto-enroll Scraped leads into Campaign 1, and auto-send due follow-up steps. Defaults are off.
- Pipeline stages now include `Scraped`, `Emailed`, `Two-Way Conversation`, `Needs Human Action`, and `Quarantined`.
- Onboarding scan is intended to be deep business intelligence: multi-page company crawl plus Gemini Search grounding for company profile, offers, audience, competitor profiles/socials, SWOT, and a compact business report.
- Onboarding state includes `bizSwot`, `businessReport`, `companySocialLinks`, ranked `competitorUrls`, and `competitorProfiles`; ad, social, and support prompts reuse this strategic context.
- Onboarding JSON parsing repairs literal control characters inside AI JSON string values before parsing, because Gemini can return unescaped newlines in long report fields.
- Setup box order is: 1 Business Identity, 2 Product & Audience, 3 Competitor Intelligence, 4 SWOT Profile, 5 Budget & Goals, 6 Autopilot Employees.

## Working Agreements

- At the end of each meaningful update, refresh both `MEMORY.md` and `handoff.md`.
- Keep `MEMORY.md` short and prune stale details instead of appending forever.
- Keep `handoff.md` focused on latest state, verification, blockers, and next steps.
- User preference: after completing project updates, push/deploy them live by default unless there is a clear blocker, explicit pause, or safety issue.
