/*
  data.js
  --------
  Data layer for Otaku Shelf, backed by a plain JSON file in this repo.

  All figures live in data/figures.json as { "figures": [ ... ] }. The
  client edits that file (and uploads photos to assets/statues/web/)
  through the Sveltia CMS admin at /admin/, which commits the changes
  straight to GitHub. GitHub Pages then republishes the site, so there's
  no database, no server, and nothing to pay for.
*/

const FIGURES_URL = 'data/figures.json';

const DataStore = {
  /** Load all figures, newest first. Each gets a stable-per-load `id`. */
  async getAll() {
    // no-cache: always revalidate, so new CMS edits show up once Pages redeploys.
    const res = await fetch(FIGURES_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load ${FIGURES_URL}: ${res.status}`);

    const data = await res.json();
    const list = Array.isArray(data) ? data : data.figures || [];

    return list
      .filter((fig) => fig && fig.name)
      .map((fig, i) => ({ ...fig, id: String(i) }))
      .sort((a, b) => String(b.dateAdded || '').localeCompare(String(a.dateAdded || '')));
  },
};
