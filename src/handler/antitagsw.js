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
 *  Anti-Tag Semua Warga (AntiTagSW) Handler
 *  Fitur untuk mencegah anggota mentag grup lewat status WhatsApp,
 *  caption media (gambar/video/audio), dan pesan reply.
 *  Referensi: github.com/hitlabmodv2/MD-FURINA
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const { isJidGroup, jidNormalizedUser, areJidsSameUser, jidDecode, getContentType } = _require('socketon');

import { kvGet, kvSet, kvMigrateFromJSON, kvMigrateKey } from '../db/datadb.js';
kvMigrateFromJSON('security/antitagsw', path.join(process.cwd(), 'data', 'antitagsw.json'));
kvMigrateKey('antitagsw', 'security/antitagsw');

// Set global untuk menandai pesan yang dihapus oleh antitagsw
// agar anti-delete tidak mengirim notifikasi "PESAN DIHAPUS"
if (!global.__antiTagSWDeletedIds) global.__antiTagSWDeletedIds = new Set();

// Mapping tipe konten status → label + emoji
const CONTENT_TYPE_MAP = {
    imageMessage:         ['Gambar 🖼️', '🖼️'],
    videoMessage:         ['Video 🎥', '🎥'],
    audioMessage:         ['Audio 🎵', '🎵'],
    ptvMessage:           ['Video Pesan 📹', '📹'],
    stickerMessage:       ['Stiker 🎨', '🎨'],
    documentMessage:      ['Dokumen 📄', '📄'],
    documentWithCaptionMessage: ['Dokumen 📄', '📄'],
    conversation:         ['Teks 💬', '💬'],
    extendedTextMessage:  ['Teks 💬', '💬'],
    reactionMessage:      ['Reaksi 🔥', '🔥'],
    pollCreationMessage:  ['Polling 📊', '📊'],
    pollCreationMessageV2: ['Polling 📊', '📊'],
    pollCreationMessageV3: ['Polling 📊', '📊'],
};

function detectStatusContentType(message) {
    try {
        const msg = message?.message || {};

        // Cek inner message dari groupStatusMentionMessage / groupStatusMessageV2
        const inner = msg?.groupStatusMentionMessage?.message
            || msg?.groupStatusMessageV2?.message
            || msg?.groupMentionedMessage?.message
            || msg;

        // Cari tipe pertama yang ada
        for (const [key, val] of Object.entries(CONTENT_TYPE_MAP)) {
            if (inner[key]) return val;
        }

        // Fallback: cek pakai getContentType di level dalam
        const innerType = getContentType(inner);
        if (innerType && CONTENT_TYPE_MAP[innerType]) return CONTENT_TYPE_MAP[innerType];
    } catch (_) {}
    return ['Status 📲', '📲'];
}

// Tipe pesan yang terdeteksi sebagai "tag grup lewat status"
const ANTITAG_MSG_TYPES = [
    'groupStatusMentionMessage',
    'groupStatusMessageV2',
    'groupMentionedMessage',
];

// Tipe pesan media yang bisa membawa caption dengan tag grup
const MEDIA_CAPTION_TYPES = [
    'imageMessage',
    'videoMessage',
    'audioMessage',
    'documentMessage',
    'documentWithCaptionMessage',
    'extendedTextMessage',
    'conversation',
];

/**
 * Deteksi apakah pesan mengandung tag grup lewat caption / reply
 * Cek contextInfo.groupJid atau contextInfo.mentionedJid yang berisi @g.us
 */
