import { db } from './firebase';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  onSnapshot,
  deleteDoc,
  updateDoc,
  increment,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  limit
} from 'firebase/firestore';

const DEFAULT_ROWS = [
  { id: 'trending', title: 'Trending This Week', type: 'tmdb', endpoint: 'trending', variant: 'backdrop', visible: true },
  { id: 'popular-movies', title: 'Popular Movies', type: 'tmdb', endpoint: 'popularMovies', mediaType: 'movie', variant: 'poster', visible: true },
  { id: 'top-rated-movies', title: 'Top Rated', type: 'tmdb', endpoint: 'topRatedMovies', mediaType: 'movie', variant: 'poster', visible: true },
  { id: 'popular-series', title: 'Popular Series', type: 'tmdb', endpoint: 'popularTV', mediaType: 'tv', variant: 'poster', visible: true },
  { id: 'coming-soon', title: 'Coming Soon', type: 'tmdb', endpoint: 'upcomingMovies', mediaType: 'movie', variant: 'backdrop', visible: true },
  { id: 'on-the-air', title: 'On The Air', type: 'tmdb', endpoint: 'onTheAirTV', mediaType: 'tv', variant: 'poster', visible: true }
];

const isClient = typeof window !== 'undefined';

// Local storage fallback handlers
function getLocal(key, defaultVal) {
  if (!isClient) return defaultVal;
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
}

function setLocal(key, val) {
  if (!isClient) return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {}
}

function buildWatchKey(mediaType, id, season = 0, episode = 0) {
  return `${mediaType}_${id}_${season}_${episode}`;
}

// ----------------------------------------------------
// DYNAMIC ROW MANAGEMENT (FIRESTORE SYNC WITH FALLBACK)
// ----------------------------------------------------

// Subscribe to dynamic rows in real-time
export function subscribeHomeRows(callback, onError) {
  try {
    const docRef = doc(db, 'settings', 'home_rows');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().rows) {
        callback(docSnap.data().rows);
      } else {
        // First-time setup: write defaults to Firestore
        setDoc(docRef, { rows: DEFAULT_ROWS })
          .then(() => callback(DEFAULT_ROWS))
          .catch((err) => {
            console.warn("Firestore rules likely locked. Falling back to local storage.", err);
            if (onError) onError(err);
            callback(getLocal('tashidotv_home_rows', DEFAULT_ROWS));
          });
      }
    }, (err) => {
      console.warn("Firestore rules likely locked. Falling back to local storage.", err);
      if (onError) onError(err);
      callback(getLocal('tashidotv_home_rows', DEFAULT_ROWS));
    });
  } catch (err) {
    console.warn("Firestore initialization error. Falling back to local storage.", err);
    if (onError) onError(err);
    callback(getLocal('tashidotv_home_rows', DEFAULT_ROWS));
  }
}

// Save dynamic rows to Firestore
export async function saveHomeRows(rows) {
  setLocal('tashidotv_home_rows', rows);
  try {
    const docRef = doc(db, 'settings', 'home_rows');
    await setDoc(docRef, { rows });
  } catch (e) {
    console.warn("Could not save to Firestore, using local fallback:", e);
  }
}

// Reset rows to default
export async function resetHomeRows() {
  setLocal('tashidotv_home_rows', DEFAULT_ROWS);
  try {
    const docRef = doc(db, 'settings', 'home_rows');
    await setDoc(docRef, { rows: DEFAULT_ROWS });
  } catch (e) {
    console.warn("Could not reset in Firestore:", e);
  }
  return DEFAULT_ROWS;
}

// ----------------------------------------------------
// REAL USER ACCOUNTS & SESSION MANAGEMENT
// ----------------------------------------------------

// Session-level user registration cache to avoid duplicate reads/writes
let isRegisteredInSession = false;

// Register user on login
export async function registerUser(firebaseUser) {
  if (!firebaseUser) return;
  if (isRegisteredInSession) return;

  const now = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const userData = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
    photoURL: firebaseUser.photoURL || null,
    lastSignInTime: now,
    lastActive: Date.now(),
    role: firebaseUser.email === 'herozboy@gmail.com' ? 'admin' : 'user'
  };

  try {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      // First-time user sign up
      userData.watchHours = 0.0;
      userData.createdAt = Date.now();
      await setDoc(userRef, userData);
    } else {
      // Returning user, merge values keeping existing watch hours
      await setDoc(userRef, {
        ...userData,
        watchHours: docSnap.data().watchHours || 0.0
      }, { merge: true });
    }
    isRegisteredInSession = true;
  } catch (e) {
    console.warn("Firestore registration locked. Falling back to local storage.", e);
    // Sync local storage fallback
    const localUsers = getLocal('tashidotv_users', []);
    const idx = localUsers.findIndex(u => u.uid === firebaseUser.uid);
    const localData = { ...userData, watchHours: idx >= 0 ? localUsers[idx].watchHours : 0.0 };
    if (idx >= 0) localUsers[idx] = localData;
    else localUsers.push(localData);
    setLocal('tashidotv_users', localUsers);
    isRegisteredInSession = true;
  }
}

