/*
  admin.js
  --------
  Handles the admin sign-in (Firebase Authentication) and the add/delete
  figure workflow (Firestore + Storage, via data.js).

  There's no self-serve sign-up on this page by design — create the admin
  account yourself in the Firebase console (Authentication → Users →
  Add user) and hand its email/password to whoever manages the shelf.
  Access after that is enforced server-side by the security rules in
  firestore.rules / storage.rules, not by anything in this file.
*/

const loginCard = document.getElementById('loginCard');
const adminTools = document.getElementById('adminTools');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const loginStatus = document.getElementById('loginStatus');
const signOutBtn = document.getElementById('signOutBtn');

const figureForm = document.getElementById('figureForm');
const nameInput = document.getElementById('nameInput');
const seriesInput = document.getElementById('seriesInput');
const sculptorInput = document.getElementById('sculptorInput');
const scaleInput = document.getElementById('scaleInput');
const descriptionInput = document.getElementById('descriptionInput');
const photoInput = document.getElementById('photoInput');
const featuredInput = document.getElementById('featuredInput');
const previewThumb = document.getElementById('previewThumb');
const formStatus = document.getElementById('formStatus');
const adminList = document.getElementById('adminList');

function friendlyAuthError(err) {
  switch (err.code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts — try again in a bit.';
    default:
      return `Sign-in failed: ${err.message}`;
  }
}

function attemptLogin() {
  loginStatus.textContent = '';
  loginStatus.className = 'status-msg';
  loginBtn.disabled = true;

  firebase
    .auth()
    .signInWithEmailAndPassword(emailInput.value.trim(), passwordInput.value)
    .catch((err) => {
      loginStatus.textContent = friendlyAuthError(err);
      loginStatus.className = 'status-msg error';
    })
    .finally(() => {
      loginBtn.disabled = false;
    });
}

loginBtn.addEventListener('click', attemptLogin);
[emailInput, passwordInput].forEach((el) => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptLogin();
  });
});

signOutBtn.addEventListener('click', () => firebase.auth().signOut());

// Show/hide the admin tools based on real Firebase auth state (persists across reloads).
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    loginCard.style.display = 'none';
    adminTools.style.display = 'block';
    passwordInput.value = '';
    renderAdminList();
  } else {
    loginCard.style.display = 'block';
    adminTools.style.display = 'none';
  }
});

// Photo preview
photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  if (!file) {
    previewThumb.style.display = 'none';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    previewThumb.src = reader.result;
    previewThumb.style.display = 'block';
  };
  reader.readAsDataURL(file);
});

figureForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formStatus.textContent = '';
  formStatus.className = 'status-msg';

  const file = photoInput.files[0];
  if (!file) {
    formStatus.textContent = 'Please choose a photo.';
    formStatus.className = 'status-msg error';
    return;
  }

  const submitBtn = figureForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  formStatus.textContent = 'Uploading…';

  try {
    const wantsFeatured = featuredInput.checked;
    const newFigure = await DataStore.add({
      name: nameInput.value.trim(),
      series: seriesInput.value.trim(),
      sculptor: sculptorInput.value.trim(),
      scale: scaleInput.value.trim(),
      description: descriptionInput.value.trim(),
      dateAdded: new Date().toISOString().slice(0, 10),
      imageFile: file,
    });

    if (wantsFeatured) {
      await DataStore.setFeatured(newFigure.id);
    }

    figureForm.reset();
    previewThumb.style.display = 'none';
    formStatus.textContent = 'Figure added to the shelf.';
    formStatus.className = 'status-msg success';
    renderAdminList();
  } catch (err) {
    console.error(err);
    formStatus.textContent = `Something went wrong saving that figure: ${err.message}`;
    formStatus.className = 'status-msg error';
  } finally {
    submitBtn.disabled = false;
  }
});

async function renderAdminList() {
  adminList.innerHTML = '<p>Loading…</p>';

  let figures;
  try {
    figures = await DataStore.getAll();
  } catch (err) {
    console.error('Could not load figures:', err);
    adminList.innerHTML = `<p>Couldn't load figures: ${err.message}</p>`;
    return;
  }

  if (!figures.length) {
    adminList.innerHTML = '<p>No figures yet — add one above.</p>';
    return;
  }

  adminList.innerHTML = figures
    .map(
      (fig) => `
      <div class="admin-row" data-id="${fig.id}">
        <img src="${fig.image}" alt="${fig.name}" />
        <div class="info">
          <strong>${fig.name || 'Untitled'}${fig.featured ? '<span class="featured-badge">★ Featured</span>' : ''}</strong>
          <span>${fig.series || ''}${fig.series ? ' · ' : ''}${fig.scale || ''}</span>
        </div>
        <div class="actions">
          <button class="btn secondary feature-btn" data-id="${fig.id}">${fig.featured ? 'Unfeature' : 'Feature'}</button>
          <button class="btn danger delete-btn" data-id="${fig.id}">Delete</button>
        </div>
      </div>`
    )
    .join('');

  adminList.querySelectorAll('.feature-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const fig = figures.find((f) => f.id === btn.dataset.id);
      if (fig.featured) {
        await DataStore.unfeature(fig.id);
      } else {
        await DataStore.setFeatured(fig.id);
      }
      renderAdminList();
    });
  });

  adminList.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this figure from the shelf?')) return;
      btn.disabled = true;
      await DataStore.remove(btn.dataset.id);
      renderAdminList();
    });
  });
}
