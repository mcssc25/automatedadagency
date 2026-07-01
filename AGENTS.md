# Project Operating Notes

## End-of-Work Documentation Rule

After every meaningful project update, update both files before the final response:

1. `MEMORY.md`
   - Keep only durable, high-signal facts a future session needs.
   - Keep it compact, roughly 80 lines or fewer.
   - Remove stale details when newer facts replace them.
   - Never store secrets, API keys, tokens, passwords, or private webhook URLs.

2. `handoff.md`
   - Record what changed, what was verified, deployment/repo status, and the next steps.
   - Keep it current rather than preserving a long historical log.
   - Mention blockers or unverified work plainly.

If code or config changes are committed, include the latest commit/repo status in `handoff.md`.

## Hard Boundaries

- Do not modify the separate ClaimPilot project.
- Do not touch `fluffysbait.com`.
- Keep this project separate from other projects that share the same VPS.
- Do not commit local secrets or runtime data such as `.env`, `mailgun api.txt`, `credentials.json`, SQLite DB files, backups, downloaded media, logs, or `node_modules`.

