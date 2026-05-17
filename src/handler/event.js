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
import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const { jidNormalizedUser, toNumber, jidDecode, proto, isJidGroup, delay } = _require('socketon');
import { isPnUser } from '../helper/socketCompat.js';

import { telegram } from '../helper/index.js';
import { isNumber } from '../helper/text.js';
import { getRandomEmoji, getStatusEmojis } from '../helper/emoji.js';
import { getTmpPath } from '../helper/cleaner.js';

function loadConfig() {
        try {
                const configPath = path.join(process.cwd(), 'config.json');
                if (fs.existsSync(configPath)) {
                        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                }
        } catch (err) {}
        return {};
}

function getGreeting() {
        const hour = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false });
        const h = parseInt(hour);
        if (h >= 5 && h < 11) return 'Pagi 🌆';
        if (h >= 11 && h < 15) return 'Siang 🏙️';
        if (h >= 15 && h < 18) return 'Sore 🌇';
        return 'Malam 🌃';
}

const SW_STATS_PATH = path.join(process.cwd(), 'data', 'ceksw', 'swstats.json');

function updateSwStats(number, name, reacted, emoji) {
        if (!number) return;
        if (loadConfig().cekswTracking === false) return;
        try {
                let stats = {};
                if (fs.existsSync(SW_STATS_PATH)) {
                        try { stats = JSON.parse(fs.readFileSync(SW_STATS_PATH, 'utf-8')); } catch {}
                }
                if (!stats[number]) {
                        stats[number] = { name: name || number, number, reads: 0, reactions: 0, lastSeen: null, activeSW: [] };
                }
                stats[number].reads = (stats[number].reads || 0) + 1;
                if (reacted) stats[number].reactions = (stats[number].reactions || 0) + 1;
                if (name) stats[number].name = name;
                stats[number].lastSeen = new Date().toISOString();
                const tsNow = Date.now();
                const SW_TTL = 24 * 60 * 60 * 1000;
                if (!Array.isArray(stats[number].activeSW)) stats[number].activeSW = [];
                stats[number].activeSW = stats[number].activeSW.filter(t => tsNow - t < SW_TTL);
                stats[number].activeSW.push(tsNow);
                if (reacted && emoji && !['❌ Gagal', '⏭️ Skip (LID belum resolve)', '❌', 'Off ❌'].includes(emoji)) {
                        if (!stats._emojiStats) stats._emojiStats = {};
                        stats._emojiStats[emoji] = (stats._emojiStats[emoji] || 0) + 1;
                }
                const dir = path.dirname(SW_STATS_PATH);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                const { _emojiStats, ...users } = stats;
                const sorted = Object.fromEntries(
                        Object.entries(users).sort((a, b) => (b[1].reactions || 0) - (a[1].reactions || 0))
                );
                if (_emojiStats) sorted._emojiStats = _emojiStats;
                fs.writeFileSync(SW_STATS_PATH, JSON.stringify(sorted, null, 2), 'utf-8');
        } catch {}
}

function getMediaTypeEmoji(type) {
        const mediaTypes = {
                imageMessage: ['Foto', '📷'],
                videoMessage: ['Video', '🎥'],
                audioMessage: ['Audio', '🎵'],
                stickerMessage: ['Sticker', '🎨'],
                documentMessage: ['Dokumen', '📄'],
                extendedTextMessage: ['Teks', '📝'],
                conversation: ['Teks', '📝'],
                protocolMessage: ['Protocol', '⚙️'],
                viewOnceMessageV2: ['View Once', '👁️'],
                viewOnceMessage: ['View Once', '👁️'],
                viewOnceMessageV2Extension: ['View Once', '👁️'],
                interactiveMessage: ['Interactive', '🎯'],
                listMessage: ['List', '📋'],
                buttonsMessage: ['Buttons', '🔘'],
                templateMessage: ['Template', '📃'],
                pollCreationMessage: ['Poll', '📊'],
                reactionMessage: ['Reaction', '💬'],
                liveLocationMessage: ['Live Location', '📍'],
                locationMessage: ['Location', '📍'],
                contactMessage: ['Contact', '👤'],
                contactsArrayMessage: ['Contacts', '👥'],
        };
        return mediaTypes[type] || ['Media', '📨'];
}

