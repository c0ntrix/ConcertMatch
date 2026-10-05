# Reservix integration — 5 October 2026

Reservix DE is approved in Awin: merchant 31293, publisher 3113053. Approval was shown by the operator and verified in the authenticated advertiser profile. The authorized Default feed is 73477; Awin labels its language **English**, even though most event content is German. Other programmes remain separate and unapproved unless their own evidence confirms otherwise.

## Data and revenue

`scripts/sync-reservix.ts` streams the authorized gzip/CSV feed on a GitHub runner. It keeps actual dated, geographically located concert/music offers for the coming year, excludes nonmusic categories and ticket upgrades, and validates merchant event URLs and native Awin product links. No artist names, image permissions, stock guarantees or currencies are inferred. Unconfirmed lineups remain empty; matching can use the supplied genre. Missing currency means no displayed price.

The first verified feed contains 60,831 products of all categories; the parser retains 12,009 concert offers. This count precedes the visitor's radius, date, taste and tour grouping. It is not 12,009 additional unique concerts in every search. Each selected ticket link uses the approved publisher and merchant parameters. Eligible purchases may yield a commission; no sale or payment has yet been proven. The programme overview showed a 30-day attribution window; rates, eligibility and payout timing remain governed by Awin/Reservix. Do not sum the alternative fee/basket commission descriptions.

Ticket links have a small asterisk and an adjacent commission explanation, use `rel="sponsored noopener noreferrer"`, and send no group/profile identifiers. There is no Awin MasterTag, pixel or advertising cookie on ConcertMatch. Reservix purchase options come first when an event has several ticket offers. Commission does not alter match scores or the concert ranking. Deduplication retains the original provider's verified artist metadata and both providers' purchase links; saved Ticketmaster events recheck matching Reservix offers. Multiple feed products from the same provider may legitimately describe the same performance: the importer accepts bounded validated alternate offers, while the UI shows one link per provider.

## Refresh and failure behavior

`.github/workflows/reservix.yml` runs daily at 11:20 UTC, with manual dispatch available. It uses encrypted repository secrets `RESERVIX_FEED_URL` and `RESERVIX_SYNC_TOKEN`. Only the latter is installed as a Worker secret. No Awin feed key, Cloudflare credential or import token is in committed code. Local setup/downloads are in ignored `.private/`; do not publish that directory.

The narrowly scoped machine endpoint `/api/providers/reservix/sync` authenticates the import, validates bounded 100-event batches, and activates a generation only after all expected batches and counts exist. It writes only public provider data to namespaced cache rows; it has no browser-session or group privileges. An incomplete import cannot replace the current complete catalogue. Data expires 36 hours after its import timestamp and is then excluded, preventing indefinitely stale offers. Old generations expire through the existing cache cleanup. No database migration, new paid hosting plan or Cloudflare credential in GitHub is required.

The website searches the active snapshot by dates and geographic bounding box, then checks exact straight-line radius. A request is capped at 3,000 Reservix candidates with an explicit notice. This preserves coverage bounds and lets other providers survive a Reservix failure. Saved concert data is a snapshot; visitors should verify changes and availability with the provider.

If a daily job fails, inspect its GitHub Actions log, Awin membership/feed availability, and the Worker secret. Fix and manually rerun the existing workflow, rather than creating duplicate programme applications or adding new network credentials. Never print the private feed URL or token in diagnostic output.

## Validation

Published code commits: `5502996`, `52c434c`; Worker version `0a3aa810-3331-426b-b7be-abb85a380feb`. [Import run 37308870325](https://github.com/c0ntrix/ConcertMatch/actions/runs/37308870325) succeeded and activated 121 batches with 12,009 offers, checked at 2026-10-05T12:21:04.475Z. GitHub CI also passed for both code commits.

A disposable live Hamburg search (50 km, six months, AI off) displayed Reservix offers and successfully saved one. Its native Awin link opened the matching Reservix event `e2577265`, carrying publisher campaign `3113053` and Awin attribution parameters. No order was placed, so this verifies navigation and integration rather than commission settlement.

96 logic/integration tests pass, including actual SQLite snapshot activation, rejected unauthenticated imports, incomplete uploads, geographic filtering, saved Reservix IDs, expiry, affiliate account/product validation and duplicate purchase offers. TypeScript, lint, production build and Wrangler deployment dry run pass. These checks verify the integration, not an actual commission attribution or settled sale. The first real upload exposed same-provider alternate offers that the initial strict schema rejected; the schema now validates those as well, with a regression.

Sources: [Awin link formats](https://success.awin.com/articles/en_US/Knowledge/What-does-an-affiliate-link-look-like), [Awin feed downloads](https://help.awin.com/developers/docs/downloading-feeds-using-create-a-feed), [Awin payment setup](https://success.awin.com/articles/en_US/Knowledge/What-are-the-payment-thresholds), and the authenticated approved programme/feed list. Live confirmation and release IDs are recorded in the operator's private `affiliate-application/HANDOFF.md`.
