'use strict';

/**
 * Shutdown handler — matikan bot sepenuhnya
 * Hanya bisa dipanggil oleh Owner
 */

function shutdownBot(delay = 2000) {
    setTimeout(() => {
        process.exit(0);
    }, delay);
}

module.exports = { shutdownBot };
