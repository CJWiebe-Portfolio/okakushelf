/*
  main.js
  --------
  Renders the figure gallery and drives the details modal: a photo viewer
  (multiple photos per figure, click-to-zoom with panning) plus details.
*/

const galleryEl = document.getElementById('gallery');
const restHeading = document.getElementById('restHeading');

const featuredSection = document.getElementById('featuredSection');
const featuredCard = document.getElementById('featuredCard');
const featuredImage = document.getElementById('featuredImage');
const featuredSeries = document.getElementById('featuredSeries');
const featuredName = document.getElementById('featuredName');
const featuredSculptor = document.getElementById('featuredSculptor');
const featuredScale = document.getElementById('featuredScale');
const featuredSize = document.getElementById('featuredSize');
const featuredCompare = document.getElementById('featuredCompare');
const featuredDescription = document.getElementById('featuredDescription');
const featuredPhotoCount = document.getElementById('featuredPhotoCount');

const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalImageWrap = document.getElementById('modalImageWrap');
const modalImage = document.getElementById('modalImage');
const photoPrev = document.getElementById('photoPrev');
const photoNext = document.getElementById('photoNext');
const photoThumbs = document.getElementById('photoThumbs');
const zoomHint = document.getElementById('zoomHint');
const modalSeries = document.getElementById('modalSeries');
const modalTitle = document.getElementById('modalTitle');
const modalSculptor = document.getElementById('modalSculptor');
const modalScale = document.getElementById('modalScale');
const modalSize = document.getElementById('modalSize');
const modalCompare = document.getElementById('modalCompare');
const modalDate = document.getElementById('modalDate');
const modalDescription = document.getElementById('modalDescription');

// Filled in by init(); used to refresh size text when the unit changes.
let allFigures = [];
let featuredFigure = null;
let openFigure = null;

/** Show/hide a "Size" row (its <dt> is the element just before the <dd>). */
function setSizeRow(dd, text) {
  dd.textContent = text;
  dd.hidden = !text;
  if (dd.previousElementSibling) dd.previousElementSibling.hidden = !text;
}

/** Update every size / comparison line on the page (cards, featured piece, open modal). */
function refreshSummaries() {
  document.querySelectorAll('[data-compare-for]').forEach((node) => {
    const fig = allFigures.find((f) => f.id === node.dataset.compareFor);
    const line = fig ? CompareUI.cardLine(fig) : '';
    node.textContent = line;
    node.hidden = !line;
  });
  if (featuredFigure) {
    setSizeRow(featuredSize, CompareUI.sizeText(featuredFigure));
    const sentence = CompareUI.comparison(featuredFigure);
    featuredCompare.textContent = sentence ? `That’s ${sentence}.` : '';
    featuredCompare.hidden = !sentence;
  }
  if (openFigure) setSizeRow(modalSize, CompareUI.sizeText(openFigure));
}

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Main photo first, then any extras from the CMS "More photos" list.
function photosOf(fig) {
  const all = [fig.image, ...(Array.isArray(fig.photos) ? fig.photos : [])];
  return [...new Set(all.filter(Boolean))];
}

function photoCountLabel(n) {
  return n > 1 ? `${n} photos` : '';
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  // Parse plain YYYY-MM-DD as a local date (new Date('2026-07-22') is UTC
  // midnight, which shows as the previous day west of Greenwich).
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(`${dateStr}T00:00:00`) : new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderGallery(figures) {
  if (!figures.length) {
    galleryEl.innerHTML = `
      <p class="empty-state">
        No figures on the shelf yet. Head to the
        <a href="admin/">admin page</a> to add the first one.
      </p>`;
    return;
  }

  galleryEl.innerHTML = figures
    .map(
      (fig) => {
        const count = photoCountLabel(photosOf(fig).length);
        return `
      <article class="figure-card" data-id="${escapeHtml(fig.id)}" tabindex="0">
        <div class="thumb-wrap">
          <img src="${escapeHtml(fig.image)}" alt="${escapeHtml(fig.name)}" loading="lazy" />
          ${count ? `<span class="photo-count">${count}</span>` : ''}
        </div>
        <div class="card-body">
          <div class="series">${escapeHtml(fig.series || '')}</div>
          <h3>${escapeHtml(fig.name)}</h3>
          <div class="meta-line">${escapeHtml(fig.scale || '')}</div>
          <div class="compare-line" data-compare-for="${escapeHtml(fig.id)}" hidden></div>
        </div>
      </article>`;
      }
    )
    .join('');
}

function renderFeatured(fig, hasOthers) {
  if (!fig) {
    featuredSection.style.display = 'none';
    restHeading.style.display = 'none';
    return;
  }

  featuredImage.src = fig.image;
  featuredImage.alt = fig.name;
  featuredSeries.textContent = fig.series || '';
  featuredName.textContent = fig.name;
  featuredSculptor.textContent = fig.sculptor || 'Unknown';
  featuredScale.textContent = fig.scale || 'Unknown';
  featuredDescription.textContent = fig.description || 'No description added yet.';
  featuredPhotoCount.textContent = photoCountLabel(photosOf(fig).length);
  featuredPhotoCount.hidden = !featuredPhotoCount.textContent;

  featuredSection.style.display = 'block';
  restHeading.style.display = hasOthers ? 'block' : 'none';
}

// Spotlight glow follows the cursor across each card.
function attachSpotlightTracking() {
  galleryEl.addEventListener('mousemove', (e) => {
    const card = e.target.closest('.figure-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mx', `${x}%`);
    card.style.setProperty('--my', `${y}%`);
  });
}

// ---------- Photo viewer ----------

let currentPhotos = [];
let currentIndex = 0;
let currentName = '';

function setZoom(on) {
  modalImageWrap.classList.toggle('zoomed', on);
  zoomHint.textContent = on ? 'Move to explore · click to zoom out' : 'Click photo to zoom';
}

function showPhoto(index) {
  const n = currentPhotos.length;
  currentIndex = (index + n) % n;
  modalImage.src = currentPhotos[currentIndex];
  modalImage.alt = n > 1 ? `${currentName} (photo ${currentIndex + 1} of ${n})` : currentName;
  setZoom(false);

  photoThumbs.querySelectorAll('button').forEach((btn, i) => {
    btn.classList.toggle('active', i === currentIndex);
    btn.setAttribute('aria-current', i === currentIndex ? 'true' : 'false');
  });
}

function renderPhotoNav() {
  const multiple = currentPhotos.length > 1;
  modalImageWrap.classList.toggle('has-multiple', multiple);
  photoThumbs.hidden = !multiple;
  photoThumbs.innerHTML = multiple
    ? currentPhotos
        .map(
          (src, i) => `
      <button type="button" data-index="${i}" aria-label="Show photo ${i + 1}">
        <img src="${escapeHtml(src)}" alt="" loading="lazy" />
      </button>`
        )
        .join('')
    : '';
}

// Point the zoom at the pointer, so any part of the photo can be magnified.
function setZoomOrigin(e) {
  const rect = modalImage.getBoundingClientRect();
  const x = Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 0), 100);
  const y = Math.min(Math.max(((e.clientY - rect.top) / rect.height) * 100, 0), 100);
  modalImage.style.transformOrigin = `${x}% ${y}%`;
}

