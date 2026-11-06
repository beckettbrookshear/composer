'use strict';

// ---------- Layout constants ----------
const L = 12;            // staff line spacing
const STAFF_H = 120;     // vertical space for one staff (one part)
const SYS_GAP = 30;      // extra space between systems (rows of measures)
const MAX_PARTS = 4;
const PART_COLORS = ['#1f4e9c', '#b5482b', '#2f7d4f', '#7a3fa0'];
const DEFAULT_INSTRUMENTS = ['piano', 'violin', 'flute', 'cello'];
const TOP = 50;          // y of top staff line in first row
const LEFT = 135;        // left margin (clef + key signature + time signature)
const BEAT_W = 48;       // horizontal width of one beat
const PAD = 14;          // padding between barline and first beat
const MPR = 4;           // measures per row
const MIN_STEP = -4;     // lowest placeable pitch (A3)
const MAX_STEP = 12;     // highest placeable pitch (C6)
const STORAGE_KEY = 'composer-score-v1';

// Key signatures: n accidentals of the given type, drawn in this order on a treble staff.
const KEYS = {
  C: { label: 'C major', n: 0, type: '#' },
  G: { label: 'G major (1♯)', n: 1, type: '#' },
  D: { label: 'D major (2♯)', n: 2, type: '#' },
  A: { label: 'A major (3♯)', n: 3, type: '#' },
  F: { label: 'F major (1♭)', n: 1, type: 'b' },
  Bb: { label: 'B♭ major (2♭)', n: 2, type: 'b' },
  Eb: { label: 'E♭ major (3♭)', n: 3, type: 'b' }
};
const KEY_STEPS = { '#': [8, 5, 9, 6, 3, 7, 4], b: [4, 7, 3, 6, 2, 5, 1] }; // treble staff steps
const SHARP_LETTERS = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B  (indexes into C D E F G A B)
const FLAT_LETTERS = [6, 2, 5, 1, 4, 0, 3];  // B E A D G C F

// Dynamic markings and their playback loudness
const DYNAMICS = { pp: 0.35, p: 0.5, mp: 0.7, mf: 0.85, f: 1.1, ff: 1.35 };

