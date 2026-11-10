'use strict';

// ---------- SoundFont (.sf2) instrument plug-ins ----------
// Load .sf2 files (free instrument sound libraries found online). Each preset in
// the file becomes an instrument in the parts' Instrument menu. Files are kept
// in the browser (IndexedDB) so they are still there next time.
// Instrument ids look like "sf:<fontId>:<bank>:<program>".

const SF2_FONTS = new Map(); // fontId -> { id, name, presets, instruments, samples, dv, smpl, buffers }
const SF2_ID_RE = /^sf:([a-z0-9-]+):(\d+):(\d+)$/;

// Generator numbers from the SoundFont 2.01 spec
const G = {
  startOff: 0, endOff: 1, loopStartOff: 2, loopEndOff: 3, startCoarse: 4,
  endCoarse: 12, pan: 17, attack: 34, decay: 36, sustain: 37, release: 38,
  instrument: 41, keyRange: 43, velRange: 44, loopStartCoarse: 45, initialAtten: 48,
  loopEndCoarse: 50, coarseTune: 51, fineTune: 52, sampleID: 53, sampleModes: 54,
  rootKey: 58
};

function sf2FontId(fileName, size) {
  const base = fileName.replace(/\.sf2$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `${base || 'font'}-${size}`;
}

function sf2Parse(buffer, fileName) {
  const dv = new DataView(buffer);
  if (dv.byteLength < 12) throw new Error('This file is too small to be a SoundFont.');
  const tag = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  const text = (o, n) => {
    let s = '';
    for (let i = 0; i < n; i++) {
      const c = dv.getUint8(o + i);
      if (!c) break;
      s += String.fromCharCode(c);
    }
    return s.trim();
  };
  if (tag(0) !== 'RIFF' || tag(8) !== 'sfbk') throw new Error('This is not a SoundFont (.sf2) file.');

  const chunks = {};
  (function walk(start, end) {
    let o = start;
    while (o + 8 <= end) {
      const id = tag(o);
      const size = dv.getUint32(o + 4, true);
      if (id === 'LIST') walk(o + 12, Math.min(end, o + 8 + size));
      else chunks[id] = { offset: o + 8, size };
      o += 8 + size + (size & 1);
    }
  })(12, dv.byteLength);

  for (const id of ['smpl', 'phdr', 'pbag', 'pgen', 'inst', 'ibag', 'igen', 'shdr']) {
    if (!chunks[id]) throw new Error(`This SoundFont is damaged (missing “${id}”).`);
  }
  if (chunks.ifil && dv.getUint16(chunks.ifil.offset, true) >= 3) {
    throw new Error('This is a compressed SoundFont (SF3). Please use the .sf2 version of it.');
  }

  const records = (id, size, read) => {
    const c = chunks[id];
    const n = Math.floor(c.size / size);
    const out = [];
    for (let i = 0; i < n; i++) out.push(read(c.offset + i * size));
    return out;
  };
  const u16 = (o) => dv.getUint16(o, true);
  const phdr = records('phdr', 38, (o) => ({ name: text(o, 20), program: u16(o + 20), bank: u16(o + 22), bag: u16(o + 24) }));
  const pbag = records('pbag', 4, (o) => u16(o));
  const pgen = records('pgen', 4, (o) => ({ op: u16(o), amt: dv.getInt16(o + 2, true), lo: dv.getUint8(o + 2), hi: dv.getUint8(o + 3) }));
  const inst = records('inst', 22, (o) => ({ name: text(o, 20), bag: u16(o + 20) }));
  const ibag = records('ibag', 4, (o) => u16(o));
  const igen = records('igen', 4, (o) => ({ op: u16(o), amt: dv.getInt16(o + 2, true), lo: dv.getUint8(o + 2), hi: dv.getUint8(o + 3) }));
  const samples = records('shdr', 46, (o) => ({
    name: text(o, 20),
    start: dv.getUint32(o + 20, true), end: dv.getUint32(o + 24, true),
    loopStart: dv.getUint32(o + 28, true), loopEnd: dv.getUint32(o + 32, true),
    rate: dv.getUint32(o + 36, true), root: dv.getUint8(o + 40), corr: dv.getInt8(o + 41)
  }));

  // Zones: each is a map of generator -> value (ranges kept as [lo, hi]).
  // A first zone without the terminal generator is the "global" zone whose
  // values apply to every other zone unless overridden.
  const zonesOf = (items, bags, gens, i, terminal) => {
    const zones = [];
    let global = {};
    for (let b = items[i].bag; b < items[i + 1].bag && b + 1 < bags.length; b++) {
      const g = {};
      for (let k = bags[b]; k < bags[b + 1] && k < gens.length; k++) {
        const { op, amt, lo, hi } = gens[k];
        g[op] = op === G.keyRange || op === G.velRange ? [lo, hi] : amt;
      }
      if (g[terminal] === undefined) {
        if (b === items[i].bag) global = g;
        continue;
      }
      zones.push(g);
    }
    return zones.map((z) => ({ ...global, ...z }));
  };

  const instruments = [];
  for (let i = 0; i < inst.length - 1; i++) {
    instruments.push({ name: inst[i].name, zones: zonesOf(inst, ibag, igen, i, G.sampleID) });
  }
  const presets = [];
  for (let i = 0; i < phdr.length - 1; i++) {
    const zones = zonesOf(phdr, pbag, pgen, i, G.instrument).filter((z) => instruments[z[G.instrument]]);
    if (zones.length) presets.push({ name: phdr[i].name || `Preset ${i + 1}`, bank: phdr[i].bank, program: phdr[i].program, zones });
  }
  if (!presets.length) throw new Error('No playable instruments were found in this SoundFont.');
  presets.sort((a, b) => a.bank - b.bank || a.program - b.program);

  return {
    id: sf2FontId(fileName, buffer.byteLength),
    name: fileName.replace(/\.sf2$/i, ''),
    presets, instruments, samples, dv,
    smpl: chunks.smpl,
    buffers: new Map()
  };
}

// ----- Lookup helpers used by app.js -----
function sf2Lookup(id) {
  const m = SF2_ID_RE.exec(id || '');
  if (!m) return null;
  const font = SF2_FONTS.get(m[1]);
  if (!font) return { missing: true, fontId: m[1] };
  const preset = font.presets.find((p) => p.bank === Number(m[2]) && p.program === Number(m[3]));
  return preset ? { font, preset } : { missing: true, fontId: m[1] };
}

const sf2IsId = (id) => SF2_ID_RE.test(id || '');
const sf2PresetId = (font, p) => `sf:${font.id}:${p.bank}:${p.program}`;

function sf2Label(id) {
  const ref = sf2Lookup(id);
  if (!ref) return null;
  return ref.missing ? 'Missing instrument' : ref.preset.name;
}

// ----- Sound -----
const inRange = (z, op, v) => !z[op] || (v >= z[op][0] && v <= z[op][1]);
const timecents = (tc, fallback) => Math.pow(2, (tc === undefined ? fallback : tc) / 1200);

// Turn part of the raw sample data into a Web Audio buffer (cached)
function sf2Buffer(font, zone) {
  const s = font.samples[zone[G.sampleID]];
  if (!s) return null;
  const off = (fine, coarse) => (zone[fine] || 0) + 32768 * (zone[coarse] || 0);
  const start = s.start + off(G.startOff, G.startCoarse);
  const end = s.end + off(G.endOff, G.endCoarse);
  const loopStart = s.loopStart + off(G.loopStartOff, G.loopStartCoarse);
  const loopEnd = s.loopEnd + off(G.loopEndOff, G.loopEndCoarse);
  const key = `${zone[G.sampleID]}:${start}:${end}`;
  let buf = font.buffers.get(key);
  if (buf === undefined) {
    const total = font.smpl.size / 2;
    const len = Math.min(end, total) - start;
    if (len < 2 || start < 0 || s.rate < 3000 || s.rate > 384000) {
      buf = null;
    } else {
      buf = ctx.createBuffer(1, len, s.rate);
      const data = buf.getChannelData(0);
      const base = font.smpl.offset + start * 2;
      for (let i = 0; i < len; i++) data[i] = font.dv.getInt16(base + i * 2, true) / 32768;
    }
    font.buffers.set(key, buf);
  }
  return buf && { buffer: buf, sample: s, start, loopStart, loopEnd };
}

// Play one note with a SoundFont preset. Returns false if the instrument is not loaded.
function sf2Voice(id, midi, when, dur, out, vel) {
  const ref = sf2Lookup(id);
  if (!ref || ref.missing) return false;
  const { font, preset } = ref;
  const key = Math.max(0, Math.min(127, Math.round(midi)));
  const velocity = Math.max(1, Math.min(127, Math.round(vel * 95)));
  let played = false;

  for (const pz of preset.zones) {
    if (!inRange(pz, G.keyRange, key) || !inRange(pz, G.velRange, velocity)) continue;
    const instrument = font.instruments[pz[G.instrument]];
    for (const z of instrument.zones) {
      if (!inRange(z, G.keyRange, key) || !inRange(z, G.velRange, velocity)) continue;
      const b = sf2Buffer(font, z);
      if (!b) continue;
      played = true;

      const root = z[G.rootKey] >= 0 && z[G.rootKey] <= 127 ? z[G.rootKey] : (b.sample.root <= 127 ? b.sample.root : 60);
      const cents = (key - root) * 100 +
        ((z[G.coarseTune] || 0) + (pz[G.coarseTune] || 0)) * 100 +
        (z[G.fineTune] || 0) + (pz[G.fineTune] || 0) + b.sample.corr;

      const src = ctx.createBufferSource();
      src.buffer = b.buffer;
      src.playbackRate.value = Math.pow(2, cents / 1200);
      const mode = (z[G.sampleModes] || 0) & 3;
      if ((mode === 1 || mode === 3) && b.loopEnd > b.loopStart) {
        src.loop = true;
        src.loopStart = (b.loopStart - b.start) / b.sample.rate;
        src.loopEnd = (b.loopEnd - b.start) / b.sample.rate;
      }

      // Volume envelope from the SoundFont (times in timecents, levels in centibels)
      const attack = Math.min(2, Math.max(0.002, timecents((z[G.attack] ?? -12000) + (pz[G.attack] || 0))));
      const decay = Math.min(10, Math.max(0.01, timecents((z[G.decay] ?? -12000) + (pz[G.decay] || 0))));
      const release = Math.min(4, Math.max(0.03, timecents((z[G.release] ?? -12000) + (pz[G.release] || 0))));
      const sustain = Math.pow(10, -Math.max(0, (z[G.sustain] || 0) + (pz[G.sustain] || 0)) / 200);
      const atten = Math.pow(10, -0.4 * ((z[G.initialAtten] || 0) + (pz[G.initialAtten] || 0)) / 200);
      const peak = 0.5 * Math.min(1.6, vel) * atten;

      const len = Math.max(0.12, dur);
      const end = when + len;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(peak, when + attack);
      if (sustain < 0.999) env.gain.setTargetAtTime(peak * sustain, when + attack, decay / 5);
      env.gain.setTargetAtTime(0, end, release / 5);

      let node = src.connect(env);
      const pan = Math.max(-1, Math.min(1, ((z[G.pan] || 0) + (pz[G.pan] || 0)) / 500));
      if (pan && ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        node = node.connect(p);
      }
      node.connect(out);
      src.start(when);
      src.stop(end + release + 0.1);
    }
  }
  return played;
}

// ----- Saving files in the browser -----
// Gives up after a few seconds so a blocked/unavailable store never hangs the app
function sf2DB() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('storage unavailable')), 4000);
    let req;
    try { req = indexedDB.open('composer-instruments', 1); } catch (err) { clearTimeout(timer); reject(err); return; }
    req.onupgradeneeded = () => req.result.createObjectStore('fonts', { keyPath: 'id' });
    req.onsuccess = () => { clearTimeout(timer); resolve(req.result); };
    req.onerror = () => { clearTimeout(timer); reject(req.error); };
    req.onblocked = () => { clearTimeout(timer); reject(new Error('storage blocked')); };
  });
}

async function sf2Store(op, value) {
  const db = await sf2DB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fonts', op === 'getAll' ? 'readonly' : 'readwrite');
    const store = tx.objectStore('fonts');
    const req = op === 'getAll' ? store.getAll() : op === 'put' ? store.put(value) : store.delete(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Read a user-chosen .sf2 file, keep it, and return the parsed font
async function sf2AddFile(file) {
  const buffer = await file.arrayBuffer();
  const font = sf2Parse(buffer, file.name);
  SF2_FONTS.set(font.id, font);
  let saved = true;
  try { await sf2Store('put', { id: font.id, name: file.name, data: buffer }); } catch (_) { saved = false; }
  return { font, saved };
}

async function sf2Remove(fontId) {
  SF2_FONTS.delete(fontId);
  try { await sf2Store('delete', fontId); } catch (_) { /* ignore */ }
}

// Load every .sf2 file saved in earlier visits
async function sf2LoadSaved() {
  let rows = [];
  try { rows = await sf2Store('getAll'); } catch (_) { return; }
  for (const row of rows) {
    try {
      const font = sf2Parse(row.data, row.name);
      SF2_FONTS.set(font.id, font);
    } catch (_) { /* skip unreadable file */ }
  }
}
