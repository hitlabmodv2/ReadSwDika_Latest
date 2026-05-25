'use strict';

const axios  = require('axios');
const path   = require('path');
const { Gemini } = require(path.resolve('./src/scrape/gemini.cjs'));

const _gemmyInstance = new Gemini();

// ─── Genre pools (sama dengan chatmusic.cjs) ──────────────────────────────
const _GENRES = [
        'pop', 'indie pop', 'dream pop', 'synth pop', 'electro pop', 'chamber pop',
        'art pop', 'power pop', 'baroque pop', 'sophisti pop', 'jangle pop',
        'ballad', 'slow ballad', 'piano ballad', 'orchestral ballad', 'r&b ballad',
        'rnb', 'neo soul', 'soul', 'funk soul', 'quiet storm', 'contemporary rnb',
        'jazz', 'smooth jazz', 'jazz fusion', 'bossa nova', 'swing jazz', 'nu jazz',
        'acoustic', 'folk', 'indie folk', 'folk pop', 'fingerstyle', 'americana',
        'singer songwriter', 'celtic folk', 'bluegrass',
        'electronic', 'ambient electronic', 'chillwave', 'synthwave', 'retrowave',
        'future bass', 'deep house', 'lo-fi electronic', 'downtempo', 'trip hop',
        'dance pop', 'edm', 'house', 'dance', 'disco', 'funk', 'dancehall',
        'lofi hiphop', 'lofi beats', 'lofi jazz', 'chill hop', 'bedroom pop',
        'rock', 'soft rock', 'indie rock', 'alternative rock', 'post rock',
        'shoegaze', 'math rock', 'blues rock', 'psychedelic rock',
        'ambient', 'classical', 'neoclassical', 'cinematic', 'orchestral',
        'film score', 'new age',
        'reggae', 'hip hop', 'country', 'blues', 'latin pop', 'afrobeats',
        'flamenco', 'k-pop style', 'city pop',
];

const _GENRES_JP = [
        'city pop', 'j-pop', 'j-folk', 'j-rock', 'anime ost', 'japanese indie',
        'shibuya-kei', 'j-ballad', 'j-soul', 'visual kei', 'kawaii pop',
        'j-ambient', 'japanese lo-fi', 'j-jazz', 'harajuku pop', 'ost rpg',
        'japanese city pop acoustic', 'vocaloid inspired', 'j-indie pop', 'j-alternative',
];

const _GENRES_EN = [
        'indie pop', 'dream pop', 'alt pop', 'synth pop', 'chamber pop',
        'indie folk', 'folk pop', 'singer songwriter', 'americana',
        'rnb', 'neo soul', 'soul', 'alternative rnb',
        'indie rock', 'alternative rock', 'soft rock', 'shoegaze',
        'lofi hiphop', 'chillwave', 'bedroom pop', 'dreamy pop',
        'ballad', 'piano ballad', 'orchestral pop', 'cinematic pop',
        'jazz pop', 'smooth jazz', 'acoustic pop',
];

const _MOODS = [
        'melancholy', 'sad', 'sorrowful', 'heartbroken', 'bittersweet',
        'wistful', 'mournful', 'aching', 'desolate', 'pensive',
        'nostalgic', 'reflective', 'reminiscent', 'sentimental', 'longing',
        'yearning', 'homesick',
        'romantic', 'tender', 'intimate', 'passionate', 'loving', 'sweet',
        'infatuated', 'gentle',
        'upbeat', 'energetic', 'joyful', 'cheerful', 'playful', 'euphoric',
        'excited', 'vibrant', 'lively', 'celebratory',
        'chill', 'peaceful', 'serene', 'tranquil', 'meditative', 'relaxed',
        'mellow', 'soothing', 'calm',
        'dreamy', 'ethereal', 'mysterious', 'otherworldly', 'hypnotic',
        'surreal', 'mystical', 'enchanting', 'hazy',
        'dark', 'tense', 'brooding', 'haunting', 'eerie', 'melancholic',
        'raw', 'intense', 'dramatic', 'epic',
        'hopeful', 'emotional', 'moving', 'uplifting', 'inspiring',
        'empowering', 'cathartic',
];

