/**
 * BGU Spark - Portal Auto-Login
 * Copyright (c) 2025 Shay Avivi
 * All Rights Reserved - Proprietary and Confidential
 * Contact: kshayk16@gmail.com
 */

autoLogin({
    toggleKey: 'toggleState',
    usernameSelector: '#mat-input-0',
    passwordSelector: '#mat-input-1',
    idSelector: '#mat-input-2',
    formSelector: 'form',
    useRetry: true,
    useMutationObserver: true,
    retryInterval: 500,
    maxRetries: 20
});
