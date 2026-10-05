# Search and import decisions, 2026-10-01

Fast search is the default. The optional, persisted AI switch is offered before submission and in the result filters. With AI enabled, the app keeps the loading view until the assessment finishes; it publishes one complete list. Model failures/timeouts fall back to the deterministic list with a visible notice. This avoids late score/order changes. Switching to another search invalidates stale responses.

The model receives the selected artists for each profile, not merely the deterministic result rows. Candidates come from all retrieved provider events passing real date, radius, availability and budget constraints. Their lineups are interleaved by taste evidence, provider relevance and proximity; missing genre tags do not exclude a candidate. Coverage increases from 20 to 50 artists per profile and from 180 to 360 candidate lineups, within 24 KB UTF-8. Oversized profiles are shortened evenly. The 24 KB limit bounds cost even though Scout offers a 131,000-token context; unbounded catalogue dumps are avoided. Sixteen lineups are assessed, or all if fewer are available; identical billed lineups share the assessment across verified tour dates. Exact favorites remain exact.

Llama 4 Scout 17B 16E replaces Llama 3.3 FP8 Fast using the existing Workers AI binding and no new paid plan. A generated JSON schema bounds output to 16 rows and the exact profile score count, avoiding token exhaustion on large catalogues. The prompt inspects all candidates and permits low or zero assessments when musical connections are weak; the assessment count does not force positive recommendations. Both the chat-completion and response envelopes are accepted, followed by the same strict ID and score-vector validation. Internal reasoning is never retained or shown. Caches include the model and prompt version.

## Single-result regression and return navigation

The reported Taylor Swift / Kendrick Lamar / Billie Eilish search exposed two issues: the model could return just one assessment, and the matcher treated every unassessed concert as having zero fit. Prompt and schema now request exactly sixteen candidate assessments, bounded by the number of available candidates. Incomplete answers fail validation, fall back to the ordinary search and are not cached. Recommendation cache version v7 prevents reuse of older single-assessment answers. Unassessed events retain their deterministic match; explicit low/zero AI assessments still apply. This preserves additional results without inventing a minimum number of positive musical connections.

Complete search results, metadata, recommendations, notices and diagnostics are reused in the browser for fifteen minutes. The cache belongs to the browser component, with sessionStorage persistence for up to three searches (approximately 3 MB limit); storage failures preserve in-memory reuse. A fresh authorized group response is required before restoring results. Group identity, membership, artists, genres and every preference are part of the key; names, votes and bookmarks do not trigger a new search. Changed tastes/filters invalidate reuse. Group removal and browser data deletion remove cached results. The debug view distinguishes complete-result reuse from server-side assessment reuse. Navigation through the home form and privacy page was observed to issue only one concerts request and one recommendations request in total.

## Comparison

A synthetic pair of melodic-rap profiles and twelve known/unknown candidate acts was sent to both models with the same scoring instructions on 2026-10-01:

| Model | Observed request duration | Reported neurons | Valid rows |
| --- | ---: | ---: | ---: |
| Qwen3 30B A3B FP8 | 6.33 seconds | 26.93 | 12 |
| Llama 3.3 70B FP8 Fast | 19.17 seconds | 143.01 | 12 |
| Llama 4 Scout 17B 16E | 16.48 seconds | 59.28 | 12 |

These are single comparisons, not latency guarantees or calibrated music-quality benchmarks. Scores and explanations differed; Scout was more cautious about musical fit. A later, realistic 302-lineup probe exposed Qwen returning truncated JSON and, with schema constraints, fabricated rap connections to unrelated classical/rock acts. It was therefore rejected. Scout assessed the same broad catalogue in 5.10 seconds / 181.59 neurons with a plausible Don Toliver recommendation. GPT-OSS 20B did not return within the bounded evaluation window and was not selected. The final production request is checked separately; quality still requires real-user evaluation.

