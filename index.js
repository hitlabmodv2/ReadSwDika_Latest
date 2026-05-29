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
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const {
        default: makeWASocket,
        delay,
        DisconnectReason,
        Browsers,
        areJidsSameUser,
        isLidUser,
        fetchLatestBaileysVersion,
        useMultiFileAuthState,
        jidNormalizedUser,
        jidDecode,
        downloadMediaMessage,
        getContentType,
} = _require('socketon');
const { createWelcomeCard } = _require('./src/scrape/welcomeCard.cjs');
import pino from 'pino';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';

import JSONDB from './src/db/json.js';
import { kvGet, kvSet, kvMigrateFromJSON, kvMigrateKey } from './src/db/datadb.js';
import { initBotStats } from './src/db/botStats.js';
import { injectClient } from './src/helper/inject.js';
import { getCaseName, loadConfig } from './src/helper/utils.js';
import { MemoryMonitor } from './src/helper/memoryMonitor.js';
import { getPhoneRegion, formatPhoneWithRegion } from './src/helper/phoneRegion.js';
import { ensureTmpDir, startAutoCleaner, stopAutoCleaner, restartAutoCleaner, cleanStaleSessionFiles } from './src/helper/cleaner.js'; // ini baru
import { startJadibot, jadibotMap, purgeExpiredJadibotSessions, getJadibotExpiry, formatRemainingTime, pauseAllJadibotTimers, resumeAllJadibotTimers, restoreConnectedAtMap } from './src/helper/jadibot.js';
import { safeGetPNForLID } from './src/helper/socketCompat.js';
import { saveViewOnceCache, cleanOldViewOnceCache, hasViewOnceCache } from './src/helper/voCache.js';
// ini baru - yg bawah pindah ke sini
import { setupCrashGuard } from './src/helper/crashGuard.js';
import { logError } from './src/db/errorLog.js';
import { initHotReload, getHandler, stopHotReload, onReload } from './src/helper/hotReload.js';

/* ================= VOONCE AUTO-SAVE ================= */
async function autoSaveViewOnce(message, hisoka) {
        const msg = message.message
        if (!msg) return

        let targetMsg = msg
        let isVO = false
        let originalWrapper = null // simpan wrapper asli untuk download

        // Unwrap ephemeral dulu
        if (targetMsg.ephemeralMessage?.message) targetMsg = targetMsg.ephemeralMessage.message

        // Deteksi view-once wrapper
        if (targetMsg.viewOnceMessage?.message) {
                originalWrapper = targetMsg.viewOnceMessage.message
                targetMsg = targetMsg.viewOnceMessage.message
                isVO = true
        } else if (targetMsg.viewOnceMessageV2?.message) {
                originalWrapper = targetMsg.viewOnceMessageV2.message
                targetMsg = targetMsg.viewOnceMessageV2.message
                isVO = true
        } else if (targetMsg.viewOnceMessageV2Extension?.message) {
                originalWrapper = targetMsg.viewOnceMessageV2Extension.message
                targetMsg = targetMsg.viewOnceMessageV2Extension.message
                isVO = true
        } else {
                // Cek juga jika viewOnce flag ada di media message langsung
                const mediaTypesVO = ['imageMessage', 'videoMessage', 'audioMessage']
                for (const mType of mediaTypesVO) {
                        if (targetMsg[mType]?.viewOnce === true) {
                                isVO = true
                                break
                        }
                }
        }

        if (!isVO) return

        const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage']
        const mediaType = getContentType(targetMsg)
        if (!mediaTypes.includes(mediaType)) {
                // interactiveMessage dan tipe non-media lainnya wajar muncul — skip saja tanpa log
                return
        }

        const msgId = message.key.id
        if (hasViewOnceCache(msgId)) return

        try {
                console.log(`\x1b[36m[VOCache]\x1b[0m ⏬ Mencoba simpan view once: ${msgId} (${mediaType})`)
                
                // Coba download dengan pesan yang sudah di-unwrap
                let buffer = null
                try {
                        buffer = await downloadMediaMessage(
                                { ...message, message: targetMsg },
                                'buffer',
                                {},
                                { logger: hisoka.logger, reuploadRequest: hisoka.updateMediaMessage }
                        )
                } catch (dlErr) {
                        console.error(`\x1b[31m[VOCache]\x1b[0m Download pertama gagal (${msgId}): ${dlErr.message}`)
                        // Coba fallback dengan pesan original
                        buffer = await downloadMediaMessage(
                                message,
                                'buffer',
                                {},
                                { logger: hisoka.logger, reuploadRequest: hisoka.updateMediaMessage }
                        )
                }

                if (!buffer || buffer.length === 0) {
                        console.error(`\x1b[31m[VOCache]\x1b[0m Buffer kosong untuk ${msgId}`)
                        return
                }

                const content = targetMsg[mediaType]
                saveViewOnceCache(msgId, buffer, {
                        mediaType,
                        mimetype: content?.mimetype || '',
                        caption: content?.caption || '',
                        ptt: content?.ptt || false,
                        fileName: content?.fileName || '',
                        senderName: message.pushName || '',
                        from: message.key.remoteJid || '',
                })
        } catch (err) {
                console.error(`\x1b[31m[VOCache]\x1b[0m ❌ Gagal simpan ${msgId}: ${err.message}`)
                console.error(err.stack)
        }
}

/* ================= JADIBOT GLOBAL STATE ================= */
global.autoStartedJadibot = new Set();

function isJadibotSessionValid(number) {
  const dir = path.join(process.cwd(), 'jadibot', number);
  return fs.existsSync(path.join(dir, 'creds.json'));
}

/* ================= BOT ADMIN STATUS TRACKER ================= */
function loadBotAdminData() {
  return kvGet('botadmin/botadmin', {});
}

function saveBotAdminData(data) {
  kvSet('botadmin/botadmin', data);
}

function autoAddGroupToAntiTagSW(groupId) {
        try {
                const config = loadConfig();
                if (!config.antiTagSW?.enabled) return;
                const data = kvGet('security/antitagsw', { groups: [], warnings: {} });
                if (!Array.isArray(data.groups)) data.groups = [];
                if (!data.groups.includes(groupId)) {
                        data.groups.push(groupId);
                        kvSet('security/antitagsw', data);
                        console.log(`\x1b[32m[AutoAntiTagSW] ✓ Grup ${groupId} otomatis ditambahkan ke Anti Tag SW (global aktif)\x1b[39m`);
                }
        } catch (err) {
                console.error('\x1b[31m[AutoAntiTagSW] Error:\x1b[39m', err?.message);
        }
}

function saveBotAdminStatus(hisoka, allGroups) {
  try {
    const botNumber = (hisoka.user?.id || '').split('@')[0].split(':')[0];
    if (!botNumber) return;
    const data = loadBotAdminData();
    for (const g of allGroups) {
      const participant = (g.participants || []).find(p => {
        const rawJid = p.jid || p.phoneNumber || p.id || '';
        const pNum = rawJid.split('@')[0].split(':')[0];
        return pNum === botNumber;
      });
      data[g.id] = !!participant?.admin;
    }
    saveBotAdminData(data);
    const adminGroups = Object.values(data).filter(Boolean).length;
    console.info(`\x1b[32m→ Admin    :\x1b[39m ${Object.keys(data).length} grup, admin di ${adminGroups}`);
  } catch (err) {
    console.error('\x1b[31m[BotAdmin] Gagal simpan:\x1b[39m', err?.message);
  }
}

function updateBotAdminStatus(groupId, botNumber, isAdmin) {
  try {
    const data = loadBotAdminData();
    data[groupId] = isAdmin;
    saveBotAdminData(data);
    console.info(`\x1b[32m[BotAdmin] Update ${groupId}: admin=${isAdmin}\x1b[39m`);
  } catch (_) {}
}

if (!process.env.BOT_SESSION_NAME) process.env.BOT_SESSION_NAME = 'default';
if (!process.env.BOT_NUMBER_OWNER) process.env.BOT_NUMBER_OWNER = '1';

const botStats = initBotStats();

const sessionDir = (global.sessionDir = path.join(process.cwd(), 'sessions', process.env.BOT_SESSION_NAME));

if (process.env.BOT_MAX_RETRIES && isNaN(Number(process.env.BOT_MAX_RETRIES))) {
        console.warn('\x1b[33mWarning: BOT_MAX_RETRIES is not a valid number. Disabling max retry limit.\x1b[39m');
        delete process.env.BOT_MAX_RETRIES;
}

const logger = pino({ 
        level: process.env.BOT_LOGGER_LEVEL || 'silent',
        hooks: {
                logMethod(inputArgs, method) {
                        const msg = inputArgs[0];
                        if (typeof msg === 'string' && (msg.includes('Closing session') || msg.includes('SessionEntry'))) {
                                return;
                        }
                        return method.apply(this, inputArgs);
                }
        }
}).child({ class: 'Aja Sendiri' });

const silentLogger = pino({ level: 'silent' });

const filterLogs = (message) => {
        if (typeof message !== 'string') return false;
        const blockedPatterns = [
                'Closing stale open session',
                'Closing session:',
                'Closing session',
                'SessionEntry',
                'prekey bundle',
                'Closing open session',
                '_chains',
                'registrationId',
                'currentRatchet',
                'pendingPreKey',
                'baseKey:',
                'ephemeralKeyPair',
                'lastRemoteEphemeralKey',
                'indexInfo',
                'baseKeyType',
                'Failed to decrypt message',
                'Decrypted message with closed session',
                'Session error',
                'Bad MAC',
                'libsignal/src/crypto.js',
                'libsignal/src/session_cipher.js',
                'verifyMAC',
                'doDecryptWhisperMessage',
                'decryptWithSessions',
                'Message absent from node',
                'chainKey',
                'chainType',
                'messageKeys',
                'previousCounter',
                'rootKey',
                'pubKey',
                'privKey',
                'remoteIdentityKey',
                '<Buffer',
                'Buffer ',
                'signedKeyId',
                'preKeyId',
                'closed:',
                'used:',
                'created:'
        ];
        return blockedPatterns.some(pattern => message.includes(pattern));
};

const isSessionObject = (obj) => {
        if (!obj || typeof obj !== 'object') return false;
        return obj._chains || obj.registrationId || obj.currentRatchet || 
                   obj.indexInfo || obj.pendingPreKey || obj.ephemeralKeyPair ||
                   obj.chainKey || obj.pubKey || obj.privKey || obj.rootKey ||
                   obj.baseKey || obj.signedKeyId || obj.preKeyId;
};

