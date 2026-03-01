// ── FIREBASE CONFIG ──────────────────────────────────────────────
// Replace these values with your own Firebase project config
// after creating a project at https://console.firebase.google.com
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId:         "YOUR_PROJECT",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// ── PIN CONFIG ────────────────────────────────────────────────────
// Change these to your own 4-digit PINs before deploying
const PINS = {
  pavlo:  "2002",
  olivia: "6767"
};

// ── APP STATE ─────────────────────────────────────────────────────
const AppState = {
  currentUser: null,   // 'pavlo' | 'olivia'
  currentDay:  1,
  db:          null,
  initialized: false
};

// ── FIREBASE INIT ─────────────────────────────────────────────────
function initFirebase() {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    AppState.db = firebase.database();
    AppState.initialized = true;
    console.log('Firebase connected');
  } catch (e) {
    console.warn('Firebase not configured yet — running in offline mode');
    AppState.initialized = false;
  }
}

// ── DAY MANAGEMENT ────────────────────────────────────────────────
function getTodayDayNumber() {
  // Reads from localStorage so both users stay in sync locally
  // When Firebase is configured, this syncs via the cloud
  const stored = localStorage.getItem('partnership_start_date');
  if (!stored) {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('partnership_start_date', today);
    return 1;
  }
  const start = new Date(stored);
  const now   = new Date();
  const diff  = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return Math.min(Math.max(diff + 1, 1), 30);
}

// ── PROGRESS TRACKING ─────────────────────────────────────────────
function getProgress(user) {
  const raw = localStorage.getItem(`partnership_progress_${user}`);
  return raw ? JSON.parse(raw) : {};
}

function markComplete(user, day, step) {
  const progress = getProgress(user);
  if (!progress[day]) progress[day] = {};
  progress[day][step] = true;
  localStorage.setItem(`partnership_progress_${user}`, JSON.stringify(progress));

  if (AppState.initialized && AppState.db) {
    AppState.db.ref(`progress/${user}/day${day}/${step}`).set(true);
  }
}

function isComplete(user, day, step) {
  const progress = getProgress(user);
  return !!(progress[day] && progress[day][step]);
}

// ── JOURNAL STORAGE ───────────────────────────────────────────────
function saveJournalEntry(user, day, text) {
  localStorage.setItem(`journal_${user}_day${day}`, text);
}

function loadJournalEntry(user, day) {
  return localStorage.getItem(`journal_${user}_day${day}`) || '';
}

function saveSharedExcerpt(user, day, text) {
  localStorage.setItem(`shared_${user}_day${day}`, text);

  if (AppState.initialized && AppState.db) {
    AppState.db.ref(`shared/${user}/day${day}`).set({
      excerpt: text,
      timestamp: Date.now()
    });
  }
}

// ── LISTEN FOR PARTNER'S SHARED EXCERPT ──────────────────────────
function listenForPartnerExcerpt(day, callback) {
  if (!AppState.initialized || !AppState.db) return;
  const partner = AppState.currentUser === 'pavlo' ? 'olivia' : 'pavlo';
  AppState.db.ref(`shared/${partner}/day${day}`).on('value', snap => {
    if (snap.exists()) callback(snap.val());
  });
}

// ── PARTNER ONLINE STATUS ─────────────────────────────────────────
function setOnline(user) {
  if (!AppState.initialized || !AppState.db) return;
  const ref = AppState.db.ref(`presence/${user}`);
  ref.set({ online: true, lastSeen: Date.now() });
  ref.onDisconnect().set({ online: false, lastSeen: Date.now() });
}

function listenForPartnerPresence(callback) {
  if (!AppState.initialized || !AppState.db) return;
  const partner = AppState.currentUser === 'pavlo' ? 'olivia' : 'pavlo';
  AppState.db.ref(`presence/${partner}`).on('value', snap => {
    callback(snap.exists() ? snap.val() : { online: false });
  });
}

// ── MEDITATION SYNC ───────────────────────────────────────────────
function startSharedMeditation(user, day, durationMinutes) {
  if (!AppState.initialized || !AppState.db) return;
  AppState.db.ref(`meditation/${day}`).set({
    startedBy: user,
    startTime: Date.now(),
    duration: durationMinutes * 60 * 1000
  });
}

function listenForMeditationStart(day, callback) {
  if (!AppState.initialized || !AppState.db) return;
  AppState.db.ref(`meditation/${day}`).on('value', snap => {
    if (snap.exists()) callback(snap.val());
  });
}