function openModal(fig) {
  currentPhotos = photosOf(fig);
  currentName = fig.name;
  renderPhotoNav();
  showPhoto(0);
  modalSeries.textContent = fig.series || '';
  modalTitle.textContent = fig.name;
  modalSculptor.textContent = fig.sculptor || 'Unknown';
  modalScale.textContent = fig.scale || 'Unknown';
  modalDate.textContent = formatDate(fig.dateAdded);
  modalDescription.textContent = fig.description || 'No description added yet.';

  openFigure = fig;
  setSizeRow(modalSize, CompareUI.sizeText(fig));
  CompareUI.mount(modalCompare, fig);

  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.remove('open');
  setZoom(false);
  document.body.style.overflow = '';
  openFigure = null;
  CompareUI.unmount();
}

async function init() {
  let figures;
  try {
    // Reference items never throw; without them the size comparisons just stay hidden.
    const [list, items] = await Promise.all([DataStore.getAll(), DataStore.getReferenceItems()]);
    figures = list;
    CompareUI.init(items);
  } catch (err) {
    console.error('Could not load figures:', err);
    galleryEl.innerHTML = `
      <p class="empty-state">
        Couldn't load the collection. Check that <code>data/figures.json</code>
        exists and is valid JSON (see README.md).
      </p>`;
    return;
  }

  allFigures = figures;
  const featured = figures.find((f) => f.featured);
  featuredFigure = featured || null;
  const rest = featured ? figures.filter((f) => f.id !== featured.id) : figures;

  renderFeatured(featured, rest.length > 0);

  if (featured && rest.length === 0) {
    galleryEl.style.display = 'none';
  } else {
    renderGallery(rest);
  }
  attachSpotlightTracking();
  refreshSummaries();
  CompareUI.onUnitChange(refreshSummaries);

  if (featured) {
    featuredCard.addEventListener('click', () => openModal(featured));
    featuredCard.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      openModal(featured);
    });
  }

  galleryEl.addEventListener('click', (e) => {
    const card = e.target.closest('.figure-card');
    if (!card) return;
    const fig = rest.find((f) => f.id === card.dataset.id);
    if (fig) openModal(fig);
  });

  // Keyboard access: Enter/Space opens the focused card.
  galleryEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.figure-card');
    if (!card) return;
    e.preventDefault();
    const fig = rest.find((f) => f.id === card.dataset.id);
    if (fig) openModal(fig);
  });
}

// Click (or tap) the photo to zoom in at that spot / zoom back out. While
// zoomed, moving the mouse or dragging a finger pans across the photo.
let pointerStart = null;
let dragged = false;

modalImageWrap.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.photo-nav')) return;
  pointerStart = { x: e.clientX, y: e.clientY };
  dragged = false;
});

modalImageWrap.addEventListener('pointermove', (e) => {
  if (!modalImageWrap.classList.contains('zoomed')) return;
  if (pointerStart && Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 6) {
    dragged = true;
  }
  // Mouse pans on hover; touch/pen pans while pressed.
  if (e.pointerType === 'mouse' || pointerStart) setZoomOrigin(e);
});

modalImageWrap.addEventListener('pointerup', (e) => {
  const start = pointerStart;
  pointerStart = null;
  if (!start || dragged || e.target.closest('.photo-nav')) return;
  const zooming = !modalImageWrap.classList.contains('zoomed');
  if (zooming) setZoomOrigin(e);
  setZoom(zooming);
});

modalImageWrap.addEventListener('pointercancel', () => {
  pointerStart = null;
});

photoPrev.addEventListener('click', () => showPhoto(currentIndex - 1));
photoNext.addEventListener('click', () => showPhoto(currentIndex + 1));

photoThumbs.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-index]');
  if (btn) showPhoto(Number(btn.dataset.index));
});

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (!modalOverlay.classList.contains('open')) return;
  if (e.key === 'Escape') closeModal();
  if (currentPhotos.length < 2) return;
  if (e.key === 'ArrowLeft') showPhoto(currentIndex - 1);
  if (e.key === 'ArrowRight') showPhoto(currentIndex + 1);
});

init();
