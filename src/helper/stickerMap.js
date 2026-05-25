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

/**
 * ─────────────────────────────────────────
 *  STICKER MAP — Data stiker karakter CDN
 *  Recode By : Bang Wilykun
 *
 *  Dipakai oleh:
 *    • aiTools.js  → extractReplyStickersFromText (validasi + fallback mood)
 *    • aiPrompt.js → buildStickerPromptList (generate daftar URL di prompt)
 * ─────────────────────────────────────────
 */

const CDN = 'https://cdn.ornzora.eu.cc';

// ════════════════════════════════════════════════════════
//  HONOLULU — Stiker utama karakter Honolulu (Azur Lane)
// ════════════════════════════════════════════════════════
export const HONOLULU_STICKERS = [
    {
        url: `${CDN}/a44ce53e-6b1e-4a7f-b5cd-e60ee2d285bf-HONOLULU.webp`,
        label: 'malu nutup muka',
        desc: 'shy, kelepasan, panik',
        tags: ['malu', 'shy', 'kelepasan', 'panik', 'embarrassed', 'caught', 'nutup muka', 'malu-maluin', 'diketahuan'],
    },
    {
        url: `${CDN}/6853b306-6f51-47f4-8b7a-694a6c4ed618-HONOLULU.webp`,
        label: 'senyum kecil / lembut',
        desc: 'hangat, subtle',
        tags: ['senyum', 'hangat', 'subtle', 'warm', 'gentle', 'smile', 'lembut', 'senang tipis', 'positif ringan'],
    },
    {
        url: `${CDN}/ba453a09-aabd-4483-9ca1-0ef1b66f34c1-HONOLULU.webp`,
        label: 'datar / blank stare',
        desc: 'netral, dingin, default',
        tags: ['datar', 'netral', 'blank', 'dingin', 'default', 'biasa', 'ya terus', 'oke', 'so what', 'flat'],
    },
    {
        url: `${CDN}/fbcea89f-580c-4f52-970f-2e1fa44abdce-HONOLULU.webp`,
        label: 'ceria ringan',
        desc: 'positif, genuinely happy',
        tags: ['ceria', 'happy', 'senang', 'positif', 'genuinely happy', 'gembira', 'baik', 'oke bagus', 'good'],
    },
    {
        url: `${CDN}/31f63a4b-95a8-440a-9d77-9d634ef2153a-HONOLULU.webp`,
        label: 'smug / puas',
        desc: 'ngeledek tipis, confident',
        tags: ['smug', 'puas', 'ngeledek', 'confident', 'told you', 'kan udah bilang', 'heh', 'makanya', 'victory', 'menang'],
    },
    {
        url: `${CDN}/a4bbcdf7-0c78-4d43-93e2-f0ebad7d1bf6-HONOLULU.webp`,
        label: 'mikir / skeptis',
        desc: 'bingung ringan, "serius?"',
        tags: ['mikir', 'skeptis', 'bingung ringan', 'serius', 'yakin', 'hmm', 'really', 'masa', 'thinking', 'ragu'],
    },
    {
        url: `${CDN}/b371232a-5655-4341-985f-90aa4efcc9c4-HONOLULU.webp`,
        label: 'kaget positif',
        desc: 'impressed, "gila sih"',
        tags: ['kaget', 'impressed', 'gila sih', 'wow', 'wah', 'keren', 'serius', 'nggak nyangka', 'shocked good', 'surprised good'],
    },
    {
        url: `${CDN}/2203539e-dfc0-4bd7-b4bf-e0ad72385c02-HONOLULU.webp`,
        label: 'malu + gugup',
        desc: 'etto, awkward',
        tags: ['malu gugup', 'etto', 'awkward', 'gugup', 'nervous', 'canggung', 'serba salah', 'nggak tau mau ngapain'],
    },
    {
        url: `${CDN}/3d3b9600-910a-452e-b567-922c193b9bbb-HONOLULU.webp`,
        label: 'jahil / ngejek',
        desc: 'playful teasing, bleh',
        tags: ['jahil', 'ngejek', 'playful', 'teasing', 'bleh', 'iseng', 'usil', 'godain', 'jail', 'nakal'],
    },
    {
        url: `${CDN}/98de1e26-b28f-42a7-a6f1-c769ddf1e6eb-HONOLULU.webp`,
        label: 'malu berat / flustered',
        desc: 'gugup, pipi merah',
        tags: ['flustered', 'malu berat', 'pipi merah', 'duh', 'gombalin', 'dipuji', 'overwhelmed malu', 'blushing hard'],
    },
    {
        url: `${CDN}/dd1de830-8664-490d-96c4-cc199bddb284-HONOLULU.webp`,
        label: 'ngamuk lucu',
        desc: 'marah komedik, overreact',
        tags: ['ngamuk', 'marah lucu', 'overreact', 'komedik', 'lebay marah', 'kesal komedi', 'tantrum', 'ngamuk kocak'],
    },
    {
        url: `${CDN}/41f054d0-55e9-4d1a-abb7-6a49ac74769b-HONOLULU.webp`,
        label: 'kesel lucu',
        desc: 'ngambek tipis, pouting',
        tags: ['kesel', 'ngambek', 'pouting', 'cemberut', 'nggak seneng', 'annoyed tipis', 'duh', 'ih', 'pout'],
    },
    {
        url: `${CDN}/0e5ac3ba-8326-46ab-947c-fb03374207f6-HONOLULU.webp`,
        label: 'datar / males respon',
        desc: 'jutek, "ya terus"',
        tags: ['jutek', 'males', 'malas', 'whatever', 'ya terus', 'bodo amat', 'nggak tertarik', 'cuek'],
    },
    {
        url: `${CDN}/c3de99b6-bf96-46f6-bef7-d929c6399175-HONOLULU.webp`,
        label: 'zamn / chaotic',
        desc: 'lidah keluar, absurd',
        tags: ['zamn', 'chaotic', 'absurd', 'gokil', 'random', 'receh', 'ngakak absurd', 'mati', 'ded', 'lidah keluar'],
    },
    {
        url: `${CDN}/85d768a4-fedb-4f1f-8e21-86254fcd6049-HONOLULU.webp`,
        label: 'mikir + sedikit kesel',
        desc: 'side-eye, skeptis, annoyed',
        tags: ['side-eye', 'skeptis annoyed', 'mikir kesel', 'annoyed skeptis', 'nggak yakin tapi kesel', 'serius ini'],
    },
    {
        url: `${CDN}/4f528082-cccc-46ad-839c-d31dc19888a7-HONOLULU.webp`,
        label: 'capek total / drop',
        desc: 'lemes, pasrah',
        tags: ['capek', 'lemes', 'pasrah', 'exhausted', 'drop', 'burnout', 'lelah', 'nggak kuat', 'udah deh'],
    },
    {
        url: `${CDN}/e7fc6d71-5c4a-4059-abf3-8eea94fe2cbf-HONOLULU.webp`,
        label: 'skeptis diam / "hmmm"',
        desc: 'meragukan, mata setengah tutup',
        tags: ['hmmm', 'skeptis diam', 'meragukan', 'diam skeptis', 'mata setengah', 'tidak percaya', 'really though'],
    },
    {
        url: `${CDN}/c2c0fbd3-2170-42a4-be19-81004597b4cd-HONOLULU.webp`,
        label: 'nyengir puas / grin',
        desc: 'senyum lebar, playful victory',
        tags: ['nyengir', 'grin', 'senyum lebar', 'playful victory', 'heh berhasil', 'menang', 'got you', 'yes'],
    },
    {
        url: `${CDN}/acf8ea6e-1741-4b67-a41f-e4bc5f03457e-HONOLULU.webp`,
        label: 'bingung total / IDK',
        desc: 'genuinely confused, "ya gimana dong"',
        tags: ['bingung total', 'idk', 'confused', 'gimana dong', 'nggak tau', 'hah', 'apa maksudnya', 'nggak ngerti'],
    },
    {
        url: `${CDN}/8d94e9d0-0bea-49d2-9cf1-4c85d2fd50e1-HONOLULU.webp`,
        label: 'jijik / disgusted',
        desc: 'muka terganggu, genuinely disgusted',
        tags: ['jijik', 'disgusted', 'eww', 'eugh', 'terganggu', 'nggak suka', 'gross', 'yikes', 'ih jijik'],
    },
    {
        url: `${CDN}/0329f854-5309-4b03-b77e-f428d2ec362f-HONOLULU.webp`,
        label: 'yandere / creepy manis',
        desc: 'senyum menakutkan, dark-sweet',
        tags: ['yandere', 'creepy', 'dark sweet', 'senyum jahat', 'menyeramkan manis', 'threatening sweet', 'kamu milikku'],
        animated: true,
    },
    {
        url: `${CDN}/f017d04e-7da4-4160-8d01-f8a535bd1759-HONOLULU.webp`,
        label: 'ngelat playful chaotic',
        desc: 'lidah panjang, chaotic fun',
        tags: ['ngelat', 'lidah panjang', 'chaotic fun', 'bleh playful', 'jahil extreme', 'ngejek chaotic'],
        animated: true,
    },
    {
        url: `${CDN}/ece3f948-a0b4-40fe-a83a-907cc1d74793-HONOLULU.webp`,
        label: 'mati gaya / dead inside',
        desc: 'tengkurap lemas, mata kosong',
        tags: ['mati gaya', 'dead inside', 'tengkurap', 'mata kosong', 'hopeless', 'done', 'nggak ada harapan', 'give up'],
        animated: true,
    },
    {
        url: `${CDN}/4041efc4-c729-4084-8f59-3e72cee98f46-HONOLULU.webp`,
        label: 'confident tangan di pinggang',
        desc: 'smirk, "gitu deh"',
        tags: ['confident', 'tangan di pinggang', 'smirk', 'gitu deh', 'yakin', 'percaya diri', 'that\'s right'],
    },
    {
        url: `${CDN}/d86d0c29-85b7-40d7-9546-2a898df37f40-HONOLULU.webp`,
        label: 'datar annoyed',
        desc: 'capek + sedikit annoyed, "oke..." flat',
        tags: ['datar annoyed', 'oke flat', 'capek annoyed', 'yeah sure', 'oke terserah', 'nggak semangat', 'flat annoyed'],
    },
    {
        url: `${CDN}/a8a04221-d6bc-47d5-a2f6-d10dacded588-HONOLULU.webp`,
        label: '"apalah ya" santai',
        desc: 'kacamata, ketawa ringan, absurd tapi santai',
        tags: ['apalah ya', 'santai absurd', 'ketawa ringan', 'absurd santai', 'whatever absurd', 'yah gitu deh'],
    },
    {
        url: `${CDN}/e85c024f-0785-4afc-8e0c-1f0dfee258fc-HONOLULU.webp`,
        label: '"hah apa?" terbengong',
        desc: 'close-up bingung kaget, confusion overload',
        tags: ['hah apa', 'terbengong', 'bingung kaget', 'overload', 'apa tadi', 'nggak denger', 'confusion overload'],
    },
    {
        url: `${CDN}/1fb1df22-5384-4a9c-8c1a-23f96b4fccad-HONOLULU.webp`,
        label: 'loading / buffering',
        desc: 'otak error, informasi terlalu banyak',
        tags: ['loading', 'buffering', 'otak error', 'terlalu banyak', 'overload info', 'nggak nyangkup', 'processing'],
    },
    {
        url: `${CDN}/38c0ed9c-0eba-48bb-9696-9c31f38e6c18-HONOLULU.webp`,
        label: 'ngantuk / lapar',
        desc: 'mulut terbuka, energi habis',
        tags: ['ngantuk', 'lapar', 'energi habis', 'sleepy', 'hungry', 'capek ngantuk', 'nggak fokus'],
    },
    {
        url: `${CDN}/7a0a9446-4acb-4f87-8595-1205c63b5e13-HONOLULU.webp`,
        label: 'kelepasan ketawa',
        desc: 'ketawa malu, overwhelmed tapi ketawa',
        tags: ['kelepasan ketawa', 'ketawa malu', 'ngakak malu', 'nggak bisa nahan', 'overwhlelmed ketawa', 'hahaha malu'],
    },
    {
        url: `${CDN}/1afd0a2a-ea2d-4dad-979b-4b93d91bdf03-HONOLULU.webp`,
        label: 'tsundere pose klasik',
        desc: 'noleh samping, tangan disilang, muka merah',
        tags: ['tsundere pose', 'noleh', 'tangan disilang', 'classic tsundere', 'humph', 'bukan karena kamu', 'nggak mau ngaku'],
    },
    {
        url: `${CDN}/a74f6af9-1c2c-44d5-b35e-0330cfc881db-HONOLULU.webp`,
        label: 'tersipu malu dalam',
        desc: 'nutupin muka kedua tangan, full shy',
        tags: ['tersipu', 'full shy', 'nutupin muka', 'kedua tangan', 'malu dalam', 'super malu', 'blushing full'],
    },
    {
        url: `${CDN}/449471bc-ace4-4940-b771-ff0870fe440f-HONOLULU.webp`,
        label: 'semangat / genki mode',
        desc: 'mata bersinar, energi penuh, excited',
        tags: ['semangat', 'genki', 'excited', 'energi penuh', 'mata bersinar', 'antusias', 'yosh', 'ganbatte', 'siap'],
    },
    {
        url: `${CDN}/68665968-e561-4d83-85b7-f109cdc43a4a-HONOLULU.webp`,
        label: 'galak full mode',
        desc: 'alis turun tajam, marah serius, bukan komedik',
        tags: ['galak', 'marah serius', 'alis turun', 'serius marah', 'tegas marah', 'warning', 'jangan coba-coba'],
    },
    {
        url: `${CDN}/50ddaa82-1c24-4566-9a1c-0518c2336120-HONOLULU.webp`,
        label: 'menahan nangis',
        desc: 'air mata tipis, nahan sedih, ketahuan',
        tags: ['menahan nangis', 'nahan sedih', 'hampir nangis', 'sedih tersembunyi', 'air mata', 'tersentuh', 'mellow'],
    },
    {
        url: `${CDN}/8ef9c4b7-0c0b-4ffd-a4f4-fe646450c9d9-HONOLULU.webp`,
        label: 'stoic / tenang total',
        desc: 'calm, controlled, sangat kalem',
        tags: ['stoic', 'tenang', 'calm', 'controlled', 'kalem', 'serius tenang', 'cool', 'collected'],
    },
    {
        url: `${CDN}/b47f0c6d-bcac-4cab-a178-63c944623d0e-HONOLULU.webp`,
        label: 'protective mode',
        desc: 'tatapan tajam, siaga, serius dan alert',
        tags: ['protective', 'siaga', 'alert', 'jaga', 'tatapan tajam', 'waspada', 'lindungi', 'berhati-hati ya'],
    },
    {
        url: `${CDN}/d5d1fa53-1219-43e2-afc5-68da22a431d1-HONOLULU.webp`,
        label: 'surprise blush',
        desc: 'kaget + merah sekaligus, caught off guard',
        tags: ['surprise blush', 'kaget merah', 'caught off guard', 'tak terduga', 'nggak siap', 'hah serius'],
    },
    {
        url: `${CDN}/139eb47a-712a-4095-be7d-ae0f0800f660-HONOLULU.webp`,
        label: 'pensive / merenung',
        desc: 'tatapan jauh, tenggelam dalam pikiran',
        tags: ['pensive', 'merenung', 'tatapan jauh', 'dalam pikiran', 'reflektif', 'galau pelan', 'thoughtful'],
    },
    {
        url: `${CDN}/19938391-0a15-4a7c-9f11-46af6822bb00-HONOLULU.webp`,
        label: 'senyum tulus / rare smile',
        desc: 'senyum genuinely dari hati, momen langka',
        tags: ['senyum tulus', 'rare smile', 'genuinely happy', 'dari hati', 'momen langka', 'terharu senang', 'tulus'],
    },
    {
        url: `${CDN}/c06ae88e-858b-4a22-af58-52091d095b94-HONOLULU.webp`,
        label: 'facepalm / hopeless',
        desc: 'tangan di muka, "kenapa sih ini"',
        tags: ['facepalm', 'hopeless', 'kenapa sih', 'ya ampun', 'duh', 'dunia apa ini', 'nggak percaya', 'oh no'],
    },
    {
        url: `${CDN}/341224f3-7271-4501-8d29-f921d287b0d2-HONOLULU.webp`,
        label: 'ngangguk setuju pelan',
        desc: 'subtle agreement, "ya emang gitu"',
        tags: ['setuju', 'ngangguk', 'agreement', 'ya emang', 'iya bener', 'makes sense', 'nod', 'oke masuk akal'],
    },
];

