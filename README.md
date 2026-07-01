# Automated Ad Agency

Autonomous marketing and sales CRM dashboard for Real Estate CRM Pro outreach.

## Runtime

- Node.js 24+
- Express
- Native `node:sqlite`
- Mailgun for outbound/inbound email
- Gemini for AI generation and lead scraping
- Cloudflare Tunnel for production hosting

## Local Setup

```powershell
npm install
Copy-Item .env.example .env
```

Fill in `.env`, then run:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

## Production

Current production app path on the VPS:

```text
/opt/ad-agency-autopilot
```

Current branded URL:

```text
https://agents.realestatecrmpro.com
```

Production runs as a separate Docker Compose project and Cloudflare Tunnel. It does not modify the ClaimPilot project on the same VPS.

## Secrets And Runtime Data

These are intentionally not committed:

- `.env`
- `mailgun api.txt`
- `credentials.json`
- `data/crm.db`
- generated files in `downloads/`
- logs

Use `.env.example` and `credentials.example.json` as templates.

## Lead/DNC Safeguards

- Lead emails and DNC emails are normalized lowercase before storage.
- SQLite enforces case-insensitive uniqueness on lead emails and DNC emails.
- Scraper skips invalid, duplicate, and DNC emails.
- Outbound Mailgun sends refuse DNC recipients.
- Unsubscribes and `Opted Out`/`DNC` lead updates permanently add the email to the DNC table.
- DNC removal is disabled unless `ALLOW_DNC_REMOVAL=true` is deliberately set for admin recovery.