// ---------- Instrument plug-ins ----------
// Add your own by adding an entry here; it appears in the Instrument menu automatically.
//   partials: [frequencyRatio, gain, oscillatorType, detuneCents?]
//   attack: seconds; decay: time constant to the sustain level; sustain: 0..1; release: time constant
//   filter: optional lowpass { start, end, tc, q } with cutoffs as multiples of the note frequency
//   vibrato: optional { rate (Hz), cents }; octave: optional register shift
const INSTRUMENTS = {
  piano: {
    label: 'Grand Piano',
    partials: [[1, 1, 'triangle'], [2, 0.5, 'sine'], [3, 0.25, 'sine'], [4, 0.12, 'sine']],
    attack: 0.005, decay: 0.6, sustain: 0.05, release: 0.12
  },
  epiano: {
    label: 'Electric Piano',
    partials: [[1, 1, 'sine'], [2, 0.45, 'sine'], [4, 0.15, 'sine']],
    attack: 0.005, decay: 0.9, sustain: 0.2, release: 0.15
  },
  organ: {
    label: 'Church Organ',
    partials: [[1, 1, 'sine'], [2, 0.8, 'sine'], [3, 0.5, 'sine'], [4, 0.4, 'sine'], [6, 0.25, 'sine'], [8, 0.2, 'sine']],
    attack: 0.01, decay: 0.05, sustain: 1, release: 0.03
  },
  strings: {
    label: 'String Ensemble',
    partials: [[1, 1, 'sawtooth', -8], [1, 1, 'sawtooth', 8]],
    attack: 0.15, decay: 0.2, sustain: 0.9, release: 0.12,
    filter: { start: 7, end: 7, tc: 0.1, q: 0.5 },
    vibrato: { rate: 5.5, cents: 8 }
  },
  flute: {
    label: 'Flute',
    partials: [[1, 1, 'sine'], [2, 0.15, 'sine'], [3, 0.05, 'sine']],
    attack: 0.06, decay: 0.1, sustain: 0.85, release: 0.06,
    vibrato: { rate: 5, cents: 6 }
  },
  guitar: {
    label: 'Nylon Guitar',
    partials: [[1, 1, 'sawtooth']],
    attack: 0.003, decay: 0.5, sustain: 0.05, release: 0.08,
    filter: { start: 8, end: 1.5, tc: 0.15, q: 1 }
  },
  marimba: {
    label: 'Marimba',
    partials: [[1, 1, 'sine'], [4, 0.35, 'sine'], [10, 0.08, 'sine']],
    attack: 0.002, decay: 0.15, sustain: 0, release: 0.05
  },
  bell: {
    label: 'Bells',
    partials: [[1, 1, 'sine'], [2.76, 0.5, 'sine'], [5.4, 0.3, 'sine'], [8.93, 0.15, 'sine']],
    attack: 0.002, decay: 0.9, sustain: 0, release: 0.3
  },
  brass: {
    label: 'Brass Section',
    partials: [[1, 1, 'sawtooth'], [1, 0.6, 'sawtooth', 6]],
    attack: 0.06, decay: 0.1, sustain: 0.8, release: 0.08,
    filter: { start: 2, end: 6, tc: 0.08, q: 1 }
  },
  bass: {
    label: 'Synth Bass',
    partials: [[1, 1, 'sawtooth'], [1, 0.5, 'sine']],
    attack: 0.01, decay: 0.4, sustain: 0.5, release: 0.06,
    filter: { start: 5, end: 3, tc: 0.2, q: 1 }, octave: -1
  },
  synth: {
    label: 'Synth Lead',
    partials: [[1, 1, 'square'], [1, 0.5, 'sawtooth', 7]],
    attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.08,
    filter: { start: 10, end: 6, tc: 0.2, q: 2 }
  },
  violin: {
    label: 'Violin',
    partials: [[1, 1, 'sawtooth']],
    attack: 0.08, decay: 0.2, sustain: 0.9, release: 0.1,
    filter: { start: 6, end: 6, tc: 0.1, q: 0.7 },
    vibrato: { rate: 6, cents: 12 }
  },
  cello: {
    label: 'Cello',
    partials: [[1, 1, 'sawtooth'], [1, 0.5, 'triangle', 5]],
    attack: 0.1, decay: 0.2, sustain: 0.9, release: 0.12,
    filter: { start: 5, end: 5, tc: 0.1, q: 0.7 },
    vibrato: { rate: 5, cents: 8 }, octave: -1
  },
  harp: {
    label: 'Harp',
    partials: [[1, 1, 'sine'], [2, 0.4, 'sine'], [3, 0.2, 'sine'], [4, 0.1, 'sine']],
    attack: 0.003, decay: 0.5, sustain: 0, release: 0.15
  },
  pizzicato: {
    label: 'Pizzicato Strings',
    partials: [[1, 1, 'sawtooth']],
    attack: 0.002, decay: 0.12, sustain: 0, release: 0.05,
    filter: { start: 6, end: 1.5, tc: 0.06, q: 1 }
  },
  piccolo: {
    label: 'Piccolo',
    partials: [[1, 1, 'sine'], [2, 0.1, 'sine']],
    attack: 0.04, decay: 0.1, sustain: 0.85, release: 0.05,
    vibrato: { rate: 5.5, cents: 5 }, octave: 1
  },
  clarinet: {
    label: 'Clarinet',
    partials: [[1, 1, 'sine'], [3, 0.5, 'sine'], [5, 0.25, 'sine'], [7, 0.1, 'sine']],
    attack: 0.04, decay: 0.1, sustain: 0.85, release: 0.06
  },
  oboe: {
    label: 'Oboe',
    partials: [[1, 1, 'sawtooth']],
    attack: 0.04, decay: 0.1, sustain: 0.85, release: 0.06,
    filter: { start: 4, end: 4, tc: 0.1, q: 4 },
    vibrato: { rate: 5.5, cents: 7 }
  },

  // --- Woodwinds ---
  sopranoSax: {
    label: 'Soprano Sax',
    partials: [[1, 1, 'sawtooth'], [1, 0.4, 'square', 4]],
    attack: 0.03, decay: 0.15, sustain: 0.85, release: 0.06,
    filter: { start: 5, end: 3.5, tc: 0.15, q: 2.5 },
    vibrato: { rate: 5.5, cents: 10 }
  },
  altoSax: {
    label: 'Alto Sax',
    partials: [[1, 1, 'sawtooth'], [1, 0.4, 'square', 3]],
    attack: 0.03, decay: 0.15, sustain: 0.85, release: 0.06,
    filter: { start: 4, end: 3, tc: 0.15, q: 2 },
    vibrato: { rate: 5, cents: 9 }
  },
  tenorSax: {
    label: 'Tenor Sax',
    partials: [[1, 1, 'sawtooth'], [1, 0.4, 'square', 3]],
    attack: 0.04, decay: 0.15, sustain: 0.85, release: 0.07,
    filter: { start: 3.5, end: 2.5, tc: 0.15, q: 2 },
    vibrato: { rate: 5, cents: 9 }, octave: -1
  },
  baritoneSax: {
    label: 'Baritone Sax',
    partials: [[1, 1, 'sawtooth'], [1, 0.5, 'square', 3]],
    attack: 0.05, decay: 0.15, sustain: 0.85, release: 0.08,
    filter: { start: 3, end: 2, tc: 0.15, q: 2.5 },
    vibrato: { rate: 4.5, cents: 8 }, octave: -1
  },
  bassClarinet: {
    label: 'Bass Clarinet',
    partials: [[1, 1, 'sine'], [3, 0.5, 'sine'], [5, 0.25, 'sine'], [7, 0.1, 'sine']],
    attack: 0.06, decay: 0.1, sustain: 0.85, release: 0.07, octave: -1
  },
  bassoon: {
    label: 'Bassoon',
    partials: [[1, 1, 'sawtooth']],
    attack: 0.05, decay: 0.1, sustain: 0.9, release: 0.07,
    filter: { start: 4, end: 3, tc: 0.1, q: 3 },
    vibrato: { rate: 4.5, cents: 4 }, octave: -1
  },
  englishHorn: {
    label: 'English Horn',
    partials: [[1, 1, 'sawtooth']],
    attack: 0.05, decay: 0.1, sustain: 0.85, release: 0.07,
    filter: { start: 3, end: 3, tc: 0.1, q: 3.5 },
    vibrato: { rate: 5, cents: 6 }
  },
  recorder: {
    label: 'Recorder',
    partials: [[1, 1, 'sine'], [2, 0.03, 'sine']],
    attack: 0.05, decay: 0.1, sustain: 0.9, release: 0.05
  },
  panFlute: {
    label: 'Pan Flute',
    partials: [[1, 1, 'sine'], [3, 0.08, 'sine']],
    attack: 0.08, decay: 0.1, sustain: 0.8, release: 0.06,
    vibrato: { rate: 4, cents: 4 }
  },
  altoFlute: {
    label: 'Alto Flute',
    partials: [[1, 1, 'sine'], [2, 0.25, 'sine'], [3, 0.1, 'sine']],
    attack: 0.07, decay: 0.1, sustain: 0.85, release: 0.07,
    vibrato: { rate: 4.5, cents: 5 }, octave: -1
  },

  // --- Strings ---
  viola: {
    label: 'Viola',
    partials: [[1, 1, 'sawtooth']],
    attack: 0.09, decay: 0.2, sustain: 0.9, release: 0.1,
    filter: { start: 5, end: 5, tc: 0.1, q: 0.7 },
    vibrato: { rate: 5.5, cents: 10 }
  },
  doubleBass: {
    label: 'Double Bass',
    partials: [[1, 1, 'sawtooth'], [1, 0.6, 'triangle']],
    attack: 0.06, decay: 0.2, sustain: 0.9, release: 0.1,
    filter: { start: 6, end: 6, tc: 0.1, q: 0.7 },
    vibrato: { rate: 4.5, cents: 5 }, octave: -2
  },
  steelGuitar: {
    label: 'Steel Guitar',
    partials: [[1, 1, 'sawtooth'], [2, 0.3, 'sawtooth', 3]],
    attack: 0.002, decay: 0.6, sustain: 0.03, release: 0.08,
    filter: { start: 10, end: 2, tc: 0.1, q: 1.5 }
  },
  electricGuitar: {
    label: 'Electric Guitar',
    partials: [[1, 1, 'square'], [1, 0.6, 'sawtooth', 5]],
    attack: 0.005, decay: 0.8, sustain: 0.35, release: 0.1,
    filter: { start: 6, end: 4, tc: 0.3, q: 2 }
  },
  banjo: {
    label: 'Banjo',
    partials: [[1, 1, 'sawtooth'], [3, 0.3, 'square']],
    attack: 0.001, decay: 0.1, sustain: 0, release: 0.04,
    filter: { start: 12, end: 3, tc: 0.04, q: 4 }
  },
  mandolin: {
    label: 'Mandolin',
    partials: [[1, 1, 'square'], [2, 0.4, 'sawtooth', 6]],
    attack: 0.002, decay: 0.2, sustain: 0, release: 0.05,
    filter: { start: 8, end: 2, tc: 0.05, q: 1 }
  },
  ukulele: {
    label: 'Ukulele',
    partials: [[1, 1, 'triangle'], [2, 0.3, 'sine']],
    attack: 0.002, decay: 0.3, sustain: 0.02, release: 0.06,
    filter: { start: 6, end: 2, tc: 0.1, q: 0.8 }
  },

  // --- Keyboards ---
  brightPiano: {
    label: 'Bright Piano',
    partials: [[1, 1, 'triangle'], [2, 0.7, 'sine'], [3, 0.5, 'sine'], [4, 0.35, 'sine'], [5, 0.2, 'sine']],
    attack: 0.004, decay: 0.5, sustain: 0.05, release: 0.1
  },
  honkyTonk: {
    label: 'Honky-Tonk Piano',
    partials: [[1, 1, 'triangle', -12], [1, 1, 'triangle', 12], [2, 0.4, 'sine']],
    attack: 0.004, decay: 0.5, sustain: 0.05, release: 0.1
  },
  harpsichord: {
    label: 'Harpsichord',
    partials: [[1, 1, 'sawtooth'], [2, 0.3, 'square']],
    attack: 0.001, decay: 0.3, sustain: 0.1, release: 0.03,
    filter: { start: 8, end: 4, tc: 0.03, q: 1 }
  },
  celesta: {
    label: 'Celesta',
    partials: [[1, 1, 'sine'], [2, 0.2, 'sine'], [5, 0.15, 'sine']],
    attack: 0.002, decay: 0.5, sustain: 0, release: 0.2, octave: 1
  },
  accordion: {
    label: 'Accordion',
    partials: [[1, 1, 'sawtooth', -6], [1, 1, 'sawtooth', 6], [2, 0.4, 'square']],
    attack: 0.03, decay: 0.1, sustain: 1, release: 0.05,
    filter: { start: 5, end: 5, tc: 0.1, q: 0.7 },
    vibrato: { rate: 6, cents: 5 }
  },
  jazzOrgan: {
    label: 'Jazz Organ',
    partials: [[1, 1, 'sine'], [3, 0.6, 'sine'], [2, 0.3, 'sine']],
    attack: 0.005, decay: 0.05, sustain: 1, release: 0.03,
    vibrato: { rate: 6.5, cents: 12 }
  },
  clavinet: {
    label: 'Clavinet',
    partials: [[1, 1, 'sawtooth'], [1, 0.5, 'square']],
    attack: 0.001, decay: 0.12, sustain: 0.2, release: 0.04,
    filter: { start: 10, end: 3, tc: 0.05, q: 3 }
  },
  harmonica: {
    label: 'Harmonica',
    partials: [[1, 1, 'square'], [1, 0.5, 'sawtooth', 8]],
    attack: 0.03, decay: 0.1, sustain: 0.9, release: 0.05,
    filter: { start: 4, end: 4, tc: 0.1, q: 1 },
    vibrato: { rate: 5, cents: 8 }
  },

  // --- Brass ---
  trumpet: {
    label: 'Trumpet',
    partials: [[1, 1, 'sawtooth'], [1, 0.4, 'square', 3]],
    attack: 0.03, decay: 0.1, sustain: 0.85, release: 0.06,
    filter: { start: 2, end: 7, tc: 0.05, q: 1.5 }
  },
  mutedTrumpet: {
    label: 'Muted Trumpet',
    partials: [[1, 1, 'sawtooth']],
    attack: 0.03, decay: 0.1, sustain: 0.85, release: 0.06,
    filter: { start: 2.5, end: 2.5, tc: 0.1, q: 5 }
  },
  trombone: {
    label: 'Trombone',
    partials: [[1, 1, 'sawtooth'], [1, 0.5, 'sawtooth', 5]],
    attack: 0.06, decay: 0.1, sustain: 0.85, release: 0.08,
    filter: { start: 1.5, end: 5, tc: 0.1, q: 1 }, octave: -1
  },
  frenchHorn: {
    label: 'French Horn',
    partials: [[1, 1, 'sawtooth']],
    attack: 0.08, decay: 0.1, sustain: 0.85, release: 0.1,
    filter: { start: 1.5, end: 3, tc: 0.15, q: 0.7 }
  },
  tuba: {
    label: 'Tuba',
    partials: [[1, 1, 'sawtooth'], [1, 0.7, 'triangle']],
    attack: 0.06, decay: 0.1, sustain: 0.9, release: 0.08,
    filter: { start: 3, end: 3, tc: 0.1, q: 1 }, octave: -2
  },

  // --- Tuned percussion ---
  vibraphone: {
    label: 'Vibraphone',
    partials: [[1, 1, 'sine'], [4, 0.25, 'sine'], [10, 0.05, 'sine']],
    attack: 0.003, decay: 1, sustain: 0, release: 0.3,
    vibrato: { rate: 5, cents: 6 }
  },
  xylophone: {
    label: 'Xylophone',
    partials: [[1, 1, 'sine'], [3, 0.4, 'sine'], [6, 0.15, 'sine']],
    attack: 0.001, decay: 0.08, sustain: 0, release: 0.03, octave: 1
  },
  glockenspiel: {
    label: 'Glockenspiel',
    partials: [[1, 1, 'sine'], [3, 0.3, 'sine'], [5.4, 0.3, 'sine']],
    attack: 0.001, decay: 0.5, sustain: 0, release: 0.15, octave: 1
  },
  steelDrum: {
    label: 'Steel Drum',
    partials: [[1, 1, 'sine'], [2, 0.6, 'sine'], [3, 0.15, 'sine']],
    attack: 0.003, decay: 0.35, sustain: 0, release: 0.1
  },
  kalimba: {
    label: 'Kalimba',
    partials: [[1, 1, 'triangle'], [6, 0.1, 'sine']],
    attack: 0.002, decay: 0.4, sustain: 0, release: 0.1
  },
  musicBox: {
    label: 'Music Box',
    partials: [[1, 1, 'sine'], [3, 0.2, 'sine']],
    attack: 0.002, decay: 0.25, sustain: 0, release: 0.08, octave: 1
  },
  tubularBells: {
    label: 'Tubular Bells',
    partials: [[1, 1, 'sine'], [2.5, 0.5, 'sine'], [4.1, 0.4, 'sine'], [6.4, 0.2, 'sine']],
    attack: 0.002, decay: 1.8, sustain: 0, release: 0.5
  },

  // --- Synth ---
  sawLead: {
    label: 'Saw Lead',
    partials: [[1, 1, 'sawtooth'], [1, 1, 'sawtooth', 10]],
    attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.08,
    filter: { start: 8, end: 5, tc: 0.2, q: 1.5 }
  },
  warmPad: {
    label: 'Warm Pad',
    partials: [[1, 1, 'sawtooth', -10], [1, 1, 'sawtooth', 10], [0.5, 0.6, 'sine']],
    attack: 0.4, decay: 0.3, sustain: 0.9, release: 0.4,
    filter: { start: 3, end: 3, tc: 0.1, q: 0.7 }
  },
  pluckSynth: {
    label: 'Pluck Synth',
    partials: [[1, 1, 'square']],
    attack: 0.002, decay: 0.15, sustain: 0.1, release: 0.06,
    filter: { start: 10, end: 1.5, tc: 0.08, q: 3 }
  },

  // --- Voices ---
  choir: {
    label: 'Choir Aah',
    partials: [[1, 1, 'sawtooth', -7], [1, 1, 'sawtooth', 7], [2, 0.3, 'sawtooth']],
    attack: 0.25, decay: 0.2, sustain: 0.9, release: 0.25,
    filter: { start: 3, end: 3, tc: 0.1, q: 4 },
    vibrato: { rate: 5, cents: 6 }
  },
  ooh: {
    label: 'Voice Ooh',
    partials: [[1, 1, 'sine'], [2, 0.3, 'sine'], [3, 0.1, 'sine']],
    attack: 0.2, decay: 0.2, sustain: 0.9, release: 0.2,
    vibrato: { rate: 5.5, cents: 8 }
  }
};