const _VIBES = [
        'midnight vibes', 'late night', '3am feels', 'golden hour', 'sunset vibes',
        'sunrise', 'morning vibes', 'dusk', 'twilight', 'noon sun',
        'rainy day', 'stormy night', 'winter cold', 'first snow', 'summer breeze',
        'foggy morning', 'thunder and rain', 'spring rain', 'sunny afternoon',
        'coffee shop', 'cozy room', 'empty streets', 'rooftop', 'city lights',
        'night club', 'beach sunset', 'ocean waves', 'forest walk', 'mountain top',
        'old bookstore', 'quiet library', 'basement studio', 'train window',
        'highway drive', 'back alley', 'small town', 'skyscraper view',
        'candlelit room', 'empty dance floor', 'late night diner',
        'starry night', 'moonlight', 'galaxy', 'cosmos', 'floating in space',
        'nostalgia trip', 'daydream', 'lost in thought', 'warm memories',
        'cold december', 'summer nostalgia', 'autumn leaves', 'cherry blossom',
];

const _INSTRUMENTS = [
        'piano', 'grand piano', 'upright piano', 'electric piano', 'toy piano',
        'acoustic guitar', 'electric guitar', 'fingerstyle guitar', 'nylon guitar',
        'bass guitar', 'violin', 'cello', 'viola', 'double bass', 'harp',
        'banjo', 'mandolin', 'ukulele', 'sitar', 'koto',
        'flute', 'alto flute', 'clarinet', 'oboe', 'saxophone', 'alto sax',
        'tenor sax', 'trumpet', 'flugelhorn', 'trombone', 'french horn',
        'synthesizer', 'analog synth', 'mellotron', 'theremin', 'moog synth',
        'pad synth', 'arp synth', 'vocoder',
        'drum machine', 'soft beats', 'lo-fi drums', 'live drums', 'tabla',
        'bongos', 'marimba', 'vibraphone', 'glockenspiel',
        'orchestral strings', 'string quartet', 'chamber ensemble',
        'choir', 'vocal harmonies',
];

const _TITLE_ADJ = [
        'Biru', 'Merah', 'Emas', 'Perak', 'Hitam', 'Putih', 'Abu', 'Ungu',
        'Hijau', 'Jingga', 'Merah Muda', 'Krem', 'Coklat', 'Tembaga',
        'Malam', 'Pagi', 'Senja', 'Fajar', 'Tengah Malam', 'Subuh', 'Petang',
        'Indah', 'Abadi', 'Terang', 'Hangat', 'Lembut', 'Bahagia', 'Nyata',
        'Agung', 'Murni', 'Tulus', 'Setia', 'Damai', 'Manis', 'Mulia',
        'Sunyi', 'Gelap', 'Sepi', 'Dingin', 'Hilang', 'Pergi', 'Jauh',
        'Kelam', 'Redup', 'Senyap', 'Beku', 'Kosong', 'Rapuh', 'Lelah',
        'Pulang', 'Hilang', 'Melayang', 'Terbang', 'Jatuh', 'Berlari',
        'Tenggelam', 'Menghilang', 'Bersinar', 'Berputar',
        'Keras', 'Palsu', 'Teduh', 'Dekat', 'Rindu', 'Sungguh', 'Dalam',
        'Asing', 'Ganjil', 'Ajaib', 'Terakhir', 'Pertama', 'Baru', 'Lama',
];

const _TITLE_NOUN = [
        'Langit', 'Bintang', 'Lautan', 'Angin', 'Hujan', 'Cahaya', 'Awan',
        'Bulan', 'Matahari', 'Gunung', 'Hutan', 'Sungai', 'Laut', 'Danau',
        'Badai', 'Petir', 'Salju', 'Pasir', 'Tanah', 'Api',
        'Kenangan', 'Mimpi', 'Jiwa', 'Bayangan', 'Hati', 'Cinta', 'Duka',
        'Tawa', 'Rindu', 'Harap', 'Rasa', 'Resah', 'Gundah', 'Amarah',
        'Bahagia', 'Sedih', 'Takut', 'Damai', 'Tenang', 'Hampa',
        'Nada', 'Irama', 'Melodi', 'Lagu', 'Suara', 'Dansa', 'Harmoni',
        'Simfoni', 'Kord', 'Notasi', 'Lirik', 'Tempo',
        'Ruang', 'Jalan', 'Pintu', 'Jendela', 'Sayap', 'Cerita', 'Hari',
        'Waktu', 'Momen', 'Saat', 'Jejak', 'Langkah', 'Perjalanan',
        'Rumah', 'Kota', 'Desa', 'Pantai', 'Puncak', 'Lembah',
        'Jiwa', 'Raga', 'Nama', 'Wajah', 'Mata', 'Tangan', 'Nafas',
        'Detak', 'Nadi', 'Senyum', 'Air Mata', 'Pelukan',
];

