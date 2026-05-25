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

const DATA_DIR  = path.join(process.cwd(), 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');

if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });

function sanitizeSender(sender) {
    return (sender || '').split('@')[0].replace(/[^0-9a-zA-Z_-]/g, '');
}

function userPath(id) {
    return path.join(USERS_DIR, id + '.json');
}

export function getUserData(sender) {
    const id = sanitizeSender(sender);
    if (!id) return {};
    try {
        const p = userPath(id);
        if (!fs.existsSync(p)) return {};
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch { return {}; }
}

export function saveUserData(sender, data) {
    const id = sanitizeSender(sender);
    if (!id) return;
    try {
        fs.writeFileSync(userPath(id), JSON.stringify(data, null, 2), 'utf-8');
    } catch {}
}

export function updateUserName(sender, name) {
    if (!sender || !name || !name.trim()) return;
    const data = getUserData(sender);
    const trimmedName = name.trim();
    let changed = false;
    if (data.name !== trimmedName) {
        data.name      = trimmedName;
        data.updatedAt = new Date().toISOString();
        changed = true;
    }
    if (!data.firstSeen) {
        data.firstSeen = new Date().toISOString();
        changed = true;
    }
    if (changed) saveUserData(sender, data);
}

export function getUserName(sender, fallback = 'Kak') {
    return getUserData(sender).name || fallback;
}

export function setUserExtra(sender, key, value) {
    const data = getUserData(sender);
    data[key] = value;
    saveUserData(sender, data);
}

export function getUserExtra(sender, key) {
    return getUserData(sender)[key];
}

export function getAllUserIds() {
    try {
        return fs.readdirSync(USERS_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));
    } catch { return []; }
}
