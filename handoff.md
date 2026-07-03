# Handoff

Last updated: 2026-07-03

## Latest Update

- Tested the live Hetzner Lead Intelligence Worker against real brokerage roster pages.
- Found three concrete failure modes:
  - IDX/KW/RealtySouth/ARC-style pages can show Cloudflare, reCAPTCHA, Burrow, or similar human-verification pages from the Hetzner headless browser.
  - OpenRouter free models can return repeated `429` rate limits; before this fix, optional brokerage tech research could stall the worker before roster harvesting.
  - Elementor roster cards can put the email in a `mailto:` button whose visible text is only `Email`, while the agent name lives several ancestors up in the card.
- Fixed backend reliability in `server.js`:
  - OpenRouter no longer retries the same model on `429`; model fallback is capped and falls back to Gemini quickly.
  - Expanded roster challenge detection to catch Cloudflare, reCAPTCHA, Burrow, "Please Verify You Are Human", "I'm not a robot", "malicious bots", and request-forbidden pages.
  - Improved roster contact scoping so `mailto:` links inside nested Elementor/card layouts resolve the full agent card and extract the agent name.
- Deployed the fixes live to `/opt/ad-agency-autopilot` and restarted only the `ad-agency-autopilot` Docker Compose service.

## Production Test Result

- Controlled test office: `Pointe South Realty`, Foley, AL.
- Public roster URL: `https://pointesouth.com/our-team/`.
- Manual production run completed successfully:
  - Run id: `40`
  - Result: `Harvested 31 contact(s) from Pointe South Realty`
  - Pages scanned: `1`
  - Warning/error: none
- Hidden SQLite status after cleanup:
  - `roster_contacts`: `31`
  - `brokerage_offices`: `1 Harvested`, `5 Blocked`, `3 Failed`, `21 No Contacts`, `264 Pending`
- Successful contact rows were renamed from the temporary controlled-test label to real brokerage name `Pointe South Realty`.
- The next scheduled run correctly marked `RE/MAX` in Huntsville, AL as blocked by browser verification instead of misclassifying it as no-contact.
- The app container was healthy after deployment.

## Verification

- Local `node --check server.js` passed.
- Local `git diff --check` passed with the normal Windows CRLF warning only.
- Deployed `/app/server.js` syntax check passed.
- Production `docker compose ps ad-agency-autopilot` reported the app container healthy.
- Production status endpoint showed the worker enabled and OpenRouter configured from Integrations.
- Production DB sample confirmed named Pointe South contacts stored with source URL `https://pointesouth.com/our-team/`.

## Repo / Deployment Status

- Current branch: `main`.
- Latest committed update on `main`: `Harden lead intelligence roster harvesting`.
- Runtime data/secrets were not committed.
- Changed source/docs in this update: `server.js`, `MEMORY.md`, `handoff.md`.
- Deployment backups created:
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260703T1623-lead-intelligence-rate-limit-blocked-detect`
  - `/opt/ad-agency-autopilot/data/backups/deploy-20260703T1628-lead-intelligence-card-scope`

## Next Steps

- Commit and push this update after final verification.
- Add a queue strategy that prioritizes public non-Cloudflare brokerage/team pages and marks repeated protected IDX pages as lower priority.
- Consider a managed browser provider later for Cloudflare/CAPTCHA-protected roster pages; do not bypass logins, CAPTCHAs, paywalls, or private APIs.
- Add a small backend regression test for extracting names from `mailto:` buttons inside nested cards.
