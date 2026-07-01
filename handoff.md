# Ad Agency Autopilot Handoff

Last updated: 2026-07-01

## Current State

- Local project is now a Git repository on branch `main`.
- Remote repo: `https://github.com/mcssc25/automatedadagency.git`.
- Initial project backup was pushed to GitHub at commit `1aebfc5a8b59ec5ee45febc4edf4a8b6950cad7f`.
- Production app is hosted at `https://agents.realestatecrmpro.com`.
- VPS app path: `/opt/ad-agency-autopilot`.
- Runtime is on the ClaimPilot/shared VPS `178.156.178.56`, but the project is separate; only modify `/opt/ad-agency-autopilot`.
- VPS deployment is currently file-copy based, not a Git checkout.
- Do not modify `fluffysbait.com`; it is a real production site.

## Production Setup

- Node/Express app runs in Docker on the VPS.
- Cloudflare Tunnel exposes the app at `agents.realestatecrmpro.com`.
- Local deployment files:
  - `Dockerfile`
  - `docker-compose.yml`
  - `docker-compose.tunnel.yml`
  - `.dockerignore`
- Sensitive/runtime files are intentionally excluded from git:
  - `.env`
  - `.cloudflared.env`
  - `mailgun api.txt`
  - `credentials.json`
  - `data/*` except `data/.gitkeep`
  - `downloads/*` except `downloads/.gitkeep`
  - logs and `node_modules`

## Mailgun / Email

- Outreach sending domain: `outreach.realestatecrmpro.com`.
- Sender configured for outreach: `Sales at Real Estate CRM Pro <sales@outreach.realestatecrmpro.com>`.
- This outreach Mailgun setup is separate from the Real Estate CRM Pro product Mailgun account to avoid harming product-user deliverability.
- Inbound route forwards replies to `https://agents.realestatecrmpro.com/api/webhooks/inbound-email`.
- Inbound parser handles Mailgun form posts and normalizes display-name senders to bare lowercase emails.
- CRM view polls while on `#crm` so new replies should appear in the selected conversation after refresh.

## Database / DNC Safeguards

- SQLite database is local runtime data and is not committed.
- Lead and DNC emails are normalized to lowercase/trimmed before storage.
- Duplicate lead/DNC emails are deduped during DB initialization.
- Case-insensitive indexes exist for lead email, lead name, and DNC email.
- Scraper skips invalid emails, DNC emails, and existing lead emails before insert.
- Outbound Mailgun sending refuses DNC recipients.
- Setting a lead to `DNC` or `Opted Out` adds the email to the permanent DNC table.
- DNC removal API is disabled unless `ALLOW_DNC_REMOVAL=true` is intentionally set for admin recovery.
- VPS DB backup before DNC migration: `/opt/ad-agency-autopilot/data/backups/crm-20260701T080419Z-pre-dedupe.db`.

## Latest Update

- Draft generation now auto-attaches local generated images:
  - `handleContentGeneration()` and content autopilot now call a shared `createGeneratedPostMedia()` helper after copy generation.
  - The helper asks `/api/generate-image-prompt` for a visual concept, then calls `/api/generate-image`, requires a local `/downloads/...` asset, and attaches that URL to the draft.
  - If image generation fails, the post is still drafted but no broken image URL is attached; the activity log records the image failure.
  - Reels/YouTube draft concepts now receive generated image assets instead of external stock video URLs.
  - `/api/generate-image` no longer returns external Unsplash URLs as a successful ultimate fallback; if Gemini and local fallbacks both fail, it returns HTTP 502.
  - Autopilot settings copy now says generated drafts attach locally saved AI images.
  - Asset version changed to `app.js?v=20260701-generated-draft-images`.
- Local verification completed:
  - `node --check app.js`
  - `node --check server.js`
  - `git diff --check` (only normal Windows CRLF warnings)
  - Local Docker rebuild with `docker compose up -d --build ad-agency-autopilot`.
  - Local `/api/generate-image` returned `{"success":true,"mediaUrl":"/downloads/gen_1782942337507_964320.jpg","model":"gemini-3.1-flash-lite-image"}` for a test prompt.
  - Local HTML contains `app.js?v=20260701-generated-draft-images` and the updated generated-image autopilot copy.
- Not yet deployed live in this pass.

## Previous Update

