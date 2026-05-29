const sparkLogo_v2 = `<svg width="42" height="42" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M28.6118 15.6062C28.6118 15.6062 27.3476 17.4636 24.6978 19.0357C24.6978 19.0357 26.6169 2.81681 14.1129 0C17.3165 11.7576 10.0379 15.0734 7.38475 8.86162C2.95394 14.7773 6.31813 19.9384 6.31813 19.9384C4.50131 20.2002 2.97519 18.2153 2.97519 18.2153C2.96156 18.4598 2.95394 18.706 2.95394 18.9539C2.95388 26.1591 8.79481 32 16 32C23.2052 32 29.0461 26.1591 29.0461 18.9539C29.0461 17.7965 28.8946 16.6746 28.6118 15.6062Z" fill="#FF6536"/>
<path d="M2.97513 18.2153C2.97513 18.2153 4.50125 20.2002 6.31806 19.9384C6.31806 19.9384 2.95388 14.7773 7.38469 8.86162C10.0379 15.0734 17.3164 11.7576 14.1129 0C14.7826 0.150875 15.4106 0.340437 16 0.563625V32C8.79481 32 2.95388 26.1591 2.95388 18.9539C2.95388 18.7059 2.9615 18.4598 2.97513 18.2153Z" fill="#FF421D"/>
<path d="M21.7215 26.2785C21.7215 29.4384 19.1599 32 16 32C12.8401 32 10.2785 29.4384 10.2785 26.2785C10.2785 24.5872 11.0123 23.0673 12.179 22.0199C14.3911 25.0252 17.5435 20.4664 15.0868 17.1372C15.0868 17.1372 21.7215 17.9687 21.7215 26.2785Z" fill="#FF7E36"/>
<path d="M10.2785 26.2785C10.2785 24.5872 11.0123 23.0673 12.179 22.0199C14.3911 25.0252 17.5435 20.4664 15.0868 17.1372C15.0868 17.1372 15.4473 17.1825 16 17.357V32C12.8401 32 10.2785 29.4384 10.2785 26.2785Z" fill="#FF6E1D"/>
<g clip-path="url(#clip0_126_29)">
<path d="M18.7931 26.5H21.6333C19.7019 24.7274 18.4684 23.0543 20.5597 21.8548L18.7931 21.3339C17.9992 22.0744 16.512 22.9171 18.7931 26.5Z" fill="white"/>
<path d="M14.0134 26.5H11C12.6757 25.6658 14.3246 24.8045 13.1128 21.0299L15.2255 22.5928C15.0677 23.8954 15.0563 25.1976 14.0134 26.5Z" fill="white"/>
<path d="M17.8234 26.5C15.1862 20.7664 20.8077 20.9598 20.8904 17.9497C20.9406 16.1502 19.6222 14.7832 15.5029 12C16.8778 15.8795 7.56 17.1501 15.3644 22.2455C15.4812 21.6231 15.8789 21.001 16.2648 20.3786C14.1944 19.3467 14.2276 18.6448 14.249 18.0341C14.3114 16.2546 16.4097 15.5163 16.2301 13.4326C18.7278 15.6484 18.6921 16.466 18.7105 17.3328C18.7681 20.0232 15.1488 19.0717 15.3987 26.4997H17.8234V26.5Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_126_29">
<rect width="10.6333" height="14.5" fill="white" transform="translate(11 12)"/>
</clipPath>
</defs>
</svg>

`;

function resolveThemeMode(mode) {
    if (mode === 'dark') return 'dark';
    if (mode === 'light') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyMoodleTheme(mode) {
    const resolved = resolveThemeMode(mode);
    document.documentElement.classList.toggle('bgu-dark-mode', resolved === 'dark');
    document.documentElement.classList.toggle('bgu-light-mode', resolved !== 'dark');
}

function initMoodleTheme() {
    chrome.storage.sync.get('themeMode', function(data) {
        applyMoodleTheme(data.themeMode || 'system');
    });

    chrome.storage.onChanged.addListener(function(changes, area) {
        if (area === 'sync' && changes.themeMode) {
            applyMoodleTheme(changes.themeMode.newValue || 'system');
        }
    });

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', function() {
        chrome.storage.sync.get('themeMode', function(data) {
            if ((data.themeMode || 'system') === 'system') {
                applyMoodleTheme('system');
            }
        });
    });
}



