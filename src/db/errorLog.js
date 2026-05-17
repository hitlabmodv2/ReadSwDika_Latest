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

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR     = path.join(__dirname, '../../data');
const ERROR_FILE   = path.join(DATA_DIR, 'system', 'error.json');
const INFO_TXT     = path.join(DATA_DIR, 'system', 'infoerror.txt');

const MAX_ERRORS = 200;

// ─── helpers ──────────────────────────────────────────────────

function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const SYS_DIR = path.join(DATA_DIR, 'system');
    if (!fs.existsSync(SYS_DIR)) fs.mkdirSync(SYS_DIR, { recursive: true });
}

function ensureFile() {
    ensureDir();
    if (!fs.existsSync(ERROR_FILE))
        fs.writeFileSync(ERROR_FILE, JSON.stringify({ errors: [] }, null, 2), 'utf-8');
}

function readDB() {
    try {
        ensureFile();
        const raw    = fs.readFileSync(ERROR_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.errors)) parsed.errors = [];
        return parsed;
    } catch {
        return { errors: [] };
    }
}

function writeDB(db) {
    try {
        fs.writeFileSync(ERROR_FILE, JSON.stringify(db, null, 2), 'utf-8');
    } catch (_) {}
}

function makeFingerprint(message, source) {
    const msg = String(message || '').replace(/\d+/g, 'N').trim().slice(0, 120);
    const src = String(source || '').trim().slice(0, 80);
    return `${src}::${msg}`;
}

function formatTimestamp(iso) {
    try {
        const d = new Date(iso);
        return d.toLocaleString('id-ID', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false,
        });
    } catch {
        return iso;
    }
}

// ─── core: tulis infoerror.txt dari data DB ───────────────────

function flushTxt(db) {
    try {
        ensureDir();
        const errors        = db.errors || [];
        const totalJenis    = errors.length;
        const totalKejadian = errors.reduce((s, e) => s + e.count, 0);
        const now           = formatTimestamp(new Date().toISOString());

        const W  = 72;
        const eq = '═'.repeat(W);
        const da = '─'.repeat(W);
        const dt = '┄'.repeat(W);

        const lines = [];

        lines.push(eq);
        lines.push(`  ██╗███╗   ██╗███████╗ ██████╗     ███████╗██████╗ ██████╗  ██████╗ ██████╗`);
        lines.push(`  ██║████╗  ██║██╔════╝██╔═══██╗    ██╔════╝██╔══██╗██╔══██╗██╔═══██╗██╔══██╗`);
        lines.push(`  ██║██╔██╗ ██║█████╗  ██║   ██║    █████╗  ██████╔╝██████╔╝██║   ██║██████╔╝`);
        lines.push(`  ██║██║╚██╗██║██╔══╝  ██║   ██║    ██╔══╝  ██╔══██╗██╔══██╗██║   ██║██╔══██╗`);
        lines.push(`  ██║██║ ╚████║██║     ╚██████╔╝    ███████╗██║  ██║██║  ██║╚██████╔╝██║  ██║`);
        lines.push(`  ╚═╝╚═╝  ╚═══╝╚═╝      ╚═════╝     ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝`);
        lines.push(eq);
        lines.push(`  FILE     : infoerror.txt`);
        lines.push(`  Bot      : Wily Bot`);
        lines.push(`  Update   : ${now}  (realtime — diperbarui otomatis setiap ada error)`);
        lines.push(eq);
        lines.push('');

        // ── ringkasan ──
        lines.push(`  RINGKASAN`);
        lines.push(da);
        lines.push(`  Total Jenis Error (unik)  : ${totalJenis}`);
        lines.push(`  Total Kejadian Error       : ${totalKejadian}`);
        lines.push(`  Maks. Simpan               : ${MAX_ERRORS} jenis error`);
        lines.push(`  Deduplikasi                : AKTIF — error sama digabung, tidak dicatat ulang`);
        lines.push(`  Urutan                     : Terbaru di atas`);
        lines.push('');

        if (totalJenis === 0) {
            lines.push(da);
            lines.push(`  ✅  Tidak ada error yang tercatat saat ini.`);
            lines.push(`      Bot berjalan normal dan lancar!`);
            lines.push(da);
            lines.push('');
            lines.push(eq);
            lines.push(`  End of Report`);
            lines.push(eq);
            fs.writeFileSync(INFO_TXT, lines.join('\n'), 'utf-8');
            return;
        }

        lines.push(`  DAFTAR ERROR LENGKAP  [${totalJenis} jenis, ${totalKejadian} kejadian total]`);
        lines.push(da);
        lines.push('');

        errors.forEach((e, i) => {
            const no      = String(i + 1).padStart(3, '0');
            const frekStr = e.count === 1 ? '1x (baru terjadi)' : `${e.count}x (duplikat digabung)`;

            lines.push(`┌${'─'.repeat(W - 1)}`);
            lines.push(`│  #${no}  —  ${e.source}`);
            lines.push(`├${dt}`);
            lines.push(`│  PESAN ERROR`);
            lines.push(`│  ${e.message}`);
            lines.push(`│`);
            lines.push(`│  DETAIL`);
            lines.push(`│  Sumber      : ${e.source}`);
            lines.push(`│  Frekuensi   : ${frekStr}`);
            lines.push(`│  Pertama     : ${formatTimestamp(e.firstSeen)}`);
            lines.push(`│  Terakhir    : ${formatTimestamp(e.lastSeen)}`);

            if (e.stack && e.stack.trim()) {
                lines.push(`│`);
                lines.push(`│  STACK TRACE (3 baris pertama)`);
                const stackLines = e.stack.split('\n').filter(l => l.trim()).slice(0, 3);
                stackLines.forEach((sl, si) => {
                    const prefix = si === 0 ? '│  ▶' : '│   ';
                    lines.push(`${prefix}  ${sl.trim()}`);
                });
            }

            lines.push(`└${'─'.repeat(W - 1)}`);
            lines.push('');
        });

        lines.push(eq);
        lines.push(`  End of Report  —  Total: ${totalJenis} jenis, ${totalKejadian} kejadian`);
        lines.push(`  Terakhir diperbarui: ${now}`);
        lines.push(eq);

        fs.writeFileSync(INFO_TXT, lines.join('\n'), 'utf-8');
    } catch (_) {}
}

