/**
 * ───────────────────────────────
 *  USER MEMORY HELPER (Simple v1)
 *  Recode By : Bang Wilykun
 * ───────────────────────────────
 *  Nyimpen preferensi ringan per-user supaya AI ingat lintas sesi:
 *    • style    : formal / santai / nyablak  (auto-detect dari pola bahasa)
 *    • nickname : panggilan pilihan user      (cuma kalau user EXPLICIT minta)
 *    • lang     : id / en / mix               (auto-detect)
 *
 *  Disimpen di file user yg udah ada (data/users/<id>.json) di key `aiMemory`,
 *  jadi ga bikin storage baru.
 * ───────────────────────────────
 */

import { getUserExtra, setUserExtra } from '../db/userDb.js';

const DEFAULT_MEMORY = { style: null, nickname: null, lang: null, lastUpdated: null, msgCount: 0 };

const STYLE_LABELS = {
    nyablak: 'super santai/kasar (pakai lo-gw, anjir, njir, asw, wkwk)',
    santai: 'santai akrab (pakai aku-kamu/kak, gak/nggak, dong, sih)',
    formal: 'formal sopan (pakai saya-Anda, tanpa slang)',
};

const LANG_LABELS = {
    id: 'Bahasa Indonesia',
    en: 'English',
    mix: 'campur Indonesia + English (code-mixing)',
};

export function loadUserMemory(sender) {
    const stored = getUserExtra(sender, 'aiMemory');
    return { ...DEFAULT_MEMORY, ...(stored || {}) };
}

export function saveUserMemory(sender, memory) {
    const clean = {
        style: memory.style || null,
        nickname: memory.nickname || null,
        lang: memory.lang || null,
        lastUpdated: new Date().toISOString(),
        msgCount: Math.min(9999, (memory.msgCount || 0)),
    };
    setUserExtra(sender, 'aiMemory', clean);
}

export function clearUserMemory(sender) {
    setUserExtra(sender, 'aiMemory', { ...DEFAULT_MEMORY });
}

function detectStyle(text = '') {
    const lower = String(text).toLowerCase();
    let nyablak = 0, santai = 0, formal = 0;

    if (/\b(lo|lu|gw|gue|gua|elu|elo)\b/.test(lower)) nyablak += 2;
    if (/\b(anjir|njir|asw|asu|bangsat|kontol|memek|tai|taik|bgst)\b/.test(lower)) nyablak += 3;
    if (/\b(wkwk+|wkwkwk|hahaha+|xixixi)\b/.test(lower)) nyablak += 1;

    if (/\b(aku|kamu|kak|bang|bro|sis|min|mas|mbak)\b/.test(lower)) santai += 2;
    if (/\b(gak|nggak|enggak|ga|kagak|engga|dong|sih|deh|nih|kok|kan)\b/.test(lower)) santai += 1;
    if (/\b(banget|bgt|aja|doang|udah|udh|gimana|kayak|kaya)\b/.test(lower)) santai += 1;

    if (/\b(saya|anda|mohon|silakan|terima kasih|tolong)\b/.test(lower)) formal += 2;
    if (lower.length > 30 && nyablak === 0 && santai <= 1 && /\b(apakah|bagaimana|mengapa)\b/.test(lower)) formal += 2;

    const max = Math.max(nyablak, santai, formal);
    if (max === 0) return null;
    if (nyablak === max) return 'nyablak';
    if (formal === max) return 'formal';
    return 'santai';
}

function detectLang(text = '') {
    const lower = String(text).toLowerCase();
    const enWords = (lower.match(/\b(the|is|are|what|how|why|when|where|please|could|would|hello|hi|thanks|you|your|my|me)\b/g) || []).length;
    const idWords = (lower.match(/\b(yang|dan|itu|ini|gimana|kenapa|tolong|bisa|mau|gak|nggak|aja|sih|dong|kak|aku|kamu|saya|anda)\b/g) || []).length;
    if (enWords >= 3 && enWords > idWords) return 'en';
    if (enWords >= 2 && idWords >= 2) return 'mix';
    if (idWords >= 1) return 'id';
    return null;
}

