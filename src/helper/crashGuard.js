/**
 * ───────────────────────────────
 *  Base Script : Bang Dika Ardnt
 *  Recode By   : Bang Wilykun
 *  WhatsApp    : 6289688206739
 *  Telegram    : @Wilykun1994
 * ───────────────────────────────
 *  Script ini khusus donasi/VIP
 *  Support dari kalian bikin saya
 *  makin semangat update fitur,
 *  fix bug, dan rawat script ini.
 *
 *  Dilarang menjual ulang script ini
 *  Tanpa izin resmi dari developer.
 *  Jika ketahuan = NO UPDATE / NO FIX
 *
 *  Hargai karya, gunakan dengan bijak.
 *  Terima kasih sudah support.
 * ───────────────────────────────
 */
import { logError } from '../db/errorLog.js';
import { emergencyCleanup, getDiskUsage } from './cleaner.js';

const RESTART_DELAY_MS = 5000;
const MAX_ERRORS_PER_MINUTE = 20;
const CMD_TIMEOUT_MS = 120000;

let errorCount = 0;
let errorWindowStart = Date.now();
let isRestarting = false;

function handleEnospc(err) {
    const red    = '\x1b[31m';
    const yellow = '\x1b[33m';
    const cyan   = '\x1b[36m';
    const reset  = '\x1b[39m';

    console.log('');
    console.log(`${red}════════════════════════════════════════${reset}`);
    console.log(`${red}  [DiskGuard] DISK PENUH — ENOSPC ERROR${reset}`);
    console.log(`${red}════════════════════════════════════════${reset}`);

    const disk = getDiskUsage();
    if (disk.total > 0) {
        const freeMB = (disk.free / (1024 * 1024)).toFixed(1);
        const usedGB = (disk.used / (1024 * 1024 * 1024)).toFixed(2);
        const totalGB = (disk.total / (1024 * 1024 * 1024)).toFixed(2);
        console.log(`${yellow}  Disk terpakai : ${disk.usedPercent}% (${usedGB} GB / ${totalGB} GB)${reset}`);
        console.log(`${yellow}  Sisa ruang    : ${freeMB} MB${reset}`);
    }

    console.log(`${cyan}  Membersihkan file sementara...${reset}`);
    try { emergencyCleanup(); } catch {}

    const diskAfter = getDiskUsage();
    if (diskAfter.total > 0) {
        const freeMBAfter = (diskAfter.free / (1024 * 1024)).toFixed(1);
        console.log(`${cyan}  Setelah cleanup: ${diskAfter.usedPercent}% terpakai, ${freeMBAfter} MB bebas${reset}`);
    }
    console.log(`${red}════════════════════════════════════════${reset}`);
    console.log('');
}

function isEnospc(err) {
    return err?.code === 'ENOSPC' || err?.message?.includes('ENOSPC') || err?.message?.includes('no space left');
}

function trackError() {
    const now = Date.now();
    if (now - errorWindowStart > 60000) {
        errorCount = 0;
        errorWindowStart = now;
    }
    errorCount++;
    return errorCount;
}

function cleanupClient() {
    try {
        if (global.hisokaClient) {
            global.hisokaClient.ev.removeAllListeners();
            global.hisokaClient.ws?.close();
            global.hisokaClient = null;
        }
    } catch {}
    try {
        if (global.memoryMonitor) {
            global.memoryMonitor.stop();
            global.memoryMonitor = null;
        }
    } catch {}
    try {
        if (global.cacheCleaner) {
            clearInterval(global.cacheCleaner);
            global.cacheCleaner = null;
        }
    } catch {}
}

export function setupCrashGuard(restartFn) {
    process.on('uncaughtException', (err, origin) => {
        const count = trackError();
        console.error(`\x1b[31m[CrashGuard] UncaughtException (${count} this minute):\x1b[39m`, err?.message || err);
        logError(err instanceof Error ? err : new Error(String(err)), `uncaughtException`);

        if (isEnospc(err)) {
            handleEnospc(err);
        }

        if (count >= MAX_ERRORS_PER_MINUTE) {
            console.error('\x1b[31m[CrashGuard] Too many errors, forcing restart...\x1b[39m');
            cleanupClient();
            setTimeout(() => process.exit(1), 1000);
            return;
        }

        if (restartFn && !isRestarting) {
            isRestarting = true;
            console.log(`\x1b[33m[CrashGuard] Error caught, restarting bot in ${RESTART_DELAY_MS / 1000}s...\x1b[39m`);
            cleanupClient();
            setTimeout(() => {
                isRestarting = false;
                restartFn().catch(() => {});
            }, RESTART_DELAY_MS);
        }
    });

    process.on('unhandledRejection', (reason, promise) => {
        const count = trackError();
        const msg = reason instanceof Error ? reason.message : String(reason);
        console.error(`\x1b[31m[CrashGuard] UnhandledRejection (${count} this minute):\x1b[39m`, msg);
        logError(reason instanceof Error ? reason : new Error(msg), `unhandledRejection`);

        if (isEnospc(reason)) {
            handleEnospc(reason instanceof Error ? reason : new Error(msg));
        }

        if (count >= MAX_ERRORS_PER_MINUTE) {
            console.error('\x1b[31m[CrashGuard] Too many rejections, forcing restart...\x1b[39m');
            cleanupClient();
            setTimeout(() => process.exit(1), 1000);
        }
    });

    process.on('SIGTERM', () => {
        console.log('\x1b[33m[CrashGuard] SIGTERM received, shutting down gracefully...\x1b[39m');
        cleanupClient();
        setTimeout(() => process.exit(1), 3000);
    });

    process.on('SIGINT', () => {
        console.log('\x1b[33m[CrashGuard] SIGINT received (Ctrl+C), shutting down...\x1b[39m');
        cleanupClient();
        setTimeout(() => process.exit(0), 1000);
    });

    console.log('\x1b[32m→ Guard    :\x1b[39m Crash protection aktif');
}

export async function withTimeout(promise, ms = CMD_TIMEOUT_MS, label = 'operation') {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`[CrashGuard] "${label}" timed out after ${ms / 1000}s`));
        }, ms);
    });

    try {
        const result = await Promise.race([promise, timeout]);
        return result;
    } finally {
        clearTimeout(timer);
    }
}

export async function safeRun(fn, fallback = null, label = 'task') {
    try {
        return await fn();
    } catch (err) {
        console.error(`\x1b[31m[CrashGuard] Error in "${label}":\x1b[39m`, err?.message || err);
        return fallback;
    }
}
