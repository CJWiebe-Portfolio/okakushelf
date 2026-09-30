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

  // ---------- scale pictures & silhouettes ----------

  // Natural width / height of each picture, loaded once. null = missing or broken.
  const pictureAspects = new Map();

  function loadAspect(src) {
    if (!src) return Promise.resolve(null);
    if (!pictureAspects.has(src)) {
      pictureAspects.set(
        src,
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null);
          img.onerror = () => resolve(null);
          img.src = src;
        })
      );
    }
    return pictureAspects.get(src);
  }

  function cssColor(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  // Filters that turn any picture into a solid silhouette (keeps its outline/alpha,
  // replaces every colour): accent red for the figure, dim grey for the item.
  function silhouetteDefs() {
    const defs = svg('defs');
    [
      ['cmp-sil-fig', cssColor('--accent', '#da0113')],
      ['cmp-sil-item', cssColor('--text-dim', '#9a9ab0')],
    ].forEach(([id, color]) => {
      const f = svg('filter', { id });
      f.append(svg('feFlood', { 'flood-color': color, result: 'fill' }));
      f.append(svg('feComposite', { in: 'fill', in2: 'SourceAlpha', operator: 'in' }));
      defs.append(f);
    });
    return defs;
  }

  /**
   * Draw the two things side by side, true to scale. `a` is the figure, `b` the
   * reference item: { mm, name, image, sil }. `aspects` holds each picture's
   * width/height (or null). Pictures are only used for height comparisons; a
   * picture is drawn at the same scale as the ruler (as a solid silhouette when
   * `sil` is set), and anything without one (or whose picture failed to load)
   * stays a plain bar.
   */
  function drawScene(stage, key, a, b, aspects) {
    stage.textContent = '';
    const vertical = key === 'h';
    const max = Math.max(a.mm, b.mm);
    const step = C.tickStepMm(max, unit);
    const ticks = [];
    for (let i = 0; i * step <= max * 1.0001; i++) ticks.push(i * step);
    const label = `${a.name}, ${fmt(a.mm)}, drawn to scale beside ${b.name}, ${fmt(b.mm)}`;
    let root;

    if (vertical) {
      const ground = 262;
      const top = 42;
      const axisX = 46;
      const gap = 30;
      const scale = (ground - top) / max;
      const objs = [a, b].map((o, i) => {
        const h = Math.max(o.mm * scale, 2);
        const aspect = o.image ? aspects[i] : null;
        return { ...o, h, pic: !!aspect, w: aspect ? h * aspect : 64, cls: i === 0 ? 'cmp-fig' : 'cmp-item' };
      });
      const totalW = objs[0].w + gap + objs[1].w;
      // Wide pictures widen the drawing (everything shrinks together, so it stays to scale).
      const vbW = Math.max(340, axisX + 36 + totalW);
      root = svg('svg', { viewBox: `0 0 ${vbW} 310`, class: 'compare-svg', role: 'img', 'aria-label': label });
      if (objs.some((o) => o.pic && o.sil)) root.append(silhouetteDefs());
      ticks.forEach((t) => {
        const y = ground - t * scale;
        root.append(svg('line', { class: 'cmp-grid', x1: axisX, x2: vbW - 10, y1: y, y2: y }));
        root.append(svg('text', { class: 'cmp-tick', x: axisX - 6, y: y + 3.5, 'text-anchor': 'end' }, tickLabel(t)));
      });
      root.append(svg('line', { class: 'cmp-axis', x1: axisX, x2: axisX, y1: top - 10, y2: ground }));
      root.append(svg('text', { class: 'cmp-unit', x: axisX, y: 18, 'text-anchor': 'middle' }, unit));

      let x = axisX + 10 + (vbW - axisX - 20 - totalW) / 2;
      objs.forEach((o, i) => {
        const tip = svg('title', {}, `${o.name}: ${fmt(o.mm)}`);
        const shape = o.pic
          ? svg('image', {
              class: o.sil ? 'cmp-sil' : 'cmp-pic',
              href: o.image,
              x,
              y: ground - o.h,
              width: o.w,
              height: o.h,
              preserveAspectRatio: 'none',
              ...(o.sil ? { filter: `url(#${i === 0 ? 'cmp-sil-fig' : 'cmp-sil-item'})` } : {}),
            })
          : svg('rect', { class: o.cls, x, y: ground - o.h, width: o.w, height: o.h, rx: 3 });
        shape.append(tip);
        root.append(shape);
        root.append(svg('text', { class: 'cmp-val', x: x + o.w / 2, y: ground - o.h - 7, 'text-anchor': 'middle' }, fmt(o.mm)));
        root.append(svg('text', { class: 'cmp-name', x: x + o.w / 2, y: ground + 20, 'text-anchor': 'middle' }, clip(o.name)));
        x += o.w + gap;
      });
    } else {
      root = svg('svg', { viewBox: '0 0 340 196', class: 'compare-svg', role: 'img', 'aria-label': label });
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
        { mm: a.mm, y: 30, cls: 'cmp-fig', name: a.name },
        { mm: b.mm, y: 92, cls: 'cmp-item', name: b.name },
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
      view: 'picture',
    };
    let sceneToken = 0;
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
    const viewBtns = [
      ['picture', 'Picture'],
      ['silhouette', 'Silhouette'],
    ].map(([v, label]) =>
      el('button', {
        type: 'button',
        class: 'seg-btn',
        text: label,
        onclick: () => {
          state.view = v;
          update();
        },
      })
    );
    const viewRow = el('div', { class: 'seg compare-view', role: 'group', 'aria-label': 'Picture style' }, ...viewBtns);
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
      viewRow,
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
        viewRow.hidden = true;
        stage.textContent = '';
        caption.textContent = `No reference item has a ${C.NAME[key]} yet — try adding your own below.`;
        ratioLine.textContent = '';
      } else {
        const itemMm = item.dims[key];
        const ratio = figMm() / itemMm;
        const figPic = C.cleanImage(fig.scale_image);
        const figSil = C.cleanImage(fig.silhouette_image);
        const sil = state.view === 'silhouette';
        const figImage = sil ? figSil || figPic : figPic || figSil;
        // An uploaded silhouette is always drawn as a silhouette, even in Picture view.
        const a = { mm: figMm(), name: fig.name, image: figImage, sil: sil || (!figPic && !!figSil) };
        const b = { mm: itemMm, name: item.name, image: item.image, sil };
        const canToggle = key === 'h' && !!(figPic || figSil || item.image);
        viewRow.hidden = !canToggle;
        viewBtns.forEach((btn, i) => btn.setAttribute('aria-pressed', String((i === 1) === sil)));
        const token = ++sceneToken;
        drawScene(stage, key, a, b, [null, null]);
        // Height comparisons upgrade to the scale pictures (if any) once they've loaded.
        if (key === 'h' && (a.image || b.image)) {
          Promise.all([loadAspect(a.image), loadAspect(b.image)]).then((aspects) => {
            if (token === sceneToken && (aspects[0] || aspects[1])) drawScene(stage, key, a, b, aspects);
          });
        }
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