const originalConsoleLog = console.log;
console.log = (...args) => {
        for (const arg of args) {
                if (typeof arg === 'string' && filterLogs(arg)) return;
                if (isSessionObject(arg)) return;
        }
        
        try {
                const fullMessage = args.map(a => {
                        if (typeof a === 'string') return a;
                        if (typeof a === 'object' && a !== null) {
                                const str = JSON.stringify(a);
                                if (str && filterLogs(str)) return '__BLOCKED__';
                                return str;
                        }
                        return String(a);
                }).join(' ');
                
                if (fullMessage.includes('__BLOCKED__') || filterLogs(fullMessage)) return;
        } catch (e) {
                // If stringify fails, check object properties directly
                for (const arg of args) {
                        if (isSessionObject(arg)) return;
                }
        }
        
        originalConsoleLog.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = (...args) => {
        const msg = args[0];
        if (typeof msg === 'string' && filterLogs(msg)) return;
        originalConsoleWarn.apply(console, args);
};

const originalConsoleError = console.error;
console.error = (...args) => {
        const msg = args[0];
        if (typeof msg === 'string' && filterLogs(msg)) return;
        originalConsoleError.apply(console, args);

        // Auto-simpan ke data/error.json secara realtime
        try {
                // Gabungkan semua argumen jadi satu string pesan
                const fullMsg = args.map(a => {
                        if (a instanceof Error) return a.message;
                        if (typeof a === 'object' && a !== null) {
                                try { return JSON.stringify(a); } catch { return String(a); }
                        }
                        return String(a);
                }).join(' ');

                // Skip pesan sistem/koneksi rutin yang bukan error nyata
                const skipPatterns = [
                        'Session expired', 'Connection closed', 'Reconnecting',
                        'Please re-authenticate', 'Failed to request pairing',
                        'Retrying connection', 'WebSocket closed'
                ];
                if (skipPatterns.some(p => fullMsg.includes(p))) return;

                // Ekstrak tag sumber dari format [TAG] di awal pesan
                const tagMatch = fullMsg.match(/^\[([^\]]+)\]/);
                const source = tagMatch ? tagMatch[1] : 'console.error';

                // Buat Error object agar logError bisa ambil stack
                const errObj = args[0] instanceof Error
                        ? args[0]
                        : new Error(fullMsg);

                logError(errObj, source);
        } catch (_) {}
};

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => {
        if (typeof chunk === 'string') {
                if (filterLogs(chunk)) return true;
                if (chunk.includes('SessionEntry {') || chunk.includes('_chains:') || 
                    chunk.includes('registrationId:') || chunk.includes('currentRatchet:') ||
                    chunk.includes('ephemeralKeyPair:') || chunk.includes('indexInfo:') ||
                    chunk.includes('<Buffer')) return true;
        }
        return originalStdoutWrite(chunk, encoding, callback);
};

const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk, encoding, callback) => {
        if (typeof chunk === 'string') {
                if (filterLogs(chunk)) return true;
                if (chunk.includes('SessionEntry {') || chunk.includes('_chains:') || 
                    chunk.includes('registrationId:') || chunk.includes('currentRatchet:') ||
                    chunk.includes('ephemeralKeyPair:') || chunk.includes('indexInfo:') ||
                    chunk.includes('<Buffer')) return true;
        }
        return originalStderrWrite(chunk, encoding, callback);
};

let reconnectCount = 0;
let memoryMonitor = null;

