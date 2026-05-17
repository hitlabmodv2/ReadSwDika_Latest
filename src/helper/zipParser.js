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
/**
 * zipParser.js — Pure JS ZIP file parser (no external library)
 * Parses ZIP central directory to list files and detect password protection.
 * ZIP spec: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
 */

const EOCD_SIG = 0x06054b50;       // End of Central Directory
const EOCD64_SIG = 0x06064b50;     // ZIP64 EOCD
const CD_SIG = 0x02014b50;         // Central Directory header
const ENCRYPT_FLAG = 0x0001;       // General purpose bit 0 = encryption

/**
 * Format bytes to human-readable size
 */
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Get file extension icon
 */
function getIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
        js: '📜', ts: '📜', py: '🐍', java: '☕', cpp: '⚙️', c: '⚙️', cs: '⚙️', php: '🐘', rb: '💎', go: '🔵', rs: '🦀',
        html: '🌐', htm: '🌐', css: '🎨', xml: '📋', json: '📋', yaml: '📋', yml: '📋', toml: '📋', ini: '📋', cfg: '📋',
        txt: '📝', md: '📝', pdf: '📄', doc: '📄', docx: '📄', xls: '📊', xlsx: '📊', csv: '📊', ppt: '📊', pptx: '📊',
        jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', bmp: '🖼️', svg: '🖼️', webp: '🖼️', ico: '🖼️',
        mp4: '🎬', mkv: '🎬', avi: '🎬', mov: '🎬', wmv: '🎬', flv: '🎬', webm: '🎬',
        mp3: '🎵', wav: '🎵', flac: '🎵', aac: '🎵', ogg: '🎵', m4a: '🎵',
        zip: '📦', rar: '📦', '7z': '📦', tar: '📦', gz: '📦', bz2: '📦',
        exe: '⚙️', dll: '⚙️', bat: '⚙️', sh: '⚙️', msi: '⚙️',
        apk: '📱', ipa: '📱',
        sql: '🗄️', db: '🗄️', sqlite: '🗄️',
    };
    return map[ext] || '📄';
}

/**
 * Parse ZIP buffer and return entry list + metadata
 * @param {Buffer} buf - ZIP file buffer
 * @returns {{ entries: Array, isEncrypted: boolean, totalFiles: number, totalSize: number, comment: string }}
 */
export function parseZip(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 22) {
        throw new Error('Buffer tidak valid atau terlalu kecil untuk file ZIP');
    }

    // Validate ZIP signature (PK magic bytes)
    if (buf[0] !== 0x50 || buf[1] !== 0x4B) {
        throw new Error('Bukan file ZIP yang valid (magic bytes tidak cocok)');
    }

    // Find EOCD signature (search from end of file)
    let eocdOffset = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
        if (buf.readUInt32LE(i) === EOCD_SIG) {
            eocdOffset = i;
            break;
        }
    }

    if (eocdOffset === -1) {
        throw new Error('Tidak ditemukan End of Central Directory — ZIP mungkin korup');
    }

    const cdCount = buf.readUInt16LE(eocdOffset + 10);
    let cdOffset = buf.readUInt32LE(eocdOffset + 16);
    const cdSize = buf.readUInt32LE(eocdOffset + 12);
    const commentLen = buf.readUInt16LE(eocdOffset + 20);
    const comment = commentLen > 0 ? buf.slice(eocdOffset + 22, eocdOffset + 22 + commentLen).toString('utf8') : '';

    const entries = [];
    let isEncrypted = false;
    let totalSize = 0;
    let offset = cdOffset;

    const maxEntries = Math.min(cdCount, 500);

    for (let i = 0; i < maxEntries; i++) {
        if (offset + 46 > buf.length) break;
        if (buf.readUInt32LE(offset) !== CD_SIG) break;

        const gpFlag = buf.readUInt16LE(offset + 8);
        const compMethod = buf.readUInt16LE(offset + 10);
        const compSize = buf.readUInt32LE(offset + 20);
        const uncompSize = buf.readUInt32LE(offset + 24);
        const fnLen = buf.readUInt16LE(offset + 28);
        const extraLen = buf.readUInt16LE(offset + 30);
        const commentLenEntry = buf.readUInt16LE(offset + 32);

        const isFileEncrypted = !!(gpFlag & ENCRYPT_FLAG);
        if (isFileEncrypted) isEncrypted = true;

        const isDir = uncompSize === 0 && compSize === 0;
        const rawName = buf.slice(offset + 46, offset + 46 + fnLen);

        let filename;
        try {
            filename = (gpFlag & 0x0800) ? rawName.toString('utf8') : rawName.toString('latin1');
        } catch {
            filename = rawName.toString('utf8', 'replace');
        }

        totalSize += uncompSize;

        entries.push({
            name: filename,
            isDir,
            compSize,
            uncompSize,
            isEncrypted: isFileEncrypted,
            compMethod,
        });

        offset += 46 + fnLen + extraLen + commentLenEntry;
    }

    return {
        entries,
        isEncrypted,
        totalFiles: entries.filter(e => !e.isDir).length,
        totalDirs: entries.filter(e => e.isDir).length,
        totalSize,
        comment: comment.trim(),
        truncated: cdCount > maxEntries,
        originalCount: cdCount,
    };
}

/**
 * Format ZIP parse result into a WhatsApp-friendly string
 * @param {ReturnType<parseZip>} result
 * @param {string} filename - original filename
 * @returns {string}
 */
export function formatZipInfo(result, filename = 'archive.zip') {
    const { entries, isEncrypted, totalFiles, totalDirs, totalSize, comment, truncated, originalCount } = result;

    let out = `📦 *Isi File ZIP: ${filename}*\n`;
    out += `━━━━━━━━━━━━━━━━━━\n`;
    out += `📊 ${totalFiles} file, ${totalDirs} folder\n`;
    out += `💾 Total ukuran: ${formatSize(totalSize)}\n`;
    out += `🔐 Password: ${isEncrypted ? '✅ ADA (file terenkripsi)' : '❌ Tidak ada'}\n`;
    if (comment) out += `💬 Komentar ZIP: ${comment}\n`;
    out += `━━━━━━━━━━━━━━━━━━\n`;
    out += `📁 *Daftar Isi:*\n`;

    // Show folders first, then files
    const dirs = entries.filter(e => e.isDir);
    const files = entries.filter(e => !e.isDir);

    for (const dir of dirs.slice(0, 20)) {
        const name = dir.name.replace(/\/$/, '');
        out += `  📂 ${name}/\n`;
    }

    for (const file of files.slice(0, 50)) {
        const icon = getIcon(file.name);
        const sizeStr = formatSize(file.uncompSize);
        const encMark = file.isEncrypted ? ' 🔒' : '';
        // Shorten long paths
        const displayName = file.name.length > 45 ? '...' + file.name.slice(-42) : file.name;
        out += `  ${icon} ${displayName} (${sizeStr})${encMark}\n`;
    }

    const shown = Math.min(dirs.length, 20) + Math.min(files.length, 50);
    if (truncated || originalCount > shown) {
        out += `  ⋯ dan ${originalCount - shown} item lainnya\n`;
    }

    out += `━━━━━━━━━━━━━━━━━━`;

    if (isEncrypted) {
        out += `\n\n⚠️ *Catatan:* File-file di dalam ZIP ini diproteksi password. Kamu perlu tahu password-nya untuk membuka isinya.`;
    }

    return out;
}