function detectCaptionGroupTag(message) {
    try {
        const msg = message?.message || {};
        const msgType = getContentType(msg);
        if (!msgType) return false;

        if (!MEDIA_CAPTION_TYPES.includes(msgType)) return false;

        const inner = msg[msgType] || {};
        const ctx = inner?.contextInfo || {};

        // Cek groupJid (tag grup via caption)
        if (ctx?.groupJid && isJidGroup(ctx.groupJid)) return true;

        // Cek mentionedJid yang berisi JID grup (@g.us)
        if (Array.isArray(ctx?.mentionedJid)) {
            if (ctx.mentionedJid.some(j => isJidGroup(j))) return true;
        }

        // Cek quoted message yang merupakan status tag (reply ke status tag)
        const quotedMsg = ctx?.quotedMessage || {};
        for (const t of ANTITAG_MSG_TYPES) {
            if (quotedMsg[t]) return true;
        }

        return false;
    } catch (_) {
        return false;
    }
}

function loadConfig() {
    try {
        const configPath = path.join(process.cwd(), 'config.json');
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
    } catch (_) {}
    return {};
}

function loadData() {
    return kvGet('security/antitagsw', { groups: [], warnings: {} });
}

function saveData(data) {
    try {
        kvSet('security/antitagsw', data);
    } catch (err) {
        console.error('\x1b[31m[AntiTagSW] Gagal simpan data:\x1b[39m', err.message);
    }
}

function getSenderJid(message, hisoka) {
    let sender = message.key?.participant || message.participant;

    if (!sender) return null;

    if (sender.includes('@lid')) {
        try {
            // hisoka.contacts uses .read() API, not array .find()
            const contacts = hisoka.contacts;
            if (contacts?.read) {
                const contact = contacts.read(sender);
                if (contact?.id) return jidNormalizedUser(contact.id);
                if (contact?.phoneNumber) return jidNormalizedUser(contact.phoneNumber);
            }
        } catch (_) {}
        // Jika tidak bisa resolve @lid, tetap lanjut dengan sender asli
    }

    return jidNormalizedUser(sender);
}

function isOwnerJid(senderJid, senderNumber, config) {
    const owners = (config.owners || []);
    const ownerJids = owners.map(o => o + '@s.whatsapp.net');
    return ownerJids.some(o => areJidsSameUser(o, senderJid)) ||
        owners.some(o => senderNumber === o);
}

/**
 * Bangun info statistik grup dengan simbol keren
 */
