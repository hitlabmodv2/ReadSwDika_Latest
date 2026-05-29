'use strict';

/**
 * ─────────────────────────────────────
 *  Shutdown & Restart Handler
 *  Hanya bisa dipanggil oleh Owner
 * ─────────────────────────────────────
 *
 *  shutdownBot(delay)
 *    → Matikan bot sepenuhnya (process.exit 0)
 *    → Command: .mati / .shutdown / .matiin
 *
 *  restartBot(delay)
 *    → Restart bot via PM2 autorestart (process.exit 1)
 *    → Command: .restart / .rebot / .rb
 * ─────────────────────────────────────
 */

/**
 * Matikan bot sepenuhnya.
 * PM2 TIDAK akan restart karena exit code 0.
 * @param {number} delay - delay dalam ms sebelum shutdown (default 2000)
 */
function shutdownBot(delay = 2000) {
    setTimeout(() => {
        process.exit(0);
    }, delay);
}

/**
 * Restart bot secara otomatis via PM2.
 * PM2 akan restart karena exit code 1 (non-zero).
 * @param {number} delay - delay dalam ms sebelum restart (default 2000)
 */
function restartBot(delay = 2000) {
    setTimeout(() => {
        process.exit(1);
    }, delay);
}

module.exports = { shutdownBot, restartBot };
