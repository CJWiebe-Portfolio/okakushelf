# Otaku Shelf

A figurine showcase site: dark "spotlight" gallery with one featured
piece up top, click-to-zoom photos with per-figure details, an About
page with contact/ordering info, and an admin page (behind real Firebase
login) for adding, removing, and featuring figures. Figures and photos
are stored in Firebase (Firestore + Storage), so anything an admin adds
shows up for every visitor, on any device.

## Files

```
otaku-shelf/
├── index.html            Gallery page (featured piece + grid) — what visitors see
├── about.html             Contact info + how to order a figure (edit the placeholders)
├── admin.html            Firebase-login-gated page for adding/removing/featuring figures
├── css/styles.css        All styling (spotlight glow, modal, featured card, admin layout)
├── js/firebase-config.js Your Firebase project config (fill this in — see below)
├── js/data.js            Storage layer (Firestore + Storage)
├── js/main.js            Gallery rendering + featured piece + zoom/details modal logic
├── js/admin.js           Admin sign-in + add/delete/feature logic
├── data/figures.json     Example figure shape — not auto-loaded, just a reference
├── firestore.rules       Firestore security rules (public read, admin-only write)
├── storage.rules         Storage security rules (public read, admin-only write)
└── firebase.json         Optional: lets `firebase deploy` push rules + hosting
```

## One-time Firebase setup

You need a Firebase project before either page will work.

1. **Create a project** at [console.firebase.google.com](https://console.firebase.google.com).
2. **Add a Web app** (Project settings → General → "Your apps" → Web),
   then copy the `firebaseConfig` values it gives you into
   `js/firebase-config.js`.
3. **Enable Authentication** → Sign-in method → turn on **Email/Password**.
   Then go to the **Users** tab and add one user yourself — that email +
   password is the admin login for `admin.html`. There's no sign-up form
   on the site on purpose; only accounts you create by hand can sign in.
4. **Enable Firestore Database** (start in production mode), then open the
   **Rules** tab and paste in the contents of `firestore.rules`.
5. **Enable Storage**, then open its **Rules** tab and paste in the
   contents of `storage.rules`.

That's it — reads are public (the gallery works for anyone), writes
require a signed-in admin, enforced server-side by those rules, not by
anything in the client-side JS.

If you have the [Firebase CLI](https://firebase.google.com/docs/cli)
installed, `firebase deploy --only firestore:rules,storage` will push
both rules files for you instead of pasting them in by hand, and
`firebase deploy --only hosting` can host the whole site for free.

## Running it locally

Open `index.html` in a browser — no build step, no npm install. (If your
browser blocks `fetch` on local files, run a tiny local server instead,
e.g. `python3 -m http.server` from this folder, then visit
`http://localhost:8000`.) You do need the Firebase setup above completed
first, since both pages talk to Firestore on load.

## Using the admin page

1. Go to `admin.html` and sign in with the email/password you created in
   the Firebase console.
2. Fill in the figure's details and choose a photo. Check "Feature this
   piece on the home page" if you want it to be the one shown up top on
   `index.html`, then hit "Add to shelf". The photo uploads to Firebase
   Storage and the record is saved to Firestore.
3. New figures appear immediately for every visitor, everywhere — not
   just your browser.
4. In "Current figures", each row has a **Feature/Unfeature** button.
   Only one figure can be featured at a time — marking a new one
   automatically unmarks the previous one. If nothing is featured, the
   home page just shows the grid with no featured section.

## The About page

`about.html` has two sections with placeholder content you should edit
directly in the HTML before going live:

- **Get in touch** — email and social links.
- **Ordering a figure** — a short explainer plus a button linking to
  wherever figures are actually sold (Etsy, Shopify, a commission form,
  etc.). This site is a showcase, not a checkout, so that link is the
  bridge to your real store.

Both are marked with `<!-- EDIT ME -->` comments in the file.

## Also worth doing before this goes live to a client

- Replace the two placeholder-shaped entries described in
  `data/figures.json` with the real starting lineup, added through the
  admin page.
- Fill in the real contact and shop details in `about.html` (see above).
- Add a real favicon and update the page `<title>`/hero copy in `index.html`.
- Consider compressing photos before upload to keep Storage usage (and
  load times) down — Firebase's free tier has generous but finite limits.
- If you ever need more than one admin, just add more users in
  Authentication → Users; the rules already treat any signed-in user as
  an admin.