// Real-time watch heartbeat increment
export async function updateUserHeartbeat(uid, secondsToAdd) {
  if (!uid) return;
  const hoursToAdd = secondsToAdd / 3600;

  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      watchHours: increment(hoursToAdd),
      lastActive: Date.now()
    });
  } catch (e) {
    // Local storage fallback for heartbeat
    const localUsers = getLocal('tashidotv_users', []);
    const idx = localUsers.findIndex(u => u.uid === uid);
    if (idx >= 0) {
      localUsers[idx].watchHours = (localUsers[idx].watchHours || 0.0) + hoursToAdd;
      localUsers[idx].lastActive = Date.now();
      setLocal('tashidotv_users', localUsers);
    }
  }
}

// Real-time active users listener subscription
export function subscribeUsers(callback, onError) {
  try {
    const colRef = collection(db, 'users');
    return onSnapshot(colRef, (snapshot) => {
      const usersList = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // A user is considered currently "active/online" if they made an active action in the last 40 seconds
        const isOnline = data.lastActive ? (Date.now() - data.lastActive < 40000) : false;
        usersList.push({
          ...data,
          active: isOnline
        });
      });
      callback(usersList);
    }, (err) => {
      console.warn("Firestore users query failed. Falling back to local storage.", err);
      if (onError) onError(err);
      callback(getLocalUsersFallback());
    });
  } catch (err) {
    console.warn("Firestore users initialization failed. Falling back to local storage.", err);
    if (onError) onError(err);
    callback(getLocalUsersFallback());
  }
}

function getLocalUsersFallback() {
  const localUsers = getLocal('tashidotv_users', []);
  return localUsers.map(u => ({
    ...u,
    active: u.lastActive ? (Date.now() - u.lastActive < 40000) : false
  }));
}

// Delete user record from Firestore
export async function deleteUser(uid) {
  try {
    const userRef = doc(db, 'users', uid);
    await deleteDoc(userRef);
  } catch (e) {
    console.warn("Could not delete user in Firestore, using local fallback:", e);
    const localUsers = getLocal('tashidotv_users', []);
    const updated = localUsers.filter(u => u.uid !== uid);
    setLocal('tashidotv_users', updated);
  }
}

// Helper to safely parse and serialize documents from/to Firestore continueWatching subcollection
function convertFirestoreDoc(docSnap) {
  const data = docSnap.data();
  let updatedAt = Date.now();
  if (data.lastWatchedAt) {
    if (typeof data.lastWatchedAt.toMillis === 'function') {
      updatedAt = data.lastWatchedAt.toMillis();
    } else if (typeof data.lastWatchedAt === 'number') {
      updatedAt = data.lastWatchedAt;
    } else if (data.lastWatchedAt.seconds) {
      updatedAt = data.lastWatchedAt.seconds * 1000;
    }
  }

  return {
    id: data.id ?? Number(docSnap.id),
    mediaType: data.mediaType || 'movie',
    title: data.title || '',
    posterPath: data.posterPath || null,
    backdropPath: data.backdropPath || null,
    progress: data.currentTime ?? data.progress ?? 0,
    currentTime: data.currentTime ?? data.progress ?? 0,
    duration: data.duration ?? 0,
    season: data.season || 0,
    episode: data.episode || 0,
    updatedAt: updatedAt,
    lastWatchedAt: data.lastWatchedAt || null
  };
}