// ─── exports ──────────────────────────────────────────────────

export function logError(err, source = 'unknown') {
    try {
        const message = err instanceof Error ? err.message : String(err);
        const stack   = err instanceof Error ? (err.stack || '') : '';
        const now     = new Date().toISOString();
        const fp      = makeFingerprint(message, source);

        const db       = readDB();
        const existing = db.errors.find(e => e.fingerprint === fp);

        if (existing) {
            existing.count++;
            existing.lastSeen = now;
        } else {
            db.errors.unshift({
                fingerprint: fp,
                source,
                message  : message.slice(0, 500),
                stack    : stack.slice(0, 1500),
                count    : 1,
                firstSeen: now,
                lastSeen : now,
            });

            if (db.errors.length > MAX_ERRORS)
                db.errors = db.errors.slice(0, MAX_ERRORS);
        }

        writeDB(db);
        flushTxt(db);        // ← realtime: tulis infoerror.txt langsung
    } catch (_) {}
}

export function getErrors() {
    return readDB().errors;
}

export function clearErrors() {
    const emptyDb = { errors: [] };
    writeDB(emptyDb);
    flushTxt(emptyDb);       // ← reset file juga
}

export function getErrorStats() {
    const errors = getErrors();
    const total  = errors.reduce((sum, e) => sum + e.count, 0);
    return { uniqueErrors: errors.length, totalOccurred: total, errors };
}

export function formatErrorReport(limit = 3) {
    const { uniqueErrors, totalOccurred, errors } = getErrorStats();

    if (uniqueErrors === 0)
        return `╭─「 ✅ *ERROR LOG* 」\n│\n╰➤ Tidak ada error yang tercatat. Bot berjalan lancar!\n\n┗━➤ 🚀 *Powered By Wily Bot*`;

    const lines = [];
    lines.push(`╭─「 🚨 *ERROR LOG BOT* 」`);
    lines.push(`│`);
    lines.push(`├➤ *Total Jenis Error* : ${uniqueErrors}`);
    lines.push(`├➤ *Total Kejadian*    : ${totalOccurred}`);
    lines.push(`│`);

    const shown = errors.slice(0, limit);
    shown.forEach((e, i) => {
        const no = String(i + 1).padStart(2, '0');
        lines.push(`├─「 #${no} 」`);
        lines.push(`│  📌 *Sumber*    : ${e.source}`);
        lines.push(`│  ❌ *Pesan*     : ${e.message}`);
        lines.push(`│  🔢 *Kejadian*  : ${e.count}x`);
        lines.push(`│  🕐 *Pertama*   : ${formatTimestamp(e.firstSeen)}`);
        lines.push(`│  🕑 *Terakhir*  : ${formatTimestamp(e.lastSeen)}`);
        if (i < shown.length - 1) lines.push(`│`);
    });

    if (errors.length > limit) {
        lines.push(`│`);
        lines.push(`├➤ _...dan ${errors.length - limit} jenis error lainnya (cek infoerror.txt)_`);
    }

    lines.push(`╰─────────────────────────`);
    lines.push(``);
    lines.push(`┗━➤ 🚀 *Powered By Wily Bot*`);

    return lines.join('\n');
}

export function generateErrorFileTxt() {
    const db = readDB();
    flushTxt(db);
    try {
        return fs.readFileSync(INFO_TXT, 'utf-8');
    } catch {
        return '';
    }
}

export function getInfoErrorTxtPath() {
    return INFO_TXT;
}

export default { logError, getErrors, clearErrors, getErrorStats, formatErrorReport, generateErrorFileTxt, getInfoErrorTxtPath };
