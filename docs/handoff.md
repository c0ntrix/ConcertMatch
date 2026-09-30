# Release handoff

Live: https://concertmatch.ticore.workers.dev/
Source: https://github.com/c0ntrix/ConcertMatch

## Delivered

A minimal German-language entry for 2–8 people; editable artist profiles; a Spotify JSON listening-history importer that processes files locally; real Ticketmaster concert discovery; distance, date and price filters; explainable ranking with a strong weight on the least-matched person; suggestions for artists nobody in the group has selected; private group invitations; persistent shared shortlists and individual votes; calendar export; profile export and deletion; imprint and privacy pages.

The public site runs in the operator's Cloudflare account and visitors can use it without an account. The Ticketmaster credential is a Worker secret, excluded from Git and verified absent from build artifacts. No paid plan was enabled during setup. Workers AI uses the existing account binding, an atomic daily budget and a 24-hour group cache. If the model, its response validation or daily budget is unavailable, the UI clearly retains provisional genre results.

## Verification

- Thirty-nine logic tests cover fair scoring, artist names, genre inference, distance/date/price filters, duplicate preferences, Spotify standard/extended history and calendar output.
- Local API integration covers anonymous sessions, invalid JSON shapes, ownership, CSRF, invitation rotation, the eight-person limit, live events, shared saves, owned votes, export and deletion.
- The deployment smoke check exercises public pages, secure session cookies, group creation and persistence, another browser session joining, unauthorized access rejection, live concert search, shortlist, votes and data deletion. Its own group is removed afterward.
- The public browser flow was checked at a 390px mobile viewport: selection, results, loaded images, profile editing and a synthetic Spotify history file import. No horizontal overflow was found. Read-only WebMCP results were also verified.
- Production recommendation checks passed for electronic and pop pairs, including 500 km international discovery and repeat-cache consistency. A metal check passed earlier; a later run fell back on model validation. Bounded response normalization now has a regression test, but its latest metal rerun hit the daily app budget, so that live rerun remains unverified. Every test removes its own group.
- Prompt checks also cover pop, metal, electronic music, opposed tastes and an invented unknown act. They are smoke evaluations, not a calibrated recommendation benchmark.
- TypeScript and the production build passed. These checks establish the first public release; they are not a sustained load or real-device test.

The start form can also edit an existing selection atomically. Only owned profiles are editable; shared profiles remain visible. Saving keeps the group ID, invitations, shortlist and votes. A separate new-group action leaves existing groups available in the group picker. Provider/model caveats sit below the results rather than above them.

## Product limits

Direct Spotify OAuth is optional and hidden: no client ID is configured, and that flow has not been tested end to end. File import and manual selection work without it. Global artist search supports partial and non-Latin names, bulk entry and continuous selection. Llama 3.3 on Workers AI refines the initial genre ranking for each person using server-verified candidates. Direct favorites remain exact. Public ListenBrainz listener samples affect sorting, without a curated-artist bonus. Ticketmaster does not include every venue; discovery covers up to 1,000 km across borders, up to 800 provider-relevant events plus eight targeted favorite queries, and predefined German starting cities. Distances are straight-line. Saved concerts are snapshots, so users should confirm details with the ticket provider. Anonymous group access depends on the browser cookie.

The operator supplied the published imprint details. Add any applicable company registration, legal form or VAT details if they apply to the business.

## Deployment

Use the independent hosting guide for later releases and reuse the existing Cloudflare resources.

## Recommendation limits

The model sees up to 20 favorites per profile and 180 distinct lineups, within a 15 KB input cap, and evaluates up to 16 lineups. Names are used without participant names, session IDs or locations. Smaller candidate sets score every candidate. Unknown artists are capped at 45 points; exact favorite matches always score 100 for that person. Assessments are reused across verified dates of the same lineup. Model quality is still subject to real-user validation, especially for niche acts and mixed tastes.

## Next product validation

Try the service with 10–20 real pairs/groups and measure whether they can choose a concert together. The short market review in `market-research.md` identifies competitors and the unvalidated opportunity. Improve recommendation nuance and local venue coverage based on those sessions before adding more social features.

## Ranking correction (2026-09-30)

The deterministic fallback now combines each person’s strongest artist connection with their entire selected taste, caps peripheral subgenre tags and discounts support-act evidence. Discovery requires at least 30 points for each person. Truncated MusicBrainz name batches are split within a bounded request budget and cannot create negative cache entries; valid older positive metadata remains reusable. Plural VIP upgrades are excluded before enrichment. The redundant discovery tab is removed; unfamiliar acts retain their badge in the concert list. Same-city distances are labelled by city, other distances explicitly as air distance from the selected city centre.

The production API regression using Joji / Juice WRLD / Kendrick Lamar and Travis Scott / XXXTENTACION / Post Malone, Hamburg and 500 km, ranked Don Toliver first and J. Cole in the top five without a model call. Only the disposable test group was removed. Unit coverage includes the same profile, rock profiles, support acts, truncated metadata, plural upgrades and token-based inference accounting.

The model reports token counts; the budget now converts those at the published Llama 3.3 FP8 Fast neuron rates with 25% headroom and refunds unused reservations before output validation. Unknown/failed usage keeps its reservation. The budget resets at 00:00 UTC and is shared across visitors; cached group assessments avoid repeat inference. Today’s budget was already exhausted, so the changed model prompt and token refund have not been rerun against live inference. No quota was reset and no paid upgrade was made.
