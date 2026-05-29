(function () {

function _extensionVersion() {
    try { return chrome.runtime.getManifest().version; } catch (_) { return 'unknown'; }
}

function _truncate(value, max) {
    if (value == null) return value;
    const s = String(value);
    return s.length > max ? s.slice(0, max) : s;
}

async function log({ type = 'error', message, stack = null, context = null }) {
    try {
        const getClient = globalThis.getSupabaseClient;
        if (typeof getClient !== 'function') return;
        const client = getClient();
        if (!client) return;
        let userId;
        try {
            userId = await globalThis.authModule?.getCurrentUserId?.();
        } catch (_) {
            return; // not signed in — drop the log
        }
        if (!userId) return;
        const row = {
            user_id: userId,
            error_type: _truncate(type, 100),
            message: _truncate(message ?? '', 2000),
            stack: stack ? _truncate(stack, 8000) : null,
            context: context ? _truncate(context, 500) : null,
            extension_version: _extensionVersion(),
            user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : null),
        };
        await client.from('client_errors').insert(row);
    } catch (err) {
        // Never propagate errors from the error logger itself — just log locally
        console.warn('[errorLogger] swallowed', err);
    }
}

function install(globalScope, { context = null } = {}) {
    if (!globalScope || typeof globalScope.addEventListener !== 'function') return;
    globalScope.addEventListener('error', (ev) => {
        log({
            type: 'window.error',
            message: ev?.message || (ev?.error && String(ev.error)) || 'unknown error',
            stack: ev?.error?.stack,
            context,
        });
    });
    globalScope.addEventListener('unhandledrejection', (ev) => {
        const reason = ev?.reason;
        log({
            type: 'unhandledrejection',
            message: (reason && reason.message) || (reason != null ? String(reason) : 'unknown rejection'),
            stack: reason?.stack,
            context,
        });
    });
}

const errorLogger = { log, install };

if (typeof module !== 'undefined' && module.exports) module.exports = { errorLogger };
globalThis.errorLogger = errorLogger;

})();
