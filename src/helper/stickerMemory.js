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

/**
 * stickerMemory.js
 * Simpan dan ambil analisis stiker dari ai_history.json (key: sticker_memory)
 * — Bot makin cerdas setiap kali lihat stiker baru
 */

import { createHash } from 'crypto';
import { readAll, writeAll } from '../db/aiHistory.js';

// ── File helpers ──

function readMemory() {
    try {
        return readAll().sticker_memory || {};
    } catch { return {}; }
}

function writeMemory(mem) {
    try {
        const all = readAll();
        all.sticker_memory = mem;
        writeAll(all);
    } catch {}
}

/**
 * Hash buffer stiker → hex sha256 (64 karakter)
 */
export function hashSticker(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Cari stiker di memori berdasarkan hash
 * @returns {object|null} row atau null jika belum dikenal
 */
export function lookupSticker(hash) {
    const mem = readMemory();
    const row = mem[hash];
    if (!row) return null;
    return {
        ...row,
        tags: Array.isArray(row.tags) ? row.tags : [],
    };
}

/**
 * Simpan/update analisis stiker ke JSON
 */
export function saveSticker(hash, { emotion = '', category = '', description = '', tags = [] } = {}) {
    const mem = readMemory();
    const existing = mem[hash];
    const nowSec = Math.floor(Date.now() / 1000);

    if (existing) {
        mem[hash] = {
            ...existing,
            seen_count:  (existing.seen_count || 1) + 1,
            last_seen:   nowSec,
            emotion:     emotion    || existing.emotion    || '',
            category:    category   || existing.category   || '',
            description: description || existing.description || '',
            tags:        (Array.isArray(tags) && tags.length) ? tags.slice(0, 8) : (existing.tags || []),
        };
    } else {
        mem[hash] = {
            emotion:     emotion.substring(0, 100),
            category:    category.substring(0, 100),
            description: description.substring(0, 300),
            tags:        Array.isArray(tags) ? tags.slice(0, 8) : [],
            seen_count:  1,
            last_seen:   nowSec,
        };
    }
    writeMemory(mem);
}

/**
 * Hanya naikkan counter seen tanpa ubah analisis
 */
export function incrementStickerSeen(hash) {
    const mem = readMemory();
    if (!mem[hash]) return;
    mem[hash].seen_count = (mem[hash].seen_count || 1) + 1;
    mem[hash].last_seen  = Math.floor(Date.now() / 1000);
    writeMemory(mem);
}

/**
 * Statistik memori stiker
 */
export function getStickerMemoryStats() {
    try { return Object.keys(readMemory()).length; } catch { return 0; }
}

/**
 * Ambil stiker yang baru-baru ini dilihat
 */
export function getRecentStickers(limit = 10) {
    try {
        const mem = readMemory();
        return Object.entries(mem)
            .sort(([, a], [, b]) => (b.last_seen || 0) - (a.last_seen || 0))
            .slice(0, limit)
            .map(([hash, row]) => ({
                hash,
                emotion:     row.emotion    || '',
                category:    row.category   || '',
                description: row.description || '',
                seen_count:  row.seen_count  || 1,
            }));
    } catch { return []; }
}

/**
 * Build hint teks untuk diinjeksikan ke prompt AI
 * agar AI tahu kalau stiker ini pernah dilihat sebelumnya
 */
export function buildStickerContextHint(known) {
    if (!known) return '';
    const parts = [];
    if (known.emotion)    parts.push(`Emosi: ${known.emotion}`);
    if (known.category)   parts.push(`Kategori: ${known.category}`);
    if (known.description) parts.push(`Deskripsi: ${known.description}`);
    if (Array.isArray(known.tags) && known.tags.length) parts.push(`Tag: ${known.tags.join(', ')}`);
    if (known.seen_count > 1) parts.push(`Sudah dilihat bot ${known.seen_count}x`);
    if (!parts.length) return '';
    return `[Memori Stiker — Bot pernah menganalisis stiker ini sebelumnya]\n${parts.join('\n')}`;
}