// ════════════════════════════════════════════════════════
//  FIORA — Stiker karakter Fiora
// ════════════════════════════════════════════════════════
export const FIORA_STICKERS = [
    {
        url: `${CDN}/502784e6-108d-49d7-a981-04083d14ad9a-FIORA.webp`,
        label: 'malu nutup muka',
        desc: 'shy banget, kelepasan',
        tags: ['malu', 'shy', 'kelepasan', 'embarrassed', 'nutup muka'],
    },
    {
        url: `${CDN}/89067324-1a1e-4b51-a379-cdb50e8cd30d-FIORA.webp`,
        label: 'senyum kecil / lembut',
        desc: 'tenang, subtle warmth',
        tags: ['senyum', 'lembut', 'warm', 'gentle', 'subtle', 'smile'],
    },
    {
        url: `${CDN}/91b84f91-7d92-4850-a743-c0554439861d-FIORA.webp`,
        label: 'datar / blank stare',
        desc: 'netral, diem, sedikit dingin',
        tags: ['datar', 'blank', 'netral', 'dingin', 'diem', 'biasa'],
    },
    {
        url: `${CDN}/873d7ed5-c36c-43d7-a5ba-0d0acfd73eb8-FIORA.webp`,
        label: 'ceria ringan',
        desc: 'respon positif santai',
        tags: ['ceria', 'positif', 'happy', 'senang', 'santai', 'good'],
    },
    {
        url: `${CDN}/e1ab519c-7a03-4246-8cd9-2cfd623247b8-FIORA.webp`,
        label: 'smug / puas dikit',
        desc: 'ngeledek tipis, confident',
        tags: ['smug', 'puas', 'ngeledek', 'confident', 'told you', 'heh'],
    },
    {
        url: `${CDN}/5baac1a3-ca2b-4749-a08c-5eabfd418e79-FIORA.webp`,
        label: 'mikir / skeptis',
        desc: 'bingung ringan, "serius?"',
        tags: ['mikir', 'skeptis', 'hmm', 'serius', 'yakin', 'thinking'],
    },
    {
        url: `${CDN}/4d58a123-ad35-4bb2-9353-8e3e23c6d0c8-FIORA.webp`,
        label: 'kaget positif',
        desc: '"gila sih", impressed',
        tags: ['kaget', 'impressed', 'gila sih', 'wow', 'wah', 'surprised good'],
    },
    {
        url: `${CDN}/b7df2441-2731-427d-ba44-e88e1f5275e4-FIORA.webp`,
        label: 'malu + gugup',
        desc: 'etto / awkward',
        tags: ['malu gugup', 'etto', 'awkward', 'gugup', 'nervous', 'canggung'],
    },
    {
        url: `${CDN}/6adbf4a3-07ce-47c8-9dbd-31efce9d0dfe-FIORA.webp`,
        label: 'jahil / ngejek',
        desc: 'playful teasing, bleh',
        tags: ['jahil', 'ngejek', 'playful', 'teasing', 'bleh', 'iseng'],
    },
    {
        url: `${CDN}/9138434c-7338-4f66-9b40-574179b5b072-FIORA.webp`,
        label: 'malu berat / flustered',
        desc: 'gugup, pipi merah, overwhelmed',
        tags: ['flustered', 'malu berat', 'pipi merah', 'overwhelmed', 'blushing hard'],
    },
    {
        url: `${CDN}/6f805809-c16a-4521-bfdf-92ca7d20c6b4-FIORA.webp`,
        label: 'ngamuk / agresif lucu',
        desc: 'marah komedik, overreact',
        tags: ['ngamuk', 'agresif lucu', 'marah komedik', 'overreact', 'tantrum'],
    },
    {
        url: `${CDN}/997a0eb7-090a-404f-9b47-fa84f136705c-FIORA.webp`,
        label: 'kesel lucu',
        desc: 'ngambek tipis, nggak serius',
        tags: ['kesel', 'ngambek', 'pouting', 'cemberut', 'annoyed tipis'],
    },
    {
        url: `${CDN}/57a1045e-48bb-4535-bece-d7bf5e750943-FIORA.webp`,
        label: 'datar / males respon',
        desc: 'sedikit jutek, nggak tertarik',
        tags: ['jutek', 'males', 'cuek', 'whatever', 'nggak tertarik', 'bodo amat'],
    },
    {
        url: `${CDN}/249f7a66-906f-4adc-b78f-eca20e4807b7-FIORA.webp`,
        label: 'zamn / absurd reaction',
        desc: 'lidah keluar, muka bego, chaotic',
        tags: ['zamn', 'absurd', 'chaotic', 'gokil', 'muka bego', 'ngakak absurd'],
    },
    {
        url: `${CDN}/7fce094a-28c8-443f-8602-9be9518d5369-FIORA.webp`,
        label: 'mikir + sedikit kesel',
        desc: 'side-eye, skeptis, agak jutek',
        tags: ['side-eye', 'skeptis kesel', 'mikir kesel', 'annoyed skeptis', 'jutek skeptis'],
    },
    {
        url: `${CDN}/7c896ced-9e8f-4b06-9dc6-228c6b94208f-FIORA.webp`,
        label: 'malu berat flustered sensual',
        desc: 'pipi merah, overwhelmed, agak sensual',
        tags: ['sensual malu', 'flustered sensual', 'pipi merah sensual', 'overwhelmed sensual'],
    },
    {
        url: `${CDN}/390fadb4-0548-4978-8dc3-f4ee398a31e9-FIORA.webp`,
        label: 'capek total / drop',
        desc: 'lemes, energi habis, pasrah',
        tags: ['capek', 'lemes', 'pasrah', 'exhausted', 'drop', 'lelah'],
    },
    {
        url: `${CDN}/b92ddde7-eccd-43c7-9536-295f528cd741-FIORA.webp`,
        label: 'panik / keteteran',
        desc: 'stres ringan, kewalahan, hampir nangis',
        tags: ['panik', 'keteteran', 'stres', 'kewalahan', 'hampir nangis', 'overwhelmed panik'],
    },
];

