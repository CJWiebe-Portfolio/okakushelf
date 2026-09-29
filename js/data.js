/*
  data.js
  --------
  Data layer for Otaku Shelf, backed by Firebase:
    - Firestore holds the figure records (name, series, description, ...).
    - Firebase Storage holds the uploaded photos; Firestore stores the
      resulting download URL.

  Reads (getAll) work for anyone — the gallery page is public. Writes
  (add/update/remove) are restricted to signed-in users by the security
  rules in firestore.rules and storage.rules, so admin.js gates them
  behind Firebase Authentication rather than a client-side passcode.
*/

const FIGURES_COLLECTION = 'figures';

const DataStore = {
  /** Load all figures, newest first. */
  async getAll() {
    const snapshot = await firebase
      .firestore()
      .collection(FIGURES_COLLECTION)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },

  /**
   * Add a figure. `figure.imageFile` should be the raw File the admin
   * picked; it's uploaded to Storage and swapped for a download URL.
   */
  async add(figure) {
    const { imageFile, ...fields } = figure;
    const db = firebase.firestore();
    const docRef = db.collection(FIGURES_COLLECTION).doc();

    let image = '';
    let imagePath = '';
    if (imageFile) {
      imagePath = `figures/${docRef.id}/${Date.now()}-${imageFile.name}`;
      const storageRef = firebase.storage().ref(imagePath);
      await storageRef.put(imageFile);
      image = await storageRef.getDownloadURL();
    }

    const data = {
      ...fields,
      image,
      imagePath,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await docRef.set(data);
    return { id: docRef.id, ...data };
  },

  async update(id, updates) {
    await firebase.firestore().collection(FIGURES_COLLECTION).doc(id).update(updates);
    const doc = await firebase.firestore().collection(FIGURES_COLLECTION).doc(id).get();
    return { id: doc.id, ...doc.data() };
  },

  /** Mark one figure as the home page's featured piece, unmarking any previous one. */
  async setFeatured(id) {
    const db = firebase.firestore();
    const snapshot = await db.collection(FIGURES_COLLECTION).where('featured', '==', true).get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      if (doc.id !== id) batch.update(doc.ref, { featured: false });
    });
    batch.update(db.collection(FIGURES_COLLECTION).doc(id), { featured: true });
    await batch.commit();
  },

  async unfeature(id) {
    await firebase.firestore().collection(FIGURES_COLLECTION).doc(id).update({ featured: false });
  },

  /** Remove a figure's Firestore record and its Storage photo, if any. */
  async remove(id) {
    const docRef = firebase.firestore().collection(FIGURES_COLLECTION).doc(id);
    const doc = await docRef.get();
    const data = doc.data();

    if (data && data.imagePath) {
      try {
        await firebase.storage().ref(data.imagePath).delete();
      } catch (err) {
        console.warn('Could not delete image from storage:', err);
      }
    }

    await docRef.delete();
  },

  /** Convert a File into a data URL — used for the admin form's live preview only. */
  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
};
