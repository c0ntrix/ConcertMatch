# Independent Cloudflare hosting

The owner requested independent hosting. Nothing was published on ChatGPT Sites. Visitors do not need a ChatGPT or Cloudflare account.

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

The generated configuration is ignored. Repeat the preparation command after every build. The existing `.openai/hosting.json` is build-template metadata; it does not require deployment through Sites. Runtime code uses a standard Worker and a D1 binding named DB.

Before independent publication, update the privacy text to name the actual hosting provider and remove the unused OpenAI Sites reference. Configure Spotify callback URLs only if direct OAuth is enabled. Its client ID is not configured in the initial release.
