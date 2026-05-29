// Guards the popup UI: if no Supabase session, show the sign-in overlay
// and hide the rest of the extension. Runs as early as possible on popup load.

(function () {
  const overlay = () => document.getElementById('signin-overlay');
  const errorBox = () => document.getElementById('signin-error');
  const body = () => document.body;

  function showSignIn(errorMsg) {
    overlay().hidden = false;
    body().classList.add('signin-active');
    if (errorMsg) {
      _renderError({ hebrew: errorMsg, code: 'unknown', raw: errorMsg });
    } else {
      errorBox().hidden = true;
      errorBox().innerHTML = '';
    }
  }

  function hideSignIn() {
    overlay().hidden = true;
    body().classList.remove('signin-active');
  }

  // Build the error block: a Hebrew message + a "report this" mailto link.
  // Users hit a sign-in failure with no telemetry today (error-logger needs
  // a user id), so the mailto is the only feedback channel back to the dev.
  function _renderError({ hebrew, code, raw }) {
    const box = errorBox();
    box.hidden = false;
    box.innerHTML = '';

    const msgEl = document.createElement('div');
    msgEl.className = 'signin-error-msg';
    msgEl.textContent = hebrew;
    box.appendChild(msgEl);

    // Skip the mailto for user-cancelled — that's not a bug to report.
    if (code !== 'user_cancelled') {
      const mailto = _buildMailto({ code, raw });
      const link = document.createElement('a');
      link.href = mailto;
      link.target = '_blank';
      link.rel = 'noopener';
      link.className = 'signin-error-report';
      link.textContent = 'דווח על השגיאה למפתח';
      box.appendChild(link);
    }
  }

  function _buildMailto({ code, raw }) {
    let version = 'unknown';
    try { version = chrome.runtime.getManifest().version; } catch (_) {}
    const subject = `BGU Spark - שגיאת התחברות (${code || 'unknown'})`;
    const body = [
      'היי,',
      '',
      'נתקלתי בשגיאה בהתחברות בתוסף BGU Spark.',
      '',
      `קוד שגיאה: ${code || 'unknown'}`,
      `הודעה: ${raw || '(ריק)'}`,
      `גרסה: ${version}`,
      `דפדפן: ${(typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown')}`,
      '',
      'תודה!',
    ].join('\n');
    return `mailto:kshayk16@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  // Ask the SW to run the OAuth flow. The SW stays alive on pending Chrome
  // API calls so the OAuth callback always lands, even if the user-action
  // closes this popup window. When the response comes back, we either reload
  // (popup still alive — common case for users who don't click the OAuth
  // window) or do nothing (popup already gone — the next open will pick up
  // the session via session-guard.init()).
  function _signInViaBackground() {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type: 'auth.signInWithGoogle' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message || 'message channel closed'));
            return;
          }
          if (!response) {
            reject(new Error('No response from background'));
            return;
          }
          if (!response.ok) {
            const e = new Error(response.error || 'sign-in failed');
            e.code = response.code;
            e.hebrew = response.hebrew;
            reject(e);
            return;
          }
          resolve(response);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async function init() {
    try {
      const session = await authModule.getCurrentSession();
      if (!session) {
        showSignIn();
        wireSignInButton();
      } else {
        hideSignIn();
      }
    } catch (err) {
      console.error('[session-guard] init error', err);
      showSignIn('שגיאה בטעינה, נסה לרענן');
      wireSignInButton();
    }


    // Watch for subsequent auth state changes (e.g., sign-out from options).
    // Registered after init() rather than at module level so it never fires
    // before the DOM is parsed.
    try {
      authModule.onAuthStateChange((session) => {
        if (!session) {
          showSignIn();
          wireSignInButton();
        } else {
          hideSignIn();
        }
      });
    } catch (err) {
      console.error('[session-guard] onAuthStateChange registration failed', err);
    }
  }

  function wireSignInButton() {
    const btn = document.getElementById('signin-google-btn');
    if (!btn || btn._wired) return;
    btn._wired = true;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.classList.add('is-loading');
      const label = btn.querySelector('.signin-google-label');
      const originalLabel = label ? label.textContent : null;
      if (label) label.textContent = 'מתחבר...';
      errorBox().hidden = true;
      errorBox().innerHTML = '';
      try {
        await _signInViaBackground();
        hideSignIn();
        // Reload so popup.js initializes with session available
        location.reload();
      } catch (err) {
        console.error('[signin] failed', err);
        const cat = (err.code && err.hebrew)
          ? { code: err.code, hebrew: err.hebrew }
          : (typeof globalThis.categorizeAuthError === 'function'
              ? globalThis.categorizeAuthError(err)
              : { code: 'unknown', hebrew: `התחברות נכשלה: ${err.message || err}` });
        _renderError({ ...cat, raw: err.message || String(err) });
        btn.disabled = false;
        btn.classList.remove('is-loading');
        if (label && originalLabel) label.textContent = originalLabel;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