[Published pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) at review: Scout $0.270/$0.850 per million input/output tokens versus Llama $0.293/$2.253. The app retains the 8,000-neuron daily ceiling. A call reserves 1,200 neurons, refunds unused capacity only from valid reported usage, and retains the full reservation on failure/unknown usage. No account quota was reset.

## Spotify

ZIPs are opened in a dedicated browser worker. Only standard music and extended Audio JSON filenames are selected, including nested directories and year/chunk suffixes. The PDF, Video files and unrelated account exports are ignored. Multiple files and years aggregate by actual playback date, not the filename; the supplied 2026 example begins in December 2025.

Default: last twelve months, top twenty by listening time. Current-year-only becomes too sparse early in a year; all-time-only lets old taste dominate. Users can choose a specific year/all-time and 10/20/30/50 artists before confirming. Tracks below thirty seconds, podcasts and audiobooks are excluded. Undated rows are only included in all-time. The top count is an editable product default, not a scientifically optimal threshold.

Import limits: 100 MB selected, 50 MB per Audio JSON, 200 MB selected uncompressed audio and 64 audio files. The archive is filtered before decompression. Cancel/close terminates the worker and drops its compact local aggregates. The supplied seven-year export was processed locally: seven audio files, 6,449 qualifying plays in the last twelve months, and twenty selected artists from 1,467 possible artists. No personal rows or artist names were added to tests or Git.

Broad genre checkboxes are removed; public catalogue enrichment already adds subgenres where available. Artist selection communicates taste more precisely. Names are hidden for solo search, optional for shared profiles, and default to short labels.

The search form uses an “Erweiterte KI-Suche” row with a subtle icon, a 44-pixel switch target, an explanation of the additional recommendations and search duration, and “Derzeit kostenlos”. Its Cloudflare disclosure appears only when enabled. The import dialog starts with the Spotify privacy-settings link and steps to request the extended history, followed by an icon and a clickable ZIP selection area. The timing note is “Die Bereitstellung kann ein paar Tage dauern.” Start, join, loading, empty-results and method copy use direct descriptions instead of slogans. Middle-dot separators are replaced with spacing, separate lines, badges or sentences, including normalization of older generated search names and catalogue descriptions.

Empty artist search offers eighteen acts, and four quick choices, drawn from [Spotify’s published 2025 Germany and global top-artist lists](https://spotify_presse.prowly.com/437960-spotify-2025-wrapped-das-sind-die-top-kunstlerinnen-songs-alben-podcasts-und-horbucher-des-jahres-in-deutschland-und-der-welt). This is an editorial snapshot, not a live ranking or personalized prediction. Free-text artist search remains available. City selection begins with major German cities and supports filtering their names; small operator-local towns are not promoted. Existing stored locations remain valid. Period presets now include nine and twelve months, within the existing one-year date limit.

## Final verification

78 automated tests, TypeScript, scoped lint, whitespace checks, production build and deployment dry run passed. New regressions cover incomplete model answers, retaining unassessed style matches, navigation persistence, TTL expiry, changed tastes/filters, disabled/corrupt/full storage and cache deletion. ZIP import in the built bundle and desktop/mobile browser checks passed. A local Wrangler integration run was interrupted on the foreign-origin request by Miniflare’s “worker restarted mid-request”; the corresponding authenticated foreign-origin write was separately confirmed to return 403 on the deployed Worker.

The deployed public workflow returned 473 live events and covered invitations, ownership, saved events, votes, export and deletion of disposable fixtures. The final three-artist regression assessed sixteen of 302 lineups in 13.13 seconds and yielded 42 grouped concert results, including ordinary style matches. Its second request reused the validated assessment without another model call. These are observed results for the current catalogue, not a minimum-count or latency guarantee. Its explanations still sometimes rely too heavily on broad genre labels and confidence can be optimistic for smaller acts; the model change is not a general musical-quality guarantee. Raw personal exports were kept local. Deployed version: 4480eee0-bf5c-4c51-8e1f-a0895f154aea.
