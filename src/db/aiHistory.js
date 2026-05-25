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

let _writeLock = Promise.resolve();
function withWriteLock(fn) {
    const next = _writeLock.then(() => fn()).catch(() => fn());
    _writeLock = next.then(() => {}, () => {});
    return next;
}

const DATA_DIR             = path.join(process.cwd(), 'data');
const AI_FILE              = path.join(DATA_DIR, 'ai', 'history.json');
const OLD_HISTORY_DIR      = path.join(DATA_DIR, 'ai_history');
const EXPIRE_MS            = 24 * 60 * 60 * 1000;
const MAX_HISTORY_MESSAGES = 30;
const MAX_TEXT_PER_MESSAGE = 1500;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const AI_DIR = path.join(DATA_DIR, 'ai');
if (!fs.existsSync(AI_DIR)) fs.mkdirSync(AI_DIR, { recursive: true });

// ── Shared file read/write ──────────────────────────────

function readAll() {
    try {
        if (fs.existsSync(AI_FILE)) {
            const raw = fs.readFileSync(AI_FILE, 'utf-8');
            const parsed = JSON.parse(raw);
            return {
                sessions:        parsed.sessions        || {},
                sticker_pattern: parsed.sticker_pattern || {},
                sticker_story:   parsed.sticker_story   || {},
                sticker_memory:  parsed.sticker_memory  || {},
            };
        }
    } catch {}

    // Migrasi dari folder ai_history/*.json lama
    const data = { sessions: {}, sticker_pattern: {}, sticker_story: {}, sticker_memory: {} };
    try {
        if (fs.existsSync(OLD_HISTORY_DIR) && fs.statSync(OLD_HISTORY_DIR).isDirectory()) {
            const files = fs.readdirSync(OLD_HISTORY_DIR).filter(f => f.endsWith('.json'));
            for (const f of files) {
                try {
                    const sessionKey = f.replace('.json', '');
                    const content    = JSON.parse(fs.readFileSync(path.join(OLD_HISTORY_DIR, f), 'utf-8'));
                    data.sessions[sessionKey] = content;
                } catch {}
            }
            if (files.length > 0) {
                console.log(`\x1b[32m[AiHistory]\x1b[39m Migrasi ${files.length} sesi dari ai_history/ → ai_history.json`);
            }
        }
    } catch {}

    // Migrasi sticker lama jika ada
    try {
        const patternFile = path.join(DATA_DIR, 'ai_sticker_pattern.json');
        const storyFile   = path.join(DATA_DIR, 'ai_sticker_story.json');
        const memoryFile  = path.join(DATA_DIR, 'sticker_memory.json');
        if (fs.existsSync(patternFile)) {
            data.sticker_pattern = JSON.parse(fs.readFileSync(patternFile, 'utf-8'));
            console.log(`\x1b[32m[AiHistory]\x1b[39m Migrasi ai_sticker_pattern.json → ai_history.json`);
        }
        if (fs.existsSync(storyFile)) {
            data.sticker_story = JSON.parse(fs.readFileSync(storyFile, 'utf-8'));
            console.log(`\x1b[32m[AiHistory]\x1b[39m Migrasi ai_sticker_story.json → ai_history.json`);
        }
        if (fs.existsSync(memoryFile)) {
            data.sticker_memory = JSON.parse(fs.readFileSync(memoryFile, 'utf-8'));
            console.log(`\x1b[32m[AiHistory]\x1b[39m Migrasi sticker_memory.json → ai_history.json`);
        }
    } catch {}

    writeAll(data);
    return data;
}