- Added Content Studio `Today's AI Recommendation`:
  - New button beside `Draft Social Post` in the Drafts tab.
  - Uses selected platforms, business description, target audience, strategic context, and any already-loaded trend cards to ask Gemini for one recommended topic for today.
  - Fills the topic input with the recommendation and immediately runs the normal draft flow for the checked platforms.
  - Fails visibly if Gemini is unavailable; no canned recommendation fallback is used.
  - Generator bar now wraps controls on narrower screens.
  - Asset versions changed to `index.css?v=20260701-post-recommendation` and `app.js?v=20260701-post-recommendation`.
- Local verification completed:
  - `node --check app.js`
  - `node --check server.js`
  - `git diff --check` (only normal Windows CRLF warnings)
  - Local Docker rebuild with `docker compose up -d --build ad-agency-autopilot`.
  - Local `/api/app-config` returned `geminiConfigured: true`.
  - Local HTML contains `Today's AI Recommendation`, `btn-recommend-content`, `index.css?v=20260701-post-recommendation`, and `app.js?v=20260701-post-recommendation`.
- Git commit pushed: `055e0e3` Add daily post recommendation.
- Live deployment completed on `/opt/ad-agency-autopilot`; backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T212837Z-post-recommendation`.
- Live verification passed:
  - `docker compose ps` shows `ad-agency-autopilot` healthy; tunnel and lead scraper stayed running.
  - Public `/api/app-config` returned `geminiConfigured: true`.
  - Public HTML contains `Today's AI Recommendation`, `btn-recommend-content`, `index.css?v=20260701-post-recommendation`, and `app.js?v=20260701-post-recommendation`.

## Previous Update

- Fixed the misleading dashboard startup log after onboarding is already saved.
- Code changes:
  - `app.js` now appends a context-aware startup status line after `loadState()`.
  - If onboarding has a saved business name or website, the dashboard says `Workspace ready for <client>. Onboarding profile loaded.`
  - If no client exists, the original `Add a client in Agency Onboarding` prompt still appears.
  - Asset version changed to `app.js?v=20260701-startup-client-status`.
- Local verification completed:
  - `node --check app.js`
  - `git diff --check` (only normal Windows CRLF warnings)
- Git commit pushed: `6385f8e` Fix startup client status log.
- Live deployment completed on `/opt/ad-agency-autopilot`; backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T211955Z-startup-client-status`.
- Live verification passed:
  - `docker compose ps` shows `ad-agency-autopilot` healthy; tunnel and lead scraper stayed running.
  - Public HTML references `app.js?v=20260701-startup-client-status`.
  - Public `app.js?v=20260701-startup-client-status` contains `Onboarding profile loaded`.

## Previous Product Review

- Product direction review completed from current code inspection.
- Target operating model: review-first marketing agents that deep-research the business, find competitors, identify viral topic-level social posts to adapt, discover leads, and prepare/send approved email campaigns; full autonomy comes after each part works reliably.
- Current reality:
  - Onboarding and CRM/email are the most real parts: business research feeds prompts; leads/campaigns/DNC/enrollments persist in SQLite; Mailgun send/inbound reply handling and a server-side CRM automation worker exist behind toggles.
  - Content Studio works as a draft/rewrite surface, but manual drafts currently attach external Pollinations image URLs, while the real local image generation route is only used by the manual `AI Image` action.
  - Auto-ingest viral Reel is wired to backend `yt-dlp`, but production currently errors when `yt-dlp` is unavailable and the search only requests `ytsearch1`, so it is not yet a robust viral research pipeline.
  - Research & Trends depends on a local `last30days` CLI script and returns however many parseable results it gets; it does not yet guarantee a healthy batch of high-engagement reels/posts.
  - Support Hub is simulated browser-side sessions plus Gemini/fallback replies; it is not connected to a real site chat widget or stored support inbox.
  - Dashboard KPIs/console are partly browser-local/demo simulation; real CRM lead counts feed some stats, but impressions/clicks/spend/revenue and published social analytics are not real platform metrics yet.
- Next likely build priorities:
  - Install/package `yt-dlp` in Docker or replace it with a managed ingestion service, then expand auto-ingest to collect/rank multiple candidates.
  - Change draft generation/autopilot to call `/api/generate-image-prompt` and `/api/generate-image` automatically, store local `/downloads` assets, and show graceful fallback states instead of broken images.
  - Improve the daily recommendation path so it can pull a fresh trend batch first and attach real generated media automatically.
  - Separate demo dashboard/support labels from real backend job/activity records before calling the product autonomous.

## Latest Code Update

- Cleaned up the CRM selected-lead detail header after the Maps source URL made the view look broken:
  - Contact/company/email/phone/address details now render as compact wrapping chips.
  - Long website/source URLs now render as `Website` and `Maps Source` action links.
  - Empty Maps `complete_address` JSON blobs are hidden in the UI for older rows.
  - Asset versions changed to `20260701-crm-lead-header` for `index.css` and `app.js`.
- Local verification completed:
  - `node --check app.js`
  - `node --check server.js`
  - `git diff --check`
  - Local Docker rebuild with `docker compose up -d --build ad-agency-autopilot`.
  - Browser verification on local `http://127.0.0.1:3100/#crm`: selected lead showed chips for company/email/phone and action links for Website/Maps Source, with no raw long URL or empty JSON address chip.