const MODELS2 = [
        { id: 6, version: 'v5.0' },
        { id: 5, version: 'v4.5-plus' },
        { id: 4, version: 'v4.5' },
        { id: 3, version: 'v4.0' },
        { id: 1, version: 'v3.5' },
];

// ─── Sanitizer kata sensitif ──────────────────────────────────────────────
const _SENSITIVE_MAP = [
        [/\bsabu\b/gi, 'rindu'], [/\bshabu\b/gi, 'rindu'],
        [/\bnarkoba\b/gi, 'cinta'], [/\bganja\b/gi, 'cahaya'],
        [/\bheroin\b/gi, 'mimpi'], [/\bkokain\b/gi, 'harapan'],
        [/\bmorfin\b/gi, 'perasaan'], [/\bekstasi\b/gi, 'bahagia'],
        [/\bputaw\b/gi, 'embun'], [/\btramadol\b/gi, 'waktu'],
        [/\bmetamfetamin\b/gi, 'semangat'], [/\bnarkotika\b/gi, 'kenangan'],
        [/\bopium\b/gi, 'angan'],
        [/\bmulyono\b/gi, 'seseorang'], [/\bjokowi\b/gi, 'pemimpin'],
        [/\bprabowo\b/gi, 'pahlawan'], [/\banies\b/gi, 'penggagas'],
        [/\bbunuh\b/gi, 'pergi'], [/\bmembunuh\b/gi, 'meninggalkan'],
        [/\bpembunuhan\b/gi, 'kepergian'], [/\bmembantai\b/gi, 'melepaskan'],
        [/\bperkosa\b/gi, 'memaksa rasa'],
        [/\bkontol\b/gi, 'kamu'], [/\bbajingan\b/gi, 'orang'],
        [/\bbangsat\b/gi, 'kawan'], [/\blasingkan\b/gi, 'jauhkan'],
];

function sanitizeLyrics(text) {
        if (!text) return text;
        let out = text;
        for (const [re, rep] of _SENSITIVE_MAP) out = out.replace(re, rep);
        return out;
}

// ─── ChatMusicAPI v2 ──────────────────────────────────────────────────────
class ChatMusicAPI2 {
        constructor() {
                this.baseUrl   = 'https://api.chatmusicpro.com';
                this.identityId = this._uuid();
                this.token     = null;
        }

