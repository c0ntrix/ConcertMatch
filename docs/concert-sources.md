# Concert sources and release — 2026-10-05

## Live behavior

Ticketmaster and the approved Reservix/Awin feed are active sources. See [the Reservix integration and refresh](reservix.md). Ticketmaster's Discovery API already includes multiple ticketing systems by default (Ticketmaster, Universe, Front Gate and resale); adding their names as source filters would not automatically add new coverage.

The area search used to stop after four pages / 800 events. When the provider reports more than 800, it now additionally searches up to four nonoverlapping date windows, with four pages each. This recovers previously hidden dates while respecting Ticketmaster's 1,000-item deep-paging restriction. Maximum: 20 base-search requests and up to 4,000 offers before deduplication; focused genre and favorite searches remain. Actual counts depend on the catalogue, filters and duplicates. Single-day searches and dense windows remain capped, with a visible notice. Partial failures retain available data. Shared concurrency, daily quotas and 15-minute caching apply.

Eventfrog Public API V1 is implemented but **inactive until the operator supplies an authorized `EVENTFROG_API_KEY`**. There is no Eventfrog key in local settings or the production Worker. This is not an accepted affiliate application or a promise of commission. Set the Worker secret, then run a real-provider smoke check before considering activation verified.

The adapter uses Bearer authentication, concert rubrics and descendants, geographic/date filters, public and available events, actual HTTPS ticket/event URLs, location batches and namespaced string IDs. Successful sources survive another source's failure; saved Eventfrog IDs route to that provider. Request bodies, pages, concurrency and shared quota are bounded (2.1-second minimum spacing, app ceiling 1,800/day versus provider 2,000/day). Invalid coordinates, nonconcerts, sold-out/cancelled/private events and ambiguous multiple locations are excluded. Provider images are omitted because Eventfrog forbids hotlinking. Its public schema has no verified artist lineup or currency; neither is invented. Matching therefore uses the available title/category and is less precise than sources with artist lineups. Unknown prices cannot pass an explicit EUR budget.

Cross-provider identical titles at the same date, time and venue are deduplicated when one offer lacks a lineup; known artist metadata is preferred. Different performances remain separate. Browser result keys were versioned so prior 800-event searches are not reused after this release.

## Priorities and access requirements

| Source | Fit | Current decision |
| --- | --- | --- |
| Eventfrog Public API | Useful candidate for German/Swiss local and smaller concerts; geographic search and ticket links | Adapter ready. Public API key required; can be created in the operator's Eventfrog account. Confirm commercial use terms before supplying the key. Organizer/Embed keys are unsuitable for the public catalogue. |
| Bandsintown | Strong candidate for artist-specific worldwide tour dates and ticket offers | Platform partnership approval required. Ordinary artist keys only cover one authorized artist. Do not use a made-up app ID or the artist-only access for this aggregator. |
| Songkick | Worldwide artist, location and date searches | Paid partnership/license required; no current approval for hobby projects. Request pricing before implementation; no paid license started. |
| Eventim / ADticket / Reservix via Awin | Likely valuable for German ticket coverage and actual affiliate revenue | Existing application status in the operator's external affiliate handoff remains authoritative. First obtain program approval and confirm a suitable product/event feed or API, then map it to the same concert model. An Awin account alone grants no such access. |
| Skiddle | Concert/club/festival API; candidate mainly for later UK expansion | API key required; commercial use requires written approval. Lower priority for the current German search. |

API access provides data and outgoing links; affiliate acceptance, attribution and commission terms must be established separately. No unapproved tracking parameters or guaranteed revenue were introduced.

## Primary documentation checked

- [Ticketmaster Discovery API: sources, quota and deep paging](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)
- [Eventfrog integration options](https://eventfrog.de/de/help/organizer/settings/api/api-integration.html)
- [Eventfrog API keys and quotas](https://eventfrog.de/de/help/organizer/settings/api/api-keys.html)
- [Eventfrog Public API V1 schema](https://docs.api.eventfrog.net/openapi/publicapi-v1/bundle.yaml)
- [Bandsintown platform access and artist restrictions](https://help.artists.bandsintown.com/en/articles/7053475-what-is-the-bandsintown-api)
- [Songkick licensing](https://www.songkick.com/developer)
- [Skiddle API and commercial-use approval](https://www.skiddle.com/api/)

## Verification

Unit and controlled provider orchestration tests cover date partitions, pagination limits, partial failure, event safety, long IDs, ticket links, deduplication, provider fallback, absent credentials and saved-event routing. Real Ticketmaster coverage comparison and release smoke checks are recorded below after deployment. Eventfrog tests use controlled documented fixtures; real Eventfrog access is not yet verified.

Release checks: 91 tests, TypeScript, lint, production build and deployment dry run passed. Live comparison for Berlin, 1,000 km, 2026-10-05 through 2027-10-05, the same Provinz profile and no AI: 1,772 candidates before versus 3,216 after (+81.5%). Observed times were 17.15 versus 22.23 seconds; these are individual requests with different cache states, not a speed benchmark or guaranteed minimum. Candidates precede taste ranking and tour grouping. Dense windows still show the explicit coverage-limit notice.

The wider real catalogue exposed attractions with missing names, which previously crashed normalization. Invalid attractions are now discarded, cached area data is versioned, and a regression covers the malformed row. Worker error diagnostics include only error categories and function names, avoiding raw inputs, URLs and credentials. Final production version: `1418f036-70bd-4e96-a880-1525d28198c3`, corresponding to code commit `29a6079`. Existing production D1, AI, origin and Ticketmaster secret bindings were preserved. No schema migration or paid upgrade was needed.

The final live smoke check passed public pages, secure sessions, persistent groups, invitations, isolation, 470 live concert candidates, saved events, votes, export and deletion. Only its disposable groups were deleted. Diagnostic repetitions temporarily consumed the test client's eight-per-hour creation quota; the exact increments from those tests were restored without changing the public limiter or other users' counters.
