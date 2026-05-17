'use strict';

const axios = require('axios');

const BASE = 'https://api.dotgg.gg/bluearchive';
const HEADERS = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };

function cleanText(str = '') {
  return String(str || '').replace(/\s+/g, ' ').trim();
}

function findUrl(input, urls) {
  const clean = input.toLowerCase().replace(/\s+/g, '_');
  if (urls.includes(clean)) return clean;

  const words = clean.split('_').filter(Boolean);
  const matches = urls.filter(url =>
    words.every(word => url.toLowerCase().includes(word))
  );
  return matches.length > 0 ? matches[0] : null;
}

async function baList() {
  try {
    const { data } = await axios.get(`${BASE}/characters`, { headers: HEADERS, timeout: 10000 });
    if (!Array.isArray(data)) throw new Error('Format data tidak valid.');
    return data;
  } catch (err) {
    throw new Error(`Gagal ambil daftar karakter: ${err.message}`);
  }
}

async function baChar(charName) {
  if (!charName || !charName.trim()) throw new Error('Nama karakter tidak boleh kosong.');

  const list = await baList();
  const urls = list.map(c => c.url).filter(Boolean);
  const foundUrl = findUrl(charName.trim(), urls);

  if (!foundUrl) {
    const available = urls.slice(0, 10).join(', ');
    throw new Error(`Karakter "${charName}" tidak ditemukan. Contoh: ${available}...`);
  }

  try {
    const { data } = await axios.get(`${BASE}/characters/${foundUrl}`, { headers: HEADERS, timeout: 10000 });
    return data;
  } catch (err) {
    throw new Error(`Gagal ambil data karakter: ${err.message}`);
  }
}

function formatBaChar(data) {
  if (!data) return 'Data karakter kosong.';

  const prof = data.profile || {};
  const name = cleanText(data.name || data.fullName || '-');
  const school = cleanText(prof.school || data.school || '-');
  const role = cleanText(data.role || data.combatRole || '-');
  const type = cleanText(data.type || data.attackType || '-');
  const position = cleanText(data.position || '-');
  const rarity = data.rarity ? '⭐'.repeat(Number(data.rarity)) : null;

  let body = `🎮 *BLUE ARCHIVE CHARACTER INFO*\n\n`;
  body += `👤 *${name}*`;
  if (rarity) body += ` ${rarity}`;
  body += `\n`;
  if (school && school !== '-') body += `🏫 *Sekolah:* ${school}\n`;
  if (role && role !== '-') body += `⚔️ *Role:* ${role}\n`;
  if (type && type !== '-') body += `🔰 *Tipe:* ${type}\n`;
  if (position && position !== '-') body += `📍 *Posisi:* ${position}\n`;

  const age = cleanText(prof.age || '');
  const height = cleanText(prof.height || '');
  const hobby = cleanText(prof.hobby || '');
  const club = cleanText(prof.club || '');
  const cv = cleanText(prof.CV || '');
  const weaponType = cleanText(prof.weaponType || '');

  if (age || height || hobby || club || cv || weaponType) {
    body += `\n📋 *Profil*\n`;
    if (age) body += `▸ *Usia:* ${age}\n`;
    if (height) body += `▸ *Tinggi:* ${height}\n`;
    if (hobby) body += `▸ *Hobi:* ${hobby}\n`;
    if (club) body += `▸ *Klub:* ${club}\n`;
    if (weaponType) body += `▸ *Tipe Senjata:* ${weaponType}\n`;
    if (cv) body += `▸ *CV:* ${cv}\n`;
  }

  if (data.weapon) {
    const wp = data.weapon;
    body += `\n🔫 *Senjata*\n`;
    body += `▸ *Nama:* ${cleanText(wp.name || '-')}\n`;
    if (wp.type) body += `▸ *Tipe:* ${wp.type}\n`;
    if (wp.attack) body += `▸ *ATK:* ${wp.attack}\n`;
    if (wp.hp) body += `▸ *HP:* ${wp.hp}\n`;
    if (wp.desc) body += `▸ *Deskripsi:* ${cleanText(wp.desc).slice(0, 100)}\n`;
  }

  if (data.skills && Array.isArray(data.skills)) {
    body += `\n🔥 *Skills*\n`;
    for (const skill of data.skills.slice(0, 5)) {
      const sName = cleanText(skill.name || '-');
      const sDesc = cleanText(skill.description || skill.desc || '');
      body += `▸ *${sName}*`;
      if (sDesc) body += `: ${sDesc.slice(0, 100)}`;
      body += `\n`;
    }
  }

  if (data.skillprio) {
    const sp = data.skillprio;
    body += `\n🎯 *Skill Priority*\n`;
    if (sp['General Skill Priority']) body += `▸ *Umum:* ${sp['General Skill Priority'].trim()}\n`;
    if (sp['Early to Mid Game investments']) body += `▸ *Early-Mid:* ${sp['Early to Mid Game investments']}\n`;
    if (sp['Recommended Investment pre UE40']) body += `▸ *Pre UE40:* ${sp['Recommended Investment pre UE40']}\n`;
    if (sp['Recommended Investment UE40']) body += `▸ *UE40:* ${sp['Recommended Investment UE40']}\n`;
    if (sp['Notes']) body += `▸ *Catatan:* ${cleanText(sp['Notes']).slice(0, 150)}\n`;
  }

  if (typeof data.bio === 'string' && data.bio.trim()) {
    body += `\n📖 *Bio:* ${cleanText(data.bio).slice(0, 250)}\n`;
  }

  body += `\n🔗 *Source:* ${BASE}/characters/${data.url || ''}`;
  return body.trimEnd();
}

module.exports = { baList, baChar, formatBaChar };
