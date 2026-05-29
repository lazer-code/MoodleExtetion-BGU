// Auth module: Google OAuth sign-in via chrome.identity.launchWebAuthFlow,
// exchanges the returned id_token for a Supabase session via signInWithIdToken.
// Session is persisted by the Supabase client (chromeStorageAdapter).

// Load order (HTML): lib/supabase-js/supabase.js → storage-adapter.js → client.js → auth.js

// Google OAuth client ID (Web application type). OAuth client IDs are
// designed to be shipped in client code — they identify the app but do
// not grant access by themselves. The client SECRET is stored in Supabase
// dashboard only and never ships in this extension.
const GOOGLE_OAUTH_CLIENT_ID = '470173446523-bn9mqtb5n58lk4a8pq5tl2gmte8ce0uk.apps.googleusercontent.com';

// Private helpers for chrome.storage.local with proper error handling.
// Unlike chromeStorageAdapter (Supabase-shaped), these take raw keys/values.
function _storageSet(obj) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(obj, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });
}

function _storageGet(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (data) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(data);
    });
  });
}

function _storageRemove(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(key, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });
}

// Compute hex-encoded SHA-256 of a string. Used to hash the OAuth nonce
// before sending to Google — Supabase expects the id_token's nonce claim
// to be sha256(nonce_we_pass_to_signInWithIdToken), so we hash on the way
// out and let Supabase hash+compare on the way in.
async function _sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// In-memory session cache. The Supabase client persists the session via the
// chrome-storage adapter, so getSession() is "cheap" but still does a network
// round-trip to validate. We mirror the SDK's auth state in memory and refresh
// via onAuthStateChange so callers can ask `who am I?` thousands of times per
// minute (per content-script message, per repo write) without hitting the wire.
let _sessionInitialized = false;
let _sessionCache = null; // null = signed out; session object = signed in
let _authListenerWired = false;

function _wireAuthStateListener() {
  if (_authListenerWired) return;
  let supabase;
  try { supabase = getSupabaseClient(); } catch (_) { return; }
  if (!supabase || !supabase.auth || !supabase.auth.onAuthStateChange) return;
  _authListenerWired = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    _sessionCache = session || null;
    _sessionInitialized = true;
  });
}
// Wire eagerly so the cache stays fresh from the very first event.
// Safe to call before getSupabaseClient() is initialized — guarded above.
_wireAuthStateListener();

async function getCurrentSession() {
  if (_sessionInitialized) return _sessionCache;
  _wireAuthStateListener();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[auth] getSession error', error);
    return null;
  }
  _sessionCache = data.session || null;
  _sessionInitialized = true;
  return _sessionCache;
}

async function getCurrentUserId() {
  const session = await getCurrentSession();
  const id = session && session.user && session.user.id;
  if (!id) throw new Error('not signed in');
  return id;
}