// Menu groups. Instruments not listed here appear under "Other".
const CATEGORIES = {
  'Keyboards': ['piano', 'brightPiano', 'honkyTonk', 'epiano', 'harpsichord', 'celesta', 'organ', 'jazzOrgan', 'accordion', 'clavinet', 'harmonica'],
  'Strings': ['violin', 'viola', 'cello', 'doubleBass', 'strings', 'harp', 'guitar', 'steelGuitar', 'electricGuitar', 'banjo', 'mandolin', 'ukulele', 'pizzicato'],
  'Woodwinds': ['piccolo', 'flute', 'altoFlute', 'panFlute', 'recorder', 'oboe', 'englishHorn', 'clarinet', 'bassClarinet', 'bassoon', 'sopranoSax', 'altoSax', 'tenorSax', 'baritoneSax'],
  'Brass': ['trumpet', 'mutedTrumpet', 'frenchHorn', 'trombone', 'tuba', 'brass'],
  'Percussion': ['marimba', 'xylophone', 'vibraphone', 'glockenspiel', 'musicBox', 'kalimba', 'steelDrum', 'bell', 'tubularBells'],
  'Synth': ['synth', 'sawLead', 'pluckSynth', 'warmPad', 'bass'],
  'Voices': ['choir', 'ooh']
};

// ---------- State ----------
const defaultPart = (index, instrument) => ({
  instrument: instrument || DEFAULT_INSTRUMENTS[index % DEFAULT_INSTRUMENTS.length],
  muted: false,
  clef: 'treble',
  events: [],        // { start, dur, dot, step, acc, rest, tie, art }  (acc: null = follow key signature)
  dynamics: []       // { start, mark }
});

const defaultState = () => ({
  title: 'Untitled Composition',
  tempo: 100,
  bpm: 4,            // beats per measure
  measures: 8,
  key: 'C',
  parts: [defaultPart(0)]
});

let state = loadFromStorage() || defaultState();
let tool = { dur: 1, dot: false, tie: false, rest: false, acc: null, art: '', dyn: '' };
let activePart = 0;
let history = [];

// ---------- Elements ----------
const $ = (id) => document.getElementById(id);
const svg = $('sheet');
const scoreG = $('score');
const ghostG = $('ghost');
const playhead = $('playhead');
const hit = $('hit');
const status = $('status');

// ---------- Pitch helpers ----------
const LETTERS = 'CDEFGAB';
const SEMITONES = [0, 2, 4, 5, 7, 9, 11];

// Diatonic index (C0 = 0) of the bottom staff line: E4 for treble, G2 for bass
const baseD = (clef) => (clef === 'bass' ? 18 : 30);
const letterOf = (step, clef) => (((baseD(clef) + step) % 7) + 7) % 7;

// Accidental implied by the key signature for a letter index (0 = C ... 6 = B)
function keyAcc(letter) {
  const k = KEYS[state.key];
  if (k.type === '#') return SHARP_LETTERS.slice(0, k.n).includes(letter) ? 1 : 0;
  return FLAT_LETTERS.slice(0, k.n).includes(letter) ? -1 : 0;
}

// acc === null means "follow the key signature"
const resolveAcc = (acc, step, clef) => (acc == null ? keyAcc(letterOf(step, clef)) : acc);
const beats = (ev) => ev.dur * (ev.dot ? 1.5 : 1);
const toolBeats = () => (tool.dyn ? 0.5 : tool.dur * (tool.dot ? 1.5 : 1));
const eventMidi = (ev, part) => stepToMidi(ev.step, resolveAcc(ev.acc, ev.step, part.clef), part.clef);

// step 0 = bottom line of the staff
function stepToMidi(step, acc, clef) {
  const d = baseD(clef) + step;
  const letter = ((d % 7) + 7) % 7;
  const octave = Math.floor(d / 7);
  return 12 * (octave + 1) + SEMITONES[letter] + acc;
}

function stepName(step, acc, clef) {
  const d = baseD(clef) + step;
  const letter = ((d % 7) + 7) % 7;
  const octave = Math.floor(d / 7);
  return LETTERS[letter] + (acc === 1 ? '♯' : acc === -1 ? '♭' : '') + octave;
}

// ---------- History / persistence ----------
function snapshot() {
  history.push(JSON.stringify(state));
  if (history.length > 100) history.shift();
}

