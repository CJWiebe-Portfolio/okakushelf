/*
  compare-ui.js
  -------------
  The "size comparison" feature: text summaries for cards, and the interactive
  comparison panel shown in the figure modal (true-to-scale bars, ruler, unit
  toggle, item picker, "surprise me", person-height slider, custom item,
  scale guide). The maths and wording live in js/compare.js.
*/

const CompareUI = (function () {
  const C = Compare;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const UNIT_KEY = 'otakushelf.unit';
  const BAND_LABEL = { tiny: 'Tiny', small: 'Small', medium: 'Medium', large: 'Large', xlarge: 'X-Large', huge: 'Huge' };

  let refItems = [];
  let unit = 'cm';
  const unitListeners = [];
  let activePanel = null;

  try {
    const saved = localStorage.getItem(UNIT_KEY);
    if (C.UNITS.includes(saved)) unit = saved;
  } catch (e) {
    /* storage blocked: fall back to cm */
  }

  // ---------- tiny DOM helpers ----------

  function el(tag, props, ...kids) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    });
    kids.forEach((kid) => kid && node.append(kid));
    return node;
  }

  function svg(tag, attrs, text) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const fmt = (mm) => C.formatLength(mm, unit);
  const clip = (name, n = 20) => (name.length > n ? `${name.slice(0, n - 1)}…` : name);

  function tickLabel(mm) {
    return Number(C.fromMm(mm, unit).toFixed(2)).toLocaleString('en-US');
  }

  // ---------- units ----------

  function getUnit() {
    return unit;
  }

  function setUnit(next) {
    if (!C.UNITS.includes(next) || next === unit) return;
    unit = next;
    try {
      localStorage.setItem(UNIT_KEY, unit);
    } catch (e) {
      /* fine: preference just won't persist */
    }
    unitListeners.slice().forEach((fn) => fn(unit));
  }

  function onUnitChange(fn) {
    unitListeners.push(fn);
    return () => {
      const i = unitListeners.indexOf(fn);
      if (i >= 0) unitListeners.splice(i, 1);
    };
  }

  function init(items) {
    refItems = items || [];
  }

  // ---------- text summaries (cards, featured piece, modal details) ----------

  function primaryKey(dims) {
    return dims.h ? 'h' : C.KEYS.find((k) => dims[k]);
  }

  /** "H 24.5 cm · W 12 cm · D 10 cm", or '' when the figure has no measurements. */
  function sizeText(fig) {
    const dims = C.dimsOf(fig);
    return C.KEYS.filter((k) => dims[k])
      .map((k) => `${k.toUpperCase()} ${fmt(dims[k])}`)
      .join(' · ');
  }

  function bestFor(fig) {
    const dims = C.dimsOf(fig);
    const key = primaryKey(dims);
    if (!key) return null;
    const best = C.pickBest(dims[key], key, refItems);
    return best ? { key, mm: dims[key], best } : null;
  }

  /** "about half the height of a fridge" for the figure's main measurement, or ''. */
  function comparison(fig) {
    const found = bestFor(fig);
    return found ? C.describe(found.best.ratio, found.key, found.best.item) : '';
  }

  /** Short line for gallery cards: "24.5 cm · about half the height of a fridge". */
  function cardLine(fig) {
    const found = bestFor(fig);
    if (!found) return '';
    return `${fmt(found.mm)} · ${C.describe(found.best.ratio, found.key, found.best.item)}`;
  }

  // ---------- the interactive panel ----------

  function drawScene(stage, key, aMm, bMm, aName, bName) {
    stage.textContent = '';
    const vertical = key === 'h';
    const max = Math.max(aMm, bMm);
    const step = C.tickStepMm(max, unit);
    const root = svg('svg', {
      viewBox: vertical ? '0 0 340 310' : '0 0 340 196',
      class: 'compare-svg',
      role: 'img',
      'aria-label': `${aName}, ${fmt(aMm)}, drawn to scale beside ${bName}, ${fmt(bMm)}`,
    });
    const ticks = [];
    for (let i = 0; i * step <= max * 1.0001; i++) ticks.push(i * step);

    if (vertical) {
      const ground = 262;
      const top = 42;
      const axisX = 46;
      const scale = (ground - top) / max;
      ticks.forEach((t) => {
        const y = ground - t * scale;
        root.append(svg('line', { class: 'cmp-grid', x1: axisX, x2: 330, y1: y, y2: y }));
        root.append(svg('text', { class: 'cmp-tick', x: axisX - 6, y: y + 3.5, 'text-anchor': 'end' }, tickLabel(t)));
      });
      root.append(svg('line', { class: 'cmp-axis', x1: axisX, x2: axisX, y1: top - 10, y2: ground }));
      root.append(svg('text', { class: 'cmp-unit', x: axisX, y: 18, 'text-anchor': 'middle' }, unit));
      [
        { mm: aMm, x: 104, cls: 'cmp-fig', name: aName },
        { mm: bMm, x: 210, cls: 'cmp-item', name: bName },
      ].forEach((bar) => {
        const h = Math.max(bar.mm * scale, 2);
        const title = svg('title', {}, `${bar.name}: ${fmt(bar.mm)}`);
        const rect = svg('rect', { class: bar.cls, x: bar.x, y: ground - h, width: 64, height: h, rx: 3 });
        rect.append(title);
        root.append(rect);
        root.append(svg('text', { class: 'cmp-val', x: bar.x + 32, y: ground - h - 7, 'text-anchor': 'middle' }, fmt(bar.mm)));
        root.append(svg('text', { class: 'cmp-name', x: bar.x + 32, y: ground + 20, 'text-anchor': 'middle' }, clip(bar.name)));
      });
    } else {
      const left = 24;
      const right = 316;
      const axisY = 150;
      const scale = (right - left) / max;
      ticks.forEach((t) => {
        const x = left + t * scale;
        root.append(svg('line', { class: 'cmp-grid', x1: x, x2: x, y1: 14, y2: axisY }));
        root.append(svg('text', { class: 'cmp-tick', x, y: axisY + 15, 'text-anchor': 'middle' }, tickLabel(t)));
      });
      root.append(svg('line', { class: 'cmp-axis', x1: left, x2: right, y1: axisY, y2: axisY }));
      root.append(svg('text', { class: 'cmp-unit', x: right, y: 182, 'text-anchor': 'end' }, unit));
      [
        { mm: aMm, y: 30, cls: 'cmp-fig', name: aName },
        { mm: bMm, y: 92, cls: 'cmp-item', name: bName },
      ].forEach((bar) => {
        const w = Math.max(bar.mm * scale, 2);
        const rect = svg('rect', { class: bar.cls, x: left, y: bar.y, width: w, height: 30, rx: 3 });
        rect.append(svg('title', {}, `${bar.name}: ${fmt(bar.mm)}`));
        root.append(rect);
        root.append(svg('text', { class: 'cmp-val', x: left, y: bar.y - 7, 'text-anchor': 'start' }, `${clip(bar.name, 26)} · ${fmt(bar.mm)}`));
      });
    }
    stage.append(root);
  }

  function unmount() {
    if (activePanel) activePanel();
    activePanel = null;
  }

  function mount(container, fig) {
    unmount();
    container.textContent = '';
    const dims = C.dimsOf(fig);
    const keys = C.KEYS.filter((k) => dims[k]);
    if (!keys.length || !refItems.length) {
      container.hidden = true;
      return;
    }
    container.hidden = false;

    const state = {
      key: primaryKey(dims),
      selectedId: 'auto',
      // Copies, so the person-height slider can't change the shared originals.
      pool: refItems.map((it) => ({ ...it, dims: { ...it.dims } })),
      customCount: 0,
    };
    const autoPool = () => state.pool.filter((it) => !it.custom);
    const figMm = () => dims[state.key];

    function current() {
      let item = state.selectedId === 'auto' ? null : state.pool.find((it) => it.id === state.selectedId);
      if (item && item.dims[state.key] === null) {
        item = null;
        state.selectedId = 'auto';
      }
      if (!item) {
        const best = C.pickBest(figMm(), state.key, autoPool());
        item = best ? best.item : null;
      }
      return item;
    }

    // --- static shell ---
    const unitBtns = C.UNITS.map((u) =>
      el('button', { type: 'button', class: 'seg-btn', text: u, onclick: () => setUnit(u) })
    );
    const dimBtns = keys.map((k) =>
      el('button', {
        type: 'button',
        class: 'seg-btn',
        text: C.NAME_CAP[k],
        onclick: () => {
          state.key = k;
          update();
        },
      })
    );
    const stage = el('div', { class: 'compare-stage' });
    const caption = el('p', { class: 'compare-caption', 'aria-live': 'polite' });
    const ratioLine = el('p', { class: 'compare-ratio' });

    const select = el('select', { id: 'compareItem', class: 'compare-select' });
    select.addEventListener('change', () => {
      state.selectedId = select.value;
      update();
    });
    const surprise = el('button', {
      type: 'button',
      class: 'btn-small',
      text: 'Surprise me',
      onclick: () => {
        const cur = current();
        const pick = C.pickRandom(figMm(), state.key, autoPool(), cur && cur.id, Math.random);
        if (pick) state.selectedId = pick.id;
        update();
      },
    });

    const slider = el('input', { type: 'range', id: 'comparePerson', min: '1000', max: '2100', step: '10', value: '1700' });
    const sliderOut = el('output', { for: 'comparePerson' });
    slider.addEventListener('input', () => {
      const person = state.pool.find((it) => it.adjustable);
      if (person) person.dims.h = Number(slider.value);
      update();
    });
    const personRow = el(
      'div',
      { class: 'compare-person' },
      el('label', { for: 'comparePerson', text: 'Person’s height' }),
      slider,
      sliderOut
    );

    const nameInput = el('input', { type: 'text', maxlength: '40', placeholder: 'e.g. my desk', 'aria-label': 'Item name' });
    const sizeInput = el('input', { type: 'number', min: '0', step: 'any', placeholder: 'size', 'aria-label': 'Item size' });
    const customHint = el('p', { class: 'compare-hint' });
    const form = el(
      'form',
      { class: 'compare-form' },
      nameInput,
      sizeInput,
      el('button', { type: 'submit', class: 'btn-small', text: 'Compare' })
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const mm = C.toMm(sizeInput.value, unit);
      if (mm === null) {
        customHint.textContent = 'Enter a size greater than zero.';
        sizeInput.focus();
        return;
      }
      state.customCount += 1;
      state.pool.push({
        id: `custom-${state.customCount}`,
        name: (nameInput.value.trim() || 'Your item').slice(0, 40),
        dims: { h: null, w: null, d: null, [state.key]: mm },
        band: C.bandOf(mm),
        adjustable: false,
        custom: true,
      });
      state.selectedId = `custom-${state.customCount}`;
      nameInput.value = '';
      sizeInput.value = '';
      update();
    });
    const custom = el('details', { class: 'compare-custom' }, el('summary', { text: 'Compare with your own item' }), form, customHint);

    const scaleList = el('ul', { class: 'scale-chips' });
    const scaleNote = el('p', { class: 'compare-hint' });
    const scaleBox = el(
      'div',
      { class: 'compare-scale' },
      el('h4', { text: 'Scale guide' }),
      el('p', { class: 'compare-hint', text: 'Height of the person or character this figure would represent at each scale.' }),
      scaleList,
      scaleNote
    );

    const panel = el(
      'section',
      { class: 'compare', 'aria-label': 'Size comparison' },
      el('div', { class: 'compare-head' }, el('h3', { text: 'Size comparison' }), el('div', { class: 'seg', role: 'group', 'aria-label': 'Units' }, ...unitBtns)),
      keys.length > 1 ? el('div', { class: 'seg compare-dims', role: 'group', 'aria-label': 'Measurement to compare' }, ...dimBtns) : null,
      stage,
      caption,
      ratioLine,
      el('div', { class: 'compare-controls' }, el('label', { for: 'compareItem', text: 'Compare with' }), select, surprise),
      personRow,
      custom,
      dims.h ? scaleBox : null
    );
    container.append(panel);

    // --- dynamic parts ---
    function renderSelect(selected) {
      const key = state.key;
      select.textContent = '';
      select.append(el('option', { value: 'auto', text: 'Best match' }));
      C.BANDS.forEach((band) => {
        const group = state.pool
          .filter((it) => it.band === band && it.dims[key] !== null)
          .sort((a, b) => a.dims[key] - b.dims[key]);
        if (!group.length) return;
        const og = el('optgroup', { label: BAND_LABEL[band] });
        group.forEach((it) => og.append(el('option', { value: it.id, text: `${it.name} — ${fmt(it.dims[key])}` })));
        select.append(og);
      });
      select.value = state.selectedId === 'auto' || !selected ? 'auto' : selected.id;
    }

    function renderScale() {
      if (!dims.h) return;
      const stated = C.parseScale(fig.scale);
      const scales = C.COMMON_SCALES.slice();
      if (stated && !scales.includes(stated)) scales.push(stated);
      scales.sort((a, b) => a - b);
      scaleList.textContent = '';
      scales.forEach((n) =>
        scaleList.append(
          el('li', { class: n === stated ? 'on' : null }, el('strong', { text: `1:${n}` }), el('span', { text: fmt(dims.h * n) }))
        )
      );
      scaleNote.textContent = stated
        ? `At its stated 1:${stated} scale, that’s a character about ${fmt(dims.h * stated)} tall.`
        : '';
    }

    function update() {
      const key = state.key;
      unitBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(C.UNITS[i] === unit)));
      dimBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(keys[i] === key)));
      customHint.textContent = `Compares the ${C.NAME[key]} shown above; enter its size in ${unit}.`;

      const item = current();
      renderSelect(item);
      const showPerson = !!(item && item.adjustable);
      personRow.hidden = !showPerson;
      if (showPerson) {
        slider.value = String(item.dims.h);
        sliderOut.textContent = fmt(item.dims.h);
      }

      if (!item) {
        stage.textContent = '';
        caption.textContent = `No reference item has a ${C.NAME[key]} yet — try adding your own below.`;
        ratioLine.textContent = '';
      } else {
        const itemMm = item.dims[key];
        const ratio = figMm() / itemMm;
        drawScene(stage, key, figMm(), itemMm, fig.name, item.name);
        caption.textContent = `At ${fmt(figMm())}, it’s ${C.describe(ratio, key, item)} (${fmt(itemMm)}).`;
        ratioLine.textContent = `Ratio, figure to ${C.displayName(item)}: ${C.ratioLabel(ratio)}`;
      }
      renderScale();
    }

    const stopListening = onUnitChange(update);
    activePanel = () => {
      stopListening();
      container.textContent = '';
    };
    update();
  }

  return { init, getUnit, setUnit, onUnitChange, sizeText, comparison, cardLine, mount, unmount };
})();