- Git commit pushed: `4b79a0d` Clean up CRM lead detail header.
- Live deployment completed on `/opt/ad-agency-autopilot`; backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T194149Z-crm-lead-header`.
- Live verification passed:
  - `docker compose ps` shows `ad-agency-autopilot` healthy; tunnel and lead scraper stayed running.
  - Public `/api/app-config` returned `geminiConfigured: true`.
  - Public HTML loads `index.css?v=20260701-crm-lead-header` and `app.js?v=20260701-crm-lead-header`.
  - Live files contain `selected-lead-title-row` and `lead-detail-link`.

## Previous Update

- Fixed the lead scrape failure where Maps found a business website but the sidecar returned an empty `emails` column:
  - `server.js` now keeps the `gosom/google-maps-scraper` sidecar for Maps discovery.
  - If a Maps CSV row has a website but no usable email, the app directly fetches the business homepage and up to a few contact/about/team-style internal pages.
  - The fallback extracts public emails from raw HTML, `mailto:` links, and common email metadata before Gemini fallback is considered.
  - Obvious placeholder/assets emails are filtered; imports still require both a lead name and valid email.
  - Maps `complete_address` JSON blobs are formatted instead of stored raw when possible.
  - `app.js` now surfaces backend scrape error details when available instead of collapsing to the generic duplicate `Lead scraping failed` message.
  - `index.html` now loads `app.js?v=20260701-lead-enrichment`.
- Local verification completed:
  - `node --check app.js`
  - `node --check server.js`
  - `git diff --check`
- Local Docker verification completed:
  - Rebuilt `ad-agency-autopilot` with `docker compose up -d --build ad-agency-autopilot`.
  - Local `http://127.0.0.1:3100/api/app-config` returned `geminiConfigured: true`.
  - Local `/api/scrape-leads` for `kelly davis realtor in gulf shore alabama` inserted `info@bigbeachal.com` on first run.
  - Re-running the same local scrape returned `candidateCount: 1` and `skipped.duplicate: 1`; logs showed `[Lead Enrichment] Found 1 public email(s) on https://bigbeachal.com/`.
- Git commits pushed:
  - `54c4ce8` Enrich scraped leads from business websites.
  - `72e558e` Bump lead enrichment asset version.
- Live deployment completed on `/opt/ad-agency-autopilot`; backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T193034Z-lead-enrichment`.
- Live verification passed:
  - `docker compose ps` shows `ad-agency-autopilot` healthy; tunnel and lead scraper stayed running.
  - Public `/api/app-config` returned `geminiConfigured: true`.
  - Public HTML loads `app.js?v=20260701-lead-enrichment`.
  - Live `server.js` contains the website enrichment fallback.
  - Production `/api/scrape-leads` for `kelly davis realtor in gulf shore alabama` inserted `Dave and Kelly Davis - Big Beach AL Team` with `info@bigbeachal.com` as a `Scraped` lead.
  - Public `/api/crm-state` showed stage counts `Hot Lead: 1` and `Scraped: 1` after the smoke test.

## Earlier Update

- Added optional human strategy inputs to onboarding:
  - New optional fields inside the SWOT/strategy step: agency goal, core message, and extra details not captured by research.
  - Fields auto-save to browser state and are included in normal onboarding form save.
  - `getStrategicContext()` now prepends these user-provided notes before SWOT, business report, and competitor intelligence.
  - Generated email campaigns now send `strategicContext` to `/api/generate-campaign`, and the backend includes it in the campaign copywriting prompt.
  - Asset version query changed to `20260701-strategy-inputs` for `index.css` and `app.js`.
- Git commit pushed: `e5cf391` Add optional onboarding strategy inputs.
- Live deployment completed on `/opt/ad-agency-autopilot`; backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T185147Z-optional-strategy-inputs`.