function commit() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* ignore */ }
  render();
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : null;
  } catch (_) {
    return null;
  }
}

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return null;
  // Older single-part saves have { events, wave } at the top level.
  const src = Array.isArray(obj.parts) ? obj.parts
    : Array.isArray(obj.events) ? [{ events: obj.events, instrument: obj.wave }]
    : null;
  if (!src || !src.length) return null;

  const d = defaultState();
  const num = (v, min, max, fallback) =>
    Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  const out = {
    title: typeof obj.title === 'string' ? obj.title.slice(0, 80) : d.title,
    tempo: num(obj.tempo, 30, 240, d.tempo),
    bpm: obj.bpm === 3 ? 3 : 4,
    measures: Math.round(num(obj.measures, 1, 64, d.measures)),
    key: Object.prototype.hasOwnProperty.call(KEYS, obj.key) ? obj.key : d.key,
    parts: []
  };
  for (const p of src.slice(0, MAX_PARTS)) {
    if (!p || typeof p !== 'object') continue;
    const known = Object.prototype.hasOwnProperty.call(INSTRUMENTS, p.instrument);
    const part = defaultPart(out.parts.length, known ? p.instrument : 'piano');
    part.muted = !!p.muted;
    part.clef = p.clef === 'bass' ? 'bass' : 'treble';
    for (const e of Array.isArray(p.events) ? p.events : []) {
      if (!e || ![4, 2, 1, 0.5, 0.25].includes(e.dur)) continue;
      const start = num(e.start, 0, out.measures * out.bpm, NaN);
      if (!Number.isFinite(start)) continue;
      part.events.push({
        start,
        dur: e.dur,
        dot: !!e.dot,
        step: Math.round(num(e.step, MIN_STEP, MAX_STEP, 0)),
        acc: [-1, 0, 1].includes(e.acc) ? e.acc : null,
        rest: !!e.rest,
        tie: !!e.tie && !e.rest,
        art: ['stac', 'acc'].includes(e.art) ? e.art : ''
      });
    }
    for (const dyn of Array.isArray(p.dynamics) ? p.dynamics : []) {
      if (!dyn || !Object.prototype.hasOwnProperty.call(DYNAMICS, dyn.mark)) continue;
      const start = num(dyn.start, 0, out.measures * out.bpm, NaN);
      if (Number.isFinite(start)) part.dynamics.push({ start, mark: dyn.mark });
    }
    out.parts.push(part);
  }
  return out.parts.length ? out : null;
}

// ---------- Coordinates ----------
const partColor = (i) => (state.parts.length > 1 ? PART_COLORS[i % PART_COLORS.length] : '#111');
const sysH = () => state.parts.length * STAFF_H + SYS_GAP;
const staffTop = (row, part) => TOP + row * sysH() + part * STAFF_H;

function beatToPos(beat, part = 0) {
  const perRow = MPR * state.bpm;
  const row = Math.floor(beat / perRow);
  const inRow = beat - row * perRow;
  return { x: LEFT + inRow * BEAT_W + PAD, top: staffTop(row, part), row };
}

function stepToY(step, top) {
  return top + 4 * L - step * (L / 2);
}

function pointerToCell(evt) {
  const r = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const x = ((evt.clientX - r.left) * vb.width) / r.width;
  const y = ((evt.clientY - r.top) * vb.height) / r.height;

  const rows = Math.ceil(state.measures / MPR);
  const perRow = MPR * state.bpm;

  // Pick the staff (row + part) whose centre is closest to the pointer
  let best = null;
  for (let row = 0; row < rows; row++) {
    for (let p = 0; p < state.parts.length; p++) {
      const top = staffTop(row, p);
      const dist = Math.abs(y - (top + 2 * L));
      if (!best || dist < best.dist) best = { row, p, top, dist };
    }
  }

  // Sixteenths snap to quarter-beats, everything else to half-beats
  const grid = !tool.dyn && tool.dur <= 0.25 ? 0.25 : 0.5;
  const inRow = Math.round((x - LEFT - PAD) / BEAT_W / grid) * grid;
  const start = best.row * perRow + inRow;
  const step = Math.min(MAX_STEP, Math.max(MIN_STEP, Math.round((best.top + 4 * L - y) / (L / 2))));

  if (inRow < 0) return null;
  const end = start + toolBeats();
  const total = state.measures * state.bpm;
  if (end > total) return null;
  // Do not cross barlines (use a tie to sustain across them)
  if (Math.floor(start / state.bpm) !== Math.floor((end - 0.001) / state.bpm)) return null;
  return { start, step, part: best.p };
}

// ---------- Rendering ----------
function restSVG(ev, x, top) {
  const stroke = 'stroke="#111" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  switch (ev.dur) {
    case 4:
      return `<rect x="${x - 8}" y="${top + L}" width="16" height="6" fill="#111"/>`;
    case 2:
      return `<rect x="${x - 8}" y="${top + 2 * L - 6}" width="16" height="6" fill="#111"/>`;
    case 1:
      return `<path d="M ${x - 3} ${top + 8} L ${x + 4} ${top + 19} L ${x - 4} ${top + 28} L ${x + 3} ${top + 38} Q ${x - 7} ${top + 34} ${x - 2} ${top + 44}" ${stroke}/>`;
    case 0.5:
      return eighthRest(x, top, stroke);
    default: // sixteenth
      return eighthRest(x, top, stroke) +
             `<circle cx="${x - 5}" cy="${top + 30}" r="3.2" fill="#111"/>` +
             `<path d="M ${x - 4} ${top + 31} Q ${x + 3} ${top + 31} ${x + 4} ${top + 25}" ${stroke}/>`;
  }
}

function eighthRest(x, top, stroke) {
  return `<circle cx="${x - 3}" cy="${top + 20}" r="3.2" fill="#111"/>` +
         `<path d="M ${x - 2} ${top + 21} Q ${x + 5} ${top + 21} ${x + 6} ${top + 15} L ${x - 3} ${top + 40}" ${stroke}/>`;
}

function noteSVG(ev, opacity = 1, part = 0) {
  const { x, top } = beatToPos(ev.start, part);
  const color = partColor(part);
  const clef = state.parts[part].clef;
  let out = `<g opacity="${opacity}">`;

  if (ev.rest) {
    out += restSVG(ev, x, top);
    if (ev.dot) out += `<circle cx="${x + 11}" cy="${top + 2 * L - 5}" r="2" fill="#111"/>`;
    return (out + '</g>').replaceAll('#111', color);
  }

  const y = stepToY(ev.step, top);

  // Ledger lines
  for (let s = -2; s >= ev.step; s -= 2) {
    const ly = stepToY(s, top);
    out += `<line x1="${x - 11}" x2="${x + 11}" y1="${ly}" y2="${ly}" stroke="#111" stroke-width="1.2"/>`;
  }
  for (let s = 10; s <= ev.step; s += 2) {
    const ly = stepToY(s, top);
    out += `<line x1="${x - 11}" x2="${x + 11}" y1="${ly}" y2="${ly}" stroke="#111" stroke-width="1.2"/>`;
  }

  // Accidental (only when it differs from what the key signature already says)
  if (ev.acc != null && ev.acc !== keyAcc(letterOf(ev.step, clef))) {
    const glyph = ev.acc === 1 ? '♯' : ev.acc === -1 ? '♭' : '♮';
    out += `<text x="${x - 12}" y="${y + 6}" font-size="20" text-anchor="middle" fill="#111">${glyph}</text>`;
  }

  // Head
  const filled = ev.dur <= 1;
  out += `<ellipse cx="${x}" cy="${y}" rx="6.8" ry="5" transform="rotate(-20 ${x} ${y})" ` +
         `fill="${filled ? '#111' : '#fff'}" stroke="#111" stroke-width="1.8"/>`;

  // Augmentation dot (sits in the space above when the note is on a line)
  if (ev.dot) {
    const dy = ev.step % 2 === 0 ? y - L / 2 : y;
    out += `<circle cx="${x + 12}" cy="${dy}" r="2" fill="#111"/>`;
  }

  // Stem and flags
  const up = ev.step < 4;
  if (ev.dur < 4) {
    const sx = up ? x + 6 : x - 6;
    const ey = up ? y - 36 : y + 36;
    out += `<line x1="${sx}" x2="${sx}" y1="${y}" y2="${ey}" stroke="#111" stroke-width="1.6"/>`;
    const flags = ev.dur === 0.5 ? 1 : ev.dur === 0.25 ? 2 : 0;
    for (let f = 0; f < flags; f++) {
      const fy = ey + (up ? 8 : -8) * f;
      out += up
        ? `<path d="M ${sx} ${fy} Q ${sx + 12} ${fy + 8} ${sx + 9} ${fy + 20}" stroke="#111" stroke-width="2" fill="none"/>`
        : `<path d="M ${sx} ${fy} Q ${sx + 12} ${fy - 8} ${sx + 9} ${fy - 20}" stroke="#111" stroke-width="2" fill="none"/>`;
    }
  }

  // Articulation, on the side opposite the stem
  if (ev.art) {
    const ay = up ? y + 14 : y - 14;
    out += ev.art === 'stac'
      ? `<circle cx="${x}" cy="${ay}" r="2.2" fill="#111"/>`
      : `<path d="M ${x - 6} ${ay - 4} L ${x + 6} ${ay} L ${x - 6} ${ay + 4}" stroke="#111" stroke-width="1.8" fill="none"/>`;
  }
  return (out + '</g>').replaceAll('#111', color);
}

