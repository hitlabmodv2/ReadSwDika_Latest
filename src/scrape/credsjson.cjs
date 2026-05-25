'use strict';

const fs            = require('fs');
const path          = require('path');
const pino          = require('pino');
const { execFile }  = require('child_process');
const os            = require('os');

const CREDS_BASE_DIR     = path.join(process.cwd(), 'credsjson');
const PAIRING_TIMEOUT_MS = 3 * 60 * 1000;
const PREKEY_POLL_MS     = 1_500;
const PREKEY_MAX_WAIT_MS = 40_000;
const MAX_RECONNECT      = 10;

/**
 * Format pairing code → XXXX-XXXX
 */
function formatPairingCode(code) {
    const clean = String(code).replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (clean.length === 8) return clean.slice(0, 4) + '-' + clean.slice(4);
    return clean.match(/.{1,4}/g)?.join('-') || clean;
}

/**
 * Polling sampai pre-key-*.json >= 5 file muncul di sessionDir.
 */
async function waitUntilPrekeys(sessionDir) {
    const deadline = Date.now() + PREKEY_MAX_WAIT_MS;
    while (Date.now() < deadline) {
        try {
            const all     = fs.readdirSync(sessionDir).filter(f => f.endsWith('.json'));
            const prekeys = all.filter(f => f.startsWith('pre-key-'));
            if (prekeys.length >= 5) return all.length;
        } catch {}
        await new Promise(r => setTimeout(r, PREKEY_POLL_MS));
    }
    try {
        return fs.readdirSync(sessionDir).filter(f => f.endsWith('.json')).length;
    } catch { return 0; }
}

/**
 * Pack semua file .json di sessionDir → Buffer tar.gz
 */
function packToBuffer(sessionDir) {
    return new Promise((resolve, reject) => {
        const tmpOut = path.join(os.tmpdir(), `cj_${Date.now()}.tar.gz`);
        let files;
        try {
            files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.json'));
        } catch (e) {
            return reject(new Error('Gagal baca sessionDir: ' + e.message));
        }
        if (!files.length) return reject(new Error('Tidak ada file session JSON'));

        execFile('tar', ['-czf', tmpOut, '-C', sessionDir, ...files], err => {
            if (err) return reject(new Error('tar gagal: ' + err.message));
            try {
                const buf = fs.readFileSync(tmpOut);
                try { fs.unlinkSync(tmpOut); } catch {}
                resolve(buf);
            } catch (e) { reject(e); }
        });
    });
}

/**
 * Tutup socket dengan bersih (tanpa hapus folder)
 */
function closeSocket(sock) {
    try { sock.ev.removeAllListeners(); } catch {}
    try { if (sock.ws) sock.ws.close(); } catch {}
}

/**
 * Buat & jalankan sesi WhatsApp untuk credsjson.
 * Reconnect otomatis seperti jadibot saat disconnect selama proses pairing.
 * Folder credsjson/[nomor]/ TIDAK dihapus otomatis — user bisa cek sendiri.
 */