// ════════════════════════════════════════════════════════
//  VALID URL SET — untuk validasi cepat di extractReplyStickersFromText
// ════════════════════════════════════════════════════════
export const ALL_STICKER_URLS = new Set([
    ...HONOLULU_STICKERS.map(s => s.url),
    ...FIORA_STICKERS.map(s => s.url),
]);

// ════════════════════════════════════════════════════════
//  MOOD KEYWORD MAP — kata kunci percakapan → tag stiker
//  Dipakai oleh selectStickerByMood() untuk mendeteksi
//  mood dari teks percakapan user + respons AI
// ════════════════════════════════════════════════════════
const MOOD_KEYWORD_MAP = [
    { mood: 'malu',       keywords: ['malu', 'blush', 'ih', 'apaan', 'bukan gitu', 'jangan gitu', 'a-apaan', 'duh kamu', 'jangan dong', 'gombal', 'puji', 'manis', 'cute', 'imut', 'nggak gitu', 'diperhatiin', 'ketahuan'] },
    { mood: 'flustered',  keywords: ['flustered', 'gombalan', 'naksir', 'suka', 'sayang', 'kangen', 'cinta', 'cantik', 'ganteng', 'lucu banget', 'aku suka kamu', 'kawaii', 'daisuki', 'deg-degan', 'berdebar', 'nervous', 'gugup'] },
    { mood: 'kaget',      keywords: ['kaget', 'serius', 'beneran', 'astaga', 'wah', 'wow', 'gila', 'nggak nyangka', 'masa', 'hah', 'gilaaak', 'parah', 'nggak percaya', 'shocking', 'tiba-tiba'] },
    { mood: 'senang',     keywords: ['senang', 'seneng', 'hore', 'yay', 'asik', 'asyik', 'happy', 'bahagia', 'mantap', 'keren', 'bagus', 'good', 'sip', 'nice', 'yes', 'berhasil', 'suka', 'gembira', 'girang', 'yatta'] },
    { mood: 'senyum',     keywords: ['senyum', 'ehehe', 'fufu', 'hehee', 'uwu', 'hangat', 'terharu', 'sweet', 'wholesome', 'manis banget', 'gemes', 'aww', 'hati'] },
    { mood: 'manja',      keywords: ['manja', 'mau dong', 'please', 'pls', 'onegai', 'minta', 'butuh kamu', 'jangan pergi', 'temeni', 'temenin', 'daisuki', 'peluk'] },
    { mood: 'hype',       keywords: ['hype', 'excited', 'gaskeun', 'yooo', 'lesgo', 'gas', 'hypeee', 'nggak sabar', 'finally', 'ikigai', 'yang paling', 'juara', 'top', 'god tier'] },
    { mood: 'ngambek',    keywords: ['ngambek', 'mou', 'cemberut', 'pout', 'cuek', 'diem-dieman', 'ng拗', 'nyebelin banget', 'kamu sih', 'bete sama kamu', 'kesel sama kamu'] },
    { mood: 'galak',      keywords: ['galak', 'berani', 'coba aja', 'jangan macam-macam', 'awas', 'jangan coba', 'warning', 'serius nih', 'nggak bercanda', 'terakhir'] },
    { mood: 'kesel',      keywords: ['kesel', 'sebel', 'nyebelin', 'ganggu', 'nggak suka', 'bête', 'bosen', 'males', 'whatever', 'terserah'] },
    { mood: 'ngamuk',     keywords: ['ngamuk', 'marah', 'bete', 'kampret', 'sialan', 'bangsat', 'anjir ngeselin', 'berisik', 'diem', 'tutup mulut'] },
    { mood: 'bingung',    keywords: ['bingung', 'nggak ngerti', 'maksudnya', 'gimana', 'apa tuh', 'explain', 'nggak paham', 'gimana dong', 'ya gimana', 'huh'] },
    { mood: 'sedih',      keywords: ['sedih', 'nangis', 'galau', 'patah hati', 'kecewa', 'hancur', 'sakit', 'nggak oke', 'berat', 'capek banget', 'lelah', 'susah', 'nangis diam'] },
    { mood: 'mikir',      keywords: ['mikir', 'hmm', 'coba', 'kayaknya', 'mungkin', 'entah', 'yakin nggak', 'sebentar', 'tunggu', 'let me think', 'anu', 'kurasa'] },
    { mood: 'smug',       keywords: ['smug', 'makanya', 'kan udah bilang', 'told you', 'heh', 'tuh kan', 'bukan salah aku', 'terbukti', 'menang', 'betul kan', 'kan bener'] },
    { mood: 'jahil',      keywords: ['jahil', 'hehe', 'iseng', 'becanda', 'bercanda', 'wkwk', 'lol', 'nggak serius', 'just kidding', 'jk', 'main-main', 'mancing'] },
    { mood: 'capek',      keywords: ['capek', 'lelah', 'exhausted', 'ngantuk', 'tidur', 'istirahat', 'udah deh', 'menyerah', 'pasrah', 'done', 'burnout'] },
    { mood: 'protective', keywords: ['protective', 'jaga diri', 'hati-hati', 'careful', 'aman', 'lindungi', 'waspada', 'bahaya', 'safety', 'selamat', 'perlindungan'] },
    { mood: 'semangat',   keywords: ['semangat', 'ganbatte', 'bisa', 'pasti bisa', 'fighting', 'ayo', 'lets go', 'lanjut', 'terus', 'jangan nyerah', 'kamu pasti bisa'] },
    { mood: 'setuju',     keywords: ['setuju', 'iya', 'bener', 'betul', 'yep', 'nod', 'makes sense', 'masuk akal', 'oke', 'ok', 'siap', 'roger', 'uhm', 'un'] },
    { mood: 'absurd',     keywords: ['absurd', 'wkwkwk', 'hahaha', 'ngakak', 'mati', 'ded', 'gokil', 'receh', 'nggak nyambung', 'random', 'astaghfirullah'] },
    { mood: 'jutek',      keywords: ['jutek', 'ya terus', 'so what', 'gue pikirin', 'terus kenapa', 'emangnya', 'nggak penting', 'biarin', 'ya bodo'] },
    { mood: 'tenang',     keywords: ['tenang', 'fine', 'santai', 'relax', 'cool', 'biasa aja', 'nggak masalah', 'nggak apa-apa', 'calm', 'damai'] },
    { mood: 'facepalm',   keywords: ['facepalm', 'kenapa sih', 'dunia apa', 'ya ampun', 'duh', 'oh no', 'payah', 'aduh', 'astaga', 'tobat'] },
];