## Earlier Update

- Forced onboarding long-field sizing for browsers still seeing short textareas:
  - Added cache-busting query strings to `index.css` and `app.js`.
  - Added inline `min-height`/`height` on `biz-desc` and `biz-swot` as a hard fallback.
  - Updated auto-grow JS to set `min-height`, `height`, and `overflow-y` with important priority.
  - Express now sends no-cache headers for HTML, JS, and CSS files so future UI changes do not get stuck behind static caching.
- Local verification completed:
  - `node --check app.js`
  - `node --check server.js`
  - `git diff --check`
- Git commits pushed: `8958aef` Force onboarding field size refresh, `94161f7` Disable cache for app shell assets.
- Live deployment completed on `/opt/ad-agency-autopilot`; backups:
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260701T183706Z-force-field-size-refresh`
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260701T183926Z-no-cache-field-size`
- Live verification passed:
  - `docker compose ps` shows `ad-agency-autopilot` healthy; tunnel and lead scraper stayed running.
  - Public HTML contains versioned `index.css?v=20260701-auto-grow-fields` and `app.js?v=20260701-auto-grow-fields`.
  - Public HTML contains inline `min-height:340px` for `biz-desc` and `min-height:560px` for `biz-swot`.
  - Public versioned `app.js` contains important-priority auto-grow style setters.
  - Public `/` response now sends `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`.

## Previous Update

- Made onboarding research text fields actually readable:
  - Product/Core Offer textarea minimum height is now 340px.
  - SWOT textarea minimum height is now 560px.
  - Both fields auto-grow after saved state loads, after website scans fill them, after modal saves, and while the user types.
  - Internal textarea scrollbars are hidden until the field reaches a generous max height.
- Local verification completed:
  - `node --check app.js`
  - `node --check server.js`
  - `git diff --check`
- Git commit pushed: `52dc1ec` Auto-grow onboarding research fields.
- Live deployment completed on `/opt/ad-agency-autopilot`; backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T180022Z-auto-grow-research-fields`.
- Live verification passed:
  - `docker compose ps` shows `ad-agency-autopilot` healthy; tunnel and lead scraper stayed running.
  - Public `index.css` contains `min-height: 340px` for long setup fields and `min-height: 560px` for SWOT.
  - Public `app.js` contains `autoGrowSetupTextarea` and `resizeOnboardingResearchFields`.
  - Public `/api/app-config` still returns configured Gemini model routing.

## Previous Update

- Improved onboarding scan UX:
  - Added a staged progress panel under Business Identity while `/api/scrape` runs: reading site, researching business, finding competitors, finding socials, developing SWOT, finalizing.
  - Enlarged the Product & Audience and SWOT textareas for finished research.
  - Added expand buttons for the Business Description/Core Offer and SWOT fields that open a larger modal editor; saving writes back to the original field and app state.
  - Added responsive scan-progress and expanded-editor styling in `index.css`.
- Local verification completed:
  - `node --check app.js`
  - `node --check server.js`
  - `git diff --check`
- Git commit pushed: `d722aaa` Improve onboarding scan progress and editors.
- Live deployment completed on `/opt/ad-agency-autopilot`; backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T175504Z-onboarding-progress-editors`.
- Live verification passed:
  - `docker compose ps` shows `ad-agency-autopilot` healthy; tunnel and lead scraper stayed running.
  - Public HTML contains `scan-progress-panel` and `long-text-modal`.
  - Public `app.js` contains `startScanProgress` and `openLongTextModal`.
  - Public `index.css` contains scan progress and expanded editor styles.
  - Public `/api/app-config` still returns configured Gemini model routing.

## Previous Update