async function startCredsJsonSession(number, opts = {}) {
    const {
        onPairingCode    = () => {},
        onConnected      = () => {},
        onTimeout        = () => {},
        onError          = () => {},
        customPairingCode,
    } = opts;

    number = String(number).replace(/[^0-9]/g, '');

    const sessionDir = path.join(CREDS_BASE_DIR, number);
    fs.mkdirSync(sessionDir, { recursive: true });

    const {
        default: makeWASocket,
        fetchLatestBaileysVersion,
        useMultiFileAuthState,
        DisconnectReason,
    } = require('socketon');

    // State bersama antar reconnect
    let connected        = false;
    let aborted          = false;
    let pairingDone      = false;   // pairing code sudah dikirim ke nomor tujuan
    let reconnectCount   = 0;
    let currentSock      = null;

    // Timeout global 3 menit
    const timeoutHandle = setTimeout(async () => {
        if (connected || aborted) return;
        aborted = true;
        if (currentSock) closeSocket(currentSock);
        try { await onTimeout(); } catch {}
    }, PAIRING_TIMEOUT_MS);

    async function spawnSocket() {
        if (aborted) return;

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version }          = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth             : { creds: state.creds, keys: state.keys },
            logger           : pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser          : ['Ubuntu', 'Chrome', '136.0.7103.93'],
            keepAliveIntervalMs: 30_000,
            syncFullHistory  : false,
            getMessage       : async () => undefined,
        });

        currentSock = sock;

        sock.ev.on('creds.update', async (...args) => {
            try { await saveCreds(...args); } catch {}
        });

        sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
            if (aborted) return;

            const reason = lastDisconnect?.error?.output?.statusCode;

            // ── Request pairing code saat pertama connecting ──
            if (connection === 'connecting' && !state.creds?.registered && !pairingDone) {
                pairingDone = true;
                setTimeout(async () => {
                    if (aborted) return;
                    let retries = 3;
                    while (retries-- > 0) {
                        try {
                            const code = await sock.requestPairingCode(
                                number,
                                customPairingCode ? String(customPairingCode).toUpperCase() : undefined
                            );
                            if (aborted) return;
                            await onPairingCode(code, formatPairingCode(code));
                            return;
                        } catch (e) {
                            if (retries === 0) {
                                try { await onError(e); } catch {}
                            } else {
                                await new Promise(r => setTimeout(r, 1500));
                            }
                        }
                    }
                }, 1500);
            }

            // ── Berhasil terhubung ──
            if (connection === 'open' && !connected) {
                connected = true;
                clearTimeout(timeoutHandle);
                console.log(`[CREDSJSON] ✅ ${number} connected — tunggu pre-keys...`);

                (async () => {
                    try {
                        const fileCount = await waitUntilPrekeys(sessionDir);
                        console.log(`[CREDSJSON] 📦 ${number} — ${fileCount} file, packing...`);
                        const buf = await packToBuffer(sessionDir);
                        await onConnected(buf, number, fileCount);
                    } catch (e) {
                        try { await onError(e); } catch {}
                    } finally {
                        // Tutup socket, FOLDER TIDAK DIHAPUS
                        closeSocket(sock);
                    }
                })();

                return;
            }

            // ── Koneksi putus ──
            if (connection === 'close' && !connected && !aborted) {

                // Fatal: logout paksa atau forbidden
                if (reason === DisconnectReason.loggedOut || reason === 401 || reason === 403) {
                    clearTimeout(timeoutHandle);
                    aborted = true;
                    closeSocket(sock);
                    try { await onError(new Error(`Sesi ditolak WhatsApp (${reason})`)); } catch {}
                    return;
                }

                // Non-fatal (515 restart required, 428, dsb) → reconnect seperti jadibot
                if (reconnectCount >= MAX_RECONNECT) {
                    clearTimeout(timeoutHandle);
                    aborted = true;
                    closeSocket(sock);
                    try { await onError(new Error(`Gagal terhubung setelah ${MAX_RECONNECT}x reconnect`)); } catch {}
                    return;
                }

                reconnectCount++;
                console.log(`[CREDSJSON] 🔄 ${number} reconnect ${reconnectCount}/${MAX_RECONNECT} (code ${reason})...`);
                closeSocket(sock);
                setTimeout(() => spawnSocket(), 2000);
            }
        });
    }

    await spawnSocket();

    return {
        abort() {
            aborted = true;
            clearTimeout(timeoutHandle);
            if (currentSock) closeSocket(currentSock);
        },
    };
}

/**
 * Bersihkan format nomor → 62xxx
 */
function cleanNomor(nomor) {
    let n = String(nomor).replace(/\D/g, '');
    n = n.replace(/^0+/, '');
    if (n.startsWith('6262')) n = n.slice(2);
    if (!n.startsWith('62')) n = '62' + n;
    return n;
}

/**
 * Hapus folder sesi credsjson/[nomor]/ secara manual
 */
function deleteCredsFolder(number) {
    const dir = path.join(CREDS_BASE_DIR, cleanNomor(number));
    try { fs.rmSync(dir, { recursive: true, force: true }); return true; } catch { return false; }
}

module.exports = {
    startCredsJsonSession,
    cleanNomor,
    formatPairingCode,
    deleteCredsFolder,
};
