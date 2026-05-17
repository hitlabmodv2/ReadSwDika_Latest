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
import { loadConfig } from './utils.js';

const tmpDir = path.join(process.cwd(), 'tmp');

export function getDiskUsage() {
    try {
        const stat = fs.statfsSync(process.cwd());
        const total = stat.blocks * stat.bsize;
        const free = stat.bfree * stat.bsize;
        const used = total - free;
        const usedPercent = total > 0 ? ((used / total) * 100).toFixed(1) : '0.0';
        return { total, free, used, usedPercent: parseFloat(usedPercent) };
    } catch {
        return { total: 0, free: 0, used: 0, usedPercent: 0 };
    }
}

export function emergencyCleanup() {
    const cyan  = '\x1b[36m';
    const red   = '\x1b[31m';
    const reset = '\x1b[39m';
    console.log(`${red}[DiskGuard]${reset} Menjalankan pembersihan darurat...`);
    clearTmpFolder();
    clearOldFiles(0);
    try {
        const sessionDir = path.join(process.cwd(), 'sessions');
        if (fs.existsSync(sessionDir)) {
            const files = fs.readdirSync(sessionDir);
            let deleted = 0;
            for (const file of files) {
                if (file.startsWith('pre-key-') || file.startsWith('sender-key-')) {
                    try { fs.unlinkSync(path.join(sessionDir, file)); deleted++; } catch {}
                }
            }
            if (deleted > 0) console.log(`${cyan}[DiskGuard]${reset} Hapus ${deleted} file sesi tidak perlu`);
        }
    } catch {}
    const disk = getDiskUsage();
    console.log(`${cyan}[DiskGuard]${reset} Disk setelah cleanup: ${disk.usedPercent}% terpakai (${formatBytes(disk.free)} tersisa)`);
}

export function ensureTmpDir() {
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
        console.log(`\x1b[32m[Cleaner]\x1b[39m Created tmp folder`);
    }
    return tmpDir;
}

export function getTmpPath(filename) {
    ensureTmpDir();
    return path.join(tmpDir, filename);
}

export function clearTmpFolder() {
    try {
        if (!fs.existsSync(tmpDir)) {
            console.log(`\x1b[33m[Cleaner]\x1b[39m tmp folder not found, creating...`);
            ensureTmpDir();
            return { success: true, deleted: 0, message: 'Folder created' };
        }

        const files = fs.readdirSync(tmpDir);
        let deletedCount = 0;
        let totalSize = 0;

        for (const file of files) {
            const filePath = path.join(tmpDir, file);
            try {
                const stat = fs.statSync(filePath);
                totalSize += stat.size;

                if (stat.isDirectory()) {
                    fs.rmSync(filePath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(filePath);
                }
                deletedCount++;
            } catch (err) {
                console.error(`\x1b[31m[Cleaner]\x1b[39m Failed to delete: ${file}`);
            }
        }

        const sizeStr = formatBytes(totalSize);
        console.log(`\x1b[32m[Cleaner]\x1b[39m Cleared ${deletedCount} files (${sizeStr})`);
        
        return { 
            success: true, 
            deleted: deletedCount, 
            size: totalSize,
            sizeFormatted: sizeStr,
            message: `Berhasil hapus ${deletedCount} file (${sizeStr})`
        };
    } catch (err) {
        console.error(`\x1b[31m[Cleaner]\x1b[39m Error:`, err.message);
        return { success: false, deleted: 0, message: err.message };
    }
}

export function clearOldFiles(hoursOld = 1) {
    try {
        ensureTmpDir();
        
        const files = fs.readdirSync(tmpDir);
        const now = Date.now();
        const maxAge = hoursOld * 60 * 60 * 1000;
        let deletedCount = 0;
        let totalSize = 0;

        for (const file of files) {
            const filePath = path.join(tmpDir, file);
            try {
                const stat = fs.statSync(filePath);
                const fileAge = now - stat.mtime.getTime();

                if (fileAge > maxAge) {
                    totalSize += stat.size;
                    
                    if (stat.isDirectory()) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(filePath);
                    }
                    deletedCount++;
                }
            } catch (err) {
                // Skip files that can't be accessed
            }
        }

        const sizeStr = formatBytes(totalSize);
        if (deletedCount > 0) {
            console.log(`\x1b[32m[Cleaner]\x1b[39m Auto-cleared ${deletedCount} old files (${sizeStr})`);
        }

        return { 
            success: true, 
            deleted: deletedCount, 
            size: totalSize,
            sizeFormatted: sizeStr
        };
    } catch (err) {
        return { success: false, deleted: 0, message: err.message };
    }
}