        _uuid() {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                        const r = Math.random() * 16 | 0;
                        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16).toUpperCase();
                });
        }

        async _req(endpoint, data = {}) {
                const headers = {
                        'User-Agent': 'android',
                        'Accept-Encoding': 'gzip',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'region-code': 'ID',
                        'user-type': 'android',
                        'version': '1.0.3',
                        'app-type': '1',
                        'language': 'EN',
                        'identity-id': this.identityId,
                        'app-market': 'google_play',
                };
                if (this.token) headers['token'] = this.token;
                const res = await axios.post(
                        this.baseUrl + endpoint,
                        new URLSearchParams(data).toString(),
                        { headers, timeout: 20000 }
                );
                return res.data;
        }

        async login() {
                const r = await this._req('/v1/user/device_login', {
                        source_site: 'google_play',
                        identity_id: this.identityId,
                });
                if (r.code === 200) { this.token = r.data.token; return true; }
                throw new Error('Login gagal: ' + r.message);
        }

        async generate(params) {
                const cleanTitle  = sanitizeLyrics(params.title  || 'My Song');
                const cleanLyrics = sanitizeLyrics(params.lyrics || '');
                const cleanPrompt = sanitizeLyrics(params.prompt || '');

                const body = {
                        music_model_id: params.modelId || 6,
                        title:          cleanTitle.slice(0, 80),
                        prompt:         cleanPrompt.slice(0, 200),
                        lyrics:         cleanLyrics.slice(0, 1000),
                        is_instrumental: params.isInstrumental ? 1 : 0,
                        music_style:    params.musicStyle || 'pop',
                        music_style_code: '',
                        gender_type:    params.genderType ?? 0,
                };

                const r = await this._req('/music/create-music', body);
                if (r.code === 200) return r.data.create_id;

                if (/sensitive words|prohibited/i.test(r.message || '')) {
                        const stripped = cleanLyrics
                                .replace(/[^\w\s,.\-!?]/gi, ' ')
                                .replace(/\s{2,}/g, ' ').trim();
                        const r2 = await this._req('/music/create-music', {
                                ...body,
                                lyrics: stripped.slice(0, 1000),
                                title:  cleanTitle.replace(/[^\w\s]/gi, ' ').trim().slice(0, 80),
                        });
                        if (r2.code === 200) return r2.data.create_id;
                        throw new Error('Generate gagal: ' + r2.message);
                }

                throw new Error('Generate gagal: ' + r.message);
        }

        async getProgress(id) {
                const r = await this._req('/music/get-music-progress', { id });
                if (r.code === 200) return r.data;
                throw new Error(`Progress check gagal ID ${id}: ` + r.message);
        }

        async waitAll(ids, onProgress, timeoutMs = 150000) {
                const done  = new Map();
                const start = Date.now();

                while (done.size < ids.length) {
                        if (Date.now() - start > timeoutMs)
                                throw new Error('Timeout: musik tidak selesai dalam 2.5 menit');
                        await new Promise(r => setTimeout(r, 4000));

                        for (const id of ids) {
                                if (done.has(id)) continue;
                                try {
                                        const d = await this.getProgress(id);
                                        if (d.music_file) {
                                                done.set(id, d);
                                                if (onProgress) onProgress(done.size, ids.length);
                                        }
                                } catch (_) {}
                        }
                }
                return ids.map(id => done.get(id));
        }

        async downloadBuffer(url) {
                const res = await axios.get(url, {
                        responseType: 'arraybuffer',
                        timeout: 45000,
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                });
                return Buffer.from(res.data);
        }

        _pick(arr)     { return arr[Math.floor(Math.random() * arr.length)]; }
        _pickN(arr, n) { return [...arr].sort(() => Math.random() - 0.5).slice(0, n); }

        /**
         * AI generate preset berdasarkan TEMA bebas
         */
        async aiThemePreset(tema, forceMode = null) {
                const r = () => Math.random();
                const isInstrumental = forceMode === 'instrumental' ? 1
                        : forceMode === 'vocal' ? 0
                        : (r() < 0.25 ? 1 : 0);

                const aiPrompt = isInstrumental
                        ? `Kamu adalah music director dan penulis lagu profesional Indonesia.
User ingin lagu bertema: "${tema}"

Tentukan:
1. Genre paling cocok (1-2 genre, bahasa Inggris)
2. Mood/nuansa (1-2 kata, bahasa Inggris)
3. Vibe/suasana (1 frasa pendek, bahasa Inggris)
4. Instrumen utama (1-2 instrumen, bahasa Inggris)
5. Judul instrumental puitis (1-4 kata, bahasa Indonesia)

Format PERSIS:
JUDUL: [judul]
GENRE: [genre]
GENRE_LABEL: [genre max 30 karakter]
MOOD: [mood]
VIBE: [vibe]
INSTRUMEN: [instrumen]`
                        : `Kamu adalah music director dan penulis lagu profesional Indonesia.
User ingin lagu bertema: "${tema}"

Tentukan dan buat:
1. Genre paling cocok (1-2 genre, bahasa Inggris)
2. Mood/nuansa (1-2 kata, bahasa Inggris)
3. Vibe/suasana (1 frasa pendek, bahasa Inggris)
4. Instrumen utama (1-2 instrumen, bahasa Inggris)
5. Judul lagu puitis sesuai tema (1-4 kata, bahasa Indonesia)
6. Lirik lengkap: [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Pre-Chorus], [Chorus], [Bridge], [Outro]
   - Minimal 55 baris total
   - Bahasa Indonesia puitis & natural, sesuai tema "${tema}"
   - JANGAN kata kasar, SARA, narkoba

Format PERSIS:
JUDUL: [judul]
GENRE: [genre]
GENRE_LABEL: [genre max 30 karakter]
MOOD: [mood]
VIBE: [vibe]
INSTRUMEN: [instrumen]
LIRIK:
[seluruh lirik]`;

                const aiResult = await _gemmyInstance.ask(aiPrompt);

                const judulMatch = aiResult.match(/JUDUL:\s*(.+)/);
                const genreMatch = aiResult.match(/^GENRE:\s*(.+)/m);
                const labelMatch = aiResult.match(/GENRE_LABEL:\s*(.+)/);
                const moodMatch  = aiResult.match(/MOOD:\s*(.+)/);
                const vibeMatch  = aiResult.match(/VIBE:\s*(.+)/);
                const instrMatch = aiResult.match(/INSTRUMEN:\s*(.+)/);
                const lirikMatch = aiResult.match(/LIRIK:\n([\s\S]+)/);

                const genre      = genreMatch?.[1]?.trim() || this._pick(_GENRES);
                const mood       = moodMatch?.[1]?.trim()  || this._pick(_MOODS);
                const vibe       = vibeMatch?.[1]?.trim()  || this._pick(_VIBES);
                const instr      = instrMatch?.[1]?.trim() || this._pick(_INSTRUMENTS);
                const title      = sanitizeLyrics(judulMatch?.[1]?.trim() || tema);
                const genreLabel = labelMatch?.[1]?.trim() || genre;
                const lyrics     = isInstrumental ? '' : sanitizeLyrics(lirikMatch?.[1]?.trim() || '');

                return {
                        title, prompt: `${genre} indonesia, ${mood}, ${vibe}, ${instr}`,
                        musicStyle: genre, genreLabel, lyrics, isInstrumental,
                        _aiGenerated: true, _tema: tema,
                };
        }

        /**
         * AI random preset dengan pilihan bahasa: id / jp / en
         */
        async aiRandomPreset(forceMode = null, lang = 'id') {
                const r = () => Math.random();
                const genrePool = lang === 'jp' ? _GENRES_JP
                        : lang === 'en' ? _GENRES_EN
                        : _GENRES;

                const genre = r() < 0.25
                        ? `${this._pick(genrePool)} ${this._pick(genrePool)}`
                        : this._pick(genrePool);
                const mood  = r() < 0.3
                        ? this._pickN(_MOODS, 2).join(' and ')
                        : this._pick(_MOODS);
                const vibe  = r() < 0.2
                        ? this._pickN(_VIBES, 2).join(', ')
                        : this._pick(_VIBES);
                const instr = r() < 0.4
                        ? this._pickN(_INSTRUMENTS, 2).join(' and ')
                        : this._pick(_INSTRUMENTS);

                const isInstrumental = forceMode === 'instrumental' ? 1
                        : forceMode === 'vocal' ? 0
                        : (r() < 0.35 ? 1 : 0);

                const langSuffix = lang === 'jp' ? 'japanese style'
                        : lang === 'en' ? 'english style'
                        : 'indonesia';
                const prompt = `${genre} ${langSuffix}, ${mood}, ${vibe}, ${instr}`;

                let aiPrompt;
                if (lang === 'jp') {
                        aiPrompt = isInstrumental
                                ? `あなたはプロの日本人作曲家です。\nGenre: ${genre}\nMood: ${mood}\nVibe: ${vibe}\nInstrument: ${instr}\nMode: Instrumental\n\nInstrumental曲のタイトルを考えてください（1〜4語）。\n\nFormat PERSIS:\nJUDUL: [judul]\nGENRE_LABEL: [genre max 25 karakter]`
                                : `あなたはプロの日本人作曲家・作詞家です。\nGenre: ${genre}\nMood: ${mood}\nVibe: ${vibe}\nInstrument: ${instr}\n\n以下を作ってください:\n1. 曲のタイトル（1〜4語）\n2. 日本語の歌詞（最低30行）\n   構成: [Verse 1], [Chorus], [Verse 2], [Chorus], [Bridge], [Outro]\n\nFormat PERSIS:\nJUDUL: [judul]\nGENRE_LABEL: [genre max 25 karakter]\nLIRIK:\n[seluruh lirik]`;
                } else if (lang === 'en') {
                        aiPrompt = isInstrumental
                                ? `You are a professional songwriter.\nGenre: ${genre}\nMood: ${mood}\nVibe: ${vibe}\nInstrument: ${instr}\nMode: Instrumental\n\nCreate an evocative instrumental title (1-4 words, English).\n\nFormat EXACTLY:\nJUDUL: [title]\nGENRE_LABEL: [genre max 25 chars]`
                                : `You are a professional English songwriter.\nGenre: ${genre}\nMood: ${mood}\nVibe: ${vibe}\nInstrument: ${instr}\n\nCreate:\n1. Song TITLE (1-4 words, English, poetic)\n2. Full LYRICS in English (min 30 lines)\n   Structure: [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Pre-Chorus], [Chorus], [Bridge], [Outro]\n   - Natural English, poetic, no explicit content\n\nFormat EXACTLY:\nJUDUL: [title]\nGENRE_LABEL: [genre max 25 chars]\nLIRIK:\n[full lyrics]`;
                } else {
                        aiPrompt = isInstrumental
                                ? `Kamu adalah penulis lagu profesional Indonesia.\nGenre: ${genre}\nMood: ${mood}\nSuasana: ${vibe}\nInstrumen: ${instr}\nMode: Instrumental\n\nBuatkan judul instrumental puitis (1-4 kata, bahasa Indonesia).\n\nFormat PERSIS:\nJUDUL: [judul]\nGENRE_LABEL: [genre max 30 karakter]`
                                : `Kamu adalah penulis lagu profesional Indonesia.\nGenre: ${genre}\nMood: ${mood}\nSuasana/vibe: ${vibe}\nInstrumen: ${instr}\n\nBuatkan:\n1. JUDUL lagu (1-4 kata, bahasa Indonesia, puitis)\n2. LIRIK lengkap:\n   Struktur: [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Pre-Chorus], [Chorus], [Bridge], [Outro]\n   - Minimal 55 baris total\n   - Bahasa Indonesia puitis & natural\n   - JANGAN kata kasar, SARA, narkoba\n\nFormat PERSIS:\nJUDUL: [judul]\nGENRE_LABEL: [genre max 30 karakter]\nLIRIK:\n[seluruh lirik]`;
                }

                const aiResult  = await _gemmyInstance.ask(aiPrompt);
                const judulMatch = aiResult.match(/JUDUL:\s*(.+)/);
                const genreMatch = aiResult.match(/GENRE_LABEL:\s*(.+)/);
                const lirikMatch = aiResult.match(/LIRIK:\n([\s\S]+)/);

                const title      = sanitizeLyrics(judulMatch?.[1]?.trim() || this._pick(_TITLE_NOUN) + ' ' + this._pick(_TITLE_ADJ));
                const genreLabel = genreMatch?.[1]?.trim() || genre;
                const lyrics     = isInstrumental ? '' : sanitizeLyrics(lirikMatch?.[1]?.trim() || '');

                return { title, prompt, musicStyle: genre, genreLabel, lyrics, isInstrumental, _aiGenerated: true, _lang: lang };
        }
}