// Mood → stiker index mapping (stiker paling cocok untuk tiap mood)
const MOOD_TO_STIKER = {
    malu:       { list: 'honolulu', idx: 0  },  // malu nutup muka
    flustered:  { list: 'honolulu', idx: 9  },  // malu berat / flustered / deg-degan
    kaget:      { list: 'honolulu', idx: 6  },  // kaget positif
    senang:     { list: 'honolulu', idx: 3  },  // ceria ringan
    senyum:     { list: 'honolulu', idx: 1  },  // senyum kecil / lembut
    manja:      { list: 'honolulu', idx: 9  },  // manja / minta perhatian
    hype:       { list: 'honolulu', idx: 32 },  // semangat / genki mode
    ngambek:    { list: 'honolulu', idx: 11 },  // ngambek / mou~ / cemberut imut
    galak:      { list: 'honolulu', idx: 33 },  // galak full mode
    kesel:      { list: 'honolulu', idx: 11 },  // kesel lucu
    ngamuk:     { list: 'honolulu', idx: 10 },  // ngamuk lucu
    bingung:    { list: 'honolulu', idx: 18 },  // bingung total / IDK
    sedih:      { list: 'honolulu', idx: 34 },  // menahan nangis
    mikir:      { list: 'honolulu', idx: 5  },  // mikir / skeptis
    smug:       { list: 'honolulu', idx: 4  },  // smug / puas
    jahil:      { list: 'honolulu', idx: 8  },  // jahil / ngejek
    capek:      { list: 'honolulu', idx: 15 },  // capek total / drop
    protective: { list: 'honolulu', idx: 36 },  // protective mode
    semangat:   { list: 'honolulu', idx: 32 },  // semangat / genki mode
    setuju:     { list: 'honolulu', idx: 41 },  // ngangguk setuju pelan
    absurd:     { list: 'honolulu', idx: 13 },  // zamn / chaotic
    jutek:      { list: 'honolulu', idx: 12 },  // datar / males respon
    tenang:     { list: 'honolulu', idx: 35 },  // stoic / tenang total
    facepalm:   { list: 'honolulu', idx: 40 },  // facepalm / hopeless
};