function writeAll(data) {
    try {
        fs.writeFileSync(AI_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch {}
}

// ── Helpers ─────────────────────────────────────────────

function fmtTime(ts) {
    try {
        return new Date(ts).toLocaleString('id-ID', {
            hour: '2-digit', minute: '2-digit',
            day: '2-digit', month: 'short',
            timeZone: 'Asia/Jakarta',
        });
    } catch {
        return new Date(ts).toISOString();
    }
}

function enrichUserText(userText, meta = {}) {
    const ts   = meta.timestamp || Date.now();
    const tags = [`⏰ ${fmtTime(ts)}`];

    if (meta.quotedBotText) {
        const q       = String(meta.quotedBotText).replace(/\s+/g, ' ').trim();
        const excerpt = q.length > 140 ? q.slice(0, 140) + '...' : q;
        tags.push(`↩️ BALAS PESAN BOT SEBELUMNYA: "${excerpt}"`);
    } else if (meta.isReplyToBot) {
        tags.push('↩️ BALAS PESAN BOT SEBELUMNYA');
    }

    if (meta.mediaLabel) tags.push(`📎 KIRIM ${String(meta.mediaLabel).toUpperCase()}`);
    if (meta.userName)   tags.push(`👤 ${meta.userName}`);

    const tagBlock = `[${tags.join(' | ')}]`;
    return userText && userText.trim().length > 0
        ? `${tagBlock}\n${userText}`
        : tagBlock;
}

function enrichBotText(botText, meta = {}) {
    return `[⏰ ${fmtTime(meta.timestamp || Date.now())}]\n${botText}`;
}

function clip(text, max) {
    if (!text) return text;
    const s = String(text);
    if (s.length <= max) return s;
    return s.slice(0, max) + ` …(+${s.length - max} char dipotong)`;
}

// ── Public API ───────────────────────────────────────────

export function getHistory(sessionKey) {
    const all  = readAll();
    const data = all.sessions[sessionKey];
    if (!data) return [];
    if (Date.now() - (data.lastActivity || 0) > EXPIRE_MS) {
        delete all.sessions[sessionKey];
        writeAll(all);
        return [];
    }
    return Array.isArray(data.messages) ? data.messages : [];
}

export function addToHistory(sessionKey, userText, botText, meta = {}) {
    return withWriteLock(() => {
        const all      = readAll();
        const existing = all.sessions[sessionKey] || { messages: [], lastActivity: 0 };
        const messages = Array.isArray(existing.messages) ? existing.messages : [];
        const ts       = Date.now();
        const sharedMeta = { ...meta, timestamp: meta.timestamp || ts };

        messages.push({ role: 'user',  parts: [{ text: enrichUserText(clip(userText, MAX_TEXT_PER_MESSAGE), sharedMeta) }] });
        messages.push({ role: 'model', parts: [{ text: clip(botText, MAX_TEXT_PER_MESSAGE) }] });

        while (messages.length > MAX_HISTORY_MESSAGES) messages.splice(0, 2);

        all.sessions[sessionKey] = { messages, lastActivity: ts };
        writeAll(all);
    });
}

export function wrapCurrentUserMessage(userText, meta = {}) {
    const ts   = meta.timestamp || Date.now();
    const tags = [`⏰ ${fmtTime(ts)}`];
    if (meta.quotedBotText) {
        const q       = String(meta.quotedBotText).replace(/\s+/g, ' ').trim();
        const excerpt = q.length > 140 ? q.slice(0, 140) + '...' : q;
        tags.push(`↩️ BALAS PESAN BOT: "${excerpt}"`);
    }
    if (meta.mediaLabel) tags.push(`📎 ${String(meta.mediaLabel).toUpperCase()}`);
    if (meta.userName)   tags.push(`👤 ${meta.userName}`);

    const header = `━━━ 💬 PESAN BARU DARI USER — JAWAB INI SEKARANG ━━━\n[${tags.join(' | ')}]`;
    const body   = (userText && userText.trim().length > 0) ? `\n${userText}` : '';
    const footer = `\n━━━ (akhir pesan baru) ━━━`;
    return header + body + footer;
}

export function buildHistoryMeta(m, extra = {}) {
    const meta = { timestamp: Date.now(), ...extra };
    try {
        if (m?.isQuoted && m?.quoted?.key?.fromMe) {
            meta.isReplyToBot = true;
            const q = m.quoted?.text || m.quoted?.caption || m.quoted?.body || '';
            if (q) meta.quotedBotText = q;
        }
        if (m?.pushName && !meta.userName) meta.userName = m.pushName;
    } catch {}
    return meta;
}

export function clearHistory(sessionKey) {
    return withWriteLock(() => {
        const all = readAll();
        delete all.sessions[sessionKey];
        writeAll(all);
    });
}

export function clearAllHistory() {
    return withWriteLock(() => {
        const all   = readAll();
        const count = Object.keys(all.sessions).length;
        all.sessions = {};
        writeAll(all);
        return count;
    });
}

export function countHistory() {
    try { return Object.keys(readAll().sessions).length; } catch { return 0; }
}

export function getSessionKey(m) {
    return m.isGroup ? `${m.sender}_${m.from}` : m.sender;
}

// Export shared reader/writer untuk dipakai aiStickerStory.js
export { readAll, writeAll };
