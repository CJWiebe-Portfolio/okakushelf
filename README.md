# Otaku Shelf

A figurine showcase site: dark "spotlight" gallery with one featured
piece up top, click-to-zoom photos with per-figure details, an About
page with contact/ordering info, and an admin at `/admin/` for adding,
editing, removing, and featuring figures.

There's no database or backend. Figures live in `data/figures.json` and
photos in `assets/statues/web/`, both in this repo. The admin is
[Sveltia CMS](https://github.com/sveltia/sveltia-cms), a Git-based CMS:
every save is a commit to GitHub, and GitHub Pages republishes the site.
It's free, with no card or third-party account needed beyond GitHub.

## Files

```
okakushelf/
├── index.html            Gallery page (featured piece + grid) — what visitors see
├── about.html            Contact info + how to order a figure (edit the placeholders)
├── admin/index.html      Loads Sveltia CMS
├── admin/config.yml      CMS settings: repo, fields, photo folder, image resizing
├── admin.html            Redirects old /admin.html links to /admin/
├── css/styles.css        All styling (spotlight glow, modal, featured card)
├── js/data.js            Loads data/figures.json
├── js/main.js            Gallery rendering + featured piece + zoom/details modal logic
├── data/figures.json     The collection: { "figures": [ ... ] }
└── assets/statues/web/   Web-sized photos used by the site (CMS uploads go here)
```

## One-time setup

1. **Push this repo to GitHub** (`CJWiebe-Portfolio/okakushelf`, branch `main`).
2. **Turn on GitHub Pages:** repo → Settings → Pages → Source: *Deploy
   from a branch* → `main` / `(root)` → Save. The site appears at
   `https://cjwiebe-portfolio.github.io/okakushelf/` a minute or two later.
   Note: GitHub Pages on a **private** repo requires a paid GitHub plan
   (Pro/Team). On a free account, make the repo public or host elsewhere
   (e.g. Cloudflare Pages or Netlify, both free and fine with private repos).
3. **Give the client access:** repo → Settings → Collaborators → add
   their GitHub account with **Write** access.

## Signing in to the admin

Go to `…/okakushelf/admin/` and choose **Sign In with Token**.

Each editor makes their own token once:

1. GitHub → Settings → Developer settings → Personal access tokens →
   **Fine-grained tokens** → Generate new token.
2. Resource owner: `CJWiebe-Portfolio`. Repository access: *Only select
   repositories* → `okakushelf`.
3. Repository permissions: **Contents → Read and write** (Metadata:
   read-only is added automatically).
4. Pick an expiry, generate, and paste the token into the admin sign-in.

The token stays in that browser. Treat it like a password; if it leaks,
delete it on GitHub and make a new one.

(Want a "Sign in with GitHub" button instead of tokens? That needs a
small free OAuth helper — see Sveltia's docs for *Sveltia CMS
Authenticator* on Cloudflare Workers — then add `base_url:` under
`backend:` in `admin/config.yml`.)

**Editing locally without a token:** in Chrome or Edge, open
`http://localhost:8000/admin/` (see "Running it locally") and choose
**Work with Local Repository**, then pick this folder. Changes are
written to your files; commit and push them yourself.

## Using the admin

1. Open **Shelf → Figures**. Each figure is an item in the list.
2. **Add:** click *Add Figure*, fill in the details, upload a photo, and
   **Save**. Photos are resized to 1600 px and converted to WebP in the
   browser before upload, so phone photos are fine.
3. **Feature:** tick *Feature on the home page* on one figure (untick the
   old one). If several are ticked, the newest by date wins.
4. **Remove / reorder:** use the item's menu in the list, then Save.
5. Changes go live after GitHub Pages redeploys — usually 1–2 minutes.
   Visitors may need a refresh.

Removing a figure doesn't delete its photo; clean up unused photos from
the CMS's **Assets** tab if you like.

## Running it locally

No build step. From this folder run `python3 -m http.server` and visit
`http://localhost:8000` (opening `index.html` directly won't work,
because browsers block `fetch` on local files).

## The About page

`about.html` has placeholder contact and ordering details marked with
`<!-- EDIT ME -->` comments — fill those in before going live.
