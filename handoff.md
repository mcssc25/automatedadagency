# Handoff

Last updated: 2026-07-06

## Current Repo & Deploy Status

- **Branch**: `main`
- **Modified Files**:
  - `db.js`: Created `roster_scraping_queue` table, index, and database helper functions.
  - `server.js`: Added email de-obfuscation algorithms (Cloudflare XOR & WordPress replacement decoders), Phase 1 Roster Indexer, Phase 2 Batch Harvester, and a manual harvest API route (`POST /api/lead-intelligence/run-batch-harvest`).
  - `index.html`: Added a new queue status card to the Lead Intelligence stats dashboard and a manual "Harvest Batch" button to the Agent Roster panel.
  - `app.js`: Prefilled queue metrics in the UI, bound click handler for the manual batch harvest, and handled dashboard console log updates.

---

## Latest Changes: Programmatic Two-Phase Agent Roster Scraper

1. **Phase 1: Roster Indexing (Deterministic & Fast)**
   - Extracts agent profile links from index pages.
   - Inserts profile URLs and names into `roster_scraping_queue` with status `'Pending'`.
   - Prevents duplicate index tasks using database constraints.

2. **Phase 2: Batch Harvesting (Safe & Programmatic)**
   - Coordinator fetches a small batch of `'Pending'` profile pages from the SQLite queue.
   - Visits each profile page individually with a safe delay (2 seconds).
   - Programmatically decodes email addresses obfuscated via WordPress plugins or Cloudflare's XOR-based `__cf_email__`.
   - Extracts cell phones via regex and upserts successfully enriched agents directly into `roster_contacts`.

---

## Verification

- **Syntax Checks**:
  - Passed: `node -c server.js`
  - Passed: `node -c db.js`
  - Passed: `node -c app.js`
- **Functional DB Tests**:
  - Executed `scratch/test_db_migration.js` to initialize the SQLite database schema and run insert, query, update, and clean operations successfully on `crm.db`. All tests passed.

---

## Next Steps

1. **Deploy to Production Hetzner VPS**:
   - Backup production directory under `/opt/ad-agency-autopilot/data/backups/deploy-<timestamp>`.
   - Deploy modified files (`server.js`, `db.js`, `app.js`, `index.html`).
   - Rebuild/restart only `ad-agency-autopilot` container.
2. **Post-Deployment Smoke Test**:
   - Access `https://agents.realestatecrmpro.com/`.
   - Verify the "Harvesting Queue" card is rendered on the dashboard.
   - Click "Harvest Batch" to trigger a manual Phase 2 harvest run and verify output in the activity logs.