// Fetch a single watch progress entry (comparing Firestore and localStorage timestamps)
export async function getWatchProgress(userId, mediaType, id, season = 0, episode = 0) {
  const key = buildWatchKey(mediaType, id, season, episode);
  let firestoreEntry = null;

  if (userId) {
    try {
      const docRef = doc(db, 'users', userId, 'continueWatching', String(id));
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        firestoreEntry = convertFirestoreDoc(docSnap);
      }
    } catch (err) {
      console.warn('Firestore watch history fetch failed.', err);
    }
  }

  let localEntry = null;
  // localStorage lookup
  try {
    const progressData = localStorage.getItem('tashidotv_progress');
    if (progressData) {
      const progressDict = JSON.parse(progressData);
      const entry = progressDict[key];
      if (entry) {
        if (mediaType === 'tv') {
          if (entry.season === season && entry.episode === episode) {
            localEntry = entry;
          }
        } else {
          localEntry = entry;
        }
      }
    }
  } catch (e) {}

  // Compare timestamps and return the newer watched one
  if (firestoreEntry && localEntry) {
    const firestoreTime = firestoreEntry.updatedAt || 0;
    const localTime = localEntry.updatedAt || 0;
    return localTime > firestoreTime ? localEntry : firestoreEntry;
  }

  return firestoreEntry || localEntry || null;
}

// Save (upsert) a watch progress entry to Firestore + localStorage
export async function setWatchProgress(userId, payload) {
  const { mediaType, id, title, posterPath, backdropPath, progress, duration, season = 0, episode = 0 } = payload;
  const key = buildWatchKey(mediaType, id, season, episode);
  const now = Date.now();

  // 1. Always save to localStorage
  try {
    const progressData = localStorage.getItem('tashidotv_progress');
    const progressDict = progressData ? JSON.parse(progressData) : {};
    progressDict[key] = {
      id: Number(id),
      mediaType,
      title,
      posterPath: posterPath || null,
      backdropPath: backdropPath || null,
      progress: Number(progress) || 0,
      currentTime: Number(progress) || 0,
      duration: Number(duration) || 0,
      season: mediaType === 'tv' ? Number(season) : undefined,
      episode: mediaType === 'tv' ? Number(episode) : undefined,
      updatedAt: now
    };
    localStorage.setItem('tashidotv_progress', JSON.stringify(progressDict));
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }

  // 2. Firestore for cross-device sync
  if (!userId) return;

  try {
    const docRef = doc(db, 'users', userId, 'continueWatching', String(id));
    const docPayload = {
      mediaType,
      id: Number(id),
      title: title || 'Untitled',
      posterPath: posterPath || null,
      backdropPath: backdropPath || null,
      currentTime: Number(progress) || 0,
      progress: Number(progress) || 0, // compatibility
      duration: Number(duration) || 0,
      season: mediaType === 'tv' ? Number(season) : 0,
      episode: mediaType === 'tv' ? Number(episode) : 0,
      lastWatchedAt: serverTimestamp(),
      updatedAt: now // compatibility
    };
    await setDoc(docRef, docPayload, { merge: true });
  } catch (err) {
    console.warn('Firestore watch history save failed. localStorage fallback kept.', err);
  }
}

// Delete a watch progress entry (on completion or user remove)
export async function deleteWatchProgress(userId, mediaType, id, season = 0, episode = 0) {
  const key = buildWatchKey(mediaType, id, season, episode);

  // 1. Remove from localStorage
  try {
    const progressData = localStorage.getItem('tashidotv_progress');
    if (progressData) {
      const progressDict = JSON.parse(progressData);
      if (progressDict[key]) {
        delete progressDict[key];
        localStorage.setItem('tashidotv_progress', JSON.stringify(progressDict));
      }
    }
  } catch (e) {}

  // 2. Remove from Firestore
  if (!userId) return;

  try {
    const docRef = doc(db, 'users', userId, 'continueWatching', String(id));
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Firestore watch history delete failed.', err);
  }
}

// Fetch ALL watch history for a user (for Continue Watching row)
export async function getAllWatchHistory(userId) {
  if (!userId) {
    try {
      const progressData = localStorage.getItem('tashidotv_progress');
      if (progressData) {
        return Object.values(JSON.parse(progressData));
      }
    } catch (e) {}
    return [];
  }

  try {
    const colRef = collection(db, 'users', userId, 'continueWatching');
    const snap = await getDocs(colRef);
    const list = snap.docs.map(docSnap => convertFirestoreDoc(docSnap));
    // Sort in memory by updatedAt descending (newest first)
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return list;
  } catch (err) {
    console.warn('Firestore all watch history fetch failed.', err);
    if (err.code === 'permission-denied') return []; // Do not leak admin local storage to other user profiles
    try {
      const progressData = localStorage.getItem('tashidotv_progress');
      if (progressData) {
        return Object.values(JSON.parse(progressData));
      }
    } catch (e) {}
    return [];
  }
}

