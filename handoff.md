# Sales CRM Handoff Document

This document outlines the current architecture, implemented features, and next steps for the **Sales CRM** module of the **Ad Agency Autopilot** platform.

---

## 🎯 Project Goal
Transition the Sales CRM from a mock/simulated sandbox to a production-ready, database-driven email marketing and lead negotiation dashboard.

---

## 🏗️ Implemented Architecture & Codebases

### 1. Persistent Storage (`node:sqlite`)
* **File**: [db.js](file:///c:/Users/daved/Desktop/Claude%20CoWork/Ad%20Agency%20Autopilot/db.js)
* **Description**: Migrated from a single JSON file to a local SQLite database (`data/crm.db`). Leverages Node v24.13.0's native, zero-dependency `node:sqlite` module.
* **Tables**:
  * `leads`: Holds lead records, stage statuses, and JSON-stringified chat/history logs.
  * `dnc_list`: Enforces the blacklist of unsubscribed/opted-out emails.
  * `campaigns`: Stores the 3-step drip campaign templates.

### 2. Real Outbound & Inbound Email (Mailgun Integration)
* **File**: [server.js](file:///c:/Users/daved/Desktop/Claude%20CoWork/Ad%20Agency%20Autopilot/server.js)
* **Outbound Sending**: Sends emails via Mailgun's HTTP API (using `axios` and standard urlencoded parameters, avoiding native form-data module issues).
* **Inbound Webhook (`POST /api/webhooks/inbound-email`)**: Receives JSON/form payloads from Mailgun whenever a prospect replies. Logs the reply in the database, runs keyword-based unsubscribe detection, and queries Gemini to draft follow-ups.
* **Unsubscribe Endpoint (`GET /api/unsubscribe`)**: Handles campaign opt-out links. Updates lead status to `Opted Out` and inserts the address into the `dnc_list` table.

### 3. Human Handoff Triggers & AI Responders
* **File**: [server.js](file:///c:/Users/daved/Desktop/Claude%20CoWork/Ad%20Agency%20Autopilot/server.js)
* When a reply is ingested by the inbound webhook, Gemini is prompted to analyze the history and respond with a structured JSON format containing a `requiresHandoff` flag.
* If a lead asks a complex/custom pricing question, becomes irritated, or schedules a demo, the flag is set to `true`. The server updates the stage to `Requires Handoff` and pauses automated outbound drip steps for that lead.

### 4. Search Grounded Lead Discovery
* **File**: [server.js](file:///c:/Users/daved/Desktop/Claude%20CoWork/Ad%20Agency%20Autopilot/server.js)
* The `/api/scrape-leads` endpoint queries Gemini with **Google Search Grounding** enabled. It uses the typed target query directly, so searches can target realtors, plumbers, roofers, agencies, or another niche instead of forcing every query into real estate.
* Results are inserted only when Gemini returns usable public contact data. If Gemini/search fails, the endpoint returns an error and does not insert fake contacts.
* Filters scraped results against the SQLite `dnc_list` table and existing lead emails before database insertion.

### 5. High-Volume UI Pipeline
* **Files**: [index.html](file:///c:/Users/daved/Desktop/Claude%20CoWork/Ad%20Agency%20Autopilot/index.html) & [app.js](file:///c:/Users/daved/Desktop/Claude%20CoWork/Ad%20Agency%20Autopilot/app.js)
* Restructured the sidebar with filter tabs/dropdowns (All, Scraped, Emailed, Hot Lead, Demo Scheduled, Requires Handoff, Opted Out, DNC), a search bar, and Prev/Next page buttons.
* The frontend now fetches paginated records from `/api/leads?stage=...&search=...&page=...` (50 leads per page) to prevent browser slowdowns.

---

## 🧪 Verification & Local Testing Tool
* **File**: [test-webhook.js](file:///C:/Users/daved/.gemini/antigravity/brain/8886eb1d-a2f3-4c35-b5bc-ea9b0aef6e21/scratch/test-webhook.js) (located in the scratch workspace)
* **Usage**: Run `node <path_to_scratch>/test-webhook.js` while the server is active to post a mock email response from a prospect. Verified that it parses, pauses autopilot campaigns, and triggers the AI responder.

---

## 🚀 Next Steps (What needs to be done next)

1. **Verify DNS & Domain**:
   * Add Mailgun TXT (SPF/DKIM), MX, and CNAME records to **Cloudflare** for your sending domain (e.g. `mg.yourdomain.com`).
2. **Set Up Inbound Mail Routing**:
   * Create a Catch-All route in Mailgun to forward all emails to your public webhook address: `https://<your-server-ip-or-domain>/api/webhooks/inbound-email`.
3. **Populate Environment Variables**:
   * Add these keys to the [.env](file:///c:/Users/daved/Desktop/Claude%20CoWork/Ad%20Agency%20Autopilot/.env) file:
     ```ini
     MAILGUN_API_KEY=your_mailgun_key
     MAILGUN_DOMAIN=mg.yourdomain.com
     MAILGUN_FROM_EMAIL=Sales Agent <sales@mg.yourdomain.com>
     ```
4. **Scraper Testing**:
   * Start the server (`npm run dev`) and test search queries like *"Realtors in Denver"*, *"Plumbers in Tampa"*, or *"Roofing companies in Dallas"* to verify that real contact details are harvested.
5. **Live Verification**:
   * Run the test script `node test-webhook.js` to observe the automated reply loop and database logging in action.

---

## Production Hosting Update - 2026-06-30

* **Public URL**: `https://agents.fluffysbaitco.com/`
* **Preferred branded URL**: `https://agents.realestatecrmpro.com/`
* **Cloudflare zone**: `fluffysbaitco.com`
* **Cloudflare app tunnel update**: Tunnel ingress now accepts both `agents.realestatecrmpro.com` and `agents.fluffysbaitco.com`.
* **Pending DNS change**: Add/replace the Cloudflare DNS record in the `realestatecrmpro.com` zone:
  * Type: `CNAME`
  * Name: `agents`
  * Target: `34ca8df5-6438-4148-922b-75b3f23f04d6.cfargotunnel.com`
  * Proxy status: Proxied
  * TTL: Auto
* **Do not modify**: `fluffysbait.com`, the separate ClaimPilot project on the VPS, or the existing Real Estate CRM Pro Mailgun/product email domain.
* **VPS path**: `/opt/ad-agency-autopilot`
* **Runtime**: Separate Docker Compose project with:
  * `ad-agency-autopilot` serving the Node/Express app on VPS loopback `127.0.0.1:3100`.
  * `ad-agency-autopilot-tunnel` running Cloudflare Tunnel `ad-agency-autopilot-agents`.
* **Cloudflare hostname route**: `agents.fluffysbaitco.com` routes through tunnel ID `34ca8df5-6438-4148-922b-75b3f23f04d6`.
* **Local deployment files**:
  * `Dockerfile`
  * `docker-compose.yml`
  * `docker-compose.tunnel.yml`
  * `.dockerignore`
* **Verification completed**:
  * VPS loopback health: `http://127.0.0.1:3100/api/app-config`
  * Public HTTPS: `https://agents.fluffysbaitco.com/`
  * Public config endpoint: `https://agents.fluffysbaitco.com/api/app-config`

## Mailgun Outreach Setup - 2026-06-30

* **Mailgun account**: Separate outreach account, not the existing Real Estate CRM Pro product Mailgun account.
* **Mailgun domain**: `outreach.realestatecrmpro.com`
* **Domain state**: Active in Mailgun.
* **Configured app sender**: `Sales at Real Estate CRM Pro <sales@outreach.realestatecrmpro.com>`
* **VPS env updated**: `/opt/ad-agency-autopilot/.env`
* **App container recreated**: `ad-agency-autopilot`
* **Inbound route created in Mailgun**:
  * Expression: `match_recipient(".*@outreach.realestatecrmpro.com")`
  * Action: `forward("https://agents.realestatecrmpro.com/api/webhooks/inbound-email")`
  * Action: `stop()`
* **Inbound parser fix**:
  * Added URL-encoded body parsing for Mailgun route webhooks.
  * Normalized display-name sender fields like `Dave <davedavisre@gmail.com>` to bare lowercase emails.
  * Verified with a simulated Mailgun form POST to `https://agents.realestatecrmpro.com/api/webhooks/inbound-email`.
* **CRM UI refresh fix**:
  * Added a lightweight 5-second poll while the browser is on `#crm`.
  * Preserves the selected lead by database ID and re-renders the selected conversation after each server refresh.
  * Fixes stale chat boxes where Mailgun replies existed in SQLite but the open browser view still showed the old in-memory lead history.
* **Lead/DNC database safeguards - 2026-07-01**:
  * All lead and DNC emails are normalized to lowercase/trimmed before storage.
  * Existing duplicate lead/DNC emails are deduped during DB initialization.
  * Added case-insensitive indexes for lead email, lead name, and DNC email.
  * Scraper skips invalid emails, DNC emails, and existing lead emails before insert.
  * Outbound Mailgun sender refuses to send to any DNC email.
  * Updating a lead to `DNC` or `Opted Out` adds the email to the permanent DNC table.
  * DNC removal API is disabled unless `ALLOW_DNC_REMOVAL=true` is intentionally set for admin recovery.
  * VPS DB backup before migration: `/opt/ad-agency-autopilot/data/backups/crm-20260701T080419Z-pre-dedupe.db`.
* **Secret handling**:
  * Local `mailgun api.txt` is excluded in `.dockerignore` and `.gitignore`.
  * Do not commit or package `mailgun api.txt`.
