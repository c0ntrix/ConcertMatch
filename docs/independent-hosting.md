# Independent Cloudflare hosting

ConcertMatch runs on Cloudflare Workers in the operator's own account. Visitors can use it without an account.

The deployment requires access to the operator's own Cloudflare account. Do not use another person's account or create paid resources without authorization.

1. Run `npx wrangler login` and let the operator finish the browser authorization.
2. Run `npx wrangler whoami` and select the operator's account.
3. Create a D1 database with `npx wrangler d1 create concertmatch`.
4. Build with `npm run build`.
5. Run `node scripts/prepare-cloudflare.mjs ACCOUNT_ID D1_DATABASE_ID https://PUBLIC_ORIGIN` using the exact returned IDs and the actual workers.dev or custom-domain origin.
6. Apply schema with `npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.json`.
7. Set the Ticketmaster key using `npx wrangler secret put TICKETMASTER_API_KEY --config dist/server/wrangler.json`. Supply the value over stdin, never in arguments or Git.
8. Deploy with `npx wrangler deploy --config dist/server/wrangler.json`.
9. Verify the returned public URL, group creation, event search and persisted data.

The generated configuration is ignored. Repeat the preparation command after every build. Runtime code uses a standard Worker, a D1 binding named DB and an AI binding named AI. Preparation adds the AI binding; local development deliberately omits it and uses the genre fallback. Regenerate binding types with the project-local Wrangler after configuration changes.

The privacy text names Cloudflare as the hosting provider. Configure Spotify callback URLs only if direct OAuth is enabled. Its client ID is not configured in the initial release.

Workers AI recommendations have an app-side daily ceiling of 8,000 reserved neurons, with a conservative usage refund when the provider reports usage. Cloudflare currently includes 10,000 neurons daily on its free plan; other usage in the same account shares that allowance. No plan upgrade is performed by the app. Cached assessments last 24 hours and are removed with profile/group deletion.