/**
 * Pilih URL stiker terbaik berdasarkan analisis teks percakapan.
 * Dipakai sebagai fallback ketika AI tidak kirim URL valid.
 *
 * @param {string} text - Teks percakapan (gabungan user message + AI response)
 * @param {'honolulu'|'fiora'} character - Karakter yang dipakai
 * @returns {string} URL stiker yang paling cocok
 */
export function selectStickerByMood(text = '', character = 'honolulu') {
    const lower = text.toLowerCase();
    const list = character === 'fiora' ? FIORA_STICKERS : HONOLULU_STICKERS;

    // Hitung skor tiap mood berdasarkan keyword match
    let bestMood = null;
    let bestScore = 0;

    for (const { mood, keywords } of MOOD_KEYWORD_MAP) {
        let score = 0;
        for (const kw of keywords) {
            if (lower.includes(kw)) score++;
        }
        if (score > bestScore) {
            bestScore = score;
            bestMood = mood;
        }
    }

    // Kalau ada mood yang terdeteksi, cari stiker via MOOD_TO_STIKER map
    if (bestMood && MOOD_TO_STIKER[bestMood]) {
        const ref = MOOD_TO_STIKER[bestMood];
        const targetList = ref.list === 'fiora' ? FIORA_STICKERS : HONOLULU_STICKERS;
        const stiker = targetList[ref.idx];
        if (stiker) return stiker.url;
    }

    // Fallback: tag-based search di daftar stiker
    if (bestMood) {
        const found = list.find(s => s.tags.includes(bestMood));
        if (found) return found.url;
    }

    // Ultimate fallback: datar / blank stare (netral)
    const blank = list.find(s => s.tags.includes('datar') || s.tags.includes('blank'));
    return blank?.url || list[2]?.url || list[0]?.url;
}

