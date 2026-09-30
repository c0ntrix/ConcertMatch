import fs from "node:fs";

// Run after the production build to configure the operator's Cloudflare account.
const [accountId, databaseId, origin] = process.argv.slice(2);
if (!/^[a-f0-9]{32}$/.test(accountId || "") || !/^[a-f0-9-]{36}$/.test(databaseId || "")) {
  throw new Error("Usage: node scripts/prepare-cloudflare.mjs ACCOUNT_ID D1_DATABASE_ID https://PUBLIC_ORIGIN");
}
const publicOrigin = new URL(origin);
if (publicOrigin.protocol !== "https:" || publicOrigin.pathname !== "/") {
  throw new Error("Provide the HTTPS origin of your independent deployment.");
}
const file = "dist/server/wrangler.json";
const config = JSON.parse(fs.readFileSync(file, "utf8"));
config.name = "concertmatch";
config.account_id = accountId;
config.workers_dev = true;
config.d1_databases = [{ binding: "DB", database_name: "concertmatch", database_id: databaseId, migrations_dir: "../../drizzle" }];
config.vars = { APP_ORIGIN: publicOrigin.origin };
config.ai = { binding: "AI" };
config.observability = { enabled: true, traces: { enabled: true, head_sampling_rate: 0.01 } };
// API credentials are installed separately with wrangler secret put via stdin.
fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
console.log("Prepared independent Cloudflare deployment for " + publicOrigin.origin);