const storyDebounce = new Map();

function maskNumber(number) {
        if (!number) return '***';
        const clean = number.replace(/[^0-9]/g, '');
        if (clean.length <= 6) return clean;
        return clean.slice(0, 4) + '****' + clean.slice(-3);
}

function getDisplayWidth(str) {
        let width = 0;
        for (const char of str) {
                const code = char.codePointAt(0);
                if (code > 0x1F600 && code < 0x1F9FF) width += 2;
                else if (code > 0x2600 && code < 0x27BF) width += 2;
                else if (code > 0x1F300 && code < 0x1F5FF) width += 2;
                else if (code > 0x1F900 && code < 0x1F9FF) width += 2;
                else if (code > 0x2700 && code < 0x27BF) width += 2;
                else if (code > 0xFE00 && code < 0xFE0F) width += 0;
                else if (code > 0x3000 && code < 0x9FFF) width += 2;
                else if (code > 0xFF00 && code < 0xFFEF) width += 2;
                else width += 1;
        }
        return width;
}

function padEnd(str, targetWidth) {
        const currentWidth = getDisplayWidth(str);
        const padding = Math.max(0, targetWidth - currentWidth);
        return str + ' '.repeat(padding);
}

function logStoryView(data) {
        /* tambahan botId */
        const { botId, mediaType, greeting, dayName, date, time, name, number, success, reaction, delaySeconds, mode, resolve } = data;
        const cyan = '\x1b[36m';
        const white = '\x1b[37m';
        const yellow = '\x1b[33m';
        const green = '\x1b[32m';
        const blue = '\x1b[34m';
        const orange = '\x1b[38;2;255;165;0m';
        const purple = '\x1b[38;2;180;120;255m';
        const bold = '\x1b[1m';
        const reset = '\x1b[0m';
        
        const boxWidth = 35;
        const labelWidth = 14;
        const contentWidth = boxWidth - labelWidth - 5;
        const title = 'AutoReadStoryWhatsApp';
        const titlePadding = Math.floor((boxWidth - title.length) / 2);
        
        const mediaStr = `${mediaType[0]} ${mediaType[1]}`;
        const successStr = success;
        const reactionStr = reaction;
        const delayStr = delaySeconds !== null ? `${delaySeconds} detik` : '-';
        const modeStr = mode === 'Off ❌' ? 'Read Only' : 'Read+Reaction ✓';
        
        console.log(`${cyan}╭${'═'.repeat(boxWidth)}╮${reset}`);
        console.log(`${cyan}║${' '.repeat(titlePadding)}${yellow}${title}${reset}${cyan}${' '.repeat(boxWidth - titlePadding - title.length)}║${reset}`);
        console.log(`${cyan}├${'═'.repeat(boxWidth)}┤${reset}`);
        if (botId) {
        console.log(`${cyan}│${reset} ${white}⭔ Jadibot     : ${white}${padEnd(botId, contentWidth)}${reset}${cyan}${reset}`);
}
        console.log(`${cyan}│${reset} ${white}⭔ Mode        : ${green}${padEnd(modeStr, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Tipe Story  : ${orange}${padEnd(mediaStr, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Selamat     : ${purple}${padEnd(greeting, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Hari        : ${blue}${padEnd(dayName, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Tanggal     : ${yellow}${padEnd(date, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Waktu       : ${blue}${padEnd(time, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Nama        : ${white}${padEnd(name.slice(0, contentWidth - 2), contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Nomor       : ${white}${padEnd(number, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Berhasil    : ${green}${padEnd(successStr, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}│${reset} ${white}⭔ Reaksi      : ${padEnd(reactionStr, contentWidth)}${reset}${cyan}${reset}`);
        if (resolve) {
        const resolveColor = resolve.includes('❌') ? '\x1b[31m' : (resolve.includes('PN') ? green : (resolve.includes('Cache') ? yellow : blue));
        console.log(`${cyan}│${reset} ${white}⭔ Resolve     : ${resolveColor}${padEnd(resolve, contentWidth)}${reset}${cyan}${reset}`);
        }
        console.log(`${cyan}│${reset} ${white}⭔ Delay       : ${orange}${padEnd(delayStr, contentWidth)}${reset}${cyan}${reset}`);
        console.log(`${cyan}└${'─'.repeat(13)}···${reset}`);
}

