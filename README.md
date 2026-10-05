# ConcertMatch

[Open ConcertMatch](https://concertmatch.ticore.workers.dev/)

Find concerts for your music taste, on your own or with friends. A German-language web app for 1–8 people, built for a simple first visit without an account.

## What works

- Start with one personal profile; add friends or invite them later without losing the search or shortlist.
- Opening the homepage starts fresh. Previous searches stay available in “Meine Suchen”; explicit search links still restore their selection and shortlist.
- Global MusicBrainz artist search with partial names, keyboard selection, editable profiles and bulk list entry. Apple iTunes provides a secondary catalogue during outages.
- Spotify ZIP and standard/extended audio JSON import, processed in a browser worker. Multi-year preview with the last 12 months and 20 artists by default; editable year/all-time and 10/20/30/50 artist counts. Raw exports never leave the device.
- Live Ticketmaster concerts across borders within up to 1,000 km, date/budget filters and explainable group ranking.
- Tour dates grouped into one result, with a choice of real dates/venues; tickets, saves and votes always use the selected event.
- Private invitation links, persistent groups, shared shortlists and per-person votes.
- Return to the prefilled start form to change your selection without losing the group or shortlist; start a separate group whenever needed.
- Calendar downloads, profile export/deletion and a 90-day group lifetime.
- Optional Spotify PKCE top-artists import, hidden until configured.

The group score is **65% minimum individual score + 35% average**. A favorite scores 100. Genre inference combines the best artist-to-favorite connection (60%) with the average across the person’s whole selection (40%); peripheral tags are capped and support-act evidence is discounted. The optional Llama 4 Scout 17B 16E search on Cloudflare Workers AI assesses musical proximity for each person using verified candidate lineups. Visitors enable it before searching; complete results appear once. Inferred scores run from 0–92; uncertain knowledge is capped at 45. Public ListenBrainz audience counts for the first billed act add up to 20 sorting points. Scores are not calibrated probabilities or audio analysis.

## Local development

Node.js >=22.13, npm and Git are required.

```sh
npm ci
cp .env.example .env.local
# Add your Ticketmaster Discovery API key.
npm run db:generate # only after a schema change
npm run build
node --import ./scripts/wrangler-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_wet_plazm.sql
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
TEST_ORIGIN=http://127.0.0.1:5174 node tests/solo-flow.mjs # isolated solo-to-group check
TEST_ORIGIN=http://127.0.0.1:5174 node tests/saved-search-entry.mjs # explicit restore, no automatic reopening
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

React / Vinext on Cloudflare Workers, D1 SQLite, generated Drizzle migrations. Deploy into the operator’s own Cloudflare account using [the independent hosting guide](docs/independent-hosting.md). Visitors can use the app without an account.

- `app/`: pages, UI and API routes.
- `lib/matching.ts`: group fairness, favorite overrides, geographic filtering and bounded audience weighting.
- `lib/recommendations.ts`, `lib/ai-matching.ts`: candidate selection, validated model output, group cache, daily inference budget and genre fallback.
- `lib/music-catalog.ts`: global artist search, prefix matching and public metadata enrichment.
- `lib/history-import.ts`: browser-only history parser.
- `lib/server.ts`: session capabilities, validation, prepared database access and request limits.
- `lib/ticketmaster.ts`: provider mapping, quota protection and bounded cache.
- `db/schema.ts`, `drizzle/`: schema and immutable applied migrations.
- `tests/`: logic and API integration checks.

Anonymous browser capabilities are HttpOnly/SameSite cookies; stored values are hashed. Invitations use random 256-bit secrets stored as hashes and transported in URL fragments. Members may edit only their own profiles/votes. All writes check the request origin. There is no email-based account recovery; losing the cookie requires rejoining.

## Current limits

Ticketmaster is not a complete gig catalogue. Up to 800 provider-relevant events per area query plus up to 600 events in each of the group’s three leading music families and targeted searches for up to eight favorites, interleaved across profiles; predefined German departure cities. Nearby concerts in other countries are included. Distances are straight-line from the selected city centre, not a personal address or travel time. Same-city results show the city instead of misleading small kilometre figures. No price means an event is excluded when a budget is set. Saved event data is a snapshot: always confirm changes with the provider.

Model reasoning can be wrong, especially for niche or ambiguous names. Up to 50 favorites per person and 360 distinct candidate lineups are sent, with a 24 KB UTF-8 input cap that can reduce those counts; the model assesses up to 16 lineups. Actual event dates and availability come from Ticketmaster. No model is trained on listening data. OAuth and history-imported favorites can be manually corrected.

Fast search is the default and makes no inference request. AI search is an explicit persisted search preference. It waits for the optional assessment before publishing results, and falls back with a notice if unavailable or after a 25-second provider timeout. Its collapsed “KI-Debugging” panel shows the request status, model, duration, candidate IDs/input, raw output and reported token usage. Budget stoppages and rejected responses have distinct diagnostic statuses, while the normal fallback notice says “Die KI ist gerade nicht verfügbar”. The displayed budget is the app's estimate, not Cloudflare's account usage. Raw successful output (bounded to 24,000 characters) is kept with the existing group assessment cache for 24 hours and removed through the same profile/group deletion paths. Legacy row-only caches remain usable and are explicitly labelled as validated output rather than a raw response. If the model supplies more than 16 assessments, every row is validated before retaining the strongest 16 by group fairness; unknown IDs and incomplete score vectors still fail validation.

Expired data is purged on subsequent service requests, not by a scheduled job. D1 request limits and caching bound provider usage; the app reserves inference usage atomically within an 8,000-neuron daily ceiling (below Cloudflare's 10,000 free allowance), and falls back to genres when unavailable. The budget resets at 00:00 UTC (02:00 German summer time / 01:00 winter time). Each new assessment reserves 1,200 neurons; reported neuron usage or token counts at the published model rate (with 25% headroom) refund the unused reservation even if output validation fails. Without usage refunds this allows six calls per day; actual capacity varies by input/output length and account usage. Reusing a cached group assessment for 24 hours does not consume another model call. The allowance is shared with other Workers AI usage in the account; more traffic would benefit from further load testing and provider agreements.

See [market research](docs/market-research.md) and [handoff](docs/handoff.md).

## Live deployment

ConcertMatch is published at https://concertmatch.ticore.workers.dev/ in the operator’s own Cloudflare account. Visitors can use the app without an account. The database is D1, with a Western Europe location hint. No paid plan was activated during setup.

After an intentional release, run `node tests/deployment-smoke.mjs https://concertmatch.ticore.workers.dev` to check the public flow. This creates a uniquely named disposable group and deletes only that group afterward. This is a functional check, not a load test.