// Create loader and error message elements
function createLoader() {
    const loader = document.createElement('div');
    loader.classList.add('loading-moodle');
    loader.style.position = 'fixed';
    loader.style.top = '0';
    loader.style.left = '0';
    loader.style.right = '0';
    loader.style.bottom = '0';
    loader.style.backgroundColor = 'rgba(255, 255, 255, 1)';
    loader.style.color = '#000';
    loader.style.padding = '20px';
    loader.style.borderRadius = '10px';

    loader.style.display = 'none'; // Hide initially
    loader.style.zIndex = '9999'; // Ensure it's above other elements
    loader.innerHTML = `${sparkLogo_v2} <p>מתחבר אוטומטית למודל..</p>`;
    document.body.appendChild(loader);
}

function createErrorMessage() {
    const errorMessage = document.createElement('div');
    errorMessage.id = 'error-message';
    errorMessage.style.position = 'fixed';
    errorMessage.style.top = '10%';
    errorMessage.style.left = '50%';
    errorMessage.style.transform = 'translate(-50%, -50%)';
    errorMessage.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
    errorMessage.style.color = '#fff';
    errorMessage.style.padding = '20px';
    errorMessage.style.borderRadius = '5px';
    errorMessage.style.zIndex = '1000';
    errorMessage.style.display = 'none';
    document.body.appendChild(errorMessage);
}

// Show or hide loader
function showLoader() {
    const loader = document.querySelector('.loading-moodle');
    if (loader) loader.style.display = 'flex'; // Make sure to set display to flex or block
}

function hideLoader() {
    const loader = document.querySelector('.loading-moodle');
    if (loader) loader.style.display = 'none';
}

// Show error message
function showError(message) {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
}

// Check login status
function isLoggedIn() {
    return document.querySelector('li[data-key="myhome"]') !== null;
}

// Fill login form and trigger login
function fillLoginForm(username, password) {
    const usernameField = document.querySelector('#login_username'); // Username field selector
    const passwordField = document.querySelector('#login_password'); // Password field selector
    const loginButton = document.querySelector('#loginform .btn'); // Login button selector

    if (usernameField && passwordField && loginButton) {
        showLoader(); // Show loader when filling form
        usernameField.value = username;
        passwordField.value = password;
        setTimeout(() => {
            loginButton.click(); // Trigger the login button
        }, 500); // Slight delay to show the loader
    } else {
        showError('Could not find login fields on the page.');
    }
}

// Initialize login process
function initializeLogin() {
    if (!isLoggedIn()) {
        const currentUrl = window.location.href;
        const hash = new URL(currentUrl).hash;
        const error = document.querySelector('.alert-danger');

        if (error && currentUrl !== 'https://moodle.bgu.ac.il/moodle/login/index.php') {
            showLoader();
            chrome.storage.sync.set({ currentUrlRefferal: currentUrl });
            window.location.href = 'https://moodle.bgu.ac.il/moodle/local/mydashboard/#refferal';
        } else if (currentUrl === 'https://moodle.bgu.ac.il/moodle/login/index.php') {
            // Do nothing, user is on login page
        } else {
            if (hash === '#refferal') {
                chrome.storage.sync.get(['users', 'selectedUser', 'currentUrlRefferal'], (data) => {
                    const users = data.users || {};
                    const selectedUser = data.selectedUser;
                    const referralUrl = data.currentUrlRefferal;

                    if (selectedUser && users[selectedUser]) {
                        const { password } = users[selectedUser];
                        fillLoginForm(selectedUser, password);
                    }
                });
            } else {
                chrome.storage.sync.set({ currentUrl }, () => {
                    chrome.storage.sync.get(['users', 'selectedUser', 'currentUrl'], (data) => {
                        const users = data.users || {};
                        const selectedUser = data.selectedUser;

                        if (selectedUser && users[selectedUser]) {
                            const { password } = users[selectedUser];
                            fillLoginForm(selectedUser, password);
                        }
                    });
                });
            }
        }
    }
}

// Initialize the loader and error message
createLoader();
createErrorMessage();
initMoodleTheme();
initializeLogin();