- Fixed SWOT scan population fallback:
  - Backend `normalizeSwotProfile()` now accepts snake_case, nested SWOT fields, singular labels, and alternate section names like `gaps`, `limitations`, `risks`, and `competitiveAdvantages`.
  - `/api/scrape` now guarantees a `swotProfile`: if primary grounded research omits a parseable SWOT, it asks Gemini to create one from the verified company/competitor data, then falls back to a deterministic four-paragraph SWOT if needed.
  - Frontend scan handling now uses the same broader SWOT extraction and can fill the textarea from varied response shapes or a local fallback instead of leaving the placeholder visible.
- Local verification completed:
  - `node --check server.js`
  - `node --check app.js`
  - `git diff --check`
- Git commit pushed: `d1d1057` Guarantee onboarding SWOT population.
- Live deployment completed on `/opt/ad-agency-autopilot`; backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T174114Z-swot-guarantee`.
- Live verification passed:
  - `docker compose ps` shows `ad-agency-autopilot` healthy; tunnel and lead scraper stayed running.
  - Public `/api/app-config` returns configured Gemini model routing.
  - Public `app.js` contains `getSwotValueFromScan` and `buildFallbackSwotText`.
  - Production `/api/scrape` for `www.realestatecrmpro.com` returned 5 competitors and a 2,091-character `swotProfile` containing Strengths, Weaknesses, Opportunities, and Threats.

## Previous Update

- Wired Gemini model routing and social media generation upgrades:
  - `queryGemini()` and `queryGeminiWithSearch()` now accept a model override and expose configured model names through `/api/app-config`.
  - Default text tasks stay on `GEMINI_DEFAULT_MODEL=gemini-2.5-flash`.
  - Deep onboarding, competitor discovery, competitor supplementation, and manual competitor enrichment use `GEMINI_RESEARCH_MODEL=gemini-3.5-flash`.
  - AI image generation now tries Nano Banana 2 Lite via `GEMINI_IMAGE_MODEL=gemini-3.1-flash-lite-image` through the Interactions API, then falls back to Imagen 4, local stock, then stock URLs.
  - Added `/api/generate-video` using `GEMINI_VIDEO_MODEL=gemini-omni-flash-preview`, portrait `9:16`, and a longer timeout for video rendering.
  - Draft social cards now include an `AI Video` action that generates a vertical video prompt from the post, saves the returned `.mp4` in `/downloads`, and attaches it to the draft.
  - `.env.example` documents all model routing env vars.
- Local verification completed:
  - `node --check server.js`
  - `node --check app.js`
  - `git diff --check`
- Git commit pushed: `dbdad37` Route Gemini models and add AI video.
- Live deployment completed on `/opt/ad-agency-autopilot`; post-deploy backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T165131Z-gemini-model-video-post`.
- Live verification passed:
  - `docker compose ps` shows `ad-agency-autopilot` healthy; tunnel and lead scraper stayed running.
  - Public `/api/app-config` returns `geminiConfigured: true` and model names for default, research, image, and video.
  - Public `app.js` contains `generatePostVideo` and `/api/generate-video`.
  - Public `/api/generate-video` route is registered and returns HTTP 400 for an empty no-prompt request without spending on generation.

## Previous Update

- Improved onboarding competitor/SWOT robustness:
  - Scan and Auto-Discover now request 5-8 competitors and supplement results if fewer than 5 are returned.
  - New `/api/competitor-profile` endpoint researches one manually added competitor for summary, strengths, weaknesses, positioning, and social links.
  - Manual Add now stores the domain immediately, shows a researching state, and enriches the competitor profile in the background.
  - SWOT population now accepts `swotProfile`, `swot`, `SWOT`, `businessAnalysis`, object-shaped SWOT, or a SWOT section inside `businessReport`.
  - Competitor domain normalization trims whitespace before deduping.
