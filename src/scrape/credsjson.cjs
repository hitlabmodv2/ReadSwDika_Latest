'use strict';

const fs   = require('fs');
const path = require('path');

const CREDS_BASE_DIR = path.join(process.cwd(), 'credsjson');

/**
 * Buat folder staging dan copy creds.json ke sana.
 * stageKey = `${botNomor}_${targetNomor}` → unik per-jadibot per-target, no conflict.
 * @param {string} stageKey   - misal "6281234_6289999"
 * @param {string} sessionDir - path folder session jadibot/bot utama
 * @returns {string} path staging creds.json
 */
function stageCreds(stageKey, sessionDir) {
    const srcPath = path.join(sessionDir, 'creds.json');
    if (!fs.existsSync(srcPath)) {
        throw new Error(`creds.json tidak ditemukan di: ${srcPath}`);
    }

    const stageDir  = path.join(CREDS_BASE_DIR, stageKey);
    const stagePath = path.join(stageDir, 'creds.json');

    fs.mkdirSync(stageDir, { recursive: true });
    fs.copyFileSync(srcPath, stagePath);

    return stagePath;
}

/**
 * Baca staging creds.json sebagai Buffer.
 * @param {string} stageKey
 * @returns {Buffer}
 */
function readStagedBuffer(stageKey) {
    const stagePath = path.join(CREDS_BASE_DIR, stageKey, 'creds.json');
    if (!fs.existsSync(stagePath)) {
        throw new Error(`Staging file tidak ditemukan: ${stagePath}`);
    }
    return fs.readFileSync(stagePath);
}

/**
 * Hapus folder staging credsjson/[stageKey]/ setelah file terkirim.
 * @param {string} stageKey
 */
async function deleteStagingFolder(stageKey) {
    const stageDir = path.join(CREDS_BASE_DIR, stageKey);
    if (fs.existsSync(stageDir)) {
        await fs.promises.rm(stageDir, { recursive: true, force: true });
    }
}

/**
 * Bersihkan format nomor → 62xxx (tanpa +, spasi, dash, dll)
 * @param {string} nomor
 * @returns {string}
 */
function cleanNomor(nomor) {
    let n = String(nomor).replace(/\D/g, '');
    n = n.replace(/^0+/, '');
    if (n.startsWith('6262')) n = n.slice(2);
    if (!n.startsWith('62')) n = '62' + n;
    return n;
}

module.exports = { stageCreds, readStagedBuffer, deleteStagingFolder, cleanNomor };