function buildGroupStats(groupMeta, newWarn, maxWarnings) {
    const participants = groupMeta?.participants || [];
    const totalMembers = participants.length;
    const totalAdmins = participants.filter(p => p.admin).length;
    const totalMembers_ = totalMembers - totalAdmins;

    // Warning bar dengan simbol keren
    const filled = '◆'.repeat(newWarn);
    const empty = '◇'.repeat(maxWarnings - newWarn);
    const warnBar = filled + empty;

    // Grafik member sederhana
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

export default async function handleAntiTagSW(message, hisoka) {
    try {
        if (!message?.key?.remoteJid) return;
        if (!message.message) return;

        const remoteJid = message.key.remoteJid;

        if (!isJidGroup(remoteJid)) return;
        if (message.key?.fromMe) return;

        // Cek tipe pesan
        const msgType = getContentType(message.message);
        if (!msgType) return;

        const isTagStatus = ANTITAG_MSG_TYPES.includes(msgType);
        const isCaptionTag = !isTagStatus && detectCaptionGroupTag(message);

        // Hanya proses jika salah satu terdeteksi
        if (!isTagStatus && !isCaptionTag) return;

        // Cek config global
        const config = loadConfig();
        const antiTagSWConfig = config.antiTagSW || {};
        if (!antiTagSWConfig.enabled) return;

        // Cek apakah grup ini mengaktifkan antitagsw
        const data = loadData();
        if (!data.groups.includes(remoteJid)) return;

        const senderJid = getSenderJid(message, hisoka);
        if (!senderJid) return;

        const senderNumber = jidDecode(senderJid)?.user || senderJid.split('@')[0] || '';

        // Skip owner
        if (isOwnerJid(senderJid, senderNumber, config)) return;

        // Skip bot sendiri
        const botJid = jidNormalizedUser(hisoka.user?.id || '');
        if (areJidsSameUser(senderJid, botJid)) return;

        const botNumber = botJid.split('@')[0];
        const senderNumberClean = senderJid.split('@')[0];
        function loadBotAdminFile() {
            return kvGet('botadmin/botadmin', {});
        }

        function saveBotAdminFile(data) {
            try { kvSet('botadmin/botadmin', data); } catch (_) {}
        }

        function findParticipant(participants, targetNumber) {
            return participants?.find(p => {
                const rawJid = p.jid || p.phoneNumber || p.id || '';
                const pNum = rawJid.split('@')[0].split(':')[0];
                return pNum === targetNumber;
            });
        }

        // Selalu fetch live groupMetadata agar status admin bot akurat (realtime)
        let groupMeta = null;
        let isAdmin = false;
        try {
            groupMeta = await hisoka.groupMetadata(remoteJid);
            if (groupMeta) hisoka.groups?.write(remoteJid, groupMeta);
            const botP = findParticipant(groupMeta?.participants, botNumber);
            isAdmin = !!botP?.admin;
            // Update cache
            const botAdminData = loadBotAdminFile();
            botAdminData[remoteJid] = isAdmin;
            saveBotAdminFile(botAdminData);
        } catch (_) {
            // Fallback: cache file, lalu cache memory
            const botAdminData = loadBotAdminFile();
            if (remoteJid in botAdminData) {
                isAdmin = botAdminData[remoteJid] === true;
            }
            groupMeta = hisoka.groups?.read(remoteJid) || null;
            if (groupMeta) {
                const botP = findParticipant(groupMeta?.participants, botNumber);
                isAdmin = !!botP?.admin;
            }
        }

        // Deteksi tipe konten
        const [contentLabel, contentEmoji] = detectStatusContentType(message);
        const tagMethod = isTagStatus ? 'Status WA' : isCaptionTag ? 'Caption/Reply' : 'Tidak Diketahui';

        if (groupMeta?.participants) {
            const senderParticipant = findParticipant(groupMeta.participants, senderNumberClean);
            if (senderParticipant?.admin) {
                // Admin bebas tag status — bot konfirmasi ke grup
                try {
                    const adminMsg =
                        `👑 *Admin* @${senderNumber} melakukan tag grup via status.\n` +
                        `✅ Admin *diizinkan* — tidak ada peringatan.`;

                    await hisoka.sendMessage(remoteJid, {
                        text: adminMsg,
                        contextInfo: { mentionedJid: [senderJid] }
                    }, { quoted: message });

                    await hisoka.sendMessage(remoteJid, {
                        react: { text: '👑', key: message.key }
                    });
                } catch (_) {}
                return;
            }
        }

        console.log(`\x1b[33m[AntiTagSW] Terdeteksi! Type: ${msgType} | Metode: ${tagMethod} | Sender: ${senderNumber} | BotAdmin: ${isAdmin}\x1b[39m`);

        if (!isAdmin) {
            console.log('\x1b[33m[AntiTagSW] Bot bukan admin, hanya kirim peringatan (tanpa hapus/kick).\x1b[39m');
        }

        // Reload fresh dari disk tepat sebelum update warning (hindari race condition)
        const freshData = loadData();
        if (!freshData.warnings[remoteJid]) freshData.warnings[remoteJid] = {};
        if (!freshData.warnings[remoteJid][senderJid]) freshData.warnings[remoteJid][senderJid] = 0;
        freshData.warnings[remoteJid][senderJid] += 1;

        const newWarn = freshData.warnings[remoteJid][senderJid];
        const maxWarnings = antiTagSWConfig.maxWarnings ?? 3;
        saveData(freshData);
        Object.assign(data, freshData);

        const now = new Date();
        const timeStr = now.toLocaleTimeString('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        const dateStr = now.toLocaleDateString('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        // Bangun statistik grup
        const stats = buildGroupStats(groupMeta, newWarn, maxWarnings);

        if (newWarn >= maxWarnings) {
            // Reset warning setelah max tercapai
            delete freshData.warnings[remoteJid][senderJid];
            saveData(freshData);

            const kickStatusLine = isAdmin
                ? `💥 *Status*    ﹕ Telah di-*KICK* dari grup!`
                : `⚠️ *Bot bukan admin* — tidak bisa kick!\n💡 Jadikan bot admin agar bisa kick otomatis.`;

            const kickMsg =
                `⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛\n` +
                `✦ ⛔ *ANTI-TAG STATUS* ⛔ ✦\n` +
                `⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛\n` +
                `\n` +
                `👤 *Pelanggar* ﹕@${senderNumber}\n` +
                `🕐 *Waktu*     ﹕${timeStr} • ${dateStr}\n` +
                `${contentEmoji} *Konten*   ﹕${contentLabel}\n` +
                `📡 *Metode*    ﹕${tagMethod}\n` +
                `\n` +
                `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n` +
                `  📊 *STATISTIK GRUP*\n` +
                `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n` +
                `👥 *Total Member*  ﹕ ${stats.totalMembers} orang\n` +
                `🛡️ *Total Admin*   ﹕ ${stats.totalAdmins} orang\n` +
                `🙋 *Member Biasa* ﹕ ${stats.totalMembers_} orang\n` +
                `📈 *Rasio Admin*   ﹕ ${stats.adminPct}%\n` +
                `     [${stats.adminBar}]\n` +
                `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n` +
                `\n` +
                `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n` +
                `  ⚠️ *PELANGGARAN*\n` +
                `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n` +
                `🚫 Mentag grup lewat *${tagMethod}*\n` +
                `\n` +
                `🔴 *Peringatan* ﹕ ◆◆◆ ${maxWarnings}/${maxWarnings}\n` +
                `${kickStatusLine}\n` +
                `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n` +
                `\n` +
                `_Jangan ulangi perbuatan ini di grup lain!_ 😤`;

            await hisoka.sendMessage(remoteJid, {
                text: kickMsg,
                contextInfo: { mentionedJid: [senderJid] }
            }, { quoted: message });

            if (isAdmin) {
                // Tandai ID agar anti-delete tidak notif "PESAN DIHAPUS"
                global.__antiTagSWDeletedIds.add(message.key.id);
                setTimeout(() => global.__antiTagSWDeletedIds.delete(message.key.id), 10000);

                // Hapus pesan tag status
                try {
                    await hisoka.sendMessage(remoteJid, {
                        delete: {
                            remoteJid: remoteJid,
                            fromMe: false,
                            id: message.key.id,
                            participant: message.key.participant
                        }
                    });
                } catch (delErr) {
                    console.error('\x1b[31m[AntiTagSW] Gagal hapus pesan:\x1b[39m', delErr.message);
                }

                try {
                    await hisoka.groupParticipantsUpdate(remoteJid, [senderJid], 'remove');
                    console.log(`\x1b[31m[AntiTagSW] ✓ Kicked ${senderNumber} dari ${remoteJid}\x1b[39m`);
                } catch (kickErr) {
                    console.error('\x1b[31m[AntiTagSW] Gagal kick:\x1b[39m', kickErr.message);
                    await hisoka.sendMessage(remoteJid, {
                        text: `❌ Gagal kick @${senderNumber}. Pastikan bot adalah admin grup.`,
                        contextInfo: { mentionedJid: [senderJid] }
                    });
                }
            }
        } else {
            const deleteInfo = isAdmin
                ? `🗑️ *Pesan*     ﹕ Telah dihapus otomatis.\n`
                : `⚠️ *Pesan*     ﹕ Bot bukan admin, tidak bisa hapus.\n`;

            const nextWarnInfo = (newWarn >= maxWarnings - 1)
                ? `⚡ *Peringatan berikutnya = KICK otomatis!*`
                : `💡 Sisa *${maxWarnings - newWarn}x* lagi sebelum di-kick!`;

            const warnMsg =
                `⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛\n` +
                `✦ ⚠️ *ANTI-TAG STATUS* ⚠️ ✦\n` +
                `⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛\n` +
                `\n` +
                `👤 *Pelanggar* ﹕@${senderNumber}\n` +
                `🕐 *Waktu*     ﹕${timeStr} • ${dateStr}\n` +
                `${contentEmoji} *Konten*   ﹕${contentLabel}\n` +
                `📡 *Metode*    ﹕${tagMethod}\n` +
                `${deleteInfo}` +
                `\n` +
                `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n` +
                `  📊 *STATISTIK GRUP*\n` +
                `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n` +
                `👥 *Total Member*  ﹕ ${stats.totalMembers} orang\n` +
                `🛡️ *Total Admin*   ﹕ ${stats.totalAdmins} orang\n` +
                `🙋 *Member Biasa* ﹕ ${stats.totalMembers_} orang\n` +
                `📈 *Rasio Admin*   ﹕ ${stats.adminPct}%\n` +
                `     [${stats.adminBar}]\n` +
                `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n` +
                `\n` +
                `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n` +
                `  🚫 *PERINGATAN*\n` +
                `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n` +
                `🔴 Dilarang mentag grup via *${tagMethod}*!\n` +
                `\n` +
                `📊 *Progress* ﹕ ${stats.warnBar} ${newWarn}/${maxWarnings}\n` +
                `${nextWarnInfo}\n` +
                `◈━━━━━━━━━━━━━━━━━━━━━━━◈`;

            await hisoka.sendMessage(remoteJid, {
                text: warnMsg,
                contextInfo: { mentionedJid: [senderJid] }
            }, { quoted: message });

            if (isAdmin) {
                // Tandai ID agar anti-delete tidak notif "PESAN DIHAPUS"
                global.__antiTagSWDeletedIds.add(message.key.id);
                setTimeout(() => global.__antiTagSWDeletedIds.delete(message.key.id), 10000);

                // Hapus pesan tag status
                try {
                    await hisoka.sendMessage(remoteJid, {
                        delete: {
                            remoteJid: remoteJid,
                            fromMe: false,
                            id: message.key.id,
                            participant: message.key.participant
                        }
                    });
                } catch (delErr) {
                    console.error('\x1b[31m[AntiTagSW] Gagal hapus pesan:\x1b[39m', delErr.message);
                }
            }

            console.log(`\x1b[33m[AntiTagSW] Warn ${newWarn}/${maxWarnings} - ${senderNumber} | Admin: ${isAdmin} | Metode: ${tagMethod}\x1b[39m`);
        }
    } catch (err) {
        console.error('\x1b[31m[AntiTagSW] Error:\x1b[39m', err.message);
    }
}

export function isAntiTagSWEnabled(groupId) {
    const data = loadData();
    return data.groups.includes(groupId);
}

export function getAllAntiTagSWGroups() {
    const data = loadData();
    return Array.isArray(data.groups) ? [...data.groups] : [];
}

export function toggleAntiTagSW(groupId, enable) {
    const data = loadData();
    if (enable) {
        if (!data.groups.includes(groupId)) {
            data.groups.push(groupId);
        }
    } else {
        data.groups = data.groups.filter(g => g !== groupId);
        if (data.warnings[groupId]) {
            delete data.warnings[groupId];
        }
    }
    saveData(data);
    return data;
}

export function resetWarnings(groupId, userJid) {
    const data = loadData();
    if (!data.warnings[groupId]) return;
    if (userJid) {
        delete data.warnings[groupId][userJid];
    } else {
        delete data.warnings[groupId];
    }
    saveData(data);
}

export function getWarnings(groupId) {
    const data = loadData();
    return data.warnings[groupId] || {};
}