- Gemini API calls now retry transient 429/5xx/network failures with backoff so onboarding does not fail on temporary Gemini 503s during JSON repair or grounded research.
- Git commits pushed: `7cf8df5` Enrich onboarding competitors and SWOT, `40c6fee` Retry transient Gemini onboarding failures, `ec533d6` Dedupe researched competitor domains.
- Live deployment completed on `/opt/ad-agency-autopilot`; latest backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T162716Z-competitor-dedupe`.
- Live verification passed:
  - Production `/api/scrape` for `www.realestatecrmpro.com` returned 6 unique competitors, populated SWOT, business report, and 2 scanned pages.
  - Production `/api/competitor-profile` for `lofty.com` returned summary, strengths, and social links for LinkedIn, Facebook, Instagram, YouTube, TikTok, and X.

## Previous Update

- Fixed onboarding scan failures caused by Gemini returning invalid JSON in long report fields.
- Search-grounded Gemini JSON calls request `responseMimeType: "application/json"` when supported, but retry without responseMimeType if Gemini rejects JSON mode with search grounding.
- `parseModelJson()` retries after escaping literal control characters inside quoted JSON strings, and `parseModelJsonWithRepair()` can ask Gemini to repair malformed JSON while preserving content.
- Local checks passed: `node --check server.js`, `node --check app.js`, `git diff --check`, and a Node parser smoke test for a literal newline inside `businessReport`.
- Git commits pushed: `84c3d92` Request and repair onboarding JSON, `ad15851` Fallback JSON mode for grounded scans.
- Live deployment completed on `/opt/ad-agency-autopilot`; latest backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T161157Z-json-mode-fallback`.
- Live verification passed: production `/api/scrape` for `www.realestatecrmpro.com` returned `businessName: Real Estate CRM Pro`, description, 4 competitor profiles, SWOT, report, and 2 scanned pages.

## Previous Update

- Fixed recurring Chrome "Save password?" prompt by removing the real browser password field for the Gemini API key.
- `settings-api-key` is now a read-only text/status field with `autocomplete="off"` and no `name`; the old eye toggle no longer switches it back to `type=password`.
- Local checks passed: no remaining `type="password"` inputs found, `node --check app.js`, `node --check server.js`, and `git diff --check`.
- Git commit pushed: `e42771a` Stop password manager prompts for API status.
- Live deployment completed on `/opt/ad-agency-autopilot`; backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T160348Z-password-manager-fix`.
- Live verification passed: public HTML has no `type="password"`, no `autocomplete="new-password"`, no `name="gemini-api-key"`, and does contain `settings-api-key` as a read-only text field. `/api/app-config` returned `{"geminiConfigured":true}`.

## Previous Update

- Confirmed the previous sales-link settings layer is live in production:
  - Public HTML contains `settings-booking-link`, `settings-sales-page-url`, `settings-demo-video-url`, `settings-youtube-page-url`, and `Sales Links`.
  - Public `/api/crm-state` returns `bookingLink`, `salesPageUrl`, `demoVideoUrl`, and `youtubePageUrl` under `crmAutopilot`.
  - Live `/opt/ad-agency-autopilot/server.js` contains placeholder replacement for `[Booking Link]`, `[Demo Link]`, `[YouTube Link]`, and related sales-link settings.
- Updated `MEMORY.md` with the exact correct live deploy target and method: `root@178.156.178.56`, `/opt/ad-agency-autopilot`, backup first, copy only this project, rebuild only `ad-agency-autopilot`, verify public URL and `docker compose ps`.

## Previous Update

- Deep onboarding update was deployed live to the correct ClaimPilot/shared VPS path: `/opt/ad-agency-autopilot`.
- Deployment backup of replaced runtime files: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T155254Z`.
- Rebuilt/restarted only the `ad-agency-autopilot` Docker Compose service.
- Live verification passed:
  - `https://agents.realestatecrmpro.com/api/app-config` returned `{"geminiConfigured":true}`.
  - Public HTML contains `SWOT Profile`, `Competitor Intelligence`, the deep research profile copy, Step 5 Budget, and Step 6 Autopilot Employees.
  - `docker compose ps` shows `ad-agency-autopilot` healthy, with `ad-agency-lead-scraper` and `ad-agency-autopilot-tunnel` still running.
- Latest code commit: `90e88af` Deepen onboarding business intelligence, pushed to `origin/main`.
- Repo status: live deployment completed and GitHub updated.

## Previous Update

- User preference recorded in `MEMORY.md`: after completing project updates, push/deploy them live by default unless blocked, explicitly paused, or unsafe.

## Previous Update

- Rebuilt onboarding around a deeper business intelligence scan.
- Setup order is now:
  - 1 Business Identity and website scan
  - 2 Product & Audience
  - 3 Competitor Intelligence
  - 4 SWOT Profile
  - 5 Budget & Goals
  - 6 Autopilot Employees
