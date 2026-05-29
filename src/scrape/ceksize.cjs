'use strict';

/**
 * ─────────────────────────────────────
 *  Cek Size Script
 *  Hitung ukuran semua file di project
 *  termasuk node_modules, dengan
 *  animasi progress realtime.
 *  Owner only.
 * ─────────────────────────────────────
 */

const fs           = require('fs');
const path         = require('path');
const { exec }     = require('child_process');

const ROOT = process.cwd();

const SKIP_TOP_FILES = new Set(['node_modules', '.git', '.cache', '.npm']);

// ── Format ukuran ─────────────────────────────────────────────────────────────

function formatSize(bytes) {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    if (bytes >= 1024 * 1024)        return (bytes / (1024 * 1024)).toFixed(2)        + ' MB';
    if (bytes >= 1024)               return (bytes / 1024).toFixed(2)                 + ' KB';
    return bytes + ' B';
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function buatProgressBar(pct, panjang = 15) {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    const isi     = Math.round((clamped / 100) * panjang);
    return '█'.repeat(isi) + '░'.repeat(panjang - isi);
}

function buatPesanLoading(pct, label) {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    const bar     = buatProgressBar(clamped);
    return (
        `╔═══════════════════════╗\n` +
        `║  📂  *C E K  S I Z E*  ║\n` +
        `╚═══════════════════════╝\n\n` +
        `⏳ *Menghitung ukuran...*\n\n` +
        `\`[${bar}]\` *${clamped}%*\n\n` +
        `_${label}_`
    );
}

// ── du async (non-blocking) + ticker ─────────────────────────────────────────

/**
 * Jalankan du secara async, sambil ticker naikin pct dari pctStart→pctEnd-2
 * setiap tickMs ms. Saat du selesai, resolve ke bytes.
 */
function duSizeAsync(targetPath, pctStart, pctEnd, tickMs, onTick) {
    return new Promise((resolve) => {
        let current = pctStart;
        const range = pctEnd - 2 - pctStart; // sisakan 2% untuk "selesai"

        // Ticker: naikkan pct perlahan selama du jalan
        const interval = range > 0 ? setInterval(() => {
            if (current < pctEnd - 2) {
                current += Math.max(0.5, range / 12);
                if (current > pctEnd - 2) current = pctEnd - 2;
                if (typeof onTick === 'function') onTick(current);
            }
        }, tickMs) : null;

        exec(`du -sb "${targetPath}" 2>/dev/null`, { timeout: 30000 }, (err, stdout) => {
            if (interval) clearInterval(interval);
            const bytes = parseInt((stdout || '0').trim().split('\t')[0], 10) || 0;
            resolve(bytes);
        });
    });
}

// ── Rekursif scan project files ───────────────────────────────────────────────

function scanProjectFiles(dir, results = []) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
    for (const entry of entries) {
        if (dir === ROOT && SKIP_TOP_FILES.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            scanProjectFiles(fullPath, results);
        } else if (entry.isFile()) {
            try { results.push({ path: path.relative(ROOT, fullPath), bytes: fs.statSync(fullPath).size }); } catch {}
        }
    }
    return results;
}

// ── Main dengan progress realtime ─────────────────────────────────────────────