export function getTmpStats() {
    try {
        ensureTmpDir();
        
        const files = fs.readdirSync(tmpDir);
        let totalSize = 0;
        let fileCount = 0;

        for (const file of files) {
            const filePath = path.join(tmpDir, file);
            try {
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    const subFiles = fs.readdirSync(filePath);
                    fileCount += subFiles.length;
                    subFiles.forEach(subFile => {
                        try {
                            const subStat = fs.statSync(path.join(filePath, subFile));
                            totalSize += subStat.size;
                        } catch {}
                    });
                } else {
                    totalSize += stat.size;
                    fileCount++;
                }
            } catch {}
        }

        return {
            files: fileCount,
            size: totalSize,
            sizeFormatted: formatBytes(totalSize),
            path: tmpDir
        };
    } catch (err) {
        return { files: 0, size: 0, sizeFormatted: '0 B', path: tmpDir };
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

let _autoCleanerInterval = null;

export function stopAutoCleaner({ silent = false } = {}) {
    if (_autoCleanerInterval) {
        clearInterval(_autoCleanerInterval);
        _autoCleanerInterval = null;
        if (!silent) console.log(`\x1b[33m[Cleaner]\x1b[39m Auto-cleaner dihentikan`);
    }
}

let _diskMonitorInterval = null;

export function startDiskMonitor(warningPercent = 80, criticalPercent = 90) {
    if (_diskMonitorInterval) clearInterval(_diskMonitorInterval);

    const cyan  = '\x1b[36m';
    const yellow = '\x1b[33m';
    const red   = '\x1b[31m';
    const reset = '\x1b[39m';

    _diskMonitorInterval = setInterval(() => {
        const disk = getDiskUsage();
        if (disk.total === 0) return;

        if (disk.usedPercent >= criticalPercent) {
            console.log(`${red}[DiskGuard]${reset} ⚠️  DISK KRITIS ${disk.usedPercent}% terpakai! Memulai pembersihan darurat...`);
            emergencyCleanup();
        } else if (disk.usedPercent >= warningPercent) {
            console.log(`${yellow}[DiskGuard]${reset} Disk ${disk.usedPercent}% terpakai, membersihkan file lama...`);
            clearOldFiles(1);
            const diskAfter = getDiskUsage();
            console.log(`${cyan}[DiskGuard]${reset} Selesai. Disk sekarang: ${diskAfter.usedPercent}% (${formatBytes(diskAfter.free)} bebas)`);
        }
    }, 5 * 60 * 1000);

    return _diskMonitorInterval;
}

export function stopDiskMonitor() {
    if (_diskMonitorInterval) {
        clearInterval(_diskMonitorInterval);
        _diskMonitorInterval = null;
    }
}

export function startAutoCleaner(intervalHours = 6) {
    const config = loadConfig();
    const cleanerConfig = config.autoCleaner ?? { enabled: true };

    if (cleanerConfig.enabled === false) {
        console.log(`\x1b[33m[Cleaner]\x1b[39m Auto-cleaner dinonaktifkan (config)`);
        return null;
    }

    const hours = cleanerConfig.intervalHours || intervalHours;
    const warnPct  = cleanerConfig.diskWarnPercent  || 80;
    const critPct  = cleanerConfig.diskCritPercent  || 90;

    stopAutoCleaner({ silent: true });

    clearOldFiles(24);

    _autoCleanerInterval = setInterval(() => {
        clearOldFiles(hours);
    }, hours * 60 * 60 * 1000);

    console.log(`\x1b[32m[Cleaner]\x1b[39m Auto-cleaner aktif — interval setiap ${hours} jam`);

    startDiskMonitor(warnPct, critPct);

    const disk = getDiskUsage();
    if (disk.total > 0) {
        const color = disk.usedPercent >= 80 ? '\x1b[31m' : disk.usedPercent >= 60 ? '\x1b[33m' : '\x1b[32m';
        console.log(`\x1b[32m→ Disk     :\x1b[39m ${color}${disk.usedPercent}%\x1b[39m terpakai (${formatBytes(disk.free)} bebas dari ${formatBytes(disk.total)})`);
    }

    return _autoCleanerInterval;
}

export function restartAutoCleaner() {
    const config = loadConfig();
    const hours = config.autoCleaner?.intervalHours || 6;
    return startAutoCleaner(hours);
}

/**
 * Bersihkan pre-key files yang sudah benar-benar tidak dibutuhkan lagi.
 *
 * CATATAN PENTING — mengapa perlu buffer aman:
 * Pre-key yang sudah diunggah ke server WhatsApp (ID < firstUnuploadedPreKeyId)
 * belum tentu sudah DIPAKAI. Server WhatsApp menyimpan pool pre-key dan
 * membagi-bagikannya ke kontak baru yang ingin memulai sesi terenkripsi.
 * Bot tetap membutuhkan file pre-key lokal untuk mendekripsi pesan pertama
 * dari kontak baru tersebut — jika file sudah dihapus, bot tidak bisa
 * merespons kontak baru (terlihat online tapi diam/bisu).
 *
 * Solusi: hanya hapus pre-key yang ID-nya lebih dari SAFE_BUFFER di bawah
 * firstUnuploadedPreKeyId. Buffer 200 cukup karena WhatsApp biasanya
 * menyimpan maksimal 100–200 pre-key per perangkat di servernya.
 */
export function cleanStaleSessionFiles(sessionDir, { skipConfigCheck = false } = {}) {
    if (!skipConfigCheck) {
        try {
            const config = loadConfig();
            const sc = config.sessionCleaner ?? { enabled: true };
            if (sc.enabled === false) return;
        } catch {}
    }
    try {
        if (!fs.existsSync(sessionDir)) return

        const credsPath = path.join(sessionDir, 'creds.json')
        if (!fs.existsSync(credsPath)) return

        let safeDeleteBefore = 0
        try {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'))
            const firstUnuploaded = creds?.nextPreKeyId ?? creds?.firstUnuploadedPreKeyId ?? 0
            const SAFE_BUFFER = 200
            safeDeleteBefore = Math.max(0, firstUnuploaded - SAFE_BUFFER)
        } catch {}

        const files = fs.readdirSync(sessionDir)
        let deletedPreKeys = 0
        let deletedSessions = 0
        let deletedSize = 0
        const now = Date.now()
        const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000 // 30 hari

        for (const file of files) {
            const filePath = path.join(sessionDir, file)

            // Hapus pre-key yang sudah sangat jauh di bawah batas aman
            if (file.startsWith('pre-key-') && file.endsWith('.json')) {
                const idStr = file.replace('pre-key-', '').replace('.json', '')
                const id = parseInt(idStr, 10)
                if (!isNaN(id) && id < safeDeleteBefore) {
                    try {
                        const stat = fs.statSync(filePath)
                        deletedSize += stat.size
                        fs.unlinkSync(filePath)
                        deletedPreKeys++
                    } catch {}
                }
                continue
            }

            // Hapus session-* yang sudah lebih dari 30 hari tidak dipakai
            if (file.startsWith('session-') && file.endsWith('.json')) {
                try {
                    const stat = fs.statSync(filePath)
                    if (now - stat.mtimeMs > SESSION_MAX_AGE) {
                        deletedSize += stat.size
                        fs.unlinkSync(filePath)
                        deletedSessions++
                    }
                } catch {}
                continue
            }

            // Hapus sender-key-* yang sudah lebih dari 30 hari tidak dipakai
            if (file.startsWith('sender-key-') && file.endsWith('.json')) {
                try {
                    const stat = fs.statSync(filePath)
                    if (now - stat.mtimeMs > SESSION_MAX_AGE) {
                        deletedSize += stat.size
                        fs.unlinkSync(filePath)
                    }
                } catch {}
            }
        }

        const total = deletedPreKeys + deletedSessions
        if (total > 0) {
            const sizeStr = formatBytes(deletedSize)
            console.log(
                `\x1b[32m[SessionCleaner]\x1b[39m` +
                ` Hapus ${deletedPreKeys} pre-key stale` +
                (deletedSessions > 0 ? ` + ${deletedSessions} session lama` : '') +
                ` → hemat ${sizeStr}`
            )
        }
    } catch (err) {
        console.error(`\x1b[31m[SessionCleaner]\x1b[39m Error:`, err.message)
    }
}

export default {
    ensureTmpDir,
    getTmpPath,
    clearTmpFolder,
    clearOldFiles,
    getTmpStats,
    getDiskUsage,
    emergencyCleanup,
    startAutoCleaner,
    stopAutoCleaner,
    restartAutoCleaner,
    startDiskMonitor,
    stopDiskMonitor,
    cleanStaleSessionFiles
};
