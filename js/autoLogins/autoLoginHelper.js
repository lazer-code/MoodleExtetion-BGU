/**
 * BGU Spark - Shared Auto-Login Helper
 * Copyright (c) 2025 Shay Avivi
 * All Rights Reserved - Proprietary and Confidential
 * Contact: kshayk16@gmail.com
 */

/**
 * Shared auto-login utility. Call with a config object:
 * @param {Object} config
 * @param {string} config.toggleKey - Storage key for the toggle (e.g. 'toggleStateGezer'). If null, always runs.
 * @param {string} config.usernameSelector - CSS selector for username field
 * @param {string} config.passwordSelector - CSS selector for password field
 * @param {string|null} config.idSelector - CSS selector for ID field (null if not needed)
 * @param {string} config.formSelector - CSS selector for the login form
 * @param {boolean} [config.useRetry=false] - Whether to retry finding fields (for SPAs)
 * @param {boolean} [config.useMutationObserver=false] - Whether to watch DOM for fields appearing
 * @param {number} [config.retryInterval=500] - Ms between retries
 * @param {number} [config.maxRetries=20] - Max number of retries
 */
function autoLogin(config) {
    function run() {
        chrome.storage.sync.get(['selectedUser', 'users'], function (data) {
            const selectedUser = data.selectedUser;
            const users = data.users || {};

            if (!selectedUser || !users[selectedUser]) {
                return;
            }

            const { password, id } = users[selectedUser];

            function fillAndSubmit() {
                const usernameField = document.querySelector(config.usernameSelector);
                const passwordField = document.querySelector(config.passwordSelector);
                const idField = config.idSelector ? document.querySelector(config.idSelector) : null;

                const hasRequiredFields = usernameField && passwordField &&
                    (!config.idSelector || idField);

                if (!hasRequiredFields) return false;

                usernameField.value = selectedUser;
                passwordField.value = password;
                if (idField && id) {
                    idField.value = id;
                }

                const loginForm = document.querySelector(config.formSelector);
                if (loginForm && !loginForm.dataset.submitted) {
                    loginForm.dataset.submitted = 'true';
                    loginForm.submit();
                }
                return true;
            }

            // Try immediately
            if (fillAndSubmit()) return;

            // Retry logic for SPAs where fields load asynchronously
            if (config.useRetry) {
                const interval = config.retryInterval || 500;
                const maxRetries = config.maxRetries || 20;
                let retries = 0;

                function tryAgain() {
                    if (!fillAndSubmit() && retries < maxRetries) {
                        retries++;
                        setTimeout(tryAgain, interval);
                    }
                }
                tryAgain();
            }

            // MutationObserver for dynamically rendered forms
            if (config.useMutationObserver) {
                const observer = new MutationObserver(function () {
                    if (fillAndSubmit()) {
                        observer.disconnect();
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
            }
        });
    }

    // If a toggle key is provided, check it first
    if (config.toggleKey) {
        chrome.storage.sync.get(config.toggleKey, function (data) {
            if (data[config.toggleKey]) {
                run();
            }
        });
    } else {
        run();
    }
}
