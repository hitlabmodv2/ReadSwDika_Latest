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
 * ═══════════════════════════════════════════════════════════════
 *  Anti-Porn Handler
 *  Fitur untuk mendeteksi dan menghapus konten 18+ (gambar,
 *  stiker, video) di grup secara otomatis menggunakan nsfwjs
 *  + TensorFlow.js (deteksi lokal, tanpa API key).
 *  Model: nsfwjs (github.com/infinitered/nsfwjs)
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const { isJidGroup, downloadMediaMessage, getContentType, jidNormalizedUser, areJidsSameUser, jidDecode } = _require('socketon');

import { kvGet, kvSet, kvMigrateFromJSON, kvMigrateKey } from '../db/datadb.js';
kvMigrateFromJSON('security/antiporn', path.join(process.cwd(), 'data', 'antiporn.json'));
kvMigrateKey('antiporn', 'security/antiporn');

// Tandai pesan yang dihapus oleh antiporn agar anti-delete tidak notif
if (!global.__antiPornDeletedIds) global.__antiPornDeletedIds = new Set();

// Cache model nsfwjs (load sekali, reuse)
let _nsfwModel = null;
let _modelLoading = false;
let _modelLoadPromise = null;

async function getNsfwModel() {
    if (_nsfwModel) return _nsfwModel;
    if (_modelLoading) return _modelLoadPromise;

    _modelLoading = true;
    _modelLoadPromise = (async () => {
        try {
            const tf = await import('@tensorflow/tfjs-node');
            const { load: nsfwLoad } = await import('nsfwjs');
            console.log('\x1b[36m[AntiPorn] Memuat model NSFW... (pertama kali, harap tunggu)\x1b[39m');
            const model = await nsfwLoad(); // pakai model bundled (MobileNetV2)
            _nsfwModel = { model, tf };
            console.log('\x1b[32m[AntiPorn] Model NSFW berhasil dimuat!\x1b[39m');
            return _nsfwModel;
        } catch (err) {
            _modelLoading = false;
            _modelLoadPromise = null;
            throw err;
        }
    })();

    return _modelLoadPromise;
}

// Tipe media yang dicek
const PORN_MEDIA_TYPES = ['imageMessage', 'videoMessage', 'stickerMessage'];

function loadConfig() {
    try {
        const configPath = path.join(process.cwd(), 'config.json');
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
    } catch (_) {}
    return {};
}