function extractNicknameRequest(text = '') {
    const t = String(text);
    const patterns = [
        /panggil\s+(?:gw|gue|aku|saya|w)\s+([A-Za-z][A-Za-z0-9 _-]{1,20})/i,
        /nama\s+(?:gw|gue|aku|saya)\s+([A-Za-z][A-Za-z0-9 _-]{1,20})/i,
        /(?:gw|gue|aku|saya)\s+(?:dipanggil|biasa dipanggil)\s+([A-Za-z][A-Za-z0-9 _-]{1,20})/i,
        /call\s+me\s+([A-Za-z][A-Za-z0-9 _-]{1,20})/i,
        /my\s+name\s+is\s+([A-Za-z][A-Za-z0-9 _-]{1,20})/i,
    ];
    const STOP_WORDS = new Set(['ya', 'dong', 'sih', 'aja', 'deh', 'kok', 'tuh', 'nih', 'kak', 'bro', 'sis', 'nya', 'lah', 'tapi', 'doang', 'banget', 'bgt', 'aj', 'gw', 'gue', 'aku', 'saya', 'and', 'or', 'plz', 'please']);
    for (const re of patterns) {
        const m = t.match(re);
        if (m && m[1]) {
            let raw = m[1].trim().replace(/[.,!?;:].*$/, '').trim();
            const tokens = raw.split(/\s+/);
            const cleaned = [];
            for (const tok of tokens) {
                if (STOP_WORDS.has(tok.toLowerCase())) break;
                cleaned.push(tok);
                if (cleaned.length >= 2) break;
            }
            const name = cleaned.join(' ').trim();
            if (name.length >= 2 && name.length <= 25) return name;
        }
    }
    return null;
}

/**
 * Auto-detect dari pesan user dan update memory kalau ada signal kuat.
 * Strategi:
 *   • Style & lang: pakai EWMA (exponential weighted moving avg) — biar 1 pesan ga langsung override
 *   • Nickname: cuma update kalau user EXPLICIT minta (regex match)
 */
export function detectAndUpdateMemory(sender, message) {
    if (!sender || !message || typeof message !== 'string') return loadUserMemory(sender);
    const memory = loadUserMemory(sender);
    let changed = false;

    memory.msgCount = (memory.msgCount || 0) + 1;
    changed = true;

    const newStyle = detectStyle(message);
    if (newStyle) {
        if (!memory.style) {
            memory.style = newStyle;
        } else if (memory.style !== newStyle && memory.msgCount >= 3) {
            memory._styleVotes = memory._styleVotes || {};
            memory._styleVotes[newStyle] = (memory._styleVotes[newStyle] || 0) + 1;
            if (memory._styleVotes[newStyle] >= 3) {
                memory.style = newStyle;
                memory._styleVotes = {};
            }
        }
    }

    const newLang = detectLang(message);
    if (newLang && !memory.lang) memory.lang = newLang;
    else if (newLang && memory.lang !== newLang && memory.msgCount >= 5) memory.lang = newLang;

    const nick = extractNicknameRequest(message);
    if (nick && nick.toLowerCase() !== (memory.nickname || '').toLowerCase()) {
        memory.nickname = nick;
    }

    if (changed) saveUserMemory(sender, memory);
    return memory;
}

export function formatMemoryForPrompt(memory, fallbackName = 'Kak') {
    if (!memory) return '';
    const parts = [];
    const callName = memory.nickname || fallbackName;
    parts.push(`• Panggilan pilihan user: *${callName}*${memory.nickname ? ' (user explicit minta dipanggil gini)' : ' (default)'}`);
    if (memory.style && STYLE_LABELS[memory.style]) {
        parts.push(`• Gaya bahasa user: *${memory.style}* — ${STYLE_LABELS[memory.style]}`);
        parts.push(`  → IKUTI gaya ini saat balas, jangan beda jauh`);
    }
    if (memory.lang && LANG_LABELS[memory.lang]) {
        parts.push(`• Bahasa pilihan user: *${LANG_LABELS[memory.lang]}*`);
    }
    if (memory.msgCount > 1) {
        parts.push(`• Sudah ngobrol ${memory.msgCount}x dengan kamu — ini BUKAN user baru`);
    }
    if (parts.length === 0) return '';
    return `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 MEMORI USER (preferensi yang udah kamu pelajari dari sesi sebelumnya)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${parts.join('\n')}`;
}

export function memoryToReadable(memory) {
    if (!memory || (!memory.style && !memory.nickname && !memory.lang && !memory.msgCount)) {
        return '_(belum ada memori — mulai chat dulu, AI bakal pelan-pelan kenal kamu)_';
    }
    const lines = [];
    lines.push(`> *🧠 MEMORI AI TENTANG KAMU*`);
    lines.push('');
    lines.push(`• Panggilan : *${memory.nickname || '(belum diset)'}*`);
    lines.push(`• Gaya bahasa : *${memory.style || '(belum terdeteksi)'}*${memory.style ? ' — ' + STYLE_LABELS[memory.style] : ''}`);
    lines.push(`• Bahasa : *${memory.lang ? LANG_LABELS[memory.lang] : '(belum terdeteksi)'}*`);
    lines.push(`• Jumlah pesan : *${memory.msgCount || 0}*`);
    if (memory.lastUpdated) {
        const d = new Date(memory.lastUpdated);
        lines.push(`• Update terakhir : ${d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
    }
    lines.push('');
    lines.push(`> _Tips: ketik_ \`.lupakanaku\` _atau_ \`.resetmemori\` _untuk hapus memori_`);
    lines.push(`> _Buat ganti panggilan, cukup chat:_ \`panggil gw <nama>\``);
    return lines.join('\n');
}