export default async function (m, hisoka) {
        try {

                if (m.content && m.content.contextInfo && isNumber(m.content.contextInfo.expiration) && isPnUser(m.from)) {
                        const expiration = m.content.contextInfo.expiration;
                        const ephemeralSettingTimestamp = toNumber(m.content.contextInfo.ephemeralSettingTimestamp);
                        const contact = hisoka.contacts.read(m.from) || {};
                        hisoka.contacts.write(m.from, { ...contact, ephemeralSettingTimestamp, ephemeralDuration: expiration });
                }

                if (m.message.protocolMessage) {
                        const protocolMessage = m.message.protocolMessage;
                        const key = protocolMessage.key;
                        const type = protocolMessage.type;

                        switch (type) {
                                case proto.Message.ProtocolMessage.Type.EPHEMERAL_SETTING:
                                case proto.Message.ProtocolMessage.Type.EPHEMERAL_SYNC_RESPONSE: {
                                        const id = await hisoka.resolveLidToPN(key);
                                        const contact = hisoka.contacts.read(id) || {};
                                        hisoka.contacts.write(id, {
                                                ...contact,
                                                ephemeralSettingTimestamp: toNumber(
                                                        protocolMessage.ephemeralSettingTimestamp || m.message.messageTimestamp
                                                ),
                                                ephemeralDuration: protocolMessage.ephemeralExpiration,
                                        });
                                        break;
                                }
                        }
                }

                if (!m.isOwner && !m.isBot && !m.status && m.message && m.type && m.type !== 'protocolMessage' && m.type !== 'reactionMessage') {
                        const config = loadConfig();
                        const autoTyping = config.autoTyping || {};
                        const autoRecording = config.autoRecording || {};
                        
                        const isPrivate = isPnUser(m.from);
                        const isGroup = isJidGroup(m.from);
                        
                        const shouldAutoType = autoTyping.enabled && 
                                ((isPrivate && autoTyping.privateChat) || (isGroup && autoTyping.groupChat));
                        
                        const shouldAutoRecord = autoRecording.enabled && 
                                ((isPrivate && autoRecording.privateChat) || (isGroup && autoRecording.groupChat));
                        
                        if (shouldAutoType || shouldAutoRecord) {
                                (async () => {
                                        try {
                                                if (shouldAutoType && !shouldAutoRecord) {
                                                        await hisoka.sendPresenceUpdate('composing', m.from);
                                                        const delayMs = (autoTyping.delaySeconds || 5) * 1000;
                                                        await delay(delayMs);
                                                        await hisoka.sendPresenceUpdate('paused', m.from);
                                                } else if (shouldAutoRecord && !shouldAutoType) {
                                                        await hisoka.sendPresenceUpdate('recording', m.from);
                                                        const delayMs = (autoRecording.delaySeconds || 5) * 1000;
                                                        await delay(delayMs);
                                                        await hisoka.sendPresenceUpdate('paused', m.from);
                                                } else if (shouldAutoType && shouldAutoRecord) {
                                                        await hisoka.sendPresenceUpdate('composing', m.from);
                                                        const typingDelayMs = (autoTyping.delaySeconds || 5) * 1000;
                                                        await delay(typingDelayMs);
                                                        await hisoka.sendPresenceUpdate('recording', m.from);
                                                        const recordingDelayMs = (autoRecording.delaySeconds || 5) * 1000;
                                                        await delay(recordingDelayMs);
                                                        await hisoka.sendPresenceUpdate('paused', m.from);
                                                }
                                        } catch (err) {
                                                console.error('\x1b[31m[AutoTyping/Recording] Error:\x1b[39m', err.message);
                                        }
                                })();
                        }
                }
                // ini baru
                if (!m.key?.fromMe && m.key?.remoteJid === 'status@broadcast' && m.message && m.type && m.type !== 'protocolMessage' && m.type !== 'reactionMessage') { // sampe sini
                        const config = loadConfig();
                        const storyConfig = config.autoReadStory || {};
                        
                        if (storyConfig.enabled === false) return;

                        const reactStatus = getStatusEmojis();
                        let usedReaction = reactStatus.length ? getRandomEmoji('status') : '❌';

                        const useRandomDelay = storyConfig.randomDelay !== false;
                        const delayMinMs = storyConfig.delayMinMs || 1000;
                        const delayMaxMs = storyConfig.delayMaxMs || 20000;
                        const fixedDelayMs = storyConfig.fixedDelayMs || 3000;
                        
                        const delayMs = useRandomDelay 
                                ? Math.floor(Math.random() * (delayMaxMs - delayMinMs)) + delayMinMs
                                : fixedDelayMs;

                        // Resolusi sender: PN diutamakan, LID disimpan untuk fallback
                        const rawParticipant = m.key?.participant || m.participant || m.sender;
                        const senderPn = m.sender && !String(m.sender).endsWith('@lid') ? m.sender : null;
                        let senderLid = rawParticipant && String(rawParticipant).endsWith('@lid') ? rawParticipant : null;
                        if (!senderLid && m.key?.participantAlt && String(m.key.participantAlt).endsWith('@lid')) {
                                senderLid = m.key.participantAlt;
                        }
                        // Lacak metode resolve buat ditampilkan di notif
                        let resolveMethod = null;
                        let resolvedPn = senderPn;
                        if (resolvedPn) resolveMethod = 'PN langsung ✓';
                        // Coba resolve PN lewat signalRepository jika belum ada
                        if (!resolvedPn && senderLid && hisoka?.signalRepository?.lidMapping?.getPNForLID) {
                                try {
                                        const r = await hisoka.signalRepository.lidMapping.getPNForLID(senderLid);
                                        if (r && !String(r).endsWith('@lid')) {
                                                resolvedPn = jidNormalizedUser(r);
                                                resolveMethod = 'Signal Lib ✓';
                                        }
                                } catch (_) {}
                        }
                        // Fallback: cache LID->PN runtime dari group metadata (bot utama)
                        if (!resolvedPn && senderLid && typeof global.__lookupLidPn === 'function') {
                                try {
                                        const r = global.__lookupLidPn(senderLid);
                                        if (r && !String(r).endsWith('@lid')) {
                                                resolvedPn = jidNormalizedUser(r);
                                                resolveMethod = 'Cache Grup ✓';
                                        }
                                } catch (_) {}
                        }
                        if (!resolvedPn && senderLid) resolveMethod = 'LID belum ke-resolve ❌';
                        if (!resolvedPn && !senderLid && rawParticipant) resolveMethod = 'Tanpa LID ⚠️';
                        const senderJid = resolvedPn || senderLid || rawParticipant;
                        const hasSender = !!senderJid;
                        const shouldReact = storyConfig.autoReaction !== false && reactStatus.length && hasSender;

                        await new Promise(resolve => setTimeout(resolve, delayMs));

                        const isConnClosed = (err) => {
                                const msg = err?.message || String(err);
                                return msg.includes('Connection Closed') || msg.includes('Connection closed') || msg.includes('connection closed');
                        };

                        // Bangun beberapa varian key untuk receipt — pakai participant ASLI dari WA
                        // (LID maupun PN) supaya WA cocokkan dengan state story di server, lalu
                        // sync "sudah dilihat" ke semua device (HP & WhatsApp Web).
                        const buildKey = (participant) => ({
                                ...m.key,
                                remoteJid: 'status@broadcast',
                                ...(participant && { participant }),
                                fromMe: false,
                        });
                        const receiptKeys = [];
                        const seenParts = new Set();
                        const pushKey = (p) => {
                                if (!p) return;
                                const norm = jidNormalizedUser(p);
                                if (seenParts.has(norm)) return;
                                seenParts.add(norm);
                                receiptKeys.push(buildKey(norm));
                        };
                        // Urutan prioritas: participant asli dari key, lalu LID & PN hasil resolve
                        pushKey(rawParticipant);
                        pushKey(senderLid);
                        pushKey(resolvedPn);

                        // 'read' = beri tahu poster + WA sync ke device kita (hilangkan tanda hijau)
                        // Kirim per varian key supaya minimal salah satunya cocok di server WA
                        const readPromise = Promise.all(
                                receiptKeys.map(k =>
                                        hisoka.sendReceipts([k], 'read').catch(err => {
                                                if (!isConnClosed(err)) console.error('\x1b[31m[AutoRead] read failed:\x1b[39m', err?.message || String(err));
                                        })
                                )
                        );

                        // Reaction butuh statusJidList format PN. Kalau belum ke-resolve, skip reaction
                        // daripada kena 'not-acceptable' dari server.
                        const reactPromise = (shouldReact && resolvedPn) ? hisoka.sendMessage(
                                'status@broadcast',
                                {
                                        react: { key: m.key, text: usedReaction },
                                },
                                {
                                        statusJidList: [jidNormalizedUser(hisoka.user.id), jidNormalizedUser(resolvedPn)],
                                }
                        ).catch((err) => {
                                if (!isConnClosed(err)) {
                                        console.error('\x1b[31m[Reaction Error]\x1b[39m', err?.message || String(err) || 'Unknown');
                                }
                                usedReaction = '❌ Gagal';
                        }) : (shouldReact ? (() => { usedReaction = '⏭️ Skip (LID belum resolve)'; return Promise.resolve(); })() : Promise.resolve());

                        await Promise.all([readPromise, reactPromise]);

                        const from = jidNormalizedUser(m.participant || m.sender);
                        const storyNumber = jidDecode(from)?.user || '';
                        const storyName = m.pushName || hisoka.getName(from, true) || storyNumber;
                        const messageDate = new Date(toNumber(m.messageTimestamp) * 1000);

                        const reactionSuccess = shouldReact && resolvedPn && usedReaction !== '❌ Gagal' && usedReaction !== '⏭️ Skip (LID belum resolve)';
                        updateSwStats(storyNumber, storyName, reactionSuccess, reactionSuccess ? usedReaction : null);
                        
                        const now = Date.now();
                        // ini baru debounce bot utama dan jadibot
                        const botId = hisoka.user.id.split(':')[0]
                        const debounceKey = `${botId}:${from}` // sampe sini
                        const lastLog = storyDebounce.get(debounceKey);
                        const telegramConfig = loadConfig().telegram || {};
                        
                        if (lastLog) {
                                lastLog.count++;
                                storyDebounce.set(debounceKey, lastLog);
                        } else {
                                storyDebounce.set(debounceKey, { time: now, count: 1 });
                                
                                const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                                
                                const jakartaDate = new Date(messageDate.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
                                const dayName = dayNames[jakartaDate.getDay()];
                                const dateStr = `${jakartaDate.getDate()} ${monthNames[jakartaDate.getMonth()]} ${jakartaDate.getFullYear()}`;
                                const timeStr = jakartaDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.');
                                
                                let successMsg = 'Ke Tele ✓';
                                if (!telegramConfig.enabled || !telegramConfig.chatId || !telegramConfig.token) {
                                        successMsg = 'Ke Tele ❌';
                                }

                                logStoryView({
                     /* ini tambahan */ botId: hisoka.isMainBot ? null : (hisoka.user.name || maskNumber(botId)),
                                        mediaType: getMediaTypeEmoji(m.type),
                                        greeting: getGreeting(),
                                        dayName: dayName + ' 🔁',
                                        date: dateStr + ' 🗓️',
                                        time: timeStr + ' ⏰',
                                        name: storyName,
                                        number: maskNumber(storyNumber),
                                        success: successMsg,
                                        reaction: shouldReact ? usedReaction : 'Off ❌',
                                        resolve: resolveMethod,
                                        delaySeconds: (delayMs / 1000).toFixed(1),
                                        mode: shouldReact ? 'Read+Reaction ✓' : 'Read Only'
                                });
                                
                                setTimeout(() => {
                                        const data = storyDebounce.get(debounceKey);
                                        if (data && data.count > 1) {
                                                console.log(`\x1b[33m   └─ +${data.count - 1} story lainnya dari ${storyName}\x1b[39m`);
                                        }
                                        storyDebounce.delete(debounceKey);
                                }, 3000);
                        }

                        if (telegramConfig.enabled && telegramConfig.chatId && telegramConfig.token) {
                                const text = `<b>From :</b> <a href="https://wa.me/${jidDecode(from).user}">@${storyName}</a>
<b>Date :</b> ${new Date(toNumber(m.messageTimestamp) * 1000).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })}
${m.text ? `<b>Caption :</b>\n\n${m.text}` : ''}`.trim();

                                if (m.isMedia) {
                                        try {
                                                const media = await m.downloadMedia();
                                                
                                                if (!media || media.length === 0) {
                                                        await telegram.send(telegramConfig.chatId, text + '\n\n<i>(Media tidak tersedia)</i>', { type: 'text', parse_mode: 'HTML' });
                                                } else {
                                                        const ext = m.type === 'imageMessage' ? 'jpg' : m.type === 'videoMessage' ? 'mp4' : m.type === 'audioMessage' ? 'mp3' : 'bin';
                                                        const tmpFile = getTmpPath(`story_${Date.now()}.${ext}`);
                                                        
                                                        try {
                                                                fs.writeFileSync(tmpFile, media);
                                                                
                                                                await telegram.send(telegramConfig.chatId, media, {
                                                                        caption: text,
                                                                        type: m.type.replace('Message', ''),
                                                                        parse_mode: 'HTML',
                                                                });
                                                                
                                                                fs.unlinkSync(tmpFile);
                                                        } catch (err) {
                                                                if (fs.existsSync(tmpFile)) {
                                                                        fs.unlinkSync(tmpFile);
                                                                }
                                                                console.error('\x1b[31m[AutoReadSW] Error sending to Telegram:\x1b[39m', err.message);
                                                        }
                                                }
                                        } catch (downloadErr) {
                                                console.error('\x1b[33m[AutoReadSW] Media unavailable:\x1b[39m', downloadErr.message);
                                                await telegram.send(telegramConfig.chatId, text + '\n\n<i>(Media tidak tersedia)</i>', { type: 'text', parse_mode: 'HTML' }).catch(() => {});
                                        }
                                } else {
                                        await telegram.send(telegramConfig.chatId, text, { type: 'text', parse_mode: 'HTML' });
                                }
                        }
                }
                // Group Linked Status (upswgc / groupStatusMessageV2)
                if (!m.key?.fromMe && isJidGroup(m.key?.remoteJid) && m.message?.groupStatusMessageV2) {
                        const config = loadConfig();
                        const storyConfig = config.autoReadStory || {};

                        if (storyConfig.enabled === false) return;

                        const reactStatus = getStatusEmojis();
                        let usedReaction = reactStatus.length ? getRandomEmoji('status') : '❌';

                        const useRandomDelay = storyConfig.randomDelay !== false;
                        const delayMinMs = storyConfig.delayMinMs || 1000;
                        const delayMaxMs = storyConfig.delayMaxMs || 20000;
                        const fixedDelayMs = storyConfig.fixedDelayMs || 3000;

                        const delayMs = useRandomDelay
                                ? Math.floor(Math.random() * (delayMaxMs - delayMinMs)) + delayMinMs
                                : fixedDelayMs;

                        const senderJid = m.sender || m.participant || m.key?.participant;
                        const hasSender = !!senderJid;
                        const shouldReact = storyConfig.autoReaction !== false && reactStatus.length && hasSender;

                        await new Promise(resolve => setTimeout(resolve, delayMs));

                        const reactPromise = shouldReact ? hisoka.sendMessage(
                                m.key.remoteJid,
                                { react: { key: m.key, text: usedReaction } }
                        ).catch((err) => {
                                const msg = err?.message || String(err);
                                const connClosed = msg.includes('Connection Closed') || msg.includes('Connection closed') || msg.includes('connection closed');
                                if (!connClosed) console.error('\x1b[31m[GroupStatus Reaction Error]\x1b[39m', msg || 'Unknown');
                                usedReaction = '❌ Gagal';
                        }) : Promise.resolve();

                        await reactPromise;

                        const from = jidNormalizedUser(senderJid || m.key.remoteJid);
                        const storyNumber = jidDecode(from)?.user || '';
                        const storyName = m.pushName || hisoka.getName(from, true) || storyNumber;
                        const groupName = hisoka.getName(m.key.remoteJid) || m.key.remoteJid;

                        const gsReactionSuccess = shouldReact && usedReaction !== '❌ Gagal';
                        updateSwStats(storyNumber, storyName, gsReactionSuccess, gsReactionSuccess ? usedReaction : null);

                        const nowGs = Date.now();
                        const botIdGs = hisoka.user.id.split(':')[0];
                        const debounceKeyGs = `gs:${botIdGs}:${from}`;
                        const lastLogGs = storyDebounce.get(debounceKeyGs);

                        if (!lastLogGs) {
                                storyDebounce.set(debounceKeyGs, { time: nowGs, count: 1 });

                                const delaySeconds = (delayMs / 1000).toFixed(1);
                                const innerMsg = m.message.groupStatusMessageV2?.message;
                                const innerType = innerMsg ? Object.keys(innerMsg).find(k => k !== 'messageContextInfo') : null;
                                const mediaType = getMediaTypeEmoji(innerType);
                                const greeting = getGreeting();

                                const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                                const jakartaDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
                                const dayName = dayNames[jakartaDate.getDay()];
                                const dateStr = `${jakartaDate.getDate()} ${monthNames[jakartaDate.getMonth()]} ${jakartaDate.getFullYear()}`;
                                const timeStr = jakartaDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.');

                                const mode = shouldReact ? 'Read+Reaction ✓' : 'Read Only 👁️';

                                logStoryView({
                                        botId: hisoka.isMainBot ? null : (hisoka.user.name || maskNumber(botIdGs)),
                                        mediaType,
                                        greeting,
                                        dayName,
                                        date: dateStr,
                                        time: timeStr,
                                        name: storyName,
                                        number: maskNumber(storyNumber),
                                        success: 'Grup SW ✓',
                                        reaction: shouldReact ? usedReaction : 'Off ❌',
                                        delaySeconds,
                                        mode: `${mode} [📢 ${groupName}]`,
                                });

                                setTimeout(() => {
                                        storyDebounce.delete(debounceKeyGs);
                                }, 3000);
                        }
                }
        } catch (e) {
                console.error(`\x1b[31mError in event handler:\x1b[39m\n`, e);
        }
}