// Curved line from a tied note to the next note of the same pitch
function tieSVG(ev, p, opacity) {
  const part = state.parts[p];
  const { x, top, row } = beatToPos(ev.start, p);
  const endBeat = ev.start + beats(ev);
  const midi = eventMidi(ev, part);
  const next = part.events.find((n) => !n.rest && n !== ev && n.start === endBeat && eventMidi(n, part) === midi);
  let x2 = x + 28;
  if (next) {
    const np = beatToPos(next.start, p);
    x2 = np.row === row ? np.x : LEFT + MPR * state.bpm * BEAT_W - 6;
  }
  x2 = Math.max(x2, x + 14);
  const dir = ev.step < 4 ? 1 : -1; // opposite the stem: below for stem-up notes
  const y = stepToY(ev.step, top) + 9 * dir;
  return `<path d="M ${x + 3} ${y} Q ${(x + x2) / 2} ${y + 10 * dir} ${x2 - 3} ${y}" fill="none" ` +
         `stroke="${partColor(p)}" stroke-width="1.8" opacity="${opacity}"/>`;
}

function dynamicSVG(start, p, mark, opacity = 1) {
  const { x, top } = beatToPos(start, p);
  return `<text x="${x}" y="${top + 4 * L + 38}" font-size="17" font-style="italic" font-weight="bold" ` +
         `text-anchor="middle" font-family="Georgia,serif" fill="${partColor(p)}" opacity="${opacity}">${mark}</text>`;
}

function render() {
  if (activePart >= state.parts.length) activePart = state.parts.length - 1;
  const bpm = state.bpm;
  const nParts = state.parts.length;
  const rows = Math.ceil(state.measures / MPR);
  const W = LEFT + MPR * bpm * BEAT_W + 20;
  const H = staffTop(rows - 1, nParts - 1) + 4 * L + 40;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  hit.setAttribute('width', W);
  hit.setAttribute('height', H);

  let out = '';
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(MPR, state.measures - r * MPR);
    const w = inRow * bpm * BEAT_W;

    if (nParts > 1) {
      // Line joining the staves of this system
      out += `<line x1="${LEFT}" x2="${LEFT}" y1="${staffTop(r, 0)}" y2="${staffTop(r, nParts - 1) + 4 * L}" stroke="#111" stroke-width="2"/>`;
    }

    for (let p = 0; p < nParts; p++) {
      const top = staffTop(r, p);
      const color = partColor(p);

      if (nParts > 1 && p === activePart) {
        out += `<rect x="0" y="${top - 26}" width="${W}" height="${4 * L + 52}" fill="${color}" opacity="0.07"/>`;
      }
      if (nParts > 1) {
        const label = INSTRUMENTS[state.parts[p].instrument].label.slice(0, 13);
        out += `<text x="14" y="${top - 10}" font-size="11" font-weight="bold" fill="${color}">${label}</text>`;
      }

      for (let i = 0; i < 5; i++) {
        const ly = top + i * L;
        out += `<line x1="${LEFT}" x2="${LEFT + w}" y1="${ly}" y2="${ly}" stroke="#111" stroke-width="1"/>`;
      }
      for (let k = 0; k <= inRow; k++) {
        const bx = LEFT + k * bpm * BEAT_W;
        const last = r * MPR + k === state.measures;
        out += `<line x1="${bx}" x2="${bx}" y1="${top}" y2="${top + 4 * L}" stroke="#111" stroke-width="${last ? 3 : 1.2}"/>`;
        if (p === 0 && k < inRow) {
          out += `<text x="${bx + 3}" y="${top - 8}" font-size="10" fill="#999">${r * MPR + k + 1}</text>`;
        }
      }
      // Left edge line + clef
      out += `<line x1="${LEFT}" x2="${LEFT}" y1="${top}" y2="${top + 4 * L}" stroke="#111" stroke-width="1.2"/>`;
      const part = state.parts[p];
      if (part.clef === 'bass') {
        out += `<circle cx="22" cy="${top + L}" r="4.5" fill="#111"/>` +
               `<path d="M 18 ${top + L - 2} Q 36 ${top + L - 4} 34 ${top + L + 12} Q 31 ${top + 3 * L + 6} 14 ${top + 4 * L + 2}" ` +
               `fill="none" stroke="#111" stroke-width="3.5" stroke-linecap="round"/>` +
               `<circle cx="44" cy="${top + L - 6}" r="2.6" fill="#111"/><circle cx="44" cy="${top + L + 6}" r="2.6" fill="#111"/>`;
      } else {
        out += `<text x="14" y="${top + 4 * L + 4}" font-size="72" fill="#111" ` +
               `font-family="'Noto Music','Apple Symbols','Bravura Text',serif">&#x1D11E;</text>`;
      }
      // Key signature
      const key = KEYS[state.key];
      for (let i = 0; i < key.n; i++) {
        const s = KEY_STEPS[key.type][i] - (part.clef === 'bass' ? 2 : 0);
        out += `<text x="${68 + i * 10}" y="${stepToY(s, top) + 6}" font-size="20" text-anchor="middle" fill="#111">${key.type === '#' ? '♯' : '♭'}</text>`;
      }
      if (r === 0) {
        const tx = 68 + key.n * 10 + 16;
        out += `<text x="${tx}" y="${top + 2 * L - 2}" font-size="28" font-weight="bold" text-anchor="middle" font-family="Georgia,serif">${bpm}</text>`;
        out += `<text x="${tx}" y="${top + 4 * L - 2}" font-size="28" font-weight="bold" text-anchor="middle" font-family="Georgia,serif">4</text>`;
      }
    }
  }

  state.parts.forEach((part, p) => {
    const opacity = part.muted ? 0.35 : 1;
    for (const ev of part.events) {
      out += noteSVG(ev, opacity, p);
      if (ev.tie && !ev.rest) out += tieSVG(ev, p, opacity);
    }
    for (const d of part.dynamics) out += dynamicSVG(d.start, p, d.mark, opacity);
  });
  scoreG.innerHTML = out;
  syncControls();
}

function syncControls() {
  $('title').value = state.title;
  $('tempo').value = state.tempo;
  $('timesig').value = String(state.bpm);
  $('measures-count').textContent = state.measures;
  $('keysig').value = state.key;
  renderParts();
}

function instrumentGroups() {
  const listed = new Set(Object.values(CATEGORIES).flat());
  const groups = { ...CATEGORIES };
  const others = Object.keys(INSTRUMENTS).filter((id) => !listed.has(id));
  if (others.length) groups.Other = others;
  return groups;
}

function renderParts() {
  const panel = $('parts');
  panel.innerHTML = '';
  const groups = instrumentGroups();

  state.parts.forEach((part, i) => {
    const row = document.createElement('div');
    row.className = 'part' + (i === activePart ? ' active' : '');
    row.style.setProperty('--part-color', PART_COLORS[i % PART_COLORS.length]);

    const pick = document.createElement('button');
    pick.className = 'part-pick';
    pick.textContent = `Part ${i + 1}`;
    pick.title = 'Write notes into this part';
    pick.addEventListener('click', () => { activePart = i; render(); });

    const sel = document.createElement('select');
    sel.setAttribute('aria-label', `Part ${i + 1} instrument`);
    for (const [name, ids] of Object.entries(groups)) {
      const group = document.createElement('optgroup');
      group.label = name;
      for (const id of ids) {
        if (!INSTRUMENTS[id]) continue;
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = INSTRUMENTS[id].label;
        group.appendChild(opt);
      }
      sel.appendChild(group);
    }
    sel.value = part.instrument;
    sel.addEventListener('change', () => {
      snapshot();
      part.instrument = sel.value;
      activePart = i;
      commit();
      previewNote(64, part.instrument);
    });

    const clefSel = document.createElement('select');
    clefSel.setAttribute('aria-label', `Part ${i + 1} clef`);
    for (const [value, text] of [['treble', 'Treble clef'], ['bass', 'Bass clef']]) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = text;
      clefSel.appendChild(opt);
    }
    clefSel.value = part.clef;
    clefSel.addEventListener('change', () => {
      snapshot();
      part.clef = clefSel.value;
      activePart = i;
      commit();
    });

    const muteLabel = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = part.muted;
    cb.addEventListener('change', () => { part.muted = cb.checked; commit(); });
    muteLabel.append(cb, ' Mute');

    row.append(pick, sel, clefSel, muteLabel);

    if (state.parts.length > 1) {
      const del = document.createElement('button');
      del.textContent = 'Remove';
      del.addEventListener('click', () => {
        if (part.events.length && !confirm(`Remove Part ${i + 1} and its notes?`)) return;
        snapshot();
        state.parts.splice(i, 1);
        activePart = Math.min(activePart, state.parts.length - 1);
        commit();
      });
      row.append(del);
    }
    panel.append(row);
  });

  const add = document.createElement('button');
  add.textContent = '+ Add Part';
  add.disabled = state.parts.length >= MAX_PARTS;
  add.addEventListener('click', () => {
    snapshot();
    state.parts.push(defaultPart(state.parts.length));
    activePart = state.parts.length - 1;
    commit();
  });
  panel.append(add);
}

