// Charge settings that live in the repo. Nothing secret goes here.
const CHARGE_CONFIG = {
  // Your Strava app (the same one Overlay Studio uses). The Client ID is public.
  stravaClientId: '248261',
  // Your Cloudflare Worker that holds the Client Secret (POST /exchange and /refresh).
  tokenProxy: 'https://strava-proxy.nomtron.workers.dev',
};