async function cekSizeWithProgress(topN = 20, onProgress = null) {
    const report = async (pct, label) => {
        if (typeof onProgress === 'function') {
            try { await onProgress(Math.round(pct * 10) / 10, label); } catch {}
        }
    };

    // ── FASE 1: Baca daftar folder (0-4%) ─────────────────────────────────
    await report(1, 'Membaca struktur folder...');

    let topEntries = [];
    try { topEntries = fs.readdirSync(ROOT, { withFileTypes: true }); } catch {}

    const dirs      = topEntries.filter(e => e.isDirectory());
    const rootFiles = topEntries.filter(e => e.isFile());

    await report(4, `Ditemukan ${dirs.length} folder, mulai scan...`);

    // ── FASE 2: du per folder async + ticker (4-70%) ───────────────────────
    const folderResults = [];
    const PCT_START = 4;
    const PCT_END   = 70;
    const slicePerFolder = dirs.length > 0 ? (PCT_END - PCT_START) / dirs.length : 0;

    for (let i = 0; i < dirs.length; i++) {
        const folderName = dirs[i].name;
        const sliceStart = PCT_START + i * slicePerFolder;
        const sliceEnd   = sliceStart + slicePerFolder;
        const fullPath   = path.join(ROOT, folderName);

        // Ticker naikkan bar selama du jalan
        const bytes = await duSizeAsync(
            fullPath,
            sliceStart,
            sliceEnd,
            400,
            (tickPct) => report(tickPct, `Menghitung: ${folderName}/...`)
        );

        folderResults.push({ name: folderName, bytes, isDir: true });
        await report(sliceEnd, `✓ ${folderName}/ — ${formatSize(bytes)}`);
    }

    // Root files
    await report(70, 'Menghitung root files...');
    let rootFileBytes = 0;
    for (const f of rootFiles) {
        try { rootFileBytes += fs.statSync(path.join(ROOT, f.name)).size; } catch {}
    }
    if (rootFileBytes > 0) folderResults.push({ name: '(root files)', bytes: rootFileBytes, isDir: false });

    folderResults.sort((a, b) => b.bytes - a.bytes);
    const grandTotal = folderResults.reduce((s, f) => s + f.bytes, 0);
    const nmEntry    = folderResults.find(f => f.name === 'node_modules');
    const nmBytes    = nmEntry ? nmEntry.bytes : 0;

    // ── FASE 3: Scan project files (72-86%) ───────────────────────────────
    await report(72, 'Scanning file project...');
    const projectFiles = scanProjectFiles(ROOT);

    await report(83, `Ditemukan ${projectFiles.length} file, mengurutkan...`);
    projectFiles.sort((a, b) => b.bytes - a.bytes);

    const projectTotal = projectFiles.reduce((s, f) => s + f.bytes, 0);

    // ── FASE 4: Build caption (88-99%) ────────────────────────────────────
    await report(90, 'Menyusun laporan...');

    const caption = buatCaption({
        folderSizes      : folderResults,
        grandTotal,
        projectTotal,
        nmBytes,
        topFiles         : projectFiles.slice(0, topN),
        totalProjectFiles: projectFiles.length,
    });

    await report(100, 'Selesai!');

    return { caption, folderSizes: folderResults, grandTotal, projectTotal, nmBytes, topFiles: projectFiles.slice(0, topN), totalProjectFiles: projectFiles.length };
}

// ── Format caption ────────────────────────────────────────────────────────────

function buatCaption({ folderSizes, grandTotal, projectTotal, nmBytes, topFiles, totalProjectFiles }) {
    const MEDAL = ['🥇', '🥈', '🥉'];

    const nmPct = grandTotal > 0 ? ((nmBytes / grandTotal) * 100).toFixed(1) : '0.0';
    const prPct = grandTotal > 0 ? ((projectTotal / grandTotal) * 100).toFixed(1) : '0.0';

    const totalBaris =
        `📦 *Grand Total*     : ${formatSize(grandTotal)}\n` +
        `📁 *Project Files*  : ${formatSize(projectTotal)} (${prPct}%)\n` +
        `📦 *node_modules*   : ${formatSize(nmBytes)} (${nmPct}%)\n` +
        `🗒️ *Jumlah File*    : ${totalProjectFiles.toLocaleString('id-ID')} file`;

    let folderBaris = '';
    for (let i = 0; i < folderSizes.length; i++) {
        const medal  = MEDAL[i] ?? `${i + 1}.`;
        const bar    = buatMiniBar(folderSizes[i].bytes, grandTotal, 10);
        const ukuran = formatSize(folderSizes[i].bytes);
        folderBaris += `${medal} *${folderSizes[i].name}*\n    ${bar} ${ukuran}\n`;
    }

    let fileBaris = '';
    for (let i = 0; i < topFiles.length; i++) {
        const medal  = MEDAL[i] ?? `${i + 1}.`;
        const ukuran = formatSize(topFiles[i].bytes);
        let p = topFiles[i].path;
        if (p.length > 40) p = '…' + p.slice(p.length - 39);
        fileBaris += `${medal} \`${p}\`\n    📦 ${ukuran}\n`;
    }

    return (
        `╔═══════════════════════╗\n` +
        `║  📂  *C E K  S I Z E*  ║\n` +
        `╚═══════════════════════╝\n\n` +
        totalBaris + `\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🗂️ *Semua Folder (terbesar)*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        folderBaris +
        `\n━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📄 *Top ${topFiles.length} File Terbesar (project)*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        fileBaris +
        `\n_Diukur: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB_`
    );
}

function buatMiniBar(bytes, total, panjang = 10) {
    if (total === 0) return '░'.repeat(panjang);
    const isi = Math.round((bytes / total) * panjang);
    return '█'.repeat(isi) + '░'.repeat(panjang - isi);
}

module.exports = { cekSizeWithProgress, buatProgressBar, buatPesanLoading, formatSize };