// Real-time Continue Watching sync subscription
export function subscribeWatchHistory(userId, callback, onError) {
  if (!userId) {
    // Fallback: read local storage once and set up standard local storage event listeners
    const loadLocal = () => {
      try {
        const progressData = localStorage.getItem('tashidotv_progress');
        if (progressData) {
          callback(Object.values(JSON.parse(progressData)));
        } else {
          callback([]);
        }
      } catch (e) {
        callback([]);
      }
    };
    loadLocal();
    
    const handler = (e) => {
      if (e.key === 'tashidotv_progress' || e.type === 'tashidotv_update') {
        loadLocal();
      }
    };
    window.addEventListener('storage', handler);
    window.addEventListener('tashidotv_update', handler);
    
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('tashidotv_update', handler);
    };
  }

  try {
    let cachedFirestoreList = [];
    
    // 1. Initial one-time fetch to save passive reads
    getAllWatchHistory(userId).then(list => {
      cachedFirestoreList = list;
      callback(list);
    }).catch((err) => {
      console.warn("Firestore static fetch error. Falling back to local.", err);
      if (onError) onError(err);
    });

    // 2. Setup local listeners for real-time UI updates without re-fetching from Firestore
    const handler = (e) => {
      try {
        if (e && e.type === 'tashidotv_update' && e.detail && e.detail.action === 'delete') {
          const deletedKey = `${e.detail.mediaType || 'movie'}_${e.detail.id}`;
          cachedFirestoreList = cachedFirestoreList.filter(item => `${item.mediaType || 'movie'}_${item.id}` !== deletedKey);
        }

        const progressData = localStorage.getItem('tashidotv_progress');
        let localList = progressData ? Object.values(JSON.parse(progressData)) : [];
        
        // Only remove items from cachedFirestoreList if they were explicitly deleted locally
        // To do this properly without `deletedIds`, we just merge them. 
        // If an item was deleted, it will be handled by re-fetching from Firestore or a proper sync.
        // For now, we will NOT filter cachedFirestoreList based on localIds, as that breaks cross-device sync.
        // cachedFirestoreList = cachedFirestoreList.filter(item => localIds.has(`${item.mediaType || 'movie'}_${item.id}`));
        
        // Merge cached Firestore data with local changes (local wins on newer timestamp)
        const mergedMap = new Map();
        [...cachedFirestoreList, ...localList].forEach(item => {
           const key = `${item.mediaType || 'movie'}_${item.id}`;
           const existing = mergedMap.get(key);
           if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
             mergedMap.set(key, item);
           }
        });
        
        const mergedItems = Array.from(mergedMap.values());
        mergedItems.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        callback(mergedItems);
      } catch (e) {
        callback(cachedFirestoreList);
      }
    };
    
    window.addEventListener('storage', handler);
    window.addEventListener('tashidotv_update', handler);

    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('tashidotv_update', handler);
    };
  } catch (err) {
    console.warn("Firestore listener setup failed. Falling back to static fetch.", err);
    if (onError) onError(err);
    getAllWatchHistory(userId).then(callback);
    return () => {};
  }
}

// ----------------------------------------------------
// WATCH SESSIONS & ANALYTICS
// ----------------------------------------------------

// Log a watch session for analytics (time-series graphing)
export async function logWatchSession(uid, mediaId, mediaType, title, genresArray, sessionDurationMinutes) {
  if (!uid || sessionDurationMinutes <= 0) return;
  try {
    const colRef = collection(db, 'users', uid, 'watchSessions');
    await addDoc(colRef, {
      mediaId: Number(mediaId),
      mediaType: mediaType || 'movie',
      title: title || 'Unknown',
      genres: Array.isArray(genresArray) ? genresArray : [],
      durationMinutes: Number(sessionDurationMinutes),
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error('Failed to log watch session to Firestore', err);
  }
}

// Fetch all watch sessions for user analytics
export async function getUserWatchSessions(uid) {
  if (!uid) return [];
  try {
    const colRef = collection(db, 'users', uid, 'watchSessions');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(docSnap => {
      const data = docSnap.data();
      let createdTime = Date.now();
      if (data.createdAt) {
        if (typeof data.createdAt.toMillis === 'function') createdTime = data.createdAt.toMillis();
        else if (data.createdAt.seconds) createdTime = data.createdAt.seconds * 1000;
      }
      return {
        id: docSnap.id,
        ...data,
        createdAt: createdTime
      };
    });
  } catch (err) {
    console.warn('Failed to fetch user watch sessions', err);
    return [];
  }
}
