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
 * ─────────────────────────────────────────────────────────
 *  aiStickerStory.js
 *  Recode By : Bang Wilykun
 *
 *  Simpan sejarah + pola stiker yang dikirim AI
 *  Semua data gabung dalam 1 file: data/ai_history.json
 *  Key: sticker_pattern  → agregat per URL stiker
 *       sticker_story    → log per sesi
 *
 *  Dipakai oleh:
 *    • aiTools.js  → logStickerSent() setelah stiker berhasil kirim
 *    • aiPrompt.js → buildStickerStoryHint() untuk konteks AI
 * ─────────────────────────────────────────────────────────
 */

import { readAll, writeAll } from '../db/aiHistory.js';

// ── Helpers ───────────────────────────────────────────

function urlLabel(url = '') {
    const m = url.match(/([^/]+)-HONOLULU\.webp$/) || url.match(/([^/]+)-FIORA\.webp$/);
    return m ? m[0].substring(0, 40) : url.substring(url.lastIndexOf('/') + 1, url.lastIndexOf('/') + 40);
}

function getCharacter(url = '') {
    if (url.includes('-HONOLULU.webp')) return 'honolulu';
    if (url.includes('-FIORA.webp'))    return 'fiora';
    return 'unknown';
}

// ── Public API ────────────────────────────────────────

/**
 * Catat pengiriman stiker — dipanggil setelah stiker berhasil kirim.
 */
export function logStickerSent({ sessionKey = '', stickerUrl = '', mood = '', context = '', wasFallback = false } = {}) {
    try {
        const ctx     = String(context || '').replace(/\s+/g, ' ').trim().substring(0, 200);
        const nowSec  = Math.floor(Date.now() / 1000);
        const safeKey = String(sessionKey).substring(0, 100);

        const all = readAll();

        // 1. Tambah ke sticker_story per sesi
        if (!Array.isArray(all.sticker_story[safeKey])) all.sticker_story[safeKey] = [];
        all.sticker_story[safeKey].push({
            sticker_url:  stickerUrl,
            mood:         String(mood).substring(0, 60),
            context:      ctx,
            was_fallback: wasFallback ? 1 : 0,
            sent_at:      nowSec,
        });
        if (all.sticker_story[safeKey].length > 50) {
            all.sticker_story[safeKey] = all.sticker_story[safeKey].slice(-50);
        }

        // 2. Update sticker_pattern agregat
        if (!all.sticker_pattern[stickerUrl]) {
            all.sticker_pattern[stickerUrl] = { total_sent: 0, moods: {}, last_sent: nowSec };
        }
        all.sticker_pattern[stickerUrl].total_sent = (all.sticker_pattern[stickerUrl].total_sent || 0) + 1;
        all.sticker_pattern[stickerUrl].last_sent  = nowSec;
        if (mood) {
            all.sticker_pattern[stickerUrl].moods = all.sticker_pattern[stickerUrl].moods || {};
            all.sticker_pattern[stickerUrl].moods[mood] = (all.sticker_pattern[stickerUrl].moods[mood] || 0) + 1;
        }

        writeAll(all);
    } catch (e) {
        console.error('[StickerStory] logStickerSent error:', e.message);
    }
}

/**
 * Ambil stiker terpopuler untuk mood tertentu berdasarkan data historis.
 */
export function getTopStickersForMood(mood, limit = 3) {
    try {
        const { sticker_pattern } = readAll();
        return Object.entries(sticker_pattern)
            .filter(([, p]) => p.moods && p.moods[mood] > 0)
            .sort(([, a], [, b]) => (b.moods[mood] || 0) - (a.moods[mood] || 0))
            .slice(0, limit)
            .map(([url, p]) => ({ url, count: p.total_sent }));
    } catch { return []; }
}

/**
 * Ambil pola keseluruhan — stiker apa yang paling sering dikirim.
 */
export function getTopPatterns(limit = 10) {
    try {
        const { sticker_pattern } = readAll();
        return Object.entries(sticker_pattern)
            .sort(([, a], [, b]) => (b.total_sent || 0) - (a.total_sent || 0))
            .slice(0, limit)
            .map(([url, p]) => ({
                url,
                label: urlLabel(url),
                char:  getCharacter(url),
                total: p.total_sent || 0,
                moods: p.moods || {},
            }));
    } catch { return []; }
}

/**
 * Ambil riwayat stiker untuk 1 sesi (user/group tertentu).
 */
export function getSessionStickerHistory(sessionKey, limit = 10) {
    try {
        const { sticker_story } = readAll();
        const safeKey = String(sessionKey).substring(0, 100);
        const entries = sticker_story[safeKey];
        if (!Array.isArray(entries)) return [];
        return entries.slice(-limit).reverse();
    } catch { return []; }
}

/**
 * Statistik ringkas untuk logging/debug.
 */
export function getStickerStoryStats() {
    try {
        const { sticker_pattern, sticker_story } = readAll();
        const uniqueStickers = Object.keys(sticker_pattern).length;
        const totalSent      = Object.values(sticker_pattern).reduce((s, p) => s + (p.total_sent || 0), 0);
        const totalLogs      = Object.values(sticker_story).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
        return { totalLogs, uniqueStickers, totalSent };
    } catch {
        return { totalLogs: 0, uniqueStickers: 0, totalSent: 0 };
    }
}

/**
 * Generate hint singkat tentang pola stiker — untuk dimasukkan ke prompt AI.
 */
export function buildStickerStoryHint(sessionKey = '') {
    try {
        const lines = [];

        const recent = getSessionStickerHistory(sessionKey, 3);
        if (recent.length > 0) {
            lines.push('📖 Stiker yang baru-baru ini aku kirim ke user ini:');
            for (const r of recent) {
                const fb  = r.was_fallback ? ' *(fallback)*' : '';
                const ctx = r.context ? ` — konteks: "${r.context.substring(0, 60)}"` : '';
                lines.push(`  • [${r.mood || 'unknown'}] ${urlLabel(r.sticker_url)}${fb}${ctx}`);
            }
            lines.push('  → Hindari kirim stiker yang sama terlalu sering, variasikan.');
        }

        const top = getTopPatterns(5);
        if (top.length > 0) {
            lines.push('');
            lines.push('📊 Stiker yang paling sering aku pakai (global):');
            for (const t of top) {
                const moods = Object.keys(t.moods).slice(0, 3).join(', ');
                lines.push(`  • ${t.label} (${t.total}× — mood: ${moods || '-'})`);
            }
            lines.push('  → Boleh dipakai lagi jika mood cocok, tapi jangan terlalu monoton.');
        }

        return lines.length > 0 ? lines.join('\n') : '';
    } catch { return ''; }
}
