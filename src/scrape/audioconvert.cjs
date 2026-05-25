'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function ensureTmpDir() {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    return tmpDir;
}

function cleanupFiles(...files) {
    for (const f of files) {
        try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
}

/**
 * Convert audio buffer → WhatsApp Voice Note (OGG Opus, PTT)
 * @param {Buffer} inputBuffer - buffer audio apapun (mp3, m4a, ogg, wav, dll)
 * @param {string} inputMime  - mimetype aslinya, untuk tentukan ekstensi input
 * @returns {Promise<Buffer>} - buffer OGG Opus siap dikirim sebagai PTT
 */
async function toVoiceNote(inputBuffer, inputMime = 'audio/mpeg') {
    const tmpDir = ensureTmpDir();
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const extMap = {
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/mp4': 'm4a',
        'audio/m4a': 'm4a',
        'audio/ogg': 'ogg',
        'audio/ogg; codecs=opus': 'ogg',
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
        'audio/webm': 'webm',
        'audio/aac': 'aac',
        'audio/flac': 'flac',
    };
    const ext = extMap[inputMime?.toLowerCase().trim()] || 'mp3';

    const inputPath  = path.join(tmpDir, `ac_in_${id}.${ext}`);
    const outputPath = path.join(tmpDir, `ac_out_${id}.ogg`);

    fs.writeFileSync(inputPath, inputBuffer);

    try {
        await execFileAsync('ffmpeg', [
            '-y',
            '-hide_banner',
            '-loglevel', 'error',
            '-i', inputPath,
            '-vn',
            '-ac', '1',
            '-ar', '48000',
            '-c:a', 'libopus',
            '-b:a', '48k',
            '-vbr', 'on',
            '-compression_level', '10',
            outputPath
        ], { timeout: 60000 });

        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 512) {
            throw new Error('Konversi ke voice note gagal, output kosong.');
        }

        return fs.readFileSync(outputPath);
    } finally {
        cleanupFiles(inputPath, outputPath);
    }
}

/**
 * Convert audio buffer → MP3
 * @param {Buffer} inputBuffer - buffer audio apapun (ogg opus VN, m4a, wav, dll)
 * @param {string} inputMime  - mimetype aslinya
 * @returns {Promise<Buffer>} - buffer MP3
 */
async function toMP3(inputBuffer, inputMime = 'audio/ogg; codecs=opus') {
    const tmpDir = ensureTmpDir();
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const extMap = {
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/mp4': 'm4a',
        'audio/m4a': 'm4a',
        'audio/ogg': 'ogg',
        'audio/ogg; codecs=opus': 'ogg',
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
        'audio/webm': 'webm',
        'audio/aac': 'aac',
        'audio/flac': 'flac',
    };
    const ext = extMap[inputMime?.toLowerCase().trim()] || 'ogg';

    const inputPath  = path.join(tmpDir, `ac_in_${id}.${ext}`);
    const outputPath = path.join(tmpDir, `ac_out_${id}.mp3`);

    fs.writeFileSync(inputPath, inputBuffer);

    try {
        await execFileAsync('ffmpeg', [
            '-y',
            '-hide_banner',
            '-loglevel', 'error',
            '-i', inputPath,
            '-vn',
            '-ac', '2',
            '-ar', '44100',
            '-c:a', 'libmp3lame',
            '-q:a', '4',
            outputPath
        ], { timeout: 60000 });

        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 512) {
            throw new Error('Konversi ke MP3 gagal, output kosong.');
        }

        return fs.readFileSync(outputPath);
    } finally {
        cleanupFiles(inputPath, outputPath);
    }
}

module.exports = { toVoiceNote, toMP3 };