function saveConfig(config) {
    try {
        const configPath = path.join(process.cwd(), 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
        console.error('\x1b[31m[AntiPorn] Gagal simpan config.json:\x1b[39m', err.message);
    }
}

function loadData() {
    return kvGet('security/antiporn', { groups: [], warnings: {} });
}

function saveData(data) {
    try {
        kvSet('security/antiporn', data);
    } catch (err) {
        console.error('\x1b[31m[AntiPorn] Gagal simpan data:\x1b[39m', err.message);
    }
}

function getSenderJid(message, hisoka) {
    let sender = message.key?.participant || message.participant;
    if (!sender) return null;
    if (sender.includes('@lid')) {
        try {
            const contacts = hisoka.contacts;
            if (contacts?.read) {
                const contact = contacts.read(sender);
                if (contact?.id) return jidNormalizedUser(contact.id);
                if (contact?.phoneNumber) return jidNormalizedUser(contact.phoneNumber);
            }
        } catch (_) {}
    }
    return jidNormalizedUser(sender);
}

function isOwnerJid(senderJid, senderNumber, config) {
    const owners = (config.owners || []);
    const ownerJids = owners.map(o => o + '@s.whatsapp.net');
    return ownerJids.some(o => areJidsSameUser(o, senderJid)) ||
        owners.some(o => senderNumber === o);
}

function buildGroupStats(groupMeta, newWarn, maxWarnings) {
    const participants = groupMeta?.participants || [];
    const totalMembers = participants.length;
    const totalAdmins = participants.filter(p => p.admin).length;
    const totalMembers_ = totalMembers - totalAdmins;

    const filled = '◆'.repeat(newWarn);
    const empty = '◇'.repeat(Math.max(0, maxWarnings - newWarn));
    const warnBar = filled + empty;

    const adminPct = totalMembers > 0 ? Math.round((totalAdmins / totalMembers) * 10) : 0;
    const memberPct = 10 - adminPct;
    const adminBar = '█'.repeat(adminPct) + '░'.repeat(memberPct);

    return {
        totalMembers,
        totalAdmins,
        totalMembers_,
        warnBar,
        adminBar,
        adminPct: totalMembers > 0 ? Math.round((totalAdmins / totalMembers) * 100) : 0,
    };
}

/**
 * Konversi buffer media ke tensor RGB 3D untuk nsfwjs
 * Selalu pakai sharp untuk konversi → lebih stabil untuk semua format
 * (JPEG, PNG, WebP stiker, GIF, dll)
 */
async function bufferToTensor(buffer, tf) {
    try {
        const sharp = (await import('sharp')).default;
        // Resize ke 299x299 (ukuran optimal nsfwjs), convert ke JPEG RGB
        const jpegBuf = await sharp(buffer)
            .resize(299, 299, { fit: 'cover' })
            .removeAlpha()
            .jpeg({ quality: 90 })
            .toBuffer();
        const tensor = tf.node.decodeImage(jpegBuf, 3);
        return tensor;
    } catch (err) {
        throw new Error('Gagal konversi buffer ke tensor: ' + err.message);
    }
}

/**
 * Deteksi konten NSFW dari buffer
 * Return: { isPorn: boolean, predictions: [], topClass: string, topScore: number }
 */
async function detectNsfw(buffer, threshold) {
    const { model, tf } = await getNsfwModel();
    let tensor = null;
    try {
        tensor = await bufferToTensor(buffer, tf);
        const predictions = await model.classify(tensor);
        
        // Kelas NSFW yang dianggap porn/18+
        const nsfwClasses = ['Porn', 'Hentai', 'Sexy'];
        
        let totalNsfwScore = 0;
        let topClass = 'Unknown';
        let topScore = 0;

        for (const p of predictions) {
            if (nsfwClasses.includes(p.className)) {
                totalNsfwScore += p.probability;
            }
            if (p.probability > topScore) {
                topScore = p.probability;
                topClass = p.className;
            }
        }

        // Cari skor kelas porn/hentai tertinggi untuk laporan
        const pornPred = predictions.find(p => p.className === 'Porn');
        const hentaiPred = predictions.find(p => p.className === 'Hentai');
        const sexyPred = predictions.find(p => p.className === 'Sexy');

        const pornScore = (pornPred?.probability || 0);
        const hentaiScore = (hentaiPred?.probability || 0);
        const sexyScore = (sexyPred?.probability || 0);
        const highestNsfwScore = Math.max(pornScore, hentaiScore, sexyScore);

        const detectedClass = highestNsfwScore === pornScore ? 'Porn' :
                              highestNsfwScore === hentaiScore ? 'Hentai' : 'Sexy';

        return {
            isPorn: totalNsfwScore >= threshold,
            predictions,
            topClass: detectedClass,
            topScore: highestNsfwScore,
            pornScore,
            hentaiScore,
            sexyScore,
            totalNsfwScore,
        };
    } finally {
        if (tensor) tensor.dispose();
    }
}

function findParticipant(participants, targetNumber) {
    return participants?.find(p => {
        const rawJid = p.jid || p.phoneNumber || p.id || '';
        const pNum = rawJid.split('@')[0].split(':')[0];
        return pNum === targetNumber;
    });
}

function findBotParticipant(participants, botJid, botNumber) {
    return participants?.find(p => {
        const rawJid = p.jid || p.id || '';
        if (!rawJid) return false;
        // Cek pakai areJidsSameUser (handle semua format termasuk LID)
        try { if (areJidsSameUser(rawJid, botJid)) return true; } catch (_) {}
        // Fallback: cocokkan nomor
        const pNum = rawJid.split('@')[0].split(':')[0];
        return pNum === botNumber;
    });
}

function loadBotAdminFile() {
    return kvGet('botadmin/botadmin', {});
}
function saveBotAdminFile(data) {
    try { kvSet('botadmin/botadmin', data); } catch (_) {}
}

export default async function handleAntiPorn(message, hisoka) {
    try {
        if (!message?.key?.remoteJid) return;
        if (!message.message) return;

        const remoteJid = message.key.remoteJid;
        if (!isJidGroup(remoteJid)) return;
        if (message.key?.fromMe) return;

        const msgType = getContentType(message.message);
        if (!msgType || !PORN_MEDIA_TYPES.includes(msgType)) return;

        // Cek config global
        const config = loadConfig();
        const antiPornConfig = config.antiPorn || {};
        if (!antiPornConfig.enabled) return;

        // Cek apakah grup ini mengaktifkan antiporn (dari config.json)
        const activeGroups = config.antiPorn?.groups || [];
        if (!activeGroups.includes(remoteJid)) return;

        const senderJid = getSenderJid(message, hisoka);
        if (!senderJid) return;

        const senderNumber = jidDecode(senderJid)?.user || senderJid.split('@')[0] || '';

        // Skip bot sendiri
        const botJid = jidNormalizedUser(hisoka.user?.id || '');
        if (areJidsSameUser(senderJid, botJid)) return;

        const botNumber = botJid.split('@')[0];
        const senderNumberClean = senderJid.split('@')[0];

        const threshold = antiPornConfig.threshold ?? 0.50;
        const maxWarnings = antiPornConfig.maxWarnings ?? 10;

        // ─── CEK ADMIN BOT (realtime dari groupMetadata, fallback ke kv cache) ──
        let groupMeta = null;
        let isAdmin = false;
        let adminSource = 'unknown';

        try {
            groupMeta = await hisoka.groupMetadata(remoteJid);
            if (groupMeta) hisoka.groups?.write(remoteJid, groupMeta);

            const botP = findBotParticipant(groupMeta?.participants, botJid, botNumber);
            isAdmin = !!botP?.admin;
            adminSource = 'live';

            // Update kv cache realtime
            const botAdminData = loadBotAdminFile();
            botAdminData[remoteJid] = isAdmin;
            saveBotAdminFile(botAdminData);
        } catch (_) {
            // Fallback 1: cache memory hisoka.groups
            groupMeta = hisoka.groups?.read(remoteJid) || null;
            if (groupMeta) {
                const botP = findBotParticipant(groupMeta?.participants, botJid, botNumber);
                isAdmin = !!botP?.admin;
                adminSource = 'memory-cache';
            } else {
                // Fallback 2: kv cache data/kv/botadmin
                const botAdminData = loadBotAdminFile();
                if (remoteJid in botAdminData) {
                    isAdmin = botAdminData[remoteJid] === true;
                    adminSource = 'kv-cache';
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────────

        // Label tipe konten
        const contentLabels = {
            imageMessage: ['Gambar 🖼️', '🖼️'],
            videoMessage: ['Video 🎥', '🎥'],
            stickerMessage: ['Stiker 🎨', '🎨'],
        };
        const [contentLabel, contentEmoji] = contentLabels[msgType] || ['Media', '📁'];

        // Download atau ambil thumbnail
        let mediaBuffer = null;
        try {
            if (msgType === 'videoMessage') {
                // Pakai jpegThumbnail bawaan WhatsApp (efisien, tanpa download video penuh)
                const thumb = message.message?.videoMessage?.jpegThumbnail;
                if (thumb && thumb.length > 100) {
                    mediaBuffer = Buffer.isBuffer(thumb) ? thumb : Buffer.from(thumb);
                } else {
                    return;
                }
            } else {
                // Download gambar/stiker
                mediaBuffer = await downloadMediaMessage(
                    message,
                    'buffer',
                    {},
                    { logger: { info: () => {}, error: () => {}, warn: () => {} }, reuploadRequest: hisoka.updateMediaMessage }
                );
            }
        } catch (dlErr) {
            console.error('\x1b[31m[AntiPorn] Gagal download media:\x1b[39m', dlErr.message);
            return;
        }

        if (!mediaBuffer || mediaBuffer.length < 100) return;

        // Deteksi NSFW
        let result;
        try {
            result = await detectNsfw(mediaBuffer, threshold);
        } catch (nsfwErr) {
            console.error('\x1b[31m[AntiPorn] Error deteksi NSFW:\x1b[39m', nsfwErr.message);
            return;
        }

        // Jika tidak terdeteksi porn, keluar
        if (!result.isPorn) return;

        // Jika pengirim adalah OWNER → respon khusus, tidak hapus, tidak tambah warning
        if (isOwnerJid(senderJid, senderNumber, config)) {
            const scoreBar = '🔴'.repeat(Math.round(result.totalNsfwScore * 10)) + '⚫'.repeat(10 - Math.round(result.totalNsfwScore * 10));
            const ownerMsg =
                `✅ *OWNER — AMAN* ✅\n` +
                `\n` +
                `👑 @${senderNumber} adalah *Owner Bot*\n` +
                `🛡️ Pesan tidak dihapus & tidak dicatat.\n` +
                `\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📊 *SKOR DETEKSI AI* (info saja)\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🔞 Porn    ﹕ ${(result.pornScore * 100).toFixed(1)}%\n` +
                `🖤 Hentai  ﹕ ${(result.hentaiScore * 100).toFixed(1)}%\n` +
                `💋 Sexy    ﹕ ${(result.sexyScore * 100).toFixed(1)}%\n` +
                `📈 Total   ﹕ *${(result.totalNsfwScore * 100).toFixed(1)}%*\n` +
                `     [${scoreBar}]\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━`;
            try {
                await hisoka.sendMessage(remoteJid, { text: ownerMsg, mentions: [senderJid] });
            } catch (e) {
                console.error('\x1b[31m[AntiPorn] Gagal kirim pesan owner:\x1b[39m', e.message);
            }
            return;
        }

        // Update warning
        const freshData = loadData();
        if (!freshData.warnings[remoteJid]) freshData.warnings[remoteJid] = {};
        if (!freshData.warnings[remoteJid][senderJid]) freshData.warnings[remoteJid][senderJid] = 0;
        freshData.warnings[remoteJid][senderJid] += 1;

        const newWarn = freshData.warnings[remoteJid][senderJid];
        saveData(freshData);

        const now = new Date();
        const timeStr = now.toLocaleTimeString('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        const dateStr = now.toLocaleDateString('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        const stats = buildGroupStats(groupMeta, newWarn, maxWarnings);

        const scoreBar = '🔴'.repeat(Math.round(result.totalNsfwScore * 10)) + '⚫'.repeat(10 - Math.round(result.totalNsfwScore * 10));

        // Hapus pesan jika bot admin, skip jika bukan admin
        if (isAdmin) {
            global.__antiPornDeletedIds.add(message.key.id);
            setTimeout(() => global.__antiPornDeletedIds.delete(message.key.id), 10000);
            try {
                await hisoka.sendMessage(remoteJid, {
                    delete: {
                        remoteJid: remoteJid,
                        fromMe: false,
                        id: message.key.id,
                        participant: message.key.participant
                    }
                });
                console.log(`\x1b[32m[AntiPorn] 🗑️ Hapus pesan ${senderNumber} | ${remoteJid}\x1b[39m`);
            } catch (delErr) {
                console.error('\x1b[31m[AntiPorn] Gagal hapus pesan:\x1b[39m', delErr.message);
            }
        }

        if (newWarn >= maxWarnings) {
            // Reset warning setelah max
            delete freshData.warnings[remoteJid][senderJid];
            saveData(freshData);

            let finalMsg;
            if (isAdmin) {
                // ── BOT ADMIN: hapus + kick ─────────────────────────────────
                finalMsg =
                    `╔═══════════════════════╗\n` +
                    `║  🔞 ANTI-PORN SYSTEM  ║\n` +
                    `╚═══════════════════════╝\n` +
                    `\n` +
                    `🚨 *TINDAKAN TEGAS DIAMBIL!*\n` +
                    `\n` +
                    `👤 *Pelanggar* ﹕ @${senderNumber}\n` +
                    `🕐 *Waktu*     ﹕ ${timeStr} • ${dateStr}\n` +
                    `${contentEmoji} *Konten*   ﹕ ${contentLabel}\n` +
                    `🗑️ *Pesan*     ﹕ Telah dihapus otomatis ✅\n` +
                    `\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `📊 *SKOR DETEKSI AI*\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🔞 Porn    ﹕ ${(result.pornScore * 100).toFixed(1)}%\n` +
                    `🖤 Hentai  ﹕ ${(result.hentaiScore * 100).toFixed(1)}%\n` +
                    `💋 Sexy    ﹕ ${(result.sexyScore * 100).toFixed(1)}%\n` +
                    `📈 Total   ﹕ *${(result.totalNsfwScore * 100).toFixed(1)}%*\n` +
                    `     [${scoreBar}]\n` +
                    `\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `⚡ *SANKSI*\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🔴 Peringatan ke-${maxWarnings}/${maxWarnings} tercapai!\n` +
                    `💥 Member ini telah di-*KICK* dari grup!\n` +
                    `\n` +
                    `_Pelanggaran berulang = dikeluarkan permanen!_ 🚫`;
            } else {
                // ── BOT BUKAN ADMIN: hanya notif, tidak bisa kick ───────────
                finalMsg =
                    `⚠️ *BATAS PERINGATAN TERCAPAI* ⚠️\n` +
                    `\n` +
                    `👤 @${senderNumber} telah mencapai batas maksimal peringatan!\n` +
                    `🕐 ${timeStr} • ${dateStr}\n` +
                    `\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `📊 *SKOR DETEKSI AI*\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🔞 Porn    ﹕ ${(result.pornScore * 100).toFixed(1)}%\n` +
                    `🖤 Hentai  ﹕ ${(result.hentaiScore * 100).toFixed(1)}%\n` +
                    `💋 Sexy    ﹕ ${(result.sexyScore * 100).toFixed(1)}%\n` +
                    `📈 Total   ﹕ *${(result.totalNsfwScore * 100).toFixed(1)}%*\n` +
                    `     [${scoreBar}]\n` +
                    `\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🔴 Peringatan ke-${maxWarnings}/${maxWarnings}\n` +
                    `⚠️ Bot *bukan admin* — tidak bisa kick!\n` +
                    `👮 Minta admin grup untuk keluarkan member ini.\n` +
                    `💡 Jadikan bot admin agar kick otomatis aktif.`;
            }

            try {
                await hisoka.sendMessage(remoteJid, { text: finalMsg, mentions: [senderJid] });
            } catch (sendErr) {
                console.error('\x1b[31m[AntiPorn] Gagal kirim pesan:\x1b[39m', sendErr.message);
            }

            if (isAdmin) {
                try {
                    await hisoka.groupParticipantsUpdate(remoteJid, [senderJid], 'remove');
                    console.log(`\x1b[31m[AntiPorn] 👢 Kick ${senderNumber} | ${remoteJid}\x1b[39m`);
                } catch (kickErr) {
                    console.error('\x1b[31m[AntiPorn] Gagal kick:\x1b[39m', kickErr.message);
                    try {
                        await hisoka.sendMessage(remoteJid, {
                            text: `❌ Gagal kick @${senderNumber}. Pastikan bot adalah admin grup.`,
                            mentions: [senderJid]
                        });
                    } catch (_) {}
                }
            }
        } else {
            let warnMsg;
            if (isAdmin) {
                // ── BOT ADMIN: warn + info sisa ────────────────────────────
                const sisaWarn = maxWarnings - newWarn;
                warnMsg =
                    `╔═══════════════════════╗\n` +
                    `║  🔞 ANTI-PORN SYSTEM  ║\n` +
                    `╚═══════════════════════╝\n` +
                    `\n` +
                    `👤 *Pelanggar* ﹕ @${senderNumber}\n` +
                    `🕐 *Waktu*     ﹕ ${timeStr} • ${dateStr}\n` +
                    `${contentEmoji} *Konten*   ﹕ ${contentLabel}\n` +
                    `🗑️ *Pesan*     ﹕ Telah dihapus otomatis ✅\n` +
                    `\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `📊 *SKOR DETEKSI AI*\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🔞 Porn    ﹕ ${(result.pornScore * 100).toFixed(1)}%\n` +
                    `🖤 Hentai  ﹕ ${(result.hentaiScore * 100).toFixed(1)}%\n` +
                    `💋 Sexy    ﹕ ${(result.sexyScore * 100).toFixed(1)}%\n` +
                    `📈 Total   ﹕ *${(result.totalNsfwScore * 100).toFixed(1)}%*\n` +
                    `     [${scoreBar}]\n` +
                    `\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🔢 Peringatan ke-*${newWarn}/${maxWarnings}*\n` +
                    `${sisaWarn === 1
                        ? `⚡ *Peringatan berikutnya = KICK otomatis!*`
                        : `💡 Sisa *${sisaWarn}x* lagi sebelum di-kick!`}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━`;
            } else {
                // ── BOT BUKAN ADMIN: warn tanpa hapus, tanpa info kick ──────
                warnMsg =
                    `🚨 *KONTEN 18+ TERDETEKSI!*\n` +
                    `\n` +
                    `👤 @${senderNumber}\n` +
                    `🕐 ${timeStr} • ${dateStr}\n` +
                    `${contentEmoji} Konten ﹕ ${contentLabel}\n` +
                    `\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `📊 *SKOR DETEKSI AI*\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🔞 Porn    ﹕ ${(result.pornScore * 100).toFixed(1)}%\n` +
                    `🖤 Hentai  ﹕ ${(result.hentaiScore * 100).toFixed(1)}%\n` +
                    `💋 Sexy    ﹕ ${(result.sexyScore * 100).toFixed(1)}%\n` +
                    `📈 Total   ﹕ *${(result.totalNsfwScore * 100).toFixed(1)}%*\n` +
                    `     [${scoreBar}]\n` +
                    `\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🔢 Peringatan ke-*${newWarn}/${maxWarnings}*\n` +
                    `🚫 Dilarang kirim konten 18+ di grup!\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━`;
            }

            try {
                await hisoka.sendMessage(remoteJid, { text: warnMsg, mentions: [senderJid] });
            } catch (sendErr) {
                console.error('\x1b[31m[AntiPorn] Gagal kirim pesan peringatan:\x1b[39m', sendErr.message);
            }
        }
    } catch (err) {
        console.error('\x1b[31m[AntiPorn] Error:\x1b[39m', err.message);
    }
}

export function isAntiPornEnabled(groupId) {
    const config = loadConfig();
    const groups = config.antiPorn?.groups || [];
    return groups.includes(groupId);
}

export function toggleAntiPorn(groupId, enable) {
    const config = loadConfig();
    if (!config.antiPorn) config.antiPorn = {};
    if (!Array.isArray(config.antiPorn.groups)) config.antiPorn.groups = [];

    if (enable) {
        if (!config.antiPorn.groups.includes(groupId)) {
            config.antiPorn.groups.push(groupId);
        }
    } else {
        config.antiPorn.groups = config.antiPorn.groups.filter(g => g !== groupId);
        // Hapus warnings grup ini dari kv
        const data = loadData();
        if (data.warnings[groupId]) {
            delete data.warnings[groupId];
            saveData(data);
        }
    }
    saveConfig(config);
    return config;
}

export function getAllAntiPornGroups() {
    const config = loadConfig();
    return Array.isArray(config.antiPorn?.groups) ? [...config.antiPorn.groups] : [];
}

export function resetAntiPornWarnings(groupId, userJid) {
    const data = loadData();
    if (!data.warnings[groupId]) return;
    if (userJid) {
        delete data.warnings[groupId][userJid];
    } else {
        delete data.warnings[groupId];
    }
    saveData(data);
}

export function getAntiPornWarnings(groupId) {
    const data = loadData();
    return data.warnings[groupId] || {};
}
