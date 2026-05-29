if (typeof errorLogger !== 'undefined') {
    errorLogger.install(window, { context: 'options' });
}

function resolveThemeMode(mode) {
    if (mode === 'dark') return 'dark';
    if (mode === 'light') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyOptionsTheme(mode) {
    const resolved = resolveThemeMode(mode);
    document.body.classList.toggle('theme-dark', resolved === 'dark');
    document.body.classList.toggle('theme-light', resolved !== 'dark');
}

function initOptionsTheme() {
    chrome.storage.sync.get('themeMode', function(data) {
        applyOptionsTheme(data.themeMode || 'system');
    });

    chrome.storage.onChanged.addListener(function(changes, area) {
        if (area === 'sync' && changes.themeMode) {
            applyOptionsTheme(changes.themeMode.newValue || 'system');
        }
    });

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', function() {
        chrome.storage.sync.get('themeMode', function(data) {
            if ((data.themeMode || 'system') === 'system') {
                applyOptionsTheme('system');
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initOptionsTheme();
    const userForm = document.getElementById('userForm');
    const saveButton = document.getElementById('saveButton');
    const saveUserButton = document.getElementById('saveUserButton');
    const userList = document.getElementById('userList');

    // Load users from storage and populate the user list
    function loadUsers() {
        chrome.storage.sync.get(['users', 'selectedUser'], function(data) {
            const users = data.users || {};
            const selectedUser = data.selectedUser || '';
            userList.innerHTML = ''; // Clear existing user blocks

            for (const username in users) {

                const buttonDivWrapper = document.createElement('div');

                const user = users[username];
                const userBlock = document.createElement('div');
                userBlock.className = 'user-block';
                userBlock.dataset.username = username;

                const usernameDisplay = document.createElement('span');
                usernameDisplay.textContent = username;
                userBlock.appendChild(usernameDisplay);

                const usernameInput = document.createElement('input');
                usernameInput.type = 'text';
                usernameInput.value = username;
                usernameInput.style.display = 'none';
                userBlock.appendChild(usernameInput);

                const passwordInput = document.createElement('input');
                passwordInput.type = 'text';
                passwordInput.value = user.password;
                passwordInput.style.display = 'none';
                userBlock.appendChild(passwordInput);

                const idInput = document.createElement('input');
                idInput.type = 'text';
                idInput.value = user.id;
                idInput.style.display = 'none';
                userBlock.appendChild(idInput);

                if (username === selectedUser) {
                    userBlock.classList.add('selected');
                    fillForm(username, user.password, user.id); // Fill the form with the selected user's credentials
                }

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'מחק';
                deleteButton.className = 'delete-user-button';
                deleteButton.addEventListener('click', function(event) {
                    event.stopPropagation(); // Prevent triggering the user block click event
                    deleteUser(username);
                });
                buttonDivWrapper.appendChild(deleteButton);
                

                const editButton = document.createElement('button');
                editButton.textContent = 'עריכה';
                editButton.className = 'edit-user-button';
                editButton.addEventListener('click', function(event) {
                    event.stopPropagation(); // Prevent triggering the user block click event
                    if (editButton.textContent === 'עריכה') {
                        usernameDisplay.style.display = 'none';
                        usernameInput.style.display = 'inline-block';
                        passwordInput.style.display = 'inline-block';
                        idInput.style.display = 'inline-block';
                        editButton.textContent = 'שמירה';
                    } else {
                        saveUserEdits(username, usernameInput.value, passwordInput.value, idInput.value);
                        usernameDisplay.textContent = usernameInput.value;
                        usernameDisplay.style.display = 'inline-block';
                        usernameInput.style.display = 'none';
                        passwordInput.style.display = 'none';
                        idInput.style.display = 'none';
                        editButton.textContent = 'עריכה';
                    }
                });
                buttonDivWrapper.appendChild(editButton);

                userBlock.appendChild(buttonDivWrapper);

                // Prevent input fields from triggering the user block click event
                usernameInput.addEventListener('click', function(event) {
                    event.stopPropagation();
                });
                passwordInput.addEventListener('click', function(event) {
                    event.stopPropagation();
                });
                idInput.addEventListener('click', function(event) {
                    event.stopPropagation();
                });

                userBlock.addEventListener('click', function() {
                    fillFormAndSave(username, user.password, user.id);
                });

                userList.appendChild(userBlock);
            }
        });
    }

    // Save user to storage with validation
    saveUserButton.addEventListener('click', function() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const id = document.getElementById('id').value.trim();

        // Validation check for empty inputs
        if (!username || !password || !id) {
            alert('שם משתמש, סיסמה ותעודת זהות אינם יכולים להיות ריקים');
            return; // Prevent further execution if inputs are empty
        }

        chrome.storage.sync.get('users', function(data) {
            const users = data.users || {};
            users[username] = { password: password, id: id };

            chrome.storage.sync.set({ users: users }, function() {
                loadUsers(); // Reload user list
            });
        });
        saveButton.click();
    });

    // Save selected user for auto-login
    saveButton.addEventListener('click', function() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const id = document.getElementById('id').value.trim();

        // Validation check for empty inputs
        if (!username || !password || !id) {
            alert('Username, password, and ID cannot be empty.');
            return; // Prevent further execution if inputs are empty
        }

        // Clear login error state
        chrome.storage.sync.set({ selectedUser: username, loginError: false }, function() {
        });

        // Also save the credentials to users list
        chrome.storage.sync.get('users', function(data) {
            const users = data.users || {};
            users[username] = { password: password, id: id };
            chrome.storage.sync.set({ users: users }, function() {
                loadUsers(); // Reload user list
            });
        });
    });

    // Delete user from storage
    function deleteUser(username) {
        chrome.storage.sync.get('users', function(data) {
            const users = data.users || {};
            if (username in users) {
                delete users[username];
                chrome.storage.sync.set({ users: users }, function() {
                    loadUsers(); // Reload user list
                });
            }
        });
    }

    // Save user edits to storage
    function saveUserEdits(oldUsername, newUsername, newPassword, newId) {
        chrome.storage.sync.get('users', function(data) {
            const users = data.users || {};
            if (users[oldUsername]) {
                delete users[oldUsername];
                users[newUsername] = { password: newPassword, id: newId };
                chrome.storage.sync.set({ users: users }, function() {
                    loadUsers(); // Reload user list
                });
            }
        });
    }

    // Fill the form with the user's credentials
    function fillForm(username, password, id) {
        document.getElementById('username').value = username;
        document.getElementById('password').value = password;
        document.getElementById('id').value = id;
    }

    // Fill the form with the user's credentials and save
    function fillFormAndSave(username, password, id) {
        fillForm(username, password, id);
        // Trigger the save button click to save as the selected user
        saveButton.click();
    }

    // Load users on page load
    loadUsers();

    // =============================================
    // Preferences: Toggles & Notification Settings
    // =============================================

    // Gezer auto-login toggle
    const toggleGezer = document.getElementById('toggle-switch-gezer');
    if (toggleGezer) {
        chrome.storage.sync.get('toggleStateGezer', function(data) {
            toggleGezer.checked = data.toggleStateGezer || false;
        });
        toggleGezer.addEventListener('change', function() {
            chrome.storage.sync.set({ toggleStateGezer: toggleGezer.checked });
        });
    }

    // GPT Math RTL toggle
    const toggleGptMath = document.getElementById('toggle-switch-gpt-math');
    if (toggleGptMath) {
        chrome.storage.sync.get('toggleStateGptMath', function(data) {
            toggleGptMath.checked = data.toggleStateGptMath || false;
        });
        toggleGptMath.addEventListener('change', function() {
            chrome.storage.sync.set({ toggleStateGptMath: toggleGptMath.checked });
        });
    }

    // Theme mode select
    const themeModeSelect = document.getElementById('theme-mode');
    if (themeModeSelect) {
        chrome.storage.sync.get('themeMode', function(data) {
            themeModeSelect.value = data.themeMode || 'system';
            applyOptionsTheme(themeModeSelect.value);
        });
        themeModeSelect.addEventListener('change', function() {
            const value = this.value || 'system';
            chrome.storage.sync.set({ themeMode: value });
            applyOptionsTheme(value);
        });
    }

    // Notification hours
    const notifSelect = document.getElementById('notification-hours');
    if (notifSelect) {
        chrome.storage.local.get('notificationSettings', function(data) {
            const settings = data.notificationSettings || { hoursBeforeAlert: 24 };
            notifSelect.value = String(settings.hoursBeforeAlert);
        });
        notifSelect.addEventListener('change', function() {
            chrome.storage.local.set({
                notificationSettings: { hoursBeforeAlert: parseInt(this.value, 10) }
            });
        });
    }

    // Test notification button
    const testNotifBtn = document.getElementById('test-notification');
    if (testNotifBtn) {
        testNotifBtn.addEventListener('click', function() {
            chrome.notifications.create('test-notification', {
                type: 'basic',
                iconUrl: chrome.runtime.getURL('images/icon128.png'),
                title: 'BGU Spark - בדיקת התראות',
                message: 'ההתראות עובדות! 🎉',
                priority: 2
            }, function(notifId) {
                if (chrome.runtime.lastError) {
                    testNotifBtn.textContent = 'שגיאה ❌';
                    testNotifBtn.style.background = '#dc2626';
                } else {
                    testNotifBtn.textContent = 'נשלח ✓';
                    testNotifBtn.style.background = '#16a34a';
                }
                setTimeout(function() {
                    testNotifBtn.innerHTML = '<i class="fa fa-bell"></i> בדיקה';
                    testNotifBtn.style.background = '';
                }, 2000);
            });
        });
    }
});

// =============================================
// Account section: show current user and sign out
// =============================================
(async function initAccountSection() {
    const section = document.getElementById('account-section');
    const emailEl = document.getElementById('account-email');
    const signoutBtn = document.getElementById('signout-btn');
    if (!section || !emailEl || !signoutBtn) {
        console.warn('[options] account section elements missing');
        return;
    }

    // Attach the click handler FIRST, before anything that could throw.
    // Previously this was after session.user.email access, so if the session
    // lacked .user for any reason the handler was never bound and the button
    // looked dead.
    signoutBtn.addEventListener('click', async () => {
        console.log('[options] signout clicked');
        if (!confirm('האם אתה בטוח שברצונך להתנתק?')) return;
        signoutBtn.disabled = true;
        try {
            await authModule.signOut();
            alert('התנתקת בהצלחה');
            window.location.reload();
        } catch (err) {
            console.error('[options] signOut error', err);
            alert('שגיאה בהתנתקות: ' + (err?.message || err));
            signoutBtn.disabled = false;
        }
    });

    // Then resolve the session and reveal the section.
    let session;
    try {
        session = await authModule.getCurrentSession();
    } catch (err) {
        console.error('[options] getCurrentSession error', err);
        section.hidden = true;
        return;
    }

    if (!session) {
        section.hidden = true;
        return;
    }

    section.hidden = false;
    emailEl.textContent = session?.user?.email || '—';
})();