// ---------- Editing ----------
function placeAt(cell) {
  snapshot();
  const part = state.parts[cell.part];

  if (tool.dyn) {
    const existing = part.dynamics.find((d) => d.start === cell.start);
    part.dynamics = part.dynamics.filter((d) => d.start !== cell.start);
    if (!existing || existing.mark !== tool.dyn) part.dynamics.push({ start: cell.start, mark: tool.dyn });
    commit();
    return;
  }

  const evs = part.events;
  const sameStart = evs.filter((e) => e.start === cell.start);

  if (tool.rest) {
    const existing = sameStart.find((e) => e.rest);
    part.events = evs.filter((e) => e.start !== cell.start);
    if (!existing) {
      part.events.push({ start: cell.start, dur: tool.dur, dot: tool.dot, step: 0, acc: null, rest: true, tie: false, art: '' });
    }
  } else {
    const existing = sameStart.find((e) => !e.rest && e.step === cell.step);
    part.events = evs.filter((e) => !(e.start === cell.start && (e.rest || e === existing)));
    if (!existing) {
      part.events.push({
        start: cell.start, dur: tool.dur, dot: tool.dot, step: cell.step,
        acc: tool.acc, rest: false, tie: tool.tie, art: tool.art
      });
      const acc = resolveAcc(tool.acc, cell.step, part.clef);
      previewNote(stepToMidi(cell.step, acc, part.clef), part.instrument);
    }
  }
  commit();
}

function trimEvents() {
  const total = state.measures * state.bpm;
  for (const part of state.parts) {
    part.events = part.events.filter((e) => e.start + beats(e) <= total);
    part.dynamics = part.dynamics.filter((d) => d.start < total);
  }
}

function setMeasures(n) {
  n = Math.min(64, Math.max(1, n));
  if (n === state.measures) return;
  snapshot();
  state.measures = n;
  trimEvents();
  commit();
}

hit.addEventListener('click', (e) => {
  const cell = pointerToCell(e);
  if (!cell) return;
  activePart = cell.part;
  placeAt(cell);
});

hit.addEventListener('mousemove', (e) => {
  const cell = pointerToCell(e);
  if (!cell) {
    ghostG.innerHTML = '';
    return;
  }
  const clef = state.parts[cell.part].clef;
  const ev = {
    start: cell.start, dur: tool.dur, dot: tool.dot, step: cell.step,
    acc: tool.acc, rest: tool.rest, tie: false, art: tool.art
  };
  ghostG.innerHTML = tool.dyn
    ? dynamicSVG(cell.start, cell.part, tool.dyn, 0.35)
    : noteSVG(ev, 0.35, cell.part);
  const beat = cell.start % state.bpm;
  const where = `Part ${cell.part + 1}, measure ${Math.floor(cell.start / state.bpm) + 1}, beat ${beat + 1}`;
  if (tool.dyn) status.textContent = `Dynamic ${tool.dyn} – ${where}`;
  else if (tool.rest) status.textContent = `Rest – ${where}`;
  else status.textContent = `${stepName(cell.step, resolveAcc(tool.acc, cell.step, clef), clef)} – ${where}`;
});

hit.addEventListener('mouseleave', () => { ghostG.innerHTML = ''; });

// ---------- Toolbar ----------
function setRadio(containerId, attr, value) {
  $(containerId).querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset[attr] === String(value));
  });
}

function bindRadio(containerId, attr, apply) {
  $(containerId).addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) apply(btn.dataset[attr]);
  });
}

// Choosing a note length goes back to writing notes (leaves dynamics mode)
function setDuration(v) {
  tool.dur = v;
  setRadio('durations', 'dur', v);
  setDynamic('');
}
function setAccidental(v) {
  tool.acc = v;
  setRadio('accidentals', 'acc', v === null ? 'key' : v);
}
function setArticulation(v) {
  tool.art = v;
  setRadio('articulations', 'art', v);
}
function setDynamic(v) {
  tool.dyn = v;
  setRadio('dynamics', 'dyn', v);
}
function toggleFlag(name) {
  tool[name] = !tool[name];
  $(name).setAttribute('aria-pressed', String(tool[name]));
}
const toggleRest = () => toggleFlag('rest');

bindRadio('durations', 'dur', (v) => setDuration(Number(v)));
bindRadio('accidentals', 'acc', (v) => setAccidental(v === 'key' ? null : Number(v)));
bindRadio('articulations', 'art', setArticulation);
bindRadio('dynamics', 'dyn', setDynamic);
$('rest').addEventListener('click', () => toggleFlag('rest'));
$('dot').addEventListener('click', () => toggleFlag('dot'));
$('tie').addEventListener('click', () => toggleFlag('tie'));

$('keysig').addEventListener('change', (e) => {
  snapshot();
  state.key = e.target.value;
  commit();
});

$('title').addEventListener('input', (e) => {
  state.title = e.target.value;
  commit();
});

$('tempo').addEventListener('change', (e) => {
  const v = Math.min(240, Math.max(30, Number(e.target.value) || 100));
  state.tempo = v;
  commit();
});

$('timesig').addEventListener('change', (e) => {
  snapshot();
  state.bpm = Number(e.target.value) === 3 ? 3 : 4;
  trimEvents();
  commit();
});

$('measures-plus').addEventListener('click', () => setMeasures(state.measures + 1));
$('measures-minus').addEventListener('click', () => setMeasures(state.measures - 1));

function undo() {
  const prev = history.pop();
  if (!prev) return;
  state = JSON.parse(prev);
  commit();
}
$('undo').addEventListener('click', undo);

// ---------- AutoCorrect ----------
const NOTE_VALUES = [
  { dur: 4, dot: false }, { dur: 2, dot: true }, { dur: 2, dot: false },
  { dur: 1, dot: true }, { dur: 1, dot: false }, { dur: 0.5, dot: true },
  { dur: 0.5, dot: false }, { dur: 0.25, dot: false }
];

// Break a length (in beats) into the fewest standard note values
function splitLength(len) {
  const out = [];
  for (const v of NOTE_VALUES) {
    while (len >= beats(v) - 1e-6) {
      out.push(v);
      len -= beats(v);
    }
  }
  return out;
}

// Re-write an event as consecutive pieces covering `len` beats; notes are tied together
function fitPieces(ev, start, len, lastTie) {
  let at = start;
  const vals = splitLength(len);
  return vals.map((v, i) => {
    const piece = { ...ev, start: at, dur: v.dur, dot: v.dot, tie: !ev.rest && (i < vals.length - 1 || lastTie) };
    at += beats(v);
    return piece;
  });
}

