/*
  compare.js
  ----------
  Pure logic for the "size comparison" feature: no DOM in here, so it can be
  unit-tested in Node. The UI lives in js/compare-ui.js.

  Every measurement is stored in millimetres. A "thing" (figure or reference
  item) can have any of:  height_mm, width_mm, depth_mm.
  Internally those become the keys  h / w / d.
*/

(function (root) {
  const KEYS = ['h', 'w', 'd'];
  const FIELD = { h: 'height_mm', w: 'width_mm', d: 'depth_mm' };
  const NAME = { h: 'height', w: 'width', d: 'depth' };
  const NAME_CAP = { h: 'Height', w: 'Width', d: 'Depth' };

  // Size bands, smallest to largest. A figure is compared against items in
  // its own band or the next one up, so a 30 mm figure never meets a fridge.
  const BANDS = ['tiny', 'small', 'medium', 'large', 'xlarge', 'huge'];
  const BAND_LIMITS_MM = [40, 200, 500, 1600, 3000]; // upper edge of tiny..xlarge

  // "Friendly" ratios (figure ÷ item) and how much we like each one.
  // Lower weight = preferred when two items are equally close.
  const FRIENDLY = [
    { r: 1, word: null, weight: 0 },
    { r: 1 / 2, word: 'half', weight: 0.02 },
    { r: 2, word: null, weight: 0.02 },
    { r: 3 / 2, word: null, weight: 0.04 },
    { r: 3, word: null, weight: 0.04 },
    { r: 1 / 4, word: 'a quarter', weight: 0.05 },
    { r: 1 / 3, word: 'a third', weight: 0.05 },
    { r: 2 / 3, word: 'two-thirds', weight: 0.05 },
    { r: 3 / 4, word: 'three-quarters', weight: 0.05 },
    { r: 4, word: null, weight: 0.06 },
    { r: 5, word: null, weight: 0.08 },
    { r: 1 / 5, word: 'a fifth', weight: 0.08 },
    { r: 10, word: null, weight: 0.1 },
    { r: 1 / 10, word: 'a tenth', weight: 0.1 },
  ];
  const ABOUT_TOLERANCE = 0.12; // |ln(actual / friendly)| under this => "about"

  const COMMON_SCALES = [6, 7, 8, 10, 12];

  function toNum(v) {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return typeof n === 'number' && isFinite(n) && n > 0 ? n : null;
  }

  /** {h, w, d} in mm (null where missing) for a figure or reference item. */
  function dimsOf(obj) {
    const out = {};
    KEYS.forEach((k) => (out[k] = toNum(obj && obj[FIELD[k]])));
    return out;
  }

  function availableKeys(obj) {
    const dims = dimsOf(obj);
    return KEYS.filter((k) => dims[k] !== null);
  }

  /** A "scale picture" path/URL, or null. Plain image paths and http(s) URLs only. */
  function cleanImage(src) {
    if (typeof src !== 'string') return null;
    const s = src.trim();
    if (!s || /^(javascript|data|vbscript):/i.test(s)) return null;
    return s;
  }

  function slug(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /** Clean a raw reference-items list: drop unusable rows, add ids and dims. */
  function normalizeItems(list) {
    const seen = new Set();
    return (list || [])
      .filter((it) => it && it.name && availableKeys(it).length)
      .map((it) => {
        let id = slug(it.name) || 'item';
        while (seen.has(id)) id += '-2';
        seen.add(id);
        const dims = dimsOf(it);
        return {
          id,
          name: String(it.name),
          dims,
          band: BANDS.includes(it.band) ? it.band : bandOf(Math.max(...KEYS.map((k) => dims[k] || 0))),
          adjustable: !!it.adjustable,
          custom: !!it.custom,
          image: cleanImage(it.image),
        };
      });
  }

  function bandOf(mm) {
    for (let i = 0; i < BAND_LIMITS_MM.length; i++) if (mm < BAND_LIMITS_MM[i]) return BANDS[i];
    return BANDS[BANDS.length - 1];
  }

  /** Items worth comparing a figure of `mm` against: its band and the next one up. */
  function candidates(mm, key, items) {
    const withDim = items.filter((it) => it.dims[key] !== null);
    const i = BANDS.indexOf(bandOf(mm));
    const wanted = new Set([BANDS[i], BANDS[i + 1]]);
    const inBand = withDim.filter((it) => wanted.has(it.band));
    return inBand.length ? inBand : withDim;
  }

  /** How "friendly" is this ratio? Returns { friendly, score } (lower score = friendlier). */
  function nearestFriendly(ratio) {
    let best = null;
    FRIENDLY.forEach((f) => {
      const score = Math.abs(Math.log(ratio / f.r)) + f.weight;
      if (!best || score < best.score) best = { friendly: f, score };
    });
    return best;
  }

  /** Best item for a figure dimension: the one whose ratio lands nearest a friendly number. */
  function pickBest(mm, key, items) {
    const scan = (pool) => {
      let best = null;
      pool.forEach((it) => {
        const ratio = mm / it.dims[key];
        const near = nearestFriendly(ratio);
        if (!best || near.score < best.score) best = { item: it, ratio, score: near.score };
      });
      return best;
    };
    const best = scan(candidates(mm, key, items));
    // Nothing in the neighbouring bands is a good fit (common for width/depth,
    // where few items have that measurement): look across every item instead.
    if (!best || best.score > 0.2) {
      const wide = scan(items.filter((it) => it.dims[key] !== null));
      if (wide && (!best || wide.score < best.score)) return wide;
    }
    return best;
  }

  /** A random item, favouring ones that land close to a friendly ratio. */
  function pickRandom(mm, key, items, excludeId, rand) {
    const rnd = rand || Math.random;
    const pool = candidates(mm, key, items).filter((it) => it.id !== excludeId);
    if (!pool.length) return null;
    const nice = pool.filter((it) => nearestFriendly(mm / it.dims[key]).score < 0.2);
    const from = nice.length ? nice : pool;
    return from[Math.floor(rnd() * from.length)];
  }

  function withArticle(item) {
    if (item.custom) return item.name;
    return (/^[aeiou]/i.test(item.name) ? 'an ' : 'a ') + item.name;
  }

  function lowerFirst(name) {
    // Keep acronyms / proper-ish names (AA, LEGO, A4) intact; lowercase ordinary words.
    return /^[A-Z][a-z]/.test(name) ? name[0].toLowerCase() + name.slice(1) : name;
  }

  function displayName(item) {
    return item.custom ? item.name : lowerFirst(item.name);
  }

  /**
   * Plain-English comparison, e.g. "about half the height of a fridge".
   * `ratio` is figure ÷ item for dimension `key`.
   */
  function describe(ratio, key, item) {
    const dim = NAME[key];
    const shown = { ...item, name: displayName(item) };
    const noun = withArticle(shown);
    const near = nearestFriendly(ratio);
    const close = Math.abs(Math.log(ratio / near.friendly.r)) <= ABOUT_TOLERANCE;

    if (!close) {
      const n = ratio >= 10 ? Math.round(ratio) : Number(ratio.toFixed(2));
      return `roughly ${n}× the ${dim} of ${noun}`;
    }
    const f = near.friendly;
    if (f.r === 1) return `about the same ${dim} as ${noun}`;
    if (f.r < 1) return `about ${f.word} the ${dim} of ${noun}`;
    const times = f.r === 3 / 2 ? '1½' : String(f.r);
    return `about ${times}× the ${dim} of ${noun}`;
  }

  /** "1 : 7" style label, figure to item (item = 7× the figure). */
  function ratioLabel(ratio) {
    const trim = (x) => Number(x.toFixed(1)).toString();
    return ratio >= 1 ? `${trim(ratio)} : 1` : `1 : ${trim(1 / ratio)}`;
  }

  // ---------- units ----------

  const UNITS = ['mm', 'cm', 'in'];

  function num(x, digits) {
    return x.toLocaleString('en-US', { maximumFractionDigits: digits });
  }

  function formatLength(mm, unit) {
    if (unit === 'mm') return `${num(mm, mm < 100 ? 1 : 0)} mm`;
    if (unit === 'in') {
      const inches = mm / 25.4;
      if (inches >= 48) {
        const total = Math.round(inches);
        return `${Math.floor(total / 12)}′ ${total % 12}″`;
      }
      return `${num(inches, 1)} in`;
    }
    const cm = mm / 10;
    return `${num(cm, cm < 100 ? 1 : 0)} cm`;
  }

  /** mm from a value the visitor typed in the given unit. */
  function toMm(value, unit) {
    const v = toNum(value);
    if (v === null) return null;
    return unit === 'in' ? v * 25.4 : unit === 'cm' ? v * 10 : v;
  }

  function fromMm(mm, unit) {
    return unit === 'in' ? mm / 25.4 : unit === 'cm' ? mm / 10 : mm;
  }

  /** Nice ruler tick step (in mm) for a span, in the visitor's unit. */
  function tickStepMm(spanMm, unit) {
    const perUnit = unit === 'in' ? 25.4 : unit === 'cm' ? 10 : 1;
    const span = spanMm / perUnit;
    const rough = span / 6;
    const pow = Math.pow(10, Math.floor(Math.log10(rough)));
    const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) || pow * 10;
    return step * perUnit;
  }

  // ---------- scale (1:7 etc.) ----------

  /** "1/10 Scale", "1:7", "1 / 8" -> 10, 7, 8.  Anything else -> null. */
  function parseScale(text) {
    const m = /(\d+)\s*[/:]\s*(\d+)/.exec(String(text || ''));
    if (!m) return null;
    const a = Number(m[1]);
    const b = Number(m[2]);
    return a === 1 && b > 1 ? b : null;
  }

  const api = {
    KEYS,
    FIELD,
    NAME,
    NAME_CAP,
    BANDS,
    UNITS,
    COMMON_SCALES,
    toNum,
    dimsOf,
    availableKeys,
    normalizeItems,
    cleanImage,
    bandOf,
    candidates,
    nearestFriendly,
    pickBest,
    pickRandom,
    describe,
    displayName,
    ratioLabel,
    formatLength,
    toMm,
    fromMm,
    tickStepMm,
    parseScale,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Compare = api;
})(typeof window !== 'undefined' ? window : globalThis);