/**
 * Validasi apakah URL adalah stiker resmi dari CDN kita.
 * @param {string} url
 * @returns {boolean}
 */
export function isValidStickerUrl(url) {
    return ALL_STICKER_URLS.has(url);
}

/**
 * Generate teks daftar stiker untuk dimasukkan ke dalam system prompt AI.
 * Dipanggil oleh aiPrompt.js → buildWilyAICommandPrompt()
 * @param {'honolulu'|'fiora'|'both'} character
 * @returns {string}
 */
export function buildStickerPromptList(character = 'both') {
    const lines = [];

    if (character === 'honolulu' || character === 'both') {
        lines.push('[HONOLULU — Pilihan utama saat jadi Honolulu]');
        for (const s of HONOLULU_STICKERS) {
            const animTag = s.animated ? '[ANIMATED] ' : '';
            lines.push(`• ${animTag}${s.label} (${s.desc}):`);
            lines.push(`  ${s.url}`);
        }
    }

    if (character === 'fiora' || character === 'both') {
        lines.push('');
        lines.push('[FIORA — Gunakan jika konteks/request sesuai karakter Fiora]');
        for (const s of FIORA_STICKERS) {
            lines.push(`• ${s.label} (${s.desc}):`);
            lines.push(`  ${s.url}`);
        }
    }

    return lines.join('\n');
}
