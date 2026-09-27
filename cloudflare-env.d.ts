declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    TICKETMASTER_API_KEY?: string;
    SPOTIFY_CLIENT_ID?: string;
    SPOTIFY_REDIRECT_URI?: string;
    APP_ORIGIN?: string;
  }
}