- `/api/scrape` now crawls the homepage plus relevant internal pages, extracts company social links, and uses Gemini Search grounding to produce:
  - company profile, core offers, audience, value proposition
  - ranked competitor domains
  - competitor summaries, strengths, weaknesses, differentiators, and public social links
  - SWOT profile paragraphs
  - compact business report for downstream agents
- `/api/competitors` now uses Gemini Search grounding and can return structured competitor profiles/social links, not just domains.
- Browser state now persists `bizSwot`, `businessReport`, `companySocialLinks`, ranked `competitorUrls`, and `competitorProfiles`.
- Competitor cards now show optional AI summaries, positioning notes, and social links while preserving drag-to-rank behavior.
- Ad, social, and visitor-support prompts now include a shared strategic context built from SWOT, business report, and competitor intelligence.
- Deep scan and competitor auto-discovery save state immediately after filling the onboarding UI.

## Previous Update

- Added reusable sales-link settings for campaign and follow-up automation.
- New Settings fields:
  - Booking / calendar link
  - Sales page URL
  - Default demo YouTube video
  - YouTube page / channel
- Backend CRM settings now persists `bookingLink`, `salesPageUrl`, `demoVideoUrl`, and `youtubePageUrl`.
- Campaign generation now gives Gemini these configured assets and defaults a blank campaign CTA to demo video -> YouTube page -> sales page -> business website.
- Real Mailgun campaign sends and backend follow-up sends now resolve placeholders: `[CTA Link]`, `[Booking Link]`, `[Calendar Link]`, `[Demo Link]`, `[YouTube Link]`, `[Sales Page]`, and `[Website]`.
- Inbound Mailgun reply AI now receives the configured sales links, uses the booking link for demo/call requests, uses video/YouTube links for demo-video requests, and avoids inventing URLs when a link is missing.
- Browser-side CRM simulation was updated to use the same placeholder behavior.

## Previous Update

- Built the durable CRM lead pipeline automation engine.
- Git commit pushed: `6c6aed4` Build CRM lead pipeline automation engine.
- Added `campaign_enrollments` SQLite table plus `lastStepTime` on leads.
- Campaign approval and bypass sending now create enrollment records and use the shared campaign-step sender.
- Added backend worker endpoint: `POST /api/crm-pipeline/run`.
- Added 5-minute backend interval that only acts when explicit automation toggles are enabled.
- Added Autopilot Settings controls:
  - Daily scrape search and enable toggle
  - Auto-enroll Scraped leads into Campaign 1
  - Auto-send due follow-up steps
  - Run Pipeline Now
- Inbound replies now move leads to `Two-Way Conversation`, pause active enrollments when auto-pause is on, and AI handoff moves leads to `Needs Human Action`.
- Unsubscribes/DNC now move leads to `Quarantined` and pause enrollments.
- Live deployment backup: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T094123`.
- Production verified: app healthy, new `/api/crm-state` automation fields present, live `/api/crm-pipeline/run` smoke test completed with `scraped/enrolled/sent/transitioned/skipped = 0` because automation toggles are off.

## Previous Update

- Improved the CRM campaign workflow so lead selection and campaign routing are visible.
- Git commit pushed: `aac1c99` Clarify CRM campaign enrollment workflow.
- Campaigns tab now includes a Campaign Enrollment Workflow panel showing:
  - current Scraped audience count for the next Step 1 send
  - Emailed and Hot Lead counts
  - configured Campaign 1, Campaign 2, and Campaign 3
  - manual/bypass launch rule
  - reply tracking vs missing open/click/signup tracking
- Autopilot Settings now supports a third follow-up campaign selector.
- The old wording that implied real scraped leads auto-enroll automatically was changed; real scraped leads remain `Scraped` until a campaign is approved.
- Production verified: live HTML contains the workflow UI, `/api/crm-state` includes `leadStageCounts` and `thirdCampaignId`, and containers are healthy.

## Previous Update

- Fixed campaign review ambiguity.
- Git commit pushed: `993f59f` Clarify campaign launch targets and CTA preview.
- CTA links entered in Campaign Builder are saved as `campaign.videoAsset`; the verification queue now previews that real link instead of leaving `[CTA Link]` visible when a CTA exists.
- Pending campaigns now receive `targetLeadsCount` from the server based on current `Scraped` leads.
- Approval now refuses to proceed with zero `Scraped` leads, shows a confirmation with the exact count, and labels the action as sending Step 1 now.
- The server now updates the same campaign to `Active` on approval instead of creating a new campaign and deleting the old one, so enrolled leads keep a valid campaign id.
- Production currently has one lead total, but zero `Scraped` leads; the existing lead is stage `Hot Lead`, so the pending campaign should not email it.

## Password Prompt Update

- Fixed Chrome password-save prompts caused by the non-login Gemini API key field being interpreted as a credential form.
- The API key input now uses `autocomplete="new-password"` plus password-manager ignore hints, and its visibility toggle is explicitly a button.
- Git commit pushed: `6e56568` Suppress password manager prompt for API key field.
- Deployed to the VPS and verified the live HTML contains the password-manager ignore hints.

## Scraper Update

- Added and deployed the low-cost lead scraper integration.
- Git commits pushed:
  - `c1e42b5` Add maps-based lead scraper sidecar
  - `a835c62` Avoid VPS scraper port conflict
- `docker-compose.yml` now includes a `gosom/google-maps-scraper` sidecar service exposed on VPS loopback at `127.0.0.1:18080`; the Node app talks to it over Docker DNS at `http://lead-scraper:8080`.
- `/api/scrape-leads` now tries the maps scraper first, falls back to Gemini search only when needed, never inserts fake contacts, and imports only candidates with both name and valid email.
- Lead storage and CRM display now include optional `address`, `sourceUrl`, and `discoveryQuery` metadata.

