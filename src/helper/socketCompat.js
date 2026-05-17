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

import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const socketon = _require('socketon');

export const isPnUser = (jid) => typeof jid === 'string' && jid.endsWith('@pn');

export const isLidUser = socketon.isLidUser || ((jid) => typeof jid === 'string' && jid.endsWith('@lid'));

export const areJidsSameUser = socketon.areJidsSameUser;
export const generateWAMessageFromContent = socketon.generateWAMessageFromContent;
export const getContentType = socketon.getContentType;
export const isJidGroup = socketon.isJidGroup;
export const isJidStatusBroadcast = socketon.isJidStatusBroadcast;
export const jidDecode = socketon.jidDecode;
export const jidNormalizedUser = socketon.jidNormalizedUser;
export const downloadMediaMessage = socketon.downloadMediaMessage;
export const generateMessageIDV2 = socketon.generateMessageIDV2;
export const toNumber = socketon.toNumber;
export const proto = socketon.proto || socketon.WAProto?.proto;
export const delay = socketon.delay;
export const extractMessageContent = socketon.extractMessageContent;

export const safeGetPNForLID = async (sock, jid) => {
    try {
        if (!jid || !sock?.signalRepository?.lidMapping?.getPNForLID) return jid;
        return (await sock.signalRepository.lidMapping.getPNForLID(jid)) || jid;
    } catch {
        return jid;
    }
};
