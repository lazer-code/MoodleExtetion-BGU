(function () {

// Supabase client singleton. Used from popup scripts, content scripts,
// and the service worker. Import order (HTML/importScripts):
//   1) lib/supabase-js/supabase.js  (exposes global `supabase`)
//   2) js/data/storage-adapter.js   (exposes `chromeStorageAdapter`)
//   3) js/data/client.js            (this file)

// The anon key is intentionally public: it's a rate-limited, RLS-protected
// key meant to ship to clients. Database safety comes from Row Level Security
// policies, not from hiding this value. Do NOT commit the service_role key —
// that one bypasses RLS and must only live in the Supabase dashboard /
// Edge Functions. The `sb_publishable_*` prefix is the newer Supabase key
// format (successor to JWT anon keys); both work with supabase-js.
const SUPABASE_URL = 'https://solfcrulcrrbiabjfwac.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_13ywLqq7op3dcj76elN5sg_AFu3zVCQ';

let _client = null;

function getSupabaseClient() {
  if (_client) return _client;

  if (!globalThis.supabase || !globalThis.supabase.createClient) {
    throw new Error('supabase-js UMD bundle not loaded');
  }
  if (!globalThis.chromeStorageAdapter) {
    throw new Error('chromeStorageAdapter not loaded');
  }

  _client = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: globalThis.chromeStorageAdapter,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
  return _client;
}

globalThis.getSupabaseClient = getSupabaseClient;

})();
