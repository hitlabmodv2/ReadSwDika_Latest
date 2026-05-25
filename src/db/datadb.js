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
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const KV_DIR   = path.join(DATA_DIR, 'kv');

if (!fs.existsSync(KV_DIR)) fs.mkdirSync(KV_DIR, { recursive: true });

function kvPath(key) {
    const parts = String(key).split('/').map(p => p.replace(/[^a-zA-Z0-9_-]/g, '_'));
    const filename = parts.pop() + '.json';
    const dir = parts.length > 0 ? path.join(KV_DIR, ...parts) : KV_DIR;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, filename);
}

function kvPathFlat(key) {
    return path.join(KV_DIR, String(key).replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');
}

export function kvGet(key, fallback = null) {
    try {
        const p = kvPath(key);
        if (!fs.existsSync(p)) return fallback;
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch { return fallback; }
}

export function kvSet(key, value) {
    try {
        fs.writeFileSync(kvPath(key), JSON.stringify(value, null, 2), 'utf-8');
    } catch {}
}

export function kvMigrateFromJSON(key, jsonPath, transform = null) {
    try {
        const p = kvPath(key);
        if (fs.existsSync(p)) return;
        if (!fs.existsSync(jsonPath)) return;
        const raw  = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        const data = transform ? transform(raw) : raw;
        kvSet(key, data);
        console.log(`\x1b[32m[DataDB]\x1b[39m Migrasi ${path.basename(jsonPath)} → kv/${key}.json`);
    } catch {}
}

export function kvMigrateKey(oldKey, newKey) {
    try {
        const newPath = kvPath(newKey);
        if (fs.existsSync(newPath)) return;
        const oldPath = kvPathFlat(oldKey);
        if (!fs.existsSync(oldPath)) return;
        const data = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
        kvSet(newKey, data);
        fs.unlinkSync(oldPath);
        console.log(`\x1b[32m[DataDB]\x1b[39m Pindah key: kv/${oldKey}.json → kv/${newKey}.json`);
    } catch {}
}
