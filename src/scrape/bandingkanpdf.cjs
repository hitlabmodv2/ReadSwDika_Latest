'use strict';

const PDFDocument = require('pdfkit');

const CATEGORY_EMOJI_TXT = {
  'Network': 'Network',
  'Launch': 'Launch',
  'Body': 'Body',
  'Display': 'Display',
  'Platform': 'Platform',
  'Memory': 'Memory',
  'Main Camera': 'Main Camera',
  'Selfie camera': 'Selfie Camera',
  'Sound': 'Sound',
  'Comms': 'Comms',
  'Features': 'Features',
  'Battery': 'Battery',
  'Misc': 'Misc',
  'Our Tests': 'Our Tests',
};

// Urutan kategori: yang PALING PENTING di atas
const CATEGORY_ORDER = [
  'Platform',       // Chipset, CPU, GPU, OS
  'Memory',         // RAM + Storage
  'Display',        // Layar
  'Main Camera',    // Kamera belakang
  'Selfie camera',  // Kamera depan
  'Battery',        // Baterai + charging
  'Body',           // Dimensi, berat, build
  'Network',        // Jaringan
  'Comms',          // WiFi, BT, NFC, USB
  'Sound',          // Speaker, jack
  'Features',       // Sensor
  'Launch',         // Tanggal rilis
  'Misc',           // Warna, model, harga, SAR
  'Our Tests',      // Benchmark
];

function clean(v) {
  if (v == null) return '-';
  return String(v).replace(/\s+/g, ' ').trim() || '-';
}

function applyVariant(specs, variant) {
  if (!variant || !specs) return specs;
  const m = variant.match(/(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:\/|,|\s)\s*(\d+(?:\.\d+)?)\s*(GB|TB)/i);
  if (!m) return specs;
  const out = JSON.parse(JSON.stringify(specs));
  if (out.Memory) {
    out.Memory.Internal = `${m[3]}${m[4].toUpperCase()} ${m[1]}${m[2].toUpperCase()} RAM`;
  }
  return out;
}