async function main() {
        const sessionName = path.basename(sessionDir);
        console.log(`\x1b[36m→ Session  :\x1b[39m ${sessionName}`);

        await initHotReload();

        if (memoryMonitor) {
                memoryMonitor.stop();
        }
        memoryMonitor = new MemoryMonitor({
                // ini baru
                onLimitReached: async () => {
                        console.log('Restarting cleanly...');
                if (global.hisokaClient) {
                        try {
                                global.hisokaClient.ev.removeAllListeners();
                                global.hisokaClient.ws?.close();
                        } catch {}
                }
                        process.exit(1);
                }
        }); // sampe sini
        memoryMonitor.start();
        global.memoryMonitor = memoryMonitor;

        if (reconnectCount > 0) {
                console.warn(`\x1b[33mReconnecting... Attempt ${reconnectCount}\x1b[39m`);
        }

        // Bersihkan pre-key stale & session lama SEBELUM load state
        // Ini yang menyebabkan delay parah setelah offline lama
        cleanStaleSessionFiles(sessionDir)

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version, isLatest } = await fetchLatestBaileysVersion();

        console.info(`\x1b[32m→ Baileys  :\x1b[39m v${version.join('.')}${isLatest ? '' : ' (update tersedia)'}`);

        const cacheMsg = new Map();
        // ini tambahan
        const MAX_CACHE_SIZE = 200;
        if (global.cacheCleaner) clearInterval(global.cacheCleaner);

                global.cacheCleaner = setInterval(() => {
        if (cacheMsg.size > MAX_CACHE_SIZE) {
                cacheMsg.clear();
                console.log('[CACHE] Message cache cleared');
                }
        }, 60000); // sampe sini
        const groups = new JSONDB('groups', sessionDir);
        const contacts = new JSONDB('contacts', sessionDir);
        const settings = new JSONDB('settings', sessionDir);

        // Cache pemetaan LID -> nomor PN asli (persisten selama runtime)
        const lidPnCache = new Map();
        const cacheLidFromParticipants = (parts) => {
                if (!Array.isArray(parts)) return;
                for (const p of parts) {
                        if (!p) continue;
                        const idRaw = p.id || '';
                        const phoneRaw = p.phoneNumber || p.jid || '';
                        if (!idRaw || !phoneRaw) continue;
                        if (!String(idRaw).endsWith('@lid')) continue;
                        if (String(phoneRaw).endsWith('@lid')) continue;
                        const lidUser = idRaw.split('@')[0];
                        lidPnCache.set(lidUser, phoneRaw);
                        lidPnCache.set(idRaw, phoneRaw);
                }
        };
        const lookupLidPn = (rawLid) => {
                if (!rawLid) return null;
                const norm = String(rawLid);
                if (lidPnCache.has(norm)) return lidPnCache.get(norm);
                const user = norm.split('@')[0];
                if (lidPnCache.has(user)) return lidPnCache.get(user);
                return null;
        };
        // Ekspos cache LID->PN ke modul lain via global agar bisa dipakai
        // sebagai fallback (mis. di event.js untuk auto-read story).
        global.__lidPnCache = lidPnCache;
        global.__lookupLidPn = lookupLidPn;
        global.__cacheLidFromParticipants = cacheLidFromParticipants;

        const config = loadConfig();
        const autoOnlineConfig = config.autoOnline || {};
        
        const cleanupSocket = () => {
                if (global.hisokaClient) {
                        try {
                                global.hisokaClient.ev.removeAllListeners();
                                global.hisokaClient.ws?.close();
                        } catch {}
                }
                if (global.__connectWatchdog) {
                        clearTimeout(global.__connectWatchdog);
                        global.__connectWatchdog = null;
                }
        };

        // Watchdog: kalau dalam 90 detik belum 'open', force reconnect
        if (global.__connectWatchdog) clearTimeout(global.__connectWatchdog);
        global.__connectWatchdog = setTimeout(async () => {
                const state = global.hisokaClient?.ws?.readyState;
                // 1 = OPEN, kalau bukan OPEN berarti stuck
                if (state !== 1) {
                        console.warn('\x1b[33m[Watchdog] Koneksi stuck > 90s, force reconnect...\x1b[39m');
                        cleanupSocket();
                        reconnectCount++;
                        await main();
                }
        }, 90000);

        const hisoka = injectClient(
                makeWASocket({
                        version,
                        logger,
                        auth: {
                                creds: state.creds,
                                keys: state.keys,
                        },
                        browser: ['Ubuntu', 'Chrome', '136.0.7103.93'],
                        generateHighQualityLinkPreview: true,
                        syncFullHistory: true,
                        connectTimeoutMs: 60000,
                        defaultQueryTimeoutMs: 60000,
                        keepAliveIntervalMs: 25000,
                        retryRequestDelayMs: 2000,
                        maxMsgRetryCount: 5,
                        markOnlineOnConnect: autoOnlineConfig.enabled !== false,
                        cachedGroupMetadata: async jid => {
                                const group = groups.read(jid);
                                if (!group || !group.participants?.length) {
                                        const metadata = await hisoka.groupMetadata(jid);
                                        cacheLidFromParticipants(metadata?.participants);
                                        groups.write(jid, metadata);
                                        return metadata;
                                }
                                return group;
                        },
                        getMessage: async key => {
                                const msg = cacheMsg.get(key.id);
                                return msg?.message || '';
                        },
                }),
                cacheMsg,
                contacts,
                groups,
                settings
        );
                hisoka.isMainBot = true;
                hisoka.botNumber = null;

        const pairingNumber = process.env.BOT_NUMBER_PAIR || false;
        if (pairingNumber && !hisoka.authState.creds?.registered) {
                try {
                        let phoneNumber = pairingNumber.replace(/[^0-9]/g, '');
                        await delay(3000);
                        const cfg = loadConfig();
                        const customPairingCode = cfg.pairingCode
                                ? String(cfg.pairingCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8).padEnd(8, '0')
                                : undefined;
                        let code = await hisoka.requestPairingCode(phoneNumber, customPairingCode);
                        const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

                        const phoneInfo = formatPhoneWithRegion(phoneNumber);

                        const cyan = '\x1b[36m';
                        const yellow = '\x1b[33m';
                        const green = '\x1b[32m';
                        const white = '\x1b[37m';
                        const magenta = '\x1b[35m';
                        const bold = '\x1b[1m';
                        const dim = '\x1b[2m';
                        const reset = '\x1b[0m';
                        
                        console.log('');
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log(`${bold}${green}🤖 WHATSAPP BOT PAIRING 2025${reset}`);
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log('');
                        console.log(`${white}📌 Kode Pairing: ${bold}${green}${formattedCode}${reset}`);
                        console.log('');
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log(`${bold}${magenta}📱 INFO NOMOR${reset}`);
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log(`${phoneInfo.flag} ${white}Negara : ${bold}${green}${phoneInfo.region}${reset}`);
                        console.log(`${yellow}📞${reset} ${white}Kode   : ${bold}${yellow}${phoneInfo.countryCode}${reset}`);
                        console.log(`${cyan}📱${reset} ${white}Nomor  : ${bold}${cyan}${phoneInfo.formatted}${reset}`);
                        console.log('');
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log(`${bold}${yellow}📋 CARA PAIRING${reset}`);
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log('');
                        console.log(`${green}1.${reset} Buka ${bold}${green}WhatsApp${reset} di HP`);
                        console.log(`${green}2.${reset} Ketuk ${bold}${yellow}⋮${reset} (titik 3) kanan atas`);
                        console.log(`${green}3.${reset} Pilih ${bold}${yellow}Perangkat Tertaut${reset}`);
                        console.log(`${green}4.${reset} Ketuk ${bold}${yellow}Tautkan Perangkat${reset}`);
                        console.log(`${green}5.${reset} Ketuk ${bold}${cyan}Tautkan dgn nomor telepon${reset}`);
                        console.log(`${green}6.${reset} Masukkan: ${bold}${green}${formattedCode.replace(/-/g, '')}${reset}`);
                        console.log('');
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log(`${bold}${magenta}💡 TIPS${reset}`);
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log(`${dim}•${reset} Pastikan HP online`);
                        console.log(`${dim}•${reset} Kode berlaku ${yellow}3 menit${reset}`);
                        console.log(`${dim}•${reset} Restart bot jika expired / habis masa berlaku`);
                        console.log('');
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log(`${bold}${green}✅ KODE BERHASIL DIBUAT!${reset}`);
                        console.log(`${yellow}⏳ Menunggu konfirmasi WA...${reset}`);
                        console.log(`${cyan}────────────────────────────────${reset}`);
                        console.log('');
                } catch {
                        console.error('\x1b[31mFailed to request pairing code. Please check your pairing number.\x1b[39m');
                        process.exit(1);
                }
        }

        hisoka.ev.on('creds.update', saveCreds);

        hisoka.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
                if (qr && !pairingNumber) {
                        qrcode.generate(qr, { small: true }, code => {
                                console.log('\x1b[36mScan this QR code to connect:\x1b[39m\n');
                                console.log(code);
                        });
                }

                if (connection === 'open') {
                        lastDisconnect = 0;
                        reconnectCount = 0;
                        const userId = hisoka.user?.id?.split(':')[0] || '-';
                        const userName = hisoka.user?.name || '-';
                        hisoka.mainBotNumber = userId; // wajib untuk jadibot
                        const privacySettings = await hisoka.fetchPrivacySettings();
                        settings.write('privacy', privacySettings);

                        // ── Auto-edit pesan restart setelah bot online kembali ──
                        setTimeout(async () => {
                                try {
                                        const _rstData = kvGet('system/restart_notify', null);
                                        if (_rstData?.key && _rstData?.from) {
                                                const _rstMs = Date.now() - (_rstData.time || 0);
                                                const _rstSec = Math.round(_rstMs / 1000);
                                                const _rstWaktu = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                                                await hisoka.sendMessage(_rstData.from, {
                                                        text:
                                                                `╔══════════════════════╗\n` +
                                                                `║  ✅  *B O T  O N L I N E*  ║\n` +
                                                                `╚══════════════════════╝\n\n` +
                                                                `🟢 Bot sudah online kembali!\n\n` +
                                                                `⚙️ Direstart oleh: @${(_rstData.by || '').split('@')[0]}\n` +
                                                                `⏱️ Waktu restart: ${_rstSec} detik\n` +
                                                                `🕐 Online pada: ${_rstWaktu}`,
                                                        mentions: [_rstData.by],
                                                        edit: _rstData.key
                                                });
                                                kvSet('system/restart_notify', null);
                                        }
                                } catch (_) {}
                        }, 3000);

                        const commands = await getCaseName(path.join(process.cwd(), 'src', 'handler', 'message.js'));
                        hisoka.loadedCommands = commands;

                        onReload('message', async () => {
                                try {
                                        const refreshed = await getCaseName(path.join(process.cwd(), 'src', 'handler', 'message.js'));
                                        hisoka.loadedCommands = refreshed;
                                        console.log(`\x1b[32m[HotReload] ✓ loadedCommands diperbarui: ${refreshed.length} commands\x1b[39m`);
                                } catch (e) {
                                        console.error('\x1b[31m[HotReload] Gagal refresh loadedCommands:\x1b[39m', e.message);
                                }
                        });

                        let groupCount = 0;
                        let adminCount = 0;
                        const fetchGroupsWithRetry = async (retries = 5, delayMs = 8000) => {
                                for (let attempt = 1; attempt <= retries; attempt++) {
                                        try {
                                                await new Promise(r => setTimeout(r, delayMs));
                                                const allGroups = Object.values(await hisoka.groupFetchAllParticipating());
                                                allGroups.forEach(g => {
                                                        cacheLidFromParticipants(g?.participants);
                                                        groups.write(g.id, g);
                                                });
                                                groupCount = allGroups.length;
                                                saveBotAdminStatus(hisoka, allGroups);
                                                const botAdminData = loadBotAdminData();
                                                adminCount = Object.values(botAdminData).filter(Boolean).length;
                                                return;
                                        } catch (err) {
                                                const isRateLimit = err?.message?.includes('rate-overlimit') || err?.message?.includes('rate');
                                                if (isRateLimit && attempt < retries) {
                                                        const wait = delayMs * attempt;
                                                        console.warn(`\x1b[33m[Groups] Rate-limit, retry ${attempt}/${retries} dalam ${wait / 1000}s...\x1b[39m`);
                                                        await new Promise(r => setTimeout(r, wait));
                                                } else {
                                                        console.error('\x1b[31m[Groups] Gagal fetch grup:\x1b[39m', err?.message || err);
                                                        return;
                                                }
                                        }
                                }
                        };
                        await fetchGroupsWithRetry();

                        const config2 = loadConfig();
                        const autoOnline2 = config2.autoOnline || {};
                        const modeLabel = autoOnline2.enabled !== false ? 'ONLINE 🟢' : 'OFFLINE 🔴';

                        const G = '\x1b[32m', Y = '\x1b[33m', C = '\x1b[36m', R = '\x1b[0m', B = '\x1b[1m';
                        console.log(`${C}╔══════════════════════════════════╗${R}`);
                        console.log(`${C}║${R}     ${B}${G}🤖  W I L Y  B O T  A K T I F${R}     ${C}║${R}`);
                        console.log(`${C}╠══════════════════════════════════╣${R}`);
                        console.log(`${C}║${R} ${G}✅${R} Nomor  : ${B}${userId}${R}`);
                        console.log(`${C}║${R} ${G}👤${R} Nama   : ${B}${userName}${R}`);
                        console.log(`${C}║${R} ${Y}📋${R} Cmd    : ${B}${commands.length} commands${R}`);
                        console.log(`${C}║${R} ${Y}👥${R} Grup   : ${B}${groupCount} grup (admin: ${adminCount})${R}`);
                        console.log(`${C}║${R} ${G}🌐${R} Status : ${B}${modeLabel}${R}`);
                        console.log(`${C}╚══════════════════════════════════╝${R}`);

                        const startAutoOnline = () => {
                        const config = loadConfig();
                        const autoOnline = config.autoOnline || {};

                                if (global.autoOnlineInterval) {
                                        clearInterval(global.autoOnlineInterval);
                                        global.autoOnlineInterval = null;
                                }

                                const intervalMs = (autoOnline.intervalSeconds || 30) * 1000;

                                if (autoOnline.enabled) {
                                        hisoka.sendPresenceUpdate('available');

                                        global.autoOnlineInterval = setInterval(() => {
                                        hisoka.sendPresenceUpdate('available');

                                for (const sock of jadibotMap.values()) {
                                        try {
                                if (sock?.user) {
                                        sock.sendPresenceUpdate('available');
                                        }
                                } catch {}
                        }

                }, intervalMs);
                                        // status sudah tampil di kotak bot
                                } else {
                                        hisoka.sendPresenceUpdate('unavailable');

                                        global.autoOnlineInterval = setInterval(() => {
                                        hisoka.sendPresenceUpdate('unavailable');

                                for (const sock of jadibotMap.values()) {
                                        try {
                                if (sock?.user) {
                                        sock.sendPresenceUpdate('unavailable');
                                        }
                                } catch {}
                        }

                }, intervalMs);
                                        // status sudah tampil di kotak bot
                                }
                        };

                        startAutoOnline();
                        global.startAutoOnline = startAutoOnline;
                        global.hisokaClient = hisoka;

                        ensureTmpDir();
                        startAutoCleaner(6); // ini tambahan
                        cleanOldViewOnceCache(); // hapus cache vo lama (>7 hari)

                        /* ===================== AUTO INFOWIBU SCHEDULER ===================== */
                        if (global.infoWibuInterval) {
                                clearInterval(global.infoWibuInterval);
                                global.infoWibuInterval = null;
                        }
                        {
                                const _iw = _require(path.join(process.cwd(), 'src', 'scrape', 'infowibu.cjs'));
                                // Cek setiap 5 menit — langsung kirim saat ada episode baru tayang
                                const IW_INTERVAL_MS = 5 * 60 * 1000;

                                const runInfoWibu = async () => {
                                        try {
                                                const daftarGrup = _iw.getEnabledGroups();
                                                if (!daftarGrup.length) return;

                                                // Cari episode yang baru tayang dalam 5 menit terakhir
                                                const episodeBaru = await _iw.cariEpisodeBaru(5);
                                                if (!episodeBaru.length) return;

                                                // Kirim setiap episode baru yang ditemukan
                                                for (const item of episodeBaru) {
                                                        const caption  = await _iw.buatCaptionEpisode(item);
                                                        const urlGambar = _iw.ambilUrlGambar(item);

                                                        // Kirim ke semua grup secara parallel (batch 5)
                                                        const IW_BATCH = 5;
                                                        for (let i = 0; i < daftarGrup.length; i += IW_BATCH) {
                                                                const chunk = daftarGrup.slice(i, i + IW_BATCH);
                                                                await Promise.allSettled(chunk.map(async jid => {
                                                                        try {
                                                                                if (urlGambar) {
                                                                                        await hisoka.sendMessage(jid, {
                                                                                                image: { url: urlGambar },
                                                                                                caption,
                                                                                        });
                                                                                } else {
                                                                                        await hisoka.sendMessage(jid, { text: caption });
                                                                                }
                                                                        } catch (e) {
                                                                                console.error(`[InfoWibu] Gagal kirim ke ${jid}:`, e?.message);
                                                                        }
                                                                }));
                                                                if (i + IW_BATCH < daftarGrup.length) {
                                                                        await new Promise(r => setTimeout(r, 1000));
                                                                }
                                                        }

                                                        // Tandai episode ini sudah dikirim supaya tidak dikirim ulang
                                                        _iw.tandaiSudahKirim(item.idUnik);
                                                        console.log(`[InfoWibu] ✅ Ep ${item.episode} "${item.anime?.title?.romaji}" terkirim ke ${daftarGrup.length} grup (parallel)`);

                                                        // Jeda 3 detik antar episode
                                                        await new Promise(r => setTimeout(r, 3000));
                                                }
                                        } catch (err) {
                                                console.error('[InfoWibu] Error scheduler realtime:', err?.message);
                                        }
                                };

                                // Mulai setelah 15 detik, lalu cek setiap 5 menit
                                setTimeout(() => {
                                        runInfoWibu();
                                        global.infoWibuInterval = setInterval(runInfoWibu, IW_INTERVAL_MS);
                                }, 15000);
                        }
                        /* =================== END AUTO INFOWIBU SCHEDULER =================== */

                        /* ===================== AUTO ANIMASU SCHEDULER ===================== */
                        if (global.animasuInterval) {
                                clearInterval(global.animasuInterval);
                                global.animasuInterval = null;
                        }
                        {
                                const _am = _require(path.join(process.cwd(), 'src', 'scrape', 'animasu.cjs'));
                                const AM_INTERVAL_MS = 5 * 60 * 1000;

                                const runAnimasu = async () => {
                                        try {
                                                const daftarGrup = _am.getEnabledGroups();
                                                if (!daftarGrup.length) return;

                                                const episodeBaru = await _am.cariEpisodeBaru();
                                                if (!episodeBaru.length) return;

                                                // Dedup by animeSlug+epNum — cegah kirim 2x kalau
                                                // Animasu upload 2 post berbeda untuk episode yang sama
                                                const sudahKirimEp = new Set();
                                                const episodeUnik = episodeBaru.filter(item => {
                                                        const key = `${item.animeSlug}::${item.epNum}`;
                                                        if (sudahKirimEp.has(key)) return false;
                                                        sudahKirimEp.add(key);
                                                        return true;
                                                });

                                                for (const item of episodeUnik) {
                                                        const caption   = _am.buatCaption(item);
                                                        const urlGambar = _am.ambilUrlGambar(item);

                                                        // Kirim ke semua grup secara parallel (batch 5)
                                                        const BATCH = 5;
                                                        for (let i = 0; i < daftarGrup.length; i += BATCH) {
                                                                const chunk = daftarGrup.slice(i, i + BATCH);
                                                                await Promise.allSettled(chunk.map(async jid => {
                                                                        try {
                                                                                if (urlGambar) {
                                                                                        await hisoka.sendMessage(jid, {
                                                                                                image: { url: urlGambar },
                                                                                                caption,
                                                                                        });
                                                                                } else {
                                                                                        await hisoka.sendMessage(jid, { text: caption });
                                                                                }
                                                                        } catch (e) {
                                                                                console.error(`[Animasu] Gagal kirim ke ${jid}:`, e?.message);
                                                                        }
                                                                }));
                                                                // Jeda singkat antar batch agar tidak kena rate limit WA
                                                                if (i + BATCH < daftarGrup.length) {
                                                                        await new Promise(r => setTimeout(r, 1000));
                                                                }
                                                        }

                                                        _am.tandaiDanLog(item, daftarGrup);
                                                        console.log(`[Animasu] ✅ Ep ${item.epNum} "${item.judul}" terkirim ke ${daftarGrup.length} grup (parallel)`);
                                                        await new Promise(r => setTimeout(r, 2000));
                                                }
                                        } catch (err) {
                                                console.error('[Animasu] Error scheduler:', err?.message);
                                        }
                                };

                                // Mulai 30 detik setelah start (setelah infowibu)
                                setTimeout(() => {
                                        runAnimasu();
                                        global.animasuInterval = setInterval(runAnimasu, AM_INTERVAL_MS);
                                }, 30000);
                        }
                        /* =================== END AUTO ANIMASU SCHEDULER =================== */

                        /* =================== AUTO ALQANIME NOTIF SCHEDULER =================== */
                        if (global.alqanimeInterval) {
                                clearInterval(global.alqanimeInterval);
                                global.alqanimeInterval = null;
                        }
                        {
                                const ALQ_PATH       = path.join(process.cwd(), 'src', 'scrape', 'alqanime-monitor.cjs');
                                const ALQ_INTERVAL_MS = 60 * 1000;

                                const ALQ_SCRAPE_PATH = path.join(process.cwd(), 'src', 'scrape', 'alqanime.cjs');

                                const runAlqanime = async () => {
                                        if (global.alqanimeRunning) return;
                                        global.alqanimeRunning = true;
                                        try {
                                                delete _require.cache[_require.resolve(ALQ_PATH)];
                                                try { delete _require.cache[_require.resolve(ALQ_SCRAPE_PATH)]; } catch (_) {}
                                                const _alq = _require(ALQ_PATH);

                                                const daftarGrup = _alq.getEnabledGroups();
                                                if (!daftarGrup.length) return;

                                                const episodeBaru = await _alq.cariEpisodeBaru();
                                                if (!episodeBaru.length) return;

                                                // Dedup by url+epNum
                                                const sudahKirimEp = new Set();
                                                const episodeUnik  = episodeBaru.filter(item => {
                                                        const key = item.id || `${item.url}::${item.epNum}`;
                                                        if (sudahKirimEp.has(key)) return false;
                                                        sudahKirimEp.add(key);
                                                        return true;
                                                });

                                                for (const item of episodeUnik) {
                                                        const caption   = _alq.buatCaptionGabung(item);
                                                        const urlGambar = _alq.ambilUrlGambar(item);

                                                        const BATCH = 5;
                                                        for (let i = 0; i < daftarGrup.length; i += BATCH) {
                                                                const chunk = daftarGrup.slice(i, i + BATCH);
                                                                await Promise.allSettled(chunk.map(async jid => {
                                                                        try {
                                                                                // 1 pesan: gambar + caption gabungan (info + sinopsis + download)
                                                                                if (urlGambar) {
                                                                                        await hisoka.sendMessage(jid, {
                                                                                                image: { url: urlGambar },
                                                                                                caption,
                                                                                        });
                                                                                } else {
                                                                                        await hisoka.sendMessage(jid, { text: caption });
                                                                                }
                                                                        } catch (e) {
                                                                                console.error(`[AlqanimeNotif] Gagal kirim ke ${jid}:`, e?.message);
                                                                        }
                                                                }));
                                                                if (i + BATCH < daftarGrup.length) {
                                                                        await new Promise(r => setTimeout(r, 1000));
                                                                }
                                                        }

                                                        _alq.tandaiDanLog(item, daftarGrup);
                                                        console.log(`[AlqanimeNotif] ✅ Ep ${item.epNum} "${item.judul}" terkirim ke ${daftarGrup.length} grup`);
                                                        await new Promise(r => setTimeout(r, 2000));
                                                }
                                        } catch (err) {
                                                console.error('[AlqanimeNotif] Error scheduler:', err?.message);
                                        } finally {
                                                global.alqanimeRunning = false;
                                        }
                                };

                                // Mulai 45 detik setelah start (setelah animasu)
                                setTimeout(() => {
                                        runAlqanime();
                                        global.alqanimeInterval = setInterval(runAlqanime, ALQ_INTERVAL_MS);
                                }, 45000);
                        }
                        /* ================= END AUTO ALQANIME NOTIF SCHEDULER ================= */

                        /* ===================== AUTO TVONENEWS SCHEDULER ===================== */
                        if (global.tvoneInterval) {
                                clearInterval(global.tvoneInterval);
                                global.tvoneInterval = null;
                        }
                        {
                                const TV_TVPATH    = path.join(process.cwd(), 'src', 'scrape', 'tvonenews.cjs');
                                const TV_INTERVAL_MS = 5 * 60 * 1000;

                                const runTVOne = async () => {
                                        try {
                                                // Selalu reload modul supaya perubahan langsung aktif
                                                delete _require.cache[_require.resolve(TV_TVPATH)];
                                                const _tv = _require(TV_TVPATH);

                                                const daftarGrup = _tv.getEnabledGroups();
                                                if (!daftarGrup.length) return;

                                                const beritaBaru = await _tv.cariBeritaBaru();
                                                if (!beritaBaru.length) return;

                                                for (const item of beritaBaru) {
                                                        const caption   = _tv.buatCaption(item);
                                                        const urlGambar = item.cover || null;

                                                        // Download buffer dulu → kompatibel semua versi WA
                                                        let imgBuffer = null;
                                                        if (urlGambar) {
                                                                imgBuffer = await _tv.downloadImageBuffer(urlGambar);
                                                        }

                                                        // Kirim ke semua grup secara parallel (batch 5)
                                                        const TV_BATCH = 5;
                                                        for (let i = 0; i < daftarGrup.length; i += TV_BATCH) {
                                                                const chunk = daftarGrup.slice(i, i + TV_BATCH);
                                                                await Promise.allSettled(chunk.map(async jid => {
                                                                        try {
                                                                                if (imgBuffer) {
                                                                                        await hisoka.sendMessage(jid, {
                                                                                                image   : imgBuffer,
                                                                                                mimetype: 'image/jpeg',
                                                                                                caption,
                                                                                        });
                                                                                } else if (urlGambar) {
                                                                                        await hisoka.sendMessage(jid, {
                                                                                                image: { url: urlGambar },
                                                                                                caption,
                                                                                        });
                                                                                } else {
                                                                                        await hisoka.sendMessage(jid, { text: caption });
                                                                                }
                                                                        } catch (e) {
                                                                                console.error(`[TVOneNews] Gagal kirim ke ${jid}:`, e?.message);
                                                                        }
                                                                }));
                                                                if (i + TV_BATCH < daftarGrup.length) {
                                                                        await new Promise(r => setTimeout(r, 1000));
                                                                }
                                                        }

                                                        _tv.tandaiDanLog(item, daftarGrup);
                                                        console.log(`[TVOneNews] ✅ "${item.judul?.slice(0,50)}" terkirim ke ${daftarGrup.length} grup (parallel)`);
                                                }
                                        } catch (err) {
                                                console.error('[TVOneNews] Error scheduler:', err?.message);
                                        }
                                };

                                // Mulai 45 detik setelah start, lalu setiap 5 menit
                                setTimeout(() => {
                                        runTVOne();
                                        global.tvoneInterval = setInterval(runTVOne, TV_INTERVAL_MS);
                                }, 45000);
                        }
                        /* =================== END AUTO TVONENEWS SCHEDULER =================== */

                        /* ===================== AUTO MALNEWS SCHEDULER ===================== */
                        if (global.malnewsInterval) {
                                clearInterval(global.malnewsInterval);
                                global.malnewsInterval = null;
                        }
                        {
                                const MAL_PATH        = path.join(process.cwd(), 'src', 'scrape', 'malnews.cjs');
                                const MAL_INTERVAL_MS = 5 * 60 * 1000;

                                const runMALNews = async () => {
                                        try {
                                                delete _require.cache[_require.resolve(MAL_PATH)];
                                                const _mal = _require(MAL_PATH);

                                                const daftarGrup = _mal.getEnabledGroups();
                                                if (!daftarGrup.length) return;

                                                const beritaBaru = await _mal.cariBeritaBaru();
                                                if (!beritaBaru.length) return;

                                                for (const item of beritaBaru) {
                                                        const caption   = _mal.buatCaption(item);
                                                        const urlGambar = _mal.ambilUrlGambar(item);

                                                        const MAL_BATCH = 5;
                                                        for (let i = 0; i < daftarGrup.length; i += MAL_BATCH) {
                                                                const chunk = daftarGrup.slice(i, i + MAL_BATCH);
                                                                await Promise.allSettled(chunk.map(async jid => {
                                                                        try {
                                                                                if (urlGambar) {
                                                                                        await hisoka.sendMessage(jid, {
                                                                                                image  : { url: urlGambar },
                                                                                                caption,
                                                                                        });
                                                                                } else {
                                                                                        await hisoka.sendMessage(jid, { text: caption });
                                                                                }
                                                                        } catch (e) {
                                                                                console.error(`[MALNews] Gagal kirim ke ${jid}:`, e?.message);
                                                                        }
                                                                }));
                                                                if (i + MAL_BATCH < daftarGrup.length) {
                                                                        await new Promise(r => setTimeout(r, 1000));
                                                                }
                                                        }

                                                        _mal.tandaiDanLog(item, daftarGrup);
                                                        console.log(`[MALNews] ✅ "${(item.judulID || item.judul)?.slice(0,50)}" terkirim ke ${daftarGrup.length} grup`);
                                                }
                                        } catch (err) {
                                                console.error('[MALNews] Error scheduler:', err?.message);
                                        }
                                };

                                // Mulai 60 detik setelah start, lalu setiap 5 menit
                                setTimeout(() => {
                                        runMALNews();
                                        global.malnewsInterval = setInterval(runMALNews, MAL_INTERVAL_MS);
                                }, 60000);
                        }
                        /* =================== END AUTO MALNEWS SCHEDULER =================== */

                        /* ===================== AUTO SHOLAT SCHEDULER ===================== */
                        if (global.autoSholatInterval) {
                                clearInterval(global.autoSholatInterval);
                                global.autoSholatInterval = null;
                        }
                        {
                                const AS_PATH = path.join(process.cwd(), 'src', 'scrape', 'autosholat.cjs');
                                // Lacak sholat yang sudah dikirim hari ini (reset otomatis tiap hari baru)
                                let _sholatTerkirimHariIni = new Set();
                                let _hariTerakhirSholat    = '';

                                const runAutoSholat = async () => {
                                        try {
                                                const _as = _require(AS_PATH);
                                                const daftarGrup = _as.getEnabledGroups();
                                                if (!daftarGrup.length) return;

                                                // Reset tracker setiap hari baru (WIB)
                                                const hariIni = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
                                                if (_hariTerakhirSholat !== hariIni) {
                                                        _sholatTerkirimHariIni = new Set();
                                                        _hariTerakhirSholat    = hariIni;
                                                }

                                                const cocok = await _as.cekWaktuSholat();
                                                if (!cocok) return;
                                                if (_sholatTerkirimHariIni.has(cocok.nama)) return; // sudah dikirim
                                                _sholatTerkirimHariIni.add(cocok.nama);

                                                const jadwal  = await _as.getJadwalHariIni();
                                                const caption = _as.buatCaption(cocok.nama, cocok.waktu, jadwal);
                                                const urlGbr  = await _as.buatGambarOverlay(cocok.nama, cocok.waktu);
                                                const urlAud  = _as.getAudio(cocok.nama);

                                                console.log(`[AutoSholat] ⏰ ${cocok.nama} ${cocok.waktu} WIB → kirim ke ${daftarGrup.length} grup`);

                                                const AS_BATCH = 5;
                                                for (let i = 0; i < daftarGrup.length; i += AS_BATCH) {
                                                        const chunk = daftarGrup.slice(i, i + AS_BATCH);
                                                        const _asCfg      = loadConfig();
                                                        const _asOwner0   = Array.isArray(_asCfg.owners) ? _asCfg.owners[0] : '';
                                                        const _asEmoji    = _as.EMOJI_SHOLAT[cocok.nama]  || '🕌';
                                                        const _asUcapan   = _as.UCAPAN_SHOLAT[cocok.nama] || 'Segera tunaikan sholat 🤲';
                                                        const _asThumb    = await _as.buatThumbnail(cocok.nama);

                                                        await Promise.allSettled(chunk.map(async jid => {
                                                                try {
                                                                        // Kirim gambar bersih + info sholat di luar gambar (externalAdReply)
                                                                        const imgMsg = await hisoka.sendMessage(jid, {
                                                                                image  : urlGbr,
                                                                                caption: caption,
                                                                                contextInfo: {
                                                                                        externalAdReply: {
                                                                                                showAdAttribution : false,
                                                                                                title             : `${_asEmoji} Sholat ${cocok.nama} — ${cocok.waktu} WIB`,
                                                                                                body              : _asUcapan,
                                                                                                sourceUrl         : `https://wa.me/${_asOwner0}`,
                                                                                                mediaType         : 1,
                                                                                                renderLargerThumbnail: true,
                                                                                                thumbnail         : _asThumb,
                                                                                        },
                                                                                },
                                                                        });
                                                                        await hisoka.sendMessage(jid, {
                                                                                audio   : { url: urlAud },
                                                                                ptt     : true,
                                                                                mimetype: 'audio/mpeg',
                                                                        }, { quoted: imgMsg });
                                                                } catch (e) {
                                                                        console.error(`[AutoSholat] Gagal kirim ke ${jid}:`, e?.message);
                                                                }
                                                        }));
                                                        if (i + AS_BATCH < daftarGrup.length) {
                                                                await new Promise(r => setTimeout(r, 1500));
                                                        }
                                                }
                                                console.log(`[AutoSholat] ✅ ${cocok.nama} terkirim ke ${daftarGrup.length} grup`);
                                        } catch (err) {
                                                console.error('[AutoSholat] Error scheduler:', err?.message);
                                        }
                                };

                                // Cek setiap 60 detik, mulai setelah 10 detik
                                setTimeout(() => {
                                        runAutoSholat();
                                        global.autoSholatInterval = setInterval(runAutoSholat, 60 * 1000);
                                }, 10000);
                        }
                        /* =================== END AUTO SHOLAT SCHEDULER =================== */

                        /* ===================== AUTO START SEMUA JADIBOT (STABIL) ===================== */
const jadibotDir = path.join(process.cwd(), 'jadibot');

setTimeout(() => {
  if (!fs.existsSync(jadibotDir)) return;

  resumeAllJadibotTimers();
  restoreConnectedAtMap();
  const expiredBots = purgeExpiredJadibotSessions();

  const bots = fs.readdirSync(jadibotDir).filter(name => {
    const fullPath = path.join(jadibotDir, name);
    return fs.statSync(fullPath).isDirectory() && /^\d+$/.test(name);
  });

  if (!bots.length) return;

  const C = '\x1b[36m', G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[0m', B = '\x1b[1m';
  const RED = '\x1b[31m', DIM = '\x1b[2m';

  const validBots = [];
  const invalidBots = [];
  for (const number of bots) {
    if (global.autoStartedJadibot.has(number)) continue;
    global.autoStartedJadibot.add(number);
    if (!isJadibotSessionValid(number)) {
      invalidBots.push(number);
    } else {
      validBots.push(number);
    }
  }

  if (!validBots.length && !invalidBots.length && !expiredBots.length) return;

  console.log(`${C}╔══════════════════════════════════╗${R}`);
  console.log(`${C}║${R}   ${B}${Y}🤖  A U T O  J A D I B O T${R}         ${C}║${R}`);
  console.log(`${C}╠══════════════════════════════════╣${R}`);
  console.log(`${C}║${R} ${Y}📦${R} Total  : ${B}${validBots.length + invalidBots.length + expiredBots.length} sesi tersimpan${R}`);
  for (const number of expiredBots) {
    console.log(`${C}║${R} ${Y}⏰ ${R} ${number} - expired, dihapus`);
  }
  for (const number of invalidBots) {
    console.log(`${C}║${R} ${Y}⚠️ ${R} ${number} - tidak valid`);
  }
  for (const number of validBots) {
    const meta = getJadibotExpiry(number);
    let sisaLabel, sisaColor, icon;
    if (!meta) {
      sisaColor = DIM; icon = '❓'; sisaLabel = 'tidak ada data';
    } else if (meta.permanent === true) {
      sisaColor = C; icon = '♾️ '; sisaLabel = 'Permanent';
    } else {
      const remainingMs = Number(meta.expiresAt) - Date.now();
      if (remainingMs <= 0) {
        sisaColor = RED; icon = '💀'; sisaLabel = 'kedaluwarsa';
      } else if (remainingMs < 60 * 60 * 1000) {
        sisaColor = RED; icon = '🔴'; sisaLabel = formatRemainingTime(remainingMs);
      } else if (remainingMs < 24 * 60 * 60 * 1000) {
        sisaColor = Y;   icon = '🟡'; sisaLabel = formatRemainingTime(remainingMs);
      } else {
        sisaColor = G;   icon = '🟢'; sisaLabel = formatRemainingTime(remainingMs);
      }
    }
    console.log(`${C}║${R} ${G}▶  ${R}${B}${number}${R} ${icon} ${sisaColor}${sisaLabel}${R}`);
  }
  console.log(`${C}╚══════════════════════════════════╝${R}`);

  for (const number of validBots) {
    startJadibot(
      number,
      () => {},
      hisoka.user.id.split(':')[0].split('@')[0],
      null,
      null,
      undefined,
      hisoka
    );
  }
}, 3000); // delay agar socket utama stabil
}

                if (connection === 'open') {
                        if (global.__connectWatchdog) {
                                clearTimeout(global.__connectWatchdog);
                                global.__connectWatchdog = null;
                        }
                }

                if (connection === 'close') {
                        if (global.autoOnlineInterval) {
                                clearInterval(global.autoOnlineInterval);
                                global.autoOnlineInterval = null;
                                console.log(`\x1b[33m[AutoOnline]\x1b[39m Cleared on disconnect`);
                        }

                        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode || 0;
                        const C = '\x1b[36m', Y = '\x1b[33m', R = '\x1b[0m', B = '\x1b[1m';

                        switch (statusCode) {
                                case DisconnectReason.loggedOut: {
                                        console.log('');
                                        console.log(`${C}════════════════════════════════════${R}`);
                                        console.log(`${B}${Y}⚠️  BOT UTAMA LOGOUT — RE-AUTH${R}`);
                                        console.log(`${C}════════════════════════════════════${R}`);
                                        console.log(`${Y}• Sesi bot utama dihapus${R}`);
                                        console.log(`${Y}• Jadibot aktif tetap berjalan${R}`);
                                        console.log(`${Y}• Menampilkan kode pairing / QR baru...${R}`);
                                        console.log(`${C}════════════════════════════════════${R}`);
                                        console.log('');

                                        cleanupSocket();

                                        try {
                                                const dirContents = await fs.promises.readdir(sessionDir);
                                                for (const file of dirContents) {
                                                        if (file.startsWith('.env')) continue;
                                                        await fs.promises.rm(path.join(sessionDir, file), { recursive: true, force: true });
                                                }
                                        } catch {}

                                        await delay(2000);
                                        reconnectCount = 0;
                                        await main();
                                        break;
                                }

                                case DisconnectReason.forbidden: {
                                        reconnectCount++;
                                        const waitForbidden = Math.min(10 * reconnectCount, 60);
                                        console.log('');
                                        console.log(`${C}════════════════════════════════════${R}`);
                                        console.log(`${B}${Y}⚠️  FORBIDDEN (403) — RECONNECTING${R}`);
                                        console.log(`${C}════════════════════════════════════${R}`);
                                        console.log(`${Y}• Bukan logout — sesi TIDAK dihapus${R}`);
                                        console.log(`${Y}• Reconnect dalam ${waitForbidden}s... (Attempt ${reconnectCount})${R}`);
                                        console.log(`${C}════════════════════════════════════${R}`);
                                        console.log('');
                                        await delay(waitForbidden * 1000);
                                        cleanupSocket();
                                        await main();
                                        break;
                                }

                                case DisconnectReason.restartRequired:
                                        console.info('\x1b[33mRestart required. Reconnecting...\x1b[39m');
                                        cleanupSocket();
                                        await main();
                                        break;

                                case 408:
                                        if (hisoka.authState.creds?.registered) {
                                                console.info('\x1b[33mConnection timeout. Reconnecting in 5s...\x1b[39m');
                                                await delay(5000);
                                        } else {
                                                reconnectCount++;
                                                console.info(`\x1b[33mPairing timeout. Reconnecting in ${Math.min(5 * reconnectCount, 60)}s... (Attempt ${reconnectCount})\x1b[39m`);
                                                await delay(Math.min(5 * reconnectCount, 60) * 1000);
                                        }
                                        cleanupSocket();
                                        await main();
                                        break;

                                case 515:
                                        console.info('\x1b[33mStream error (515). Reconnecting in 5s...\x1b[39m');
                                        await delay(5000);
                                        cleanupSocket();
                                        await main();
                                        break;

                                case 503:
                                        reconnectCount++;
                                        const waitSvc = Math.min(10 * reconnectCount, 60);
                                        console.warn(`\x1b[33mService unavailable (503). Reconnecting in ${waitSvc}s... (Attempt ${reconnectCount})\x1b[39m`);
                                        await delay(waitSvc * 1000);
                                        cleanupSocket();
                                        await main();
                                        break;

                                default:
                                        reconnectCount++;
                                        const waitSec = Math.min(5 * reconnectCount, 60);
                                        console.error(`\x1b[31mConnection closed [${statusCode}]. Reconnecting in ${waitSec}s... (Attempt ${reconnectCount})\x1b[39m`);
                                        await delay(waitSec * 1000);
                                        cleanupSocket();
                                        await main();
                                        break;
                        }
                }
        });

        hisoka.ev.on('contacts.upsert', async contactsData => {
                try {
                        await Promise.all(
                                contactsData.map(async contact => {
                                        try {
                                                const jid = await hisoka.resolveLidToPN({ remoteJid: contact.id, remoteJidAlt: contact.phoneNumber });
                                                const existingContact = (await contacts.read(jid)) || {};
                                                contacts.write(
                                                        jid,
                                                        Object.assign(
                                                                isLidUser(contact.id) ? { id: jid, lid: contact.id } : {},
                                                                { isContact: true },
                                                                existingContact,
                                                                contact
                                                        )
                                                );
                                        } catch (_) {}
                                })
                        );
                } catch (err) { console.error('[contacts.upsert]', err?.message); }
        });

        hisoka.ev.on('contacts.update', async contactsData => {
                try {
                        await Promise.all(
                                contactsData.map(async contact => {
                                        try {
                                                const jid = await hisoka.resolveLidToPN({ remoteJid: contact.id, remoteJidAlt: contact.phoneNumber });
                                                const existingContact = (await contacts.read(jid)) || {};
                                                contacts.write(
                                                        jid,
                                                        Object.assign(isLidUser(contact.id) ? { id: jid, lid: contact.id } : {}, existingContact, contact)
                                                );
                                        } catch (_) {}
                                })
                        );
                } catch (err) { console.error('[contacts.update]', err?.message); }
        });

        hisoka.ev.on('groups.upsert', async groupsData => {
                try { await Promise.all(
                        groupsData.map(async group => {
                                try {
                                const groupId = group.id;
                                const existingGroup = groups.read(groupId) || {};
                                groups.write(groupId, { ...existingGroup, ...group });

                                // Auto-add ke Anti Tag SW jika global aktif
                                autoAddGroupToAntiTagSW(groupId);

                                if (process.env.BOT_AUTO_UPSWGC === 'true') {
                                        try {
                                                await delay(2000);
                                                const groupMetadata = await hisoka.groupMetadata(groupId);
                                                const allMembers = groupMetadata.participants.map(p => p.id);
                                                const groupName = groupMetadata.subject;
                                                
                                                const storyText = `🎉 Bot telah bergabung ke grup:\n\n*${groupName}*\n\nKetik .menu untuk melihat fitur!`;
                                                
                                                await hisoka.sendMessage('status@broadcast', 
                                                        { text: storyText },
                                                        {
                                                                statusJidList: allMembers,
                                                                broadcast: true,
                                                                backgroundColor: '#128C7E',
                                                                font: 2
                                                        }
                                                );

                                                console.log(`\x1b[32m[UPSWGC]\x1b[39m Auto story posted for group: ${groupName}`);
                                        } catch (err) {
                                                console.error(`\x1b[31m[UPSWGC] Error:\x1b[39m`, err.message);
                                        }
                                }
                                } catch (_) {}
                        })
                ); } catch (err) { console.error('[groups.upsert]', err?.message); }
        });

        hisoka.ev.on('groups.update', async groupsData => {
                try {
                        await Promise.all(
                                groupsData.map(group => {
                                        try {
                                                const groupId = group.id;
                                                const existingGroup = groups.read(groupId) || {};
                                                return groups.write(groupId, { ...existingGroup, ...group });
                                        } catch (_) {}
                                })
                        );
                } catch (err) { console.error('[groups.update]', err?.message); }
        });

        hisoka.ev.on('group-participants.update', ({ id, author, participants, action }) => {
                const existingGroup = groups.read(id) || {};
                const botNumber = (hisoka.user?.id || '').split('@')[0].split(':')[0];

                switch (action) {
                        case 'add': {
                                existingGroup.participants = [...(existingGroup.participants || []), ...participants];
                                // Jika bot sendiri yang di-add ke grup, auto-add ke Anti Tag SW
                                const botAdded = participants.some(p => {
                                        const rawJid = p.jid || p.phoneNumber || p.id || '';
                                        const pNum = rawJid.split('@')[0].split(':')[0];
                                        return pNum === botNumber;
                                });
                                if (botAdded) autoAddGroupToAntiTagSW(id);
                                break;
                        }
                        case 'remove':
                                existingGroup.participants = (existingGroup.participants || []).filter(p => {
                                        const existId = p.phoneNumber || p.id;
                                        return !participants.some(removed => areJidsSameUser(existId, removed.phoneNumber || removed.id));
                                });
                                break;
                        case 'promote':
                        case 'demote': {
                                existingGroup.participants = (existingGroup.participants || []).map(p => {
                                        const existId = p.phoneNumber || p.id;
                                        if (participants.some(modified => areJidsSameUser(existId, modified.phoneNumber || modified.id))) {
                                                return { ...p, admin: action === 'promote' ? 'admin' : null };
                                        }
                                        return p;
                                });
                                // Cek apakah bot sendiri yang di-promote/demote
                                const botAffected = participants.some(p => {
                                        const rawJid = p.jid || p.phoneNumber || p.id || '';
                                        const pNum = rawJid.split('@')[0].split(':')[0];
                                        return pNum === botNumber;
                                });
                                if (botAffected) {
                                        const isNowAdmin = action === 'promote';
                                        updateBotAdminStatus(id, botNumber, isNowAdmin);
                                        console.info(`\x1b[32m[BotAdmin] Bot ${action === 'promote' ? 'dijadikan ADMIN' : 'dicopot dari admin'} di grup ${id}\x1b[39m`);
                                }
                                break;
                        }
                        default:
                                console.warn(`\x1b[33mUnknown group action: ${action}\x1b[39m`);
                                return;
                }

                groups.write(id, existingGroup);

                // Welcome & Goodbye Canvas
                if (action === 'add' || action === 'remove') {
                        (async () => {
                                try {
                                        const wgConfig = loadConfig().welcomeGoodbye || {};
                                        if (!wgConfig.enabled) return;
                                        const groupSettings = (wgConfig.groups || {})[id] || {};
                                        const shouldSend = action === 'add'
                                                ? groupSettings.welcome !== false && groupSettings.welcome === true
                                                : groupSettings.goodbye !== false && groupSettings.goodbye === true;
                                        if (!shouldSend) return;

                                        const groupInfo = groups.read(id) || {};
                                        const groupName = groupInfo.subject || id.split('@')[0];
                                        const type = action === 'add' ? 'welcome' : 'goodbye';

                                        // Ambil metadata grup untuk jumlah anggota realtime
                                        let memberCount = null;
                                        let groupMeta = null;
                                        try {
                                                groupMeta = await hisoka.groupMetadata(id);
                                                memberCount = groupMeta?.participants?.length || null;
                                                cacheLidFromParticipants(groupMeta?.participants);
                                        } catch (_) {}
                                        const groupParticipants = groupMeta?.participants || groupInfo.participants || [];
                                        cacheLidFromParticipants(groupInfo?.participants);
                                        const adminCount = groupParticipants.filter(p => p?.admin).length;
                                        const formatJakartaDate = (date) => {
                                                return date.toLocaleDateString('id-ID', {
                                                        timeZone: 'Asia/Jakarta',
                                                        weekday: 'long',
                                                        day: 'numeric',
                                                        month: 'long',
                                                        year: 'numeric',
                                                });
                                        };
                                        const formatJakartaTime = (date) => {
                                                return date.toLocaleTimeString('id-ID', {
                                                        timeZone: 'Asia/Jakarta',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: false,
                                                }).replace('.', ':') + ' WIB';
                                        };
                                        const eventNow = new Date();
                                        const eventDate = formatJakartaDate(eventNow);
                                        const eventTime = formatJakartaTime(eventNow);
                                        const groupCreatedRaw = Number(groupMeta?.creation || groupInfo.creation || 0);
                                        const groupCreatedAt = groupCreatedRaw
                                                ? new Date(groupCreatedRaw > 1000000000000 ? groupCreatedRaw : groupCreatedRaw * 1000)
                                                : null;
                                        const groupCreatedDate = groupCreatedAt ? formatJakartaDate(groupCreatedAt) : 'Tidak diketahui';
                                        const groupCreatedTime = groupCreatedAt ? formatJakartaTime(groupCreatedAt) : '-';
                                        const groupOwnerJidRaw = groupMeta?.owner || groupInfo.owner || groupMeta?.subjectOwner || groupMeta?.descOwner || null;
                                        const mainAdmin = groupParticipants.find(p => p?.admin === 'superadmin') || groupParticipants.find(p => p?.admin);
                                        const mainAdminJidRaw = mainAdmin ? (mainAdmin.jid || mainAdmin.phoneNumber || mainAdmin.id || null) : null;
                                        const groupOwnerJid = groupOwnerJidRaw
                                                ? jidNormalizedUser(groupOwnerJidRaw)
                                                : mainAdminJidRaw
                                                        ? jidNormalizedUser(mainAdminJidRaw)
                                                        : null;
                                        const groupOwnerNum = groupOwnerJid ? (jidDecode(groupOwnerJid)?.user || groupOwnerJid.split('@')[0]) : null;
                                        const groupOwnerText = groupOwnerNum ? `@${groupOwnerNum}` : null;
                                        const groupOwnerLine = groupOwnerText ? `│ • Admin Utama: ${groupOwnerText}\n` : '';

                                        // Helper: resolve LID -> nomor PN asli via groupMetadata.participants + cache
                                        const resolveRealJid = (rawJid) => {
                                                if (!rawJid) return rawJid;
                                                const norm = jidNormalizedUser(rawJid);
                                                if (!norm.endsWith('@lid')) return norm;
                                                const lidUser = jidDecode(norm)?.user || norm.split('@')[0];
                                                const match = groupParticipants.find(p => {
                                                        const pid = p?.id || '';
                                                        const pidUser = jidDecode(pid)?.user || pid.split('@')[0];
                                                        return pid === norm || pidUser === lidUser;
                                                });
                                                if (match) {
                                                        const realRaw = match.phoneNumber || match.jid || match.id;
                                                        if (realRaw && !String(realRaw).endsWith('@lid')) {
                                                                return jidNormalizedUser(realRaw);
                                                        }
                                                }
                                                // Fallback ke cache LID->PN runtime
                                                const cached = lookupLidPn(norm) || lookupLidPn(lidUser);
                                                if (cached && !String(cached).endsWith('@lid')) {
                                                        return jidNormalizedUser(cached);
                                                }
                                                return norm;
                                        };

                                        // Resolve author (admin yang add/kick)
                                        const authorJid = author ? resolveRealJid(author) : null;
                                        const authorNum = authorJid ? (jidDecode(authorJid)?.user || authorJid.split('@')[0]) : null;
                                        let authorName = null;
                                        if (authorJid) {
                                                authorName = hisoka.getName
                                                        ? (hisoka.getName(authorJid, true) || hisoka.getName(authorJid) || null)
                                                        : null;
                                                if (!authorName || authorName === authorNum) {
                                                        const ac = hisoka.contacts?.read ? hisoka.contacts.read(authorJid) : null;
                                                        authorName = ac?.name || ac?.notify || ac?.verifiedName || null;
                                                }
                                                if (!authorName) authorName = `+${authorNum}`;
                                        }

                                        for (const pJid of participants) {
                                                const jid = typeof pJid === 'string' ? pJid : (pJid.jid || pJid.phoneNumber || pJid.id || '');
                                                if (!jid) continue;
                                                const normalJid = resolveRealJid(jid);
                                                const numOnly = jidDecode(normalJid)?.user || normalJid.split('@')[0];

                                                // Skip bot itself
                                                if (numOnly === botNumber) continue;

                                                // Get name
                                                let name = hisoka.getName
                                                        ? (hisoka.getName(normalJid, true) || hisoka.getName(normalJid) || null)
                                                        : null;
                                                if (!name || name === numOnly) {
                                                        const contact = hisoka.contacts?.read ? hisoka.contacts.read(normalJid) : null;
                                                        name = contact?.name || contact?.notify || contact?.verifiedName || null;
                                                }
                                                if (!name) name = `+${numOnly}`;

                                                // Tentukan cara bergabung / keluar
                                                const isSelfAction = !authorNum || authorNum === numOnly;
                                                let joinInfo = null;
                                                let caption = '';
                                                let mentionJids = [normalJid, groupOwnerJid];

                                                if (action === 'add') {
                                                        if (isSelfAction) {
                                                                joinInfo = 'via tautan undangan';
                                                                caption =
                                                                        `╭─「 *WELCOME* 」\n` +
                                                                        `│ ⟡ User\n` +
                                                                        `│ • Anggota: @${numOnly}\n` +
                                                                        `│ • Masuk: ${eventDate}\n` +
                                                                        `│ • Jam: ${eventTime}\n` +
                                                                        `│\n` +
                                                                        `│ ⟡ Grup\n` +
                                                                        `│ • Nama: ${groupName}\n` +
                                                                        `│ • Member: ${memberCount ?? '?'} | Admin: ${adminCount || '?'}\n` +
                                                                        groupOwnerLine +
                                                                        `│ • Dibuat: ${groupCreatedDate}\n` +
                                                                        `│ • Jam GC: ${groupCreatedTime}\n` +
                                                                        `│\n` +
                                                                        `│ ⟡ Aksi\n` +
                                                                        `│ • Via: Tautan Undangan\n` +
                                                                        `╰─ Selamat bergabung.`;
                                                        } else {
                                                                joinInfo = `diundang oleh ${authorName}`;
                                                                caption =
                                                                        `╭─「 *WELCOME* 」\n` +
                                                                        `│ ⟡ User\n` +
                                                                        `│ • Anggota: @${numOnly}\n` +
                                                                        `│ • Masuk: ${eventDate}\n` +
                                                                        `│ • Jam: ${eventTime}\n` +
                                                                        `│\n` +
                                                                        `│ ⟡ Grup\n` +
                                                                        `│ • Nama: ${groupName}\n` +
                                                                        `│ • Member: ${memberCount ?? '?'} | Admin: ${adminCount || '?'}\n` +
                                                                        groupOwnerLine +
                                                                        `│ • Dibuat: ${groupCreatedDate}\n` +
                                                                        `│ • Jam GC: ${groupCreatedTime}\n` +
                                                                        `│\n` +
                                                                        `│ ⟡ Aksi\n` +
                                                                        `│ • Diundang Admin: @${authorNum}\n` +
                                                                        `╰─ Selamat bergabung.`;
                                                                mentionJids = [normalJid, authorJid, groupOwnerJid];
                                                        }
                                                } else {
                                                        if (isSelfAction) {
                                                                joinInfo = 'keluar sendiri';
                                                                caption =
                                                                        `╭─「 *GOODBYE* 」\n` +
                                                                        `│ ⟡ User\n` +
                                                                        `│ • Anggota: @${numOnly}\n` +
                                                                        `│ • Keluar: ${eventDate}\n` +
                                                                        `│ • Jam: ${eventTime}\n` +
                                                                        `│\n` +
                                                                        `│ ⟡ Grup\n` +
                                                                        `│ • Nama: ${groupName}\n` +
                                                                        `│ • Member: ${memberCount ?? '?'} | Admin: ${adminCount || '?'}\n` +
                                                                        groupOwnerLine +
                                                                        `│ • Dibuat: ${groupCreatedDate}\n` +
                                                                        `│ • Jam GC: ${groupCreatedTime}\n` +
                                                                        `│\n` +
                                                                        `│ ⟡ Aksi\n` +
                                                                        `│ • Status: Keluar Sendiri\n` +
                                                                        `╰─ Terima kasih.`;
                                                        } else {
                                                                joinInfo = `dikeluarkan oleh ${authorName}`;
                                                                caption =
                                                                        `╭─「 *GOODBYE* 」\n` +
                                                                        `│ ⟡ User\n` +
                                                                        `│ • Anggota: @${numOnly}\n` +
                                                                        `│ • Keluar: ${eventDate}\n` +
                                                                        `│ • Jam: ${eventTime}\n` +
                                                                        `│\n` +
                                                                        `│ ⟡ Grup\n` +
                                                                        `│ • Nama: ${groupName}\n` +
                                                                        `│ • Member: ${memberCount ?? '?'} | Admin: ${adminCount || '?'}\n` +
                                                                        groupOwnerLine +
                                                                        `│ • Dibuat: ${groupCreatedDate}\n` +
                                                                        `│ • Jam GC: ${groupCreatedTime}\n` +
                                                                        `│\n` +
                                                                        `│ ⟡ Aksi\n` +
                                                                        `│ • Dikick Admin: @${authorNum}\n` +
                                                                        `╰─ Terima kasih.`;
                                                                mentionJids = [normalJid, authorJid, groupOwnerJid];
                                                        }
                                                }

                                                // Get avatar user
                                                let avatarUrl = null;
                                                try {
                                                        avatarUrl = await hisoka.profilePictureUrl(normalJid, 'image');
                                                } catch (_) {}

                                                // Get group icon
                                                let groupIconUrl = null;
                                                try {
                                                        groupIconUrl = await hisoka.profilePictureUrl(id, 'image');
                                                } catch (_) {}

                                                const { buffer: imgBuffer, mimetype: imgMime } = await createWelcomeCard({
                                                        name,
                                                        groupName,
                                                        avatarUrl,
                                                        groupIconUrl,
                                                        type,
                                                        memberCount,
                                                        joinInfo,
                                                });

                                                const botReply = loadConfig().botReply || {};
                                                const newsletterJid = botReply.newsletterJid || '120363312297133690@newsletter';
                                                const newsletterName = botReply.newsletterName || 'Info Seputar Anime Dll 👤';
                                                const sourceUrl = botReply.sourceUrl || 'https://wa.me/6289688206739';
                                                const previewThumbnailUrl = groupIconUrl || avatarUrl || undefined;
                                                const mentionedJid = Array.from(new Set(mentionJids.filter(Boolean)));
                                                const jakartaNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
                                                const jakartaHour = jakartaNow.getHours();
                                                const greetingText = jakartaHour >= 5 && jakartaHour < 11
                                                        ? 'Pagi 🌅'
                                                        : jakartaHour >= 11 && jakartaHour < 15
                                                                ? 'Siang ☀️'
                                                                : jakartaHour >= 15 && jakartaHour < 18
                                                                        ? 'Sore 🌇'
                                                                        : 'Malam 🌙';
                                                const realtimeDate = jakartaNow.toLocaleDateString('id-ID', {
                                                        weekday: 'long',
                                                        day: 'numeric',
                                                        month: 'long',
                                                        year: 'numeric',
                                                });

                                                await hisoka.sendMessage(id, {
                                                        image: imgBuffer,
                                                        caption,
                                                        mimetype: imgMime,
                                                        mentions: mentionedJid,
                                                        contextInfo: {
                                                                mentionedJid,
                                                                forwardingScore: 999,
                                                                isForwarded: true,
                                                                forwardedNewsletterMessageInfo: {
                                                                        newsletterJid,
                                                                        serverMessageId: Math.floor(Math.random() * 9999) + 1,
                                                                        newsletterName,
                                                                },
                                                                externalAdReply: {
                                                                        showAdAttribution: false,
                                                                        title: `Selamat: ${greetingText}`,
                                                                        body: `${realtimeDate} 📅`,
                                                                        thumbnailUrl: previewThumbnailUrl,
                                                                        sourceUrl,
                                                                        mediaType: 1,
                                                                        renderLargerThumbnail: true,
                                                                },
                                                        },
                                                });

                                                console.info(
                                                        `\x1b[35m[${type === 'welcome' ? '\x1b[32mWELCOME' : '\x1b[33mGOODBYE'}\x1b[35m]\x1b[0m` +
                                                        ` ${name} › ${groupName} (${memberCount ?? '?'})`
                                                );
                                        }
                                } catch (err) {
                                        console.error('\x1b[31m[WelcomeCard] Error:\x1b[39m', err.message);
                                }
                        })();
                }
        });

        // ini baru
        hisoka.ev.on('messages.upsert', messagesUpsert => {
                if (messagesUpsert.type !== 'notify') return;
                for (const message of messagesUpsert.messages) {
                        if (!message?.key?.id) continue;
                        if (!message.message && !message.key?.remoteJid) continue;
                        if (message.message && !hisoka.cacheMsg.has(message.key.id)) {
                                hisoka.cacheMsg.set(message.key.id, message);

                                setTimeout(() => {
                                        hisoka.cacheMsg.delete(message.key.id);
                                }, 60000);
                        }

                        // Auto-save view once ke disk agar tetap bisa dibuka setelah restart
                        if (message.message) {
                                autoSaveViewOnce(message, hisoka).catch((err) => {
                                        console.error('\x1b[31m[VOCache] Unexpected error:\x1b[0m', err?.message || err)
                                })
                        }

                        const msgId = message.key.id;
                        const handlerPromise = getHandler('message')({ ...messagesUpsert, message }, hisoka);
                        const timeoutPromise = new Promise((_, reject) =>
                                setTimeout(() => reject(new Error(`Handler timeout for msg ${msgId}`)), 220000)
                        );

                        Promise.race([handlerPromise, timeoutPromise])
                                .catch(err => {
                                        const msg = err?.message || String(err);
                                        if (msg.includes('timeout')) {
                                                console.error(`\x1b[31m[CrashGuard] Message handler timed out (220s), skipping.\x1b[39m`);
                                        } else {
                                                console.error('\x1b[31m[Handler Error]\x1b[39m', msg);
                                        }
                                });
                }
        });
        
        hisoka.ev.on('messages.update', updates => {
                for (const update of updates) {

                Promise.resolve(
                        getHandler('antidelete')(update, hisoka)
                ).catch(err => console.error('[AntiDelete]', err.message));

                }
        });

        hisoka.ev.on('messages.upsert', messagesUpsertAntiTag => {
                if (messagesUpsertAntiTag.type !== 'notify') return;
                for (const message of messagesUpsertAntiTag.messages) {
                        if (!message?.key?.id || message.key?.fromMe) continue;
                        const antiTagSWHandler = getHandler('antitagsw');
                        if (typeof antiTagSWHandler === 'function') {
                                Promise.resolve(
                                        antiTagSWHandler(message, hisoka)
                                ).catch(err => console.error('[AntiTagSW]', err.message));
                        }
                }
        }); // sampe sini


        hisoka.ev.on('call', async calls => {
                for (const call of calls) {
                        try {
                                const config = loadConfig();
                                const antiCall = config.antiCall || { enabled: false, message: '', whitelist: [] };
                                const antiCallVideo = config.antiCallVideo || { enabled: false, message: '', whitelist: [] };
                                
                                const isVideoCall = call.isVideo === true;
                                const currentConfig = isVideoCall ? antiCallVideo : antiCall;
                                const featureName = isVideoCall ? 'AntiCallVideo' : 'AntiCall';
                                
                                if (!currentConfig.enabled) continue;
                                
                                let callerJid = call.from;
                                let callerNumber = '';
                                let callerName = '';
                                
                                try {
                                        let contactData = null;
                                        
                                        if (isLidUser(call.from)) {
                                                const pnJid = await safeGetPNForLID(hisoka, call.from);
                                                if (pnJid) {
                                                        callerJid = jidNormalizedUser(pnJid);
                                                } else {
                                                        const normalizedLid = jidNormalizedUser(call.from);
                                                        contactData = contacts.find(c => 
                                                                areJidsSameUser(c.lid, normalizedLid) || areJidsSameUser(c.lid, call.from)
                                                        );
                                                        if (contactData && contactData.id) {
                                                                callerJid = jidNormalizedUser(contactData.id);
                                                        } else {
                                                                callerJid = normalizedLid;
                                                        }
                                                }
                                        } else {
                                                callerJid = jidNormalizedUser(call.from);
                                        }
                                        
                                        callerNumber = jidDecode(callerJid)?.user || '';
                                        
                                        if (!contactData) {
                                                contactData = contacts.read(callerJid);
                                        }
                                        
                                        if (!contactData) {
                                                contactData = contacts.find(c => 
                                                        areJidsSameUser(c.phoneNumber || c.id, callerJid) ||
                                                        areJidsSameUser(c.lid, call.from)
                                                );
                                        }
                                        
                                        if (contactData) {
                                                callerName = contactData.name || contactData.verifiedName || contactData.notify || callerNumber;
                                        } else {
                                                callerName = hisoka.getName(callerJid, true);
                                                if (callerName === callerNumber) {
                                                        callerName = callerNumber;
                                                }
                                        }
                                } catch (resolveErr) {
                                        callerNumber = jidDecode(call.from)?.user || call.from.replace(/[^0-9]/g, '');
                                        callerName = callerNumber;
                                }
                                
                                const whitelist = currentConfig.whitelist || [];
                                const isWhitelisted = whitelist.some(num => {
                                        const cleanNum = num.replace(/[^0-9]/g, '');
                                        return callerNumber.includes(cleanNum) || cleanNum.includes(callerNumber);
                                });
                                
                                if (isWhitelisted) {
                                        console.log(`\x1b[33m[${featureName}]\x1b[39m Call from ${callerName} (${callerNumber}) - WHITELISTED, skipping reject`);
                                        continue;
                                }
                                
                                if (call.status === 'offer') {
                                        await hisoka.rejectCall(call.id, call.from);
                                        console.log(`\x1b[32m[${featureName}]\x1b[39m Rejected ${isVideoCall ? 'video' : 'voice'} call from ${callerName} (${callerNumber})`);
                                        
                                        if (currentConfig.message) {
                                                await delay(1000);
                                                await hisoka.sendMessage(call.from, { text: currentConfig.message });
                                                console.log(`\x1b[32m[${featureName}]\x1b[39m Sent rejection message to ${callerName} (${callerNumber})`);
                                        }
                                }
                        } catch (err) {
                                console.error('\x1b[31m[AntiCall] Error:\x1b[39m', err.message);
                        }
                }
        });
}