function autoCorrect() {
  const EPS = 1e-6;
  const next = JSON.parse(JSON.stringify(state));
  const fx = { rests: 0, split: 0, removed: 0, ties: 0 };
  const bpm = next.bpm;
  const total = next.measures * bpm;
  const blank = { step: 0, acc: null, rest: true, tie: false, art: '' };

  for (const part of next.parts) {
    // 1. Notes that run over a barline or past the end are split into tied pieces
    const flat = [];
    for (const ev of part.events) {
      const s = ev.start;
      const e = s + beats(ev);
      if (s >= total - EPS) { fx.removed++; continue; }
      const end = Math.min(e, total);
      const cuts = [s];
      for (let b = (Math.floor(s / bpm + EPS) + 1) * bpm; b < end - EPS; b += bpm) cuts.push(b);
      cuts.push(end);
      if (cuts.length === 2 && end === e) { flat.push(ev); continue; }
      fx.split++;
      for (let i = 0; i < cuts.length - 1; i++) {
        const last = i === cuts.length - 2;
        flat.push(...fitPieces(ev, cuts[i], cuts[i + 1] - cuts[i], last ? end === e && ev.tie : true));
      }
    }

    // 2. Per measure: remove clashes, trim overlaps, fill gaps with rests
    const out = [];
    for (let m = 0; m < next.measures; m++) {
      const lo = m * bpm;
      const hi = lo + bpm;
      const inM = flat.filter((e) => e.start >= lo - EPS && e.start < hi - EPS);
      if (!inM.length) continue;
      const starts = [...new Set(inM.map((e) => e.start))].sort((a, b) => a - b);
      let cursor = lo;
      starts.forEach((s, i) => {
        let g = inM.filter((e) => e.start === s);
        const before = g.length;
        if (g.some((e) => !e.rest)) g = g.filter((e) => !e.rest);
        g = g.filter((e, idx) => g.findIndex((x) => x.rest === e.rest && (e.rest || x.step === e.step)) === idx);
        fx.removed += before - g.length;

        if (s > cursor + EPS) {
          out.push(...fitPieces(blank, cursor, s - cursor, false));
          fx.rests++;
        }
        const nextStart = i + 1 < starts.length ? starts[i + 1] : hi;
        let gEnd = s;
        for (const e of g) {
          if (s + beats(e) > nextStart + EPS) {
            fx.split++;
            out.push(...fitPieces(e, s, nextStart - s, false));
            gEnd = Math.max(gEnd, nextStart);
          } else {
            out.push(e);
            gEnd = Math.max(gEnd, s + beats(e));
          }
        }
        cursor = gEnd;
      });
      if (cursor < hi - EPS) {
        out.push(...fitPieces(blank, cursor, hi - cursor, false));
        fx.rests++;
      }
    }
    out.sort((a, b) => a.start - b.start);

    // 3. A tie needs a following note of the same pitch right after it
    for (const e of out) {
      if (!e.tie) continue;
      const endAt = e.start + beats(e);
      const ok = !e.rest && out.some((n) => !n.rest && Math.abs(n.start - endAt) < EPS && eventMidi(n, part) === eventMidi(e, part));
      if (!ok) { e.tie = false; fx.ties++; }
    }
    part.events = out;

    // 4. One dynamic mark per position, none past the end
    const dyn = new Map();
    for (const d of part.dynamics) {
      if (d.start >= total) { fx.removed++; continue; }
      if (dyn.has(d.start)) fx.removed++;
      dyn.set(d.start, d);
    }
    part.dynamics = [...dyn.values()];
  }

  if (JSON.stringify(next) === JSON.stringify(state)) {
    status.textContent = 'AutoCorrect: no errors found.';
    return;
  }
  snapshot();
  state = next;
  commit();
  const parts = [];
  if (fx.rests) parts.push(`${fx.rests} incomplete bar${fx.rests > 1 ? 's' : ''} filled with rests`);
  if (fx.split) parts.push(`${fx.split} note${fx.split > 1 ? 's' : ''} fitted to the bar`);
  if (fx.removed) parts.push(`${fx.removed} clashing or out-of-range item${fx.removed > 1 ? 's' : ''} removed`);
  if (fx.ties) parts.push(`${fx.ties} broken tie${fx.ties > 1 ? 's' : ''} cleared`);
  status.textContent = `AutoCorrect: ${parts.join(', ') || 'tidied'}. Undo to revert.`;
}
$('autocorrect').addEventListener('click', autoCorrect);

$('clear').addEventListener('click', () => {
  if (state.parts.every((p) => !p.events.length)) return;
  if (!confirm('Remove all notes from every part?')) return;
  snapshot();
  for (const p of state.parts) p.events = [];
  commit();
});

$('save').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (state.title.replace(/[^\w\- ]+/g, '').trim() || 'composition') + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

$('load').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const loaded = sanitize(JSON.parse(await file.text()));
    if (!loaded) throw new Error('Invalid file');
    snapshot();
    state = loaded;
    commit();
  } catch (_) {
    alert('Could not load that file.');
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    window.print();
    return;
  }
  if (e.target.matches('input, select, textarea')) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  switch (e.key.toLowerCase()) {
    case '1': setDuration(4); break;
    case '2': setDuration(2); break;
    case '3': setDuration(1); break;
    case '4': setDuration(0.5); break;
    case '5': setDuration(0.25); break;
    case 'r': toggleRest(); break;
    case 'd': toggleFlag('dot'); break;
    case 't': toggleFlag('tie'); break;
    case '.': setArticulation(tool.art === 'stac' ? '' : 'stac'); break;
    case 'a': setArticulation(tool.art === 'acc' ? '' : 'acc'); break;
    case 'k': setAccidental(null); break;
    case 'n': setAccidental(0); break;
    case 's': setAccidental(1); break;
    case 'f': setAccidental(-1); break;
    case ' ': e.preventDefault(); playing ? stop() : play(); break;
  }
});

// ---------- Audio ----------
let ctx = null;
let master = null;
let playing = null;
let playToken = 0;

const OUTPUT_KEY = 'composer-output-id';
const HEADPHONE_RE = /headphone|headset|airpods|earbuds|earphones|bluetooth/i;

// Prefer a saved device, then anything that looks like headphones, else the system default.
async function routeOutput() {
  if (!ctx || typeof ctx.setSinkId !== 'function' || !navigator.mediaDevices) return;
  try {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
    const saved = localStorage.getItem(OUTPUT_KEY);
    const target = devices.find((d) => d.deviceId === saved) ||
                   devices.find((d) => HEADPHONE_RE.test(d.label));
    await ctx.setSinkId(target ? target.deviceId : '');
  } catch (_) { /* fall back to system default */ }
}

function ensureAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    routeOutput();
    if (navigator.mediaDevices) navigator.mediaDevices.addEventListener('devicechange', routeOutput);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

// ---------- Sampled instruments ----------
// Real recorded notes from the FluidR3 General MIDI soundfont, fetched on first use and cached.
// Instruments without an entry (or if the download fails) use the synthesized preset instead.
// Format: id -> [soundfont name, semitone shift]
const SF_BASE = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/';
const SAMPLED = {
  piano: ['acoustic_grand_piano', 0], brightPiano: ['bright_acoustic_piano', 0], honkyTonk: ['honkytonk_piano', 0],
  epiano: ['electric_piano_1', 0], harpsichord: ['harpsichord', 0], celesta: ['celesta', 0],
  organ: ['church_organ', 0], jazzOrgan: ['drawbar_organ', 0], accordion: ['accordion', 0],
  clavinet: ['clavinet', 0], harmonica: ['harmonica', 0],
  violin: ['violin', 0], viola: ['viola', 0], cello: ['cello', 0], doubleBass: ['contrabass', -12],
  strings: ['string_ensemble_1', 0], harp: ['orchestral_harp', 0], guitar: ['acoustic_guitar_nylon', 0],
  steelGuitar: ['acoustic_guitar_steel', 0], electricGuitar: ['electric_guitar_clean', 0], banjo: ['banjo', 0],
  mandolin: ['acoustic_guitar_steel', 0], ukulele: ['acoustic_guitar_nylon', 0], pizzicato: ['pizzicato_strings', 0],
  piccolo: ['piccolo', 0], flute: ['flute', 0], altoFlute: ['flute', -5], panFlute: ['pan_flute', 0],
  recorder: ['recorder', 0], oboe: ['oboe', 0], englishHorn: ['english_horn', 0], clarinet: ['clarinet', 0],
  bassClarinet: ['clarinet', -12], bassoon: ['bassoon', 0],
  sopranoSax: ['soprano_sax', 0], altoSax: ['alto_sax', 0], tenorSax: ['tenor_sax', 0], baritoneSax: ['baritone_sax', 0],
  trumpet: ['trumpet', 0], mutedTrumpet: ['muted_trumpet', 0], frenchHorn: ['french_horn', 0],
  trombone: ['trombone', 0], tuba: ['tuba', 0], brass: ['brass_section', 0],
  marimba: ['marimba', 0], xylophone: ['xylophone', 0], vibraphone: ['vibraphone', 0],
  glockenspiel: ['glockenspiel', 0], musicBox: ['music_box', 0], kalimba: ['kalimba', 0],
  steelDrum: ['steel_drums', 0], bell: ['tubular_bells', 0], tubularBells: ['tubular_bells', 0],
  synth: ['lead_1_square', 0], sawLead: ['lead_2_sawtooth', 0], warmPad: ['pad_2_warm', 0], bass: ['electric_bass_finger', 0],
  choir: ['choir_aahs', 0], ooh: ['voice_oohs', 0]
};

const soundfonts = {}; // soundfont name -> { raw: {midi: dataURI}, buffers: Map(midi -> Promise|AudioBuffer), loading: Promise, failed }
const NOTE_OFFSETS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function noteNameToMidi(name) {
  const m = /^([A-G])(b?)(\d)$/.exec(name);
  return m ? (Number(m[3]) + 1) * 12 + NOTE_OFFSETS[m[1]] - (m[2] ? 1 : 0) : null;
}

