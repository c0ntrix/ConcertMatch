# ConcertMatch

Concerts your whole group can agree on. A German-language web app for 2–8 people, built for a simple first visit without an account.

## What works

- Artist selection with search, editable profiles and additional music styles.
- Spotify standard and extended listening-history JSON import, processed entirely in the browser. Up to 30 artists ranked by listening time; no raw history upload.
- Live Ticketmaster events in Germany, radius/date/budget filters and explainable group ranking.
- Private invitation links, persistent groups, shared shortlists and per-person votes.
- Calendar downloads, profile export/deletion and a 90-day group lifetime.
- Optional Spotify PKCE top-artists import, hidden until configured.

The group score is **65% minimum individual score + 35% average**. A favorite scores 100; matching genres score 45–75. These are transparent heuristics, not calibrated probabilities or audio analysis.

## Local development

Node.js >=22.13, npm and Git are required.

```sh
npm ci
cp .env.example .env.local
# Add your Ticketmaster Discovery API key.
npm run db:generate # only after a schema change
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_wet_plazm.sql
npm run dev
```

Apply each migration once. The development server prints its loopback URL, normally http://localhost:5173.

If the host's Windows npm shim incorrectly resolves npm from the working directory, invoke its installed JavaScript entry point instead:
`node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run dev`.

## Validation

```sh
npm run typecheck
npm test
npm run test:integration
npm run build
```

Integration tests require a running local server, migrated D1 and a working Ticketmaster key. They create disposable sessions/groups, check cross-member authorization and deletion, and remove their own fixtures. They refuse non-loopback origins.

## Configuration

See [.env.example](.env.example). Keep credentials out of Git. Production values live in the hosting platform's secret manager.

- `TICKETMASTER_API_KEY`: required for live discovery.
- `APP_ORIGIN`: exact public origin.
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_REDIRECT_URI`: optional. Register the exact callback URI and allowlist test users in Spotify's dashboard.

Spotify development-mode apps currently allow five authenticated users, and the app owner needs Premium. A broadly available Spotify OAuth integration needs approval; setting a client ID does not remove that restriction. No Spotify credentials were configured or end-to-end tested for this release. The local history-file importer works independently.

## Deployment and architecture

React / Vinext on Cloudflare Workers, D1 SQLite, generated Drizzle migrations. The Site identity is in `.openai/hosting.json`. Use the Sites workflow to package and publish; it applies migrations before uploading the Worker. Do not run `wrangler deploy` against platform-managed infrastructure.

- `app/`: pages, UI and API routes.
- `lib/matching.ts`: deterministic scoring and geographic filtering.
- `lib/history-import.ts`: browser-only history parser.
- `lib/server.ts`: session capabilities, validation, prepared database access and request limits.
- `lib/ticketmaster.ts`: provider mapping, quota protection and bounded cache.
- `db/schema.ts`, `drizzle/`: schema and immutable applied migrations.
- `tests/`: logic and API integration checks.

Anonymous browser capabilities are HttpOnly/SameSite cookies; stored values are hashed. Invitations use random 256-bit secrets stored as hashes and transported in URL fragments. Members may edit only their own profiles/votes. All writes check the request origin. There is no email-based account recovery; losing the cookie requires rejoining.

## Current limits

Ticketmaster is not a complete gig catalogue. Germany only; up to 800 chronologically first provider events per query; 60 predefined departure cities. Distances are straight-line, not travel time. No price means an event is excluded when a budget is set. Saved event data is a snapshot: always confirm changes with the provider.

Similarity is based on genres, so niche distinctions are imperfect. No AI model is trained on listening data. OAuth and history-imported favorites can be manually corrected.

Expired data is purged on subsequent service requests, not by a scheduled job. D1 request limits and caching bound provider usage; more traffic would benefit from further load testing and provider agreements.

See [market research](docs/market-research.md) and [handoff](docs/handoff.md).
