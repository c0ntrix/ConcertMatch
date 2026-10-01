# AI search diagnostics — 2026-10-01

The production fallback logged at 11:03 UTC was a Zod `too_big` error on `recommendations`: the model returned more than the requested 16 assessments. The app-side budget was 749 / 8,000 at diagnosis, so budget exhaustion was not the cause.

A subsequent disposable solo-profile check exposed another formatting failure: the model copied the two-person score-vector example despite receiving only one profile. The system example and explicit score-count instruction now follow the actual profile count. Incorrect vectors remain rejected, with an explanatory debug error.

All returned rows are validated before keeping the strongest 16 by group fairness. Unknown or duplicate candidate IDs and malformed scores still fail. The results footer explains the provisional-to-AI ranking change and exposes a collapsed debug panel. The ordinary fallback notice is “Erweiterte KI-Suche ist momentan deaktiviert”. Successful raw responses and usage are retained within the existing 24-hour group cache; older row-only entries still work and are labelled as validated cached output.

Production version: `3bbcfd66-ee5a-450a-aebf-005876020bd8`, https://concertmatch.ticore.workers.dev.

Verified: 54 logic/orchestration tests, TypeScript, scoped lint, production build, local browser fallback/debug display, and a live solo-profile check with 180 candidates / 16 assessments. The repeat call reused identical raw output and recommendations from cache. Unauthorized access returned 404. The test group and its cache were deleted. App budget after the live check: 1,353 / 8,000; this is the app estimate rather than the provider-account balance.

The release was built from the prior committed UI plus the AI changes in an isolated checkout, because another chat was concurrently changing the main checkout's UI. The AI edits are also present in the main checkout. Keep them when releasing that UI. The standalone release is saved on branch `codex/ai-search-debug` in `../ai-debug-release`. No LLM hosting migration or paid plan change was performed.

Repeat the bounded live check with `node tests/ai-diagnostics-smoke.mjs https://concertmatch.ticore.workers.dev`. It creates and removes only its disposable test group, uses one model inference, then checks cache reuse. Its detailed output remains in ignored `.wrangler/ai-smoke-result.json`.