async function buildComparisonPDF(result) {
  const { a, b, imgA, imgB, variantA, variantB } = result;
  const labelA = variantA ? `${a.name} (${variantA})` : a.name;
  const labelB = variantB ? `${b.name} (${variantB})` : b.name;

  const specsA = applyVariant(a.specs, variantA);
  const specsB = applyVariant(b.specs, variantB);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    info: {
      Title: `Perbandingan ${a.name} vs ${b.name}`,
      Author: 'Wily Bot',
      Subject: 'Phone Comparison',
    },
  });

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((res) => doc.on('end', () => res(Buffer.concat(chunks))));

  const PAGE_W = doc.page.width;
  const PAGE_H = doc.page.height;
  const MARGIN = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  // ── HEADER ──────────────────────────────────────────────────────────────
  doc.rect(0, 0, PAGE_W, 70).fill('#1f2937');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20)
    .text('PERBANDINGAN HP', MARGIN, 22, { align: 'center', width: CONTENT_W });
  doc.fontSize(10).font('Helvetica').fillColor('#cbd5e1')
    .text('Sumber data: GSMArena (realtime)', MARGIN, 48, { align: 'center', width: CONTENT_W });

  doc.fillColor('#000000');
  let y = 90;

  // ── PHONE TITLES + IMAGES (side-by-side) ────────────────────────────────
  const colW = (CONTENT_W - 20) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colW + 20;

  // Title boxes
  doc.roundedRect(leftX, y, colW, 30, 4).fill('#3b82f6');
  doc.roundedRect(rightX, y, colW, 30, 4).fill('#ef4444');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
    .text(labelA, leftX + 8, y + 9, { width: colW - 16, ellipsis: true });
  doc.text(labelB, rightX + 8, y + 9, { width: colW - 16, ellipsis: true });
  doc.fillColor('#000000');
  y += 40;

  // Images
  const imgH = 200;
  if (imgA && imgA.length > 500) {
    try {
      doc.image(imgA, leftX, y, { fit: [colW, imgH], align: 'center', valign: 'center' });
    } catch (_) {}
  }
  if (imgB && imgB.length > 500) {
    try {
      doc.image(imgB, rightX, y, { fit: [colW, imgH], align: 'center', valign: 'center' });
    } catch (_) {}
  }
  y += imgH + 20;

  // ── PRICE BOX ───────────────────────────────────────────────────────────
  const priceA = a.priceInfo?.raw || '-';
  const priceB = b.priceInfo?.raw || '-';
  const idrA = a.priceInfo?.idr ? 'Rp ' + Math.round(a.priceInfo.idr).toLocaleString('id-ID') : null;
  const idrB = b.priceInfo?.idr ? 'Rp ' + Math.round(b.priceInfo.idr).toLocaleString('id-ID') : null;

  doc.roundedRect(MARGIN, y, CONTENT_W, 50, 4).fill('#fef3c7').stroke('#f59e0b');
  doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(11)
    .text('HARGA', MARGIN + 10, y + 8);
  doc.font('Helvetica').fontSize(9).fillColor('#000000');
  doc.text(`A: ${priceA}${idrA ? '  |  ' + idrA : ''}`, MARGIN + 10, y + 24, { width: CONTENT_W - 20 });
  doc.text(`B: ${priceB}${idrB ? '  |  ' + idrB : ''}`, MARGIN + 10, y + 36, { width: CONTENT_W - 20 });
  y += 60;

  // Konstanta layout tabel (dipakai oleh ringkasan & spec tables di bawah)
  const specColW = 130;
  const valColW = (CONTENT_W - specColW) / 2;
  const rowPad = 6;

  function ensureSpace(needed) {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  // ── RINGKASAN SPEK PENTING (highlight box) ──────────────────────────────
  const pick = (specs, cat, keys) => {
    const c = specs?.[cat];
    if (!c) return '-';
    for (const k of keys) {
      const v = c[k];
      if (v && String(v).trim() !== '-') return clean(v);
    }
    return '-';
  };
  const summary = [
    { label: 'Chipset',   a: pick(specsA, 'Platform', ['Chipset']),       b: pick(specsB, 'Platform', ['Chipset']) },
    { label: 'OS',        a: pick(specsA, 'Platform', ['OS']),            b: pick(specsB, 'Platform', ['OS']) },
    { label: 'RAM/Storage', a: pick(specsA, 'Memory', ['Internal']),      b: pick(specsB, 'Memory', ['Internal']) },
    { label: 'Layar',     a: pick(specsA, 'Display', ['Size','Type']),    b: pick(specsB, 'Display', ['Size','Type']) },
    { label: 'Resolusi',  a: pick(specsA, 'Display', ['Resolution']),     b: pick(specsB, 'Display', ['Resolution']) },
    { label: 'Kamera Utama', a: pick(specsA, 'Main Camera', ['Triple','Quad','Dual','Single']),
                              b: pick(specsB, 'Main Camera', ['Triple','Quad','Dual','Single']) },
    { label: 'Kamera Depan', a: pick(specsA, 'Selfie camera', ['Single','Dual']),
                              b: pick(specsB, 'Selfie camera', ['Single','Dual']) },
    { label: 'Baterai',   a: pick(specsA, 'Battery', ['Type']),           b: pick(specsB, 'Battery', ['Type']) },
    { label: 'Charging',  a: pick(specsA, 'Battery', ['Charging']),       b: pick(specsB, 'Battery', ['Charging']) },
  ];

  // Pastikan ruang utk seluruh ringkasan (header + sub + ~9 row)
  ensureSpace(24 + 20 + summary.length * 30);

  // Header bar (pakai warna mencolok biar gampang dilihat)
  doc.roundedRect(MARGIN, y, CONTENT_W, 24, 3).fill('#059669');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13)
    .text('RINGKASAN SPEK PENTING', MARGIN + 12, y + 6);
  doc.fillColor('#000000');
  y += 24;

  // Sub-header
  doc.rect(MARGIN, y, specColW, 20).fill('#d1fae5');
  doc.rect(MARGIN + specColW, y, valColW, 20).fill('#dbeafe');
  doc.rect(MARGIN + specColW + valColW, y, valColW, 20).fill('#fee2e2');
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9.5);
  doc.text('Spesifikasi', MARGIN + 6, y + 6, { width: specColW - 12 });
  doc.text('A', MARGIN + specColW + 6, y + 6, { width: valColW - 12 });
  doc.text('B', MARGIN + specColW + valColW + 6, y + 6, { width: valColW - 12 });
  y += 20;

  let zebraSum = false;
  for (const r of summary) {
    doc.font('Helvetica').fontSize(9.5);
    const hL = doc.heightOfString(r.label, { width: specColW - 12 });
    const hA = doc.heightOfString(r.a, { width: valColW - 12 });
    const hB = doc.heightOfString(r.b, { width: valColW - 12 });
    const rowH = Math.max(hL, hA, hB) + 14;
    ensureSpace(rowH);
    if (zebraSum) doc.rect(MARGIN, y, CONTENT_W, rowH).fill('#f0fdf4');
    doc.strokeColor('#a7f3d0').lineWidth(0.5)
      .moveTo(MARGIN, y + rowH).lineTo(MARGIN + CONTENT_W, y + rowH).stroke();
    doc.moveTo(MARGIN + specColW, y).lineTo(MARGIN + specColW, y + rowH).stroke();
    doc.moveTo(MARGIN + specColW + valColW, y).lineTo(MARGIN + specColW + valColW, y + rowH).stroke();
    doc.fillColor('#065f46').font('Helvetica-Bold').fontSize(9.5)
      .text(r.label, MARGIN + 6, y + 7, { width: specColW - 12 });
    doc.fillColor('#000000').font('Helvetica').fontSize(9.5)
      .text(r.a, MARGIN + specColW + 6, y + 7, { width: valColW - 12 });
    doc.text(r.b, MARGIN + specColW + valColW + 6, y + 7, { width: valColW - 12 });
    y += rowH;
    zebraSum = !zebraSum;
  }
  y += 14;

  // ── SPEC TABLES PER CATEGORY ────────────────────────────────────────────
  // Tabel spek lengkap: hanya kategori yg BELUM dirangkum di RINGKASAN biar gak dobel.
  // Tapi kita tetap loop semua, kecuali "Platform/Memory/Display/Main Camera/Selfie camera/Battery"
  // -- TIDAK, user mau spek lengkap juga. Jadi tetap loop semua kategori sesuai CATEGORY_ORDER.
  const allCats = new Set([
    ...CATEGORY_ORDER,
    ...Object.keys(specsA || {}),
    ...Object.keys(specsB || {}),
  ]);

  function drawCategoryHeader(catName) {
    // Pastikan ada ruang utk header (24) + sub-header (20) + minimal 1 row data (~30)
    // supaya header gak orphan di bawah halaman
    ensureSpace(24 + 20 + 30);
    doc.roundedRect(MARGIN, y, CONTENT_W, 24, 3).fill('#1f2937');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13)
      .text(CATEGORY_EMOJI_TXT[catName] || catName, MARGIN + 12, y + 6);
    doc.fillColor('#000000');
    y += 24;

    // Sub-header for columns
    doc.rect(MARGIN, y, specColW, 20).fill('#e5e7eb');
    doc.rect(MARGIN + specColW, y, valColW, 20).fill('#dbeafe');
    doc.rect(MARGIN + specColW + valColW, y, valColW, 20).fill('#fee2e2');
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9.5);
    doc.text('Spesifikasi', MARGIN + 6, y + 6, { width: specColW - 12 });
    doc.text('A', MARGIN + specColW + 6, y + 6, { width: valColW - 12 });
    doc.text('B', MARGIN + specColW + valColW + 6, y + 6, { width: valColW - 12 });
    y += 20;
  }

  function drawRow(label, valA, valB, zebra) {
    const cleanA = clean(valA);
    const cleanB = clean(valB);
    if (cleanA === '-' && cleanB === '-') return;

    doc.font('Helvetica').fontSize(9.5);
    const hLabel = doc.heightOfString(label, { width: specColW - 12 });
    const hA = doc.heightOfString(cleanA, { width: valColW - 12 });
    const hB = doc.heightOfString(cleanB, { width: valColW - 12 });
    const rowH = Math.max(hLabel, hA, hB) + rowPad * 2;

    ensureSpace(rowH);

    if (zebra) {
      doc.rect(MARGIN, y, CONTENT_W, rowH).fill('#f9fafb');
    }
    doc.strokeColor('#d1d5db').lineWidth(0.5)
      .moveTo(MARGIN, y + rowH).lineTo(MARGIN + CONTENT_W, y + rowH).stroke();
    doc.moveTo(MARGIN + specColW, y).lineTo(MARGIN + specColW, y + rowH).stroke();
    doc.moveTo(MARGIN + specColW + valColW, y).lineTo(MARGIN + specColW + valColW, y + rowH).stroke();

    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9.5)
      .text(label, MARGIN + 6, y + rowPad, { width: specColW - 12 });
    doc.fillColor('#000000').font('Helvetica').fontSize(9.5)
      .text(cleanA, MARGIN + specColW + 6, y + rowPad, { width: valColW - 12 });
    doc.text(cleanB, MARGIN + specColW + valColW + 6, y + rowPad, { width: valColW - 12 });

    y += rowH;
  }

  for (const cat of allCats) {
    const catA = (specsA && specsA[cat]) || null;
    const catB = (specsB && specsB[cat]) || null;
    if (!catA && !catB) continue;

    const labels = [];
    const seen = new Set();
    if (catA) for (const k of Object.keys(catA)) { if (!seen.has(k)) { seen.add(k); labels.push(k); } }
    if (catB) for (const k of Object.keys(catB)) { if (!seen.has(k)) { seen.add(k); labels.push(k); } }
    if (!labels.length) continue;

    let hasContent = false;
    for (const lbl of labels) {
      const va = catA?.[lbl];
      const vb = catB?.[lbl];
      if ((va && va !== '-') || (vb && vb !== '-')) { hasContent = true; break; }
    }
    if (!hasContent) continue;

    drawCategoryHeader(cat);
    let zebra = false;
    for (const lbl of labels) {
      drawRow(lbl, catA?.[lbl], catB?.[lbl], zebra);
      zebra = !zebra;
    }
    y += 8;
  }

  // ── FOOTER ──────────────────────────────────────────────────────────────
  ensureSpace(30);
  y = PAGE_H - MARGIN - 15;
  doc.fontSize(7).fillColor('#6b7280').font('Helvetica-Oblique')
    .text('Dibuat oleh Wily Bot — Data: GSMArena', MARGIN, y, { align: 'center', width: CONTENT_W });

  doc.end();
  return await done;
}

module.exports = { buildComparisonPDF };