function sfLoad(name) {
  if (soundfonts[name]) return soundfonts[name].loading;
  const sf = soundfonts[name] = { raw: {}, buffers: new Map(), failed: false };
  sf.loading = fetch(`${SF_BASE}${name}-mp3.js`)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then((text) => {
      const re = /"([A-G]b?\d)"\s*:\s*"(data:audio\/mp3;base64,[^"]+)"/g;
      let m;
      while ((m = re.exec(text))) sf.raw[noteNameToMidi(m[1])] = m[2].replace(/\s+/g, '');
      if (!Object.keys(sf.raw).length) throw new Error('empty soundfont');
    })
    .catch(() => { sf.failed = true; });
  return sf.loading;
}

function nearestSample(sf, midi) {
  let best = null;
  for (const k of Object.keys(sf.raw)) {
    const n = Number(k);
    if (best === null || Math.abs(n - midi) < Math.abs(best - midi)) best = n;
  }
  return best;
}

// Download the soundfont and decode the sample nearest to `midi`.
async function sfPrepare(name, midi) {
  await sfLoad(name);
  const sf = soundfonts[name];
  if (sf.failed) return;
  const root = nearestSample(sf, midi);
  if (!sf.buffers.has(root)) {
    const decode = fetch(sf.raw[root])
      .then((r) => r.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => { sf.buffers.set(root, buffer); })
      .catch(() => { sf.buffers.set(root, null); });
    sf.buffers.set(root, decode);
  }
  await sf.buffers.get(root);
}

// Synchronous lookup of an already-decoded sample.
function sfPick(name, midi) {
  const sf = soundfonts[name];
  if (!sf || sf.failed) return null;
  const root = nearestSample(sf, midi);
  const buffer = sf.buffers.get(root);
  return buffer instanceof AudioBuffer ? { buffer, root } : null;
}

function sampleVoice(sample, target, when, dur, out, inst, vel) {
  const len = Math.max(0.12, dur);
  const end = when + len;
  const release = Math.max(0.06, inst.release);
  const src = ctx.createBufferSource();
  src.buffer = sample.buffer;
  src.playbackRate.value = Math.pow(2, (target - sample.root) / 12);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(0.5 * vel, when + 0.004);
  env.gain.setTargetAtTime(0, end, release);
  src.connect(env).connect(out);
  src.start(when);
  src.stop(end + release * 6 + 0.05);
}

// Make sure every sample the given notes need is downloaded and decoded.
async function prepareSamples(jobs) {
  const todo = jobs.filter((j) => SAMPLED[j.instrument]);
  if (!todo.length) return;
  const needsDownload = todo.some((j) => !soundfonts[SAMPLED[j.instrument][0]]);
  if (needsDownload) status.textContent = 'Loading instrument sounds…';
  await Promise.all(todo.map((j) => {
    const [name, shift] = SAMPLED[j.instrument];
    return sfPrepare(name, j.midi + shift);
  }));
  if (needsDownload) status.textContent = '';
}

function voice(midi, when, dur, out, instrumentId, vel = 1) {
  const inst = INSTRUMENTS[instrumentId] || INSTRUMENTS.piano;
  const sm = SAMPLED[instrumentId];
  if (sm) {
    const sample = sfPick(sm[0], midi + sm[1]);
    if (sample) return sampleVoice(sample, midi + sm[1], when, dur, out, inst, vel);
  }
  const freq = 440 * Math.pow(2, (midi + 12 * (inst.octave || 0) - 69) / 12);
  const len = Math.max(0.12, dur);
  const end = when + len;
  const attack = Math.min(inst.attack, len * 0.5);
  const peak = 0.2 * vel;
  const stopAt = end + inst.release * 6 + 0.05;

  // Amplitude envelope: attack -> decay to sustain level -> release
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(peak, when + attack);
  env.gain.setTargetAtTime(peak * inst.sustain, when + attack, inst.decay);
  env.gain.setTargetAtTime(0, end, inst.release);
  env.connect(out);

  let head = env;
  if (inst.filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = inst.filter.q || 0.7;
    f.frequency.setValueAtTime(Math.min(20000, inst.filter.start * freq), when);
    f.frequency.setTargetAtTime(Math.min(20000, inst.filter.end * freq), when, inst.filter.tc);
    f.connect(env);
    head = f;
  }

  const total = inst.partials.reduce((sum, p) => sum + p[1], 0);
  const mix = ctx.createGain();
  mix.gain.value = 1 / total;
  mix.connect(head);

  let vib = null;
  if (inst.vibrato) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = inst.vibrato.rate;
    vib = ctx.createGain();
    vib.gain.value = inst.vibrato.cents;
    lfo.connect(vib);
    lfo.start(when);
    lfo.stop(stopAt);
  }

  for (const [ratio, gain, type, cents] of inst.partials) {
    const osc = ctx.createOscillator();
    const pg = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq * ratio;
    if (cents) osc.detune.value = cents;
    if (vib) vib.connect(osc.detune);
    pg.gain.value = gain;
    osc.connect(pg).connect(mix);
    osc.start(when);
    osc.stop(stopAt);
  }
}

async function previewNote(midi, instrumentId) {
  if (playing) return;
  ensureAudio();
  await prepareSamples([{ instrument: instrumentId, midi }]);
  voice(midi, ctx.currentTime, 0.6, ctx.destination, instrumentId);
}

// Turn a part's events into playable notes: merges ties, applies dynamics and articulation
function scheduleNotes(part) {
  const notes = part.events.filter((e) => !e.rest).sort((a, b) => a.start - b.start);
  const consumed = new Set();
  const result = [];
  for (const ev of notes) {
    if (consumed.has(ev)) continue;
    const midi = eventMidi(ev, part);
    let len = beats(ev);
    let cur = ev;
    while (cur.tie) {
      const end = cur.start + beats(cur);
      const next = notes.find((n) => n !== cur && !consumed.has(n) && n.start === end && eventMidi(n, part) === midi);
      if (!next) break;
      consumed.add(next);
      len += beats(next);
      cur = next;
    }
    let mark = 'mf';
    let markAt = -1;
    for (const d of part.dynamics) {
      if (d.start <= ev.start && d.start >= markAt) { mark = d.mark; markAt = d.start; }
    }
    result.push({
      midi,
      start: ev.start,
      len,
      gate: ev.art === 'stac' ? 0.4 : 0.95,
      vel: DYNAMICS[mark] * (ev.art === 'acc' ? 1.4 : 1)
    });
  }
  return result;
}

async function play() {
  ensureAudio();
  stop();
  const token = playToken;
  const plans = state.parts.filter((p) => !p.muted).map((part) => ({ part, notes: scheduleNotes(part) }));
  await prepareSamples(plans.flatMap(({ part, notes }) => notes.map((n) => ({ instrument: part.instrument, midi: n.midi }))));
  if (token !== playToken) return; // stopped or restarted while loading

  const spb = 60 / state.tempo;
  const t0 = ctx.currentTime + 0.1;
  master = ctx.createGain();
  master.gain.value = 1 / Math.sqrt(state.parts.length); // headroom for several parts
  master.connect(ctx.destination);

  for (const { part, notes } of plans) {
    for (const n of notes) {
      voice(n.midi, t0 + n.start * spb, n.len * spb * n.gate, master, part.instrument, n.vel);
    }
  }

  playing = { t0, spb, total: state.measures * state.bpm };
  playhead.classList.add('on');
  playToken++;
  requestAnimationFrame(tick);
}

function stop() {
  if (master) {
    master.gain.cancelScheduledValues(0);
    master.gain.value = 0;
    master.disconnect();
    master = null;
  }
  playing = null;
  playhead.classList.remove('on');
}

function tick() {
  if (!playing) return;
  const beat = (ctx.currentTime - playing.t0) / playing.spb;
  if (beat >= playing.total) {
    if ($('loop').checked) play();
    else stop();
    return;
  }
  if (beat >= 0) {
    const pos = beatToPos(beat);
    const x = pos.x - PAD / 2;
    playhead.setAttribute('x1', x);
    playhead.setAttribute('x2', x);
    playhead.setAttribute('y1', pos.top - 24);
    playhead.setAttribute('y2', pos.top + (state.parts.length - 1) * STAFF_H + 4 * L + 28);
  }
  requestAnimationFrame(tick);
}

$('play').addEventListener('click', play);
$('stop').addEventListener('click', stop);

$('output').addEventListener('click', async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.selectAudioOutput) {
    alert('Your browser cannot choose an output device. Use Chrome or Edge, or set it in the macOS sound settings.');
    return;
  }
  try {
    const device = await navigator.mediaDevices.selectAudioOutput();
    localStorage.setItem(OUTPUT_KEY, device.deviceId);
    ensureAudio();
    await routeOutput();
    status.textContent = `Output: ${device.label || 'selected device'}`;
  } catch (_) { /* cancelled */ }
});

// ---------- Init ----------
for (const [id, k] of Object.entries(KEYS)) {
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = k.label;
  $('keysig').appendChild(opt);
}
render();