let mainCrashCount = 0;
const MAX_MAIN_CRASHES = 10;
let isMainActive = false;

async function startWithGuard() {
        if (isMainActive) {
                console.warn('\x1b[33m[CrashGuard] Restart diminta tapi bot masih aktif, skip.\x1b[39m');
                return;
        }
        isMainActive = true;
        try {
                await main();
        } catch (err) {
                mainCrashCount++;
                console.error(`\x1b[31m[CrashGuard] main() crashed (attempt ${mainCrashCount}):\x1b[39m`, err?.message || err);

                if (mainCrashCount >= MAX_MAIN_CRASHES) {
                        console.error('\x1b[31m[CrashGuard] Terlalu banyak crash. Keluar...\x1b[39m');
                        process.exit(1);
                }

                const waitMs = Math.min(5000 * mainCrashCount, 30000);
                console.log(`\x1b[33m[CrashGuard] Restart main() dalam ${waitMs / 1000}s... (Percobaan ${mainCrashCount})\x1b[39m`);
                isMainActive = false;
                setTimeout(() => startWithGuard(), waitMs);
        } finally {
                isMainActive = false;
        }
}

setupCrashGuard(startWithGuard);

// Graceful shutdown: pause jadibot timers
function handleShutdown(signal) {
        console.log(`\x1b[33m[Shutdown] ${signal} diterima — pause jadibot...\x1b[39m`);
        pauseAllJadibotTimers();
        process.exit(0);
}
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT',  () => handleShutdown('SIGINT'));
process.on('exit', () => {
        pauseAllJadibotTimers();
});

startWithGuard();
