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
'use strict';

import path from 'path';
import { kvGet, kvSet, kvMigrateFromJSON, kvMigrateKey } from './datadb.js';

const DATA_DIR       = path.join(process.cwd(), 'data');
const STATS_JSON     = path.join(DATA_DIR, 'bot_stats.json');
const HEARTBEAT_JSON = path.join(DATA_DIR, 'heartbeat.json');

const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000;
const DEAD_THRESHOLD_MS     = 2 * 60 * 60 * 1000;

const defaultStats = { startTime: null, totalRestarts: 0, lastHeartbeat: null };

kvMigrateFromJSON('system/bot_stats', STATS_JSON);
kvMigrateFromJSON('system/heartbeat', HEARTBEAT_JSON);
kvMigrateKey('bot_stats', 'system/bot_stats');
kvMigrateKey('heartbeat', 'system/heartbeat');

function loadStats()        { return kvGet('system/bot_stats', { ...defaultStats }); }
function saveStats(stats)   { kvSet('system/bot_stats', stats); }
function updateHeartbeat()  { kvSet('system/heartbeat', { time: Date.now() }); }
function getLastHeartbeat() { return kvGet('system/heartbeat', null)?.time ?? null; }

let heartbeatInterval = null;

export function initBotStats() {
    const stats = loadStats();
    const now   = Date.now();
    const lastHB = getLastHeartbeat();

    const timeSinceLastHB = lastHB ? (now - lastHB) : Infinity;
    const botWasDead = timeSinceLastHB > DEAD_THRESHOLD_MS;

    if (!stats.startTime || botWasDead) {
        stats.startTime     = now;
        stats.totalRestarts = 0;
        console.log(`\x1b[33m→ Stats    :\x1b[39m Fresh start`);
    } else {
        stats.totalRestarts = (stats.totalRestarts || 0) + 1;
        console.log(`\x1b[32m→ Stats    :\x1b[39m Uptime preserved ♻️`);
    }

    stats.lastHeartbeat = now;
    saveStats(stats);
    updateHeartbeat();

    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(updateHeartbeat, HEARTBEAT_INTERVAL_MS);

    return stats;
}

export function getUptime() {
    const stats = loadStats();
    return stats.startTime ? Date.now() - stats.startTime : 0;
}

export function getUptimeFormatted() {
    const uptimeMs = getUptime();
    const seconds  = Math.floor(uptimeMs / 1000);
    const minutes  = Math.floor(seconds / 60);
    const hours    = Math.floor(minutes / 60);
    const days     = Math.floor(hours / 24);
    return {
        days,
        hours:   hours % 24,
        minutes: minutes % 60,
        seconds: seconds % 60,
        formatted: `${days} days, ${hours % 24} hours, ${minutes % 60} minutes, ${seconds % 60} seconds`
    };
}

export function getBotStats() {
    return { ...loadStats(), uptime: getUptimeFormatted(), currentUptime: getUptime() };
}

export function resetUptime() {
    const stats = { startTime: Date.now(), totalRestarts: 0, lastHeartbeat: Date.now() };
    saveStats(stats);
    updateHeartbeat();
    return stats;
}

export function stopHeartbeat() {
    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
}
