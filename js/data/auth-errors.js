// Maps a thrown error from the sign-in flow to a stable code + a Hebrew
// message we can show in the popup UI. The popup currently strands
// users on the sign-in screen with no clue what went wrong; this
// gives them an actionable hint instead.

(function () {

const HEBREW = {
  user_cancelled: 'ההתחברות בוטלה. נסה שוב כשתהיה מוכן.',
  popup_dismissed: 'חלון ההתחברות נסגר לפני שהושלם. השאר את התוסף פתוח עד סוף ההתחברות.',
  network_error: 'אין חיבור לאינטרנט. בדוק את החיבור ונסה שוב.',
  oauth_misconfig: 'שגיאה בהגדרת OAuth — דווח למפתח (kshayk16@gmail.com).',
  token_rejected: 'Google לא אישר את הזיהוי. נסה שוב או השתמש בחשבון אחר.',
  token_missing: 'לא התקבל זיהוי מ-Google. נסה שוב.',
  nonce_mismatch: 'שגיאת אבטחה: ה-nonce לא תואם. נסה שוב.',
  unknown: 'התחברות נכשלה',
};

function _msg(err) {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  return String(err.message || err);
}

function categorizeAuthError(err) {
  const raw = _msg(err);
  const lower = raw.toLowerCase();

  if (/user cancelled|user_cancelled|did not approve|access_denied/i.test(raw)) {
    return { code: 'user_cancelled', hebrew: HEBREW.user_cancelled };
  }
  if (/popup.*(closed|dismissed|blocked)/i.test(raw)) {
    return { code: 'popup_dismissed', hebrew: HEBREW.popup_dismissed };
  }
  if (/failed to fetch|network ?error|err_internet|networkerror/i.test(raw)) {
    return { code: 'network_error', hebrew: HEBREW.network_error };
  }
  if (/redirect_uri_mismatch|redirect uri/i.test(raw)) {
    return { code: 'oauth_misconfig', hebrew: HEBREW.oauth_misconfig };
  }
  if (/no id_token/i.test(raw)) {
    return { code: 'token_missing', hebrew: HEBREW.token_missing };
  }
  if (/nonce/i.test(raw)) {
    return { code: 'nonce_mismatch', hebrew: HEBREW.nonce_mismatch };
  }
  if (/invalid (id_)?token|jwt|signature|aud(ience)? mismatch/i.test(raw)) {
    return { code: 'token_rejected', hebrew: HEBREW.token_rejected };
  }
  return {
    code: 'unknown',
    hebrew: raw ? `${HEBREW.unknown}: ${raw}` : HEBREW.unknown,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { categorizeAuthError };
}
globalThis.categorizeAuthError = categorizeAuthError;

})();
