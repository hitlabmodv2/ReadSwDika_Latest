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
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ROOT = process.cwd();
const DEBOUNCE_MS = 600;

const _handlers = {};
const _watchers = {};
const _debounceTimers = {};
const _reloadCallbacks = {};

const WATCHED_FILES = [
    // ── Handler ──────────────────────────────────
    { key: 'message',      rel: 'src/handler/message.js' },
    { key: 'antidelete',   rel: 'src/handler/antidelete.js' },
    { key: 'antitagsw',    rel: 'src/handler/antitagsw.js' },
    { key: 'event',        rel: 'src/handler/event.js' },

    // ── Helper (aman di-reload) ───────────────────
    { key: 'utils',        rel: 'src/helper/utils.js' },
    { key: 'inject',       rel: 'src/helper/inject.js' },
    { key: 'text',         rel: 'src/helper/text.js' },
    { key: 'emoji',        rel: 'src/helper/emoji.js' },
    { key: 'telegram',     rel: 'src/helper/telegram.js' },
    { key: 'phoneRegion',  rel: 'src/helper/phoneRegion.js' },
    { key: 'voCache',      rel: 'src/helper/voCache.js' },
    { key: 'cleaner',      rel: 'src/helper/cleaner.js' },
    { key: 'helperIndex',  rel: 'src/helper/index.js' },
    { key: 'socketCompat', rel: 'src/helper/socketCompat.js' },
    { key: 'aiTools',      rel: 'src/helper/aiTools.js' },
    { key: 'aiPrompt',     rel: 'src/helper/aiPrompt.js' },
    { key: 'aiReact',      rel: 'src/helper/aiReact.js' },

    // ── Database helpers ─────────────────────────
    { key: 'botStats',     rel: 'src/db/botStats.js' },
    { key: 'jsondb',       rel: 'src/db/json.js' },

    // ── SKIP (memegang state/timer aktif) ────────
    // crashGuard.js   → handle signal proses, berbahaya
    // hotReload.js    → dirinya sendiri
    // memoryMonitor.js → timer RAM aktif
    // jadibot.js      → sesi aktif user lain
];

async function loadModule(rel) {
    const abs = path.join(ROOT, rel);
    const url = pathToFileURL(abs).href + `?t=${Date.now()}`;
    try {
        const mod = await import(url);
        return mod.default ?? mod;
    } catch (err) {
        console.error(`\x1b[31m[HotReload] Gagal load '${rel}':\x1b[39m`, err.message);
        return null;
    }
}

function watchFile(rel, key) {
    const abs = path.join(ROOT, rel);

    if (_watchers[key]) {
        try { _watchers[key].close(); } catch {}
    }

    try {
        _watchers[key] = fs.watch(abs, { persistent: false }, (event) => {
            if (event !== 'change' && event !== 'rename') return;

            clearTimeout(_debounceTimers[key]);
            _debounceTimers[key] = setTimeout(async () => {
                console.log(`\x1b[36m[HotReload] Perubahan terdeteksi: ${rel}\x1b[39m`);
                const mod = await loadModule(rel);
                if (mod !== null) {
                    _handlers[key] = mod;
                    console.log(`\x1b[32m[HotReload] ✓ '${rel}' berhasil di-reload tanpa restart bot!\x1b[39m`);
                    if (typeof _reloadCallbacks[key] === 'function') {
                        try { await _reloadCallbacks[key](rel); } catch (cbErr) {
                            console.error(`\x1b[31m[HotReload] Callback error for '${key}':\x1b[39m`, cbErr.message);
                        }
                    }
                } else {
                    console.error(`\x1b[31m[HotReload] ✗ Gagal reload '${rel}', pakai versi lama.\x1b[39m`);
                }

                if (event === 'rename') {
                    watchFile(rel, key);
                }
            }, DEBOUNCE_MS);
        });
    } catch (err) {
        console.error(`\x1b[31m[HotReload] Tidak bisa watch '${rel}':\x1b[39m`, err.message);
    }
}

export async function initHotReload() {
    let ok = 0;
    let fail = 0;
    const failed = [];

    for (const { key, rel } of WATCHED_FILES) {
        const mod = await loadModule(rel);
        if (mod !== null) {
            _handlers[key] = mod;
            watchFile(rel, key);
            ok++;
        } else {
            failed.push(rel);
            fail++;
        }
    }

    if (fail === 0) {
        console.log(`\x1b[32m→ Reload   :\x1b[39m ${ok} files aktif`);
    } else {
        console.log(`\x1b[33m→ Reload   :\x1b[39m ${ok} aktif, ${fail} gagal (${failed.join(', ')})`);
    }
}

export function getHandler(key) {
    return _handlers[key];
}

export function onReload(key, callback) {
    _reloadCallbacks[key] = callback;
}

export function stopHotReload() {
    for (const key of Object.keys(_watchers)) {
        try { _watchers[key].close(); } catch {}
        delete _watchers[key];
    }
    for (const key of Object.keys(_debounceTimers)) {
        clearTimeout(_debounceTimers[key]);
        delete _debounceTimers[key];
    }
    console.log('\x1b[33m[HotReload] Semua watcher dihentikan.\x1b[39m');
}