async function signInWithGoogle() {
  const supabase = getSupabaseClient();

  // Build Google OAuth URL for implicit id_token flow
  const redirectUri = chrome.identity.getRedirectURL(); // https://<ext-id>.chromiumapp.org/
  console.log('[auth] OAuth redirect URL:', redirectUri);
  const nonce = crypto.randomUUID();
  // Hash nonce for Google: the id_token's nonce claim will be the hash,
  // and Supabase's signInWithIdToken hashes the nonce we pass it before
  // comparing, so we send hashed_nonce to Google and pass raw nonce to
  // Supabase. Ref: Supabase Chrome extension auth guide.
  const hashedNonce = await _sha256Hex(nonce);
  // Store nonce so we can verify after return
  await _storageSet({ _oauthNonce: nonce });

  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    response_type: 'id_token',
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    nonce: hashedNonce,
    prompt: 'select_account',
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  // Launch Google consent flow in a popup window
  const redirectResponseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          reject(new Error(chrome.runtime.lastError?.message || 'User cancelled'));
          return;
        }
        resolve(responseUrl);
      }
    );
  });

  // Response URL looks like: https://<ext-id>.chromiumapp.org/#id_token=...&...
  const fragment = new URL(redirectResponseUrl).hash.substring(1);
  const parsed = new URLSearchParams(fragment);
  const idToken = parsed.get('id_token');
  if (!idToken) throw new Error('No id_token in redirect response');

  // Sanity check the nonce round-tripped through storage. Actual replay
  // protection comes from Supabase server-side JWT verification, which
  // validates the nonce embedded in the id_token signed by Google.
  const stored = await _storageGet('_oauthNonce');
  if (stored._oauthNonce !== nonce) throw new Error('Nonce mismatch');
  await _storageRemove('_oauthNonce');

  // Exchange with Supabase
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    nonce,
  });
  if (error) throw error;

  // Defensive wipe: if the previous session crashed before signOut() ran,
  // chrome.storage may still hold a different user's cache. Detect via the
  // _lastSignedInUserId marker and wipe before any new data is written.
  const newUserId = data.user && data.user.id;
  if (newUserId) {
    try {
      const { _lastSignedInUserId: prevUserId } = await _storageGet('_lastSignedInUserId');
      if (prevUserId && prevUserId !== newUserId) {
        console.warn('[auth] previous session belonged to a different user — wiping stale cache');
        await wipeUserData();
      }
      await _storageSet({ _lastSignedInUserId: newUserId });
    } catch (err) {
      // Don't block sign-in on bookkeeping failure.
      console.error('[auth] cross-user defensive wipe failed', err);
    }
  }

  // Populate cache immediately — the onAuthStateChange listener will also
  // fire, but doing it here removes a microtask race for callers that ask
  // for the session right after sign-in.
  _sessionCache = data.session || null;
  _sessionInitialized = true;

  // Ensure profiles row exists (created lazily on first sign-in).
  // data.user is normally non-null after signInWithIdToken success, but guard
  // for edge cases where the session is created without user resolution.
  if (data.user) await ensureProfile(data.user);

  return data.session;
}

async function ensureProfile(user) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email,
  }, { onConflict: 'id' });
  if (!error) return;
  // The `profiles` table doesn't exist until Plan 2 ships the schema. Until
  // then every sign-in logs here — expected. Downgrade to a debug log so the
  // error panel doesn't light up on every sign-in. Once Plan 2 lands this
  // becomes a meaningful error signal.
  const isMissingTable =
    error.code === '42P01' || // Postgres undefined_table
    error.code === 'PGRST205' || // PostgREST schema-cache missing table
    (error.message || '').toLowerCase().includes('relation') ||
    (error.message || '').toLowerCase().includes('does not exist');
  if (isMissingTable) {
    console.debug('[auth] profiles table not available yet (expected in Plan 1)');
    return;
  }
  // Genuine unexpected error — still non-fatal but log prominently.
  console.error('[auth] ensureProfile error:', error.message || JSON.stringify(error), error);
}

async function signOut() {
  const supabase = getSupabaseClient();
  // supabase.auth.signOut() internally calls our storage adapter's removeItem
  // for the session key. Then wipeUserData() clears cache:*, syncQueue,
  // lastPullTime, and legacy per-user keys so the next user logs into a
  // clean slate. Settings (toggles, autoLogin creds) are preserved.
  await supabase.auth.signOut();
  try {
    await wipeUserData();
  } catch (err) {
    // Sign-out succeeded server-side; don't block the user on a local cleanup
    // error. Worst case: stale data lingers until next sign-in's defensive wipe.
    console.error('[auth] wipeUserData on signOut failed', err);
  }
  _sessionCache = null;
  _sessionInitialized = true;
}

/**
 * Subscribe to Supabase auth state changes.
 * @param {(session: object|null) => void} callback - invoked on SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.
 * @returns {{ data: { subscription: { unsubscribe: () => void } } }} - call .data.subscription.unsubscribe() to stop listening
 */
function onAuthStateChange(callback) {
  const supabase = getSupabaseClient();
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

globalThis.authModule = {
  getCurrentSession,
  getCurrentUserId,
  signInWithGoogle,
  signOut,
  onAuthStateChange,
};
