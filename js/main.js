/*
  main.js
  --------
  Renders the figure gallery and drives the click-to-zoom / details modal.
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
const featuredDescription = document.getElementById('featuredDescription');

const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalImageWrap = document.getElementById('modalImageWrap');
const modalImage = document.getElementById('modalImage');
const modalSeries = document.getElementById('modalSeries');
const modalTitle = document.getElementById('modalTitle');
const modalSculptor = document.getElementById('modalSculptor');
const modalScale = document.getElementById('modalScale');
const modalDate = document.getElementById('modalDate');
const modalDescription = document.getElementById('modalDescription');

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderGallery(figures) {
  if (!figures.length) {
    galleryEl.innerHTML = `
      <p class="empty-state">
        No figures on the shelf yet. Head to the
        <a href="admin.html">admin page</a> to add the first one.
      </p>`;
    return;
  }

  galleryEl.innerHTML = figures
    .map(
      (fig) => `
      <article class="figure-card" data-id="${escapeHtml(fig.id)}" tabindex="0">
        <div class="thumb-wrap">
          <img src="${escapeHtml(fig.image)}" alt="${escapeHtml(fig.name)}" loading="lazy" />
        </div>
        <div class="card-body">
          <div class="series">${escapeHtml(fig.series || '')}</div>
          <h3>${escapeHtml(fig.name)}</h3>
          <div class="meta-line">${escapeHtml(fig.scale || '')}</div>
        </div>
      </article>`
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

function openModal(fig) {
  modalImage.src = fig.image;
  modalImage.alt = fig.name;
  modalSeries.textContent = fig.series || '';
  modalTitle.textContent = fig.name;
  modalSculptor.textContent = fig.sculptor || 'Unknown';
  modalScale.textContent = fig.scale || 'Unknown';
  modalDate.textContent = formatDate(fig.dateAdded);
  modalDescription.textContent = fig.description || 'No description added yet.';

  modalImageWrap.classList.remove('zoomed');
  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.remove('open');
  modalImageWrap.classList.remove('zoomed');
  document.body.style.overflow = '';
}

async function init() {
  let figures;
  try {
    figures = await DataStore.getAll();
  } catch (err) {
    console.error('Could not load figures:', err);
    galleryEl.innerHTML = `
      <p class="empty-state">
        Couldn't load the collection. If you just set this site up, make sure
        <code>js/firebase-config.js</code> has your real Firebase project config
        (see README.md).
      </p>`;
    return;
  }

  const featured = figures.find((f) => f.featured);
  const rest = featured ? figures.filter((f) => f.id !== featured.id) : figures;

  renderFeatured(featured, rest.length > 0);

  if (featured && rest.length === 0) {
    galleryEl.style.display = 'none';
  } else {
    renderGallery(rest);
  }
  attachSpotlightTracking();

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

// Click the photo to toggle zoom.
modalImageWrap.addEventListener('click', () => {
  modalImageWrap.classList.toggle('zoomed');
});

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOverlay.classList.contains('open')) closeModal();
});

init();