function formatDuration2(sec) {
        if (!sec || sec <= 0) return '–';
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function buildCaption2(track, index, total, params) {
        const durStr    = formatDuration2(track.duration);
        const modelName = MODELS2.find(md => md.id === (params.modelId || 6))?.version || 'v5.0';
        const lines = [
                `╭──『 🎵 *MUSIK AI 2* — Variasi ${index} dari ${total} 』`,
                `│`,
                `│ 🎼 *Judul*   : ${track.title || params.title || '–'}`,
                params.musicStyle ? `│ 🎸 *Genre*   : ${params.musicStyle}` : null,
                params.isInstrumental ? `│ 🎹 *Mode*    : Instrumental` : `│ 🎤 *Mode*    : Dengan Vokal`,
                params.lyrics && !params.isInstrumental ? `│ 📝 *Lirik*   : Ada` : null,
                `│ 🤖 *Model*   : ${modelName}`,
                durStr !== '–' ? `│ ⏱️ *Durasi*  : ${durStr}` : null,
                `│`,
                `│ 🔊 Audio VN dikirim di bawah ↓`,
                `╰──────────────────────────────`,
        ].filter(Boolean);
        return lines.join('\n');
}

module.exports = { ChatMusicAPI2, MODELS2, formatDuration2, buildCaption2, _GENRES, _GENRES_JP, _GENRES_EN };