## Deployment Notes

- Runtime files copied to `/opt/ad-agency-autopilot` by `scp` because the VPS app directory is not a Git checkout.
- Pre-deploy backup of replaced runtime files: `/opt/ad-agency-autopilot/data/backups/deploy-20260701T084016`.
- Initial production restart hit a loopback port conflict on `127.0.0.1:8080`; fixed by moving the optional scraper host binding to `127.0.0.1:18080`.

## Verification

- Current local syntax checks passed after the onboarding update:
  - `node --check app.js`
  - `node --check server.js`
- Local dev server is currently running at `http://127.0.0.1:3199` and `/api/app-config` returned `{"geminiConfigured":true}`.
- The new deep onboarding scan UI has not yet been browser-tested end to end with a real client site; production deployment itself is live and public HTML/API checks passed.
- Live Gemini/Search behavior still needs a UI scan test with a configured API key because `/api/scrape` now performs multi-page crawling plus grounded research.
- Local code checks passed:
  - `node --check server.js`
  - `node --check app.js`
  - `node --check db.js`
  - `git diff --check`
- Current local smoke test passed on temporary port `3199`:
  - `/api/app-config` returned `geminiConfigured: true`
  - `/api/crm-state` included `bookingLink`, `salesPageUrl`, `demoVideoUrl`, and `youtubePageUrl`
- Local SQLite migration check passed via `db.initDb()`; existing lead rows now expose `address`, `sourceUrl`, and `discoveryQuery`.
- `docker compose config` passed.
- Local Docker verification passed:
  - `lead-scraper` started successfully.
  - App container rebuilt and became healthy.
  - Local `http://127.0.0.1:3100/api/app-config` returned `{"geminiConfigured":true}`.
  - Sidecar accepted a smoke-test REST job payload and returned a job id.
- VPS verification passed:
  - `docker compose ps` shows `ad-agency-autopilot`, `ad-agency-lead-scraper`, and the Cloudflare tunnel running.
  - Public `https://agents.realestatecrmpro.com/api/app-config` returned `{"geminiConfigured":true}`.
  - Public `/api/crm-state` shows the pending campaign has numeric `targetLeadsCount` and a saved CTA asset.
  - Public HTML contains the API-key password-manager ignore hints.
  - App container has `LEAD_SCRAPER_URL=http://lead-scraper:8080`.
  - App container resolves Docker DNS name `lead-scraper`.
  - VPS loopback `http://127.0.0.1:18080/` returned HTTP 200.
- Staged secret-pattern scan passed before pushing the initial backup.
- Git ignored local secrets/runtime data before the backup push.

## Next Steps

- Run a small real scrape from the UI and inspect inserted lead quality.
- Continue database/scraper hardening as needed:
  - Add automated tests for duplicate lead insertion.
  - Add tests for unsubscribe/DNC permanence.
  - Add tests for outbound-send DNC blocking.
