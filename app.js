// ── NAVIGATION ────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  setNavState(id);
  window.scrollTo(0, 0);
}

function setNavState(activeScreenId) {
  const homeActive = activeScreenId === 'screen-home';
  const togetherActive = activeScreenId === 'screen-shared';

  document.querySelectorAll('.bottom-nav').forEach(nav => {
    const items = nav.querySelectorAll('.nav-item');
    if (items[0]) items[0].classList.toggle('active', homeActive);
    if (items[1]) items[1].classList.toggle('active', togetherActive);
  });
}

function requireUser() {
  if (AppState.currentUser) return true;
  showScreen('screen-lock');
  return false;
}

// ── PIN AUTH ──────────────────────────────────────────────────────
let pinBuffer     = '';
let pendingUser   = null;

function selectUser(user) {
  pendingUser = user;
  pinBuffer   = '';
  updatePinDots();
  document.getElementById('pin-user-label').textContent =
    user === 'pavlo' ? 'Pavlo' : 'Olivia';
  document.getElementById('pin-error').textContent = '';
  const profile = document.getElementById('profile-selection');
  if (profile) profile.style.display = 'none';
  document.querySelectorAll('.pin-screen').forEach(s => s.classList.remove('active'));
  document.getElementById('pin-entry').classList.add('active');
}

function pinKey(val) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += val;
  updatePinDots();
  if (pinBuffer.length === 4) {
    setTimeout(checkPin, 150);
  }
}

function pinDel() {
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();
}

function updatePinDots() {
  document.querySelectorAll('.pin-dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < pinBuffer.length);
  });
}

function checkPin() {
  if (pinBuffer === PINS[pendingUser]) {
    AppState.currentUser = pendingUser;
    AppState.currentDay  = getTodayDayNumber();
    setOnline(pendingUser);
    loadHomeScreen();
    showScreen('screen-home');
  } else {
    document.getElementById('pin-error').textContent = 'Incorrect PIN. Try again.';
    pinBuffer = '';
    updatePinDots();
    // Shake animation
    const dots = document.querySelector('.pin-dots');
    dots.style.animation = 'shake 0.3s ease';
    setTimeout(() => { dots.style.animation = ''; }, 300);
  }
}

function pinBack() {
  pendingUser = null;
  pinBuffer   = '';
  document.getElementById('pin-entry').classList.remove('active');
  const profile = document.getElementById('profile-selection');
  if (profile) profile.style.display = 'block';
}

// ── HOME SCREEN ───────────────────────────────────────────────────
function loadHomeScreen() {
  const user = AppState.currentUser;
  const day  = AppState.currentDay;
  const data = DAYS[day] || DAYS[1];

  // Greeting
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('home-greeting').textContent = greet;
  document.getElementById('home-name').innerHTML =
    user === 'pavlo'
      ? 'Pavlo <em>🌿</em>'
      : 'Olivia <em>🌿</em>';

  document.getElementById('day-badge').textContent = `Day ${day} of 30`;

  // Theme card
  document.getElementById('theme-title').textContent = data.theme;
  document.getElementById('theme-quote').textContent = data.openingQuote;
  document.getElementById('theme-source').textContent = data.quoteSource;

  // Step completion
  ['reading','journal','meditation'].forEach((step, i) => {
    const el = document.getElementById(`step-${step}`);
    if (el) el.classList.toggle('completed', isComplete(user, day, step));
  });
}

// ── READING SCREEN ────────────────────────────────────────────────
function openReading() {
  if (!requireUser()) return;
  const day  = AppState.currentDay;
  const data = DAYS[day] || DAYS[1];

  document.getElementById('reading-theme').textContent  = data.theme;
  document.getElementById('reading-title').textContent  = data.reading.title;
  document.getElementById('reading-source').textContent = data.reading.source;
  document.getElementById('reading-body').innerHTML     = data.reading.body;

  // Personal reflection varies by user
  const user = AppState.currentUser;
  const ref  = data.reading.reflection[user] || data.reading.reflection.shared;
  document.getElementById('reading-reflection').textContent = ref;

  showScreen('screen-reading');
}

function finishReading() {
  if (!requireUser()) return;
  markComplete(AppState.currentUser, AppState.currentDay, 'reading');
  loadHomeScreen();
  showScreen('screen-home');
}

// ── JOURNAL SCREEN ────────────────────────────────────────────────
function openJournal() {
  if (!requireUser()) return;
  const day  = AppState.currentDay;
  const user = AppState.currentUser;
  const data = DAYS[day] || DAYS[1];

  // Prompt varies by user
  const prompt = data.journal.prompt[user] || data.journal.prompt.shared;
  document.getElementById('journal-prompt-text').textContent = prompt;
  document.getElementById('journal-note').textContent        = data.journal.note;

  // Restore saved entry
  document.getElementById('journal-entry').value     = loadJournalEntry(user, day);
  document.getElementById('share-excerpt').value     = '';
  document.getElementById('share-question').textContent = data.journal.shareQuestion;

  showScreen('screen-journal');
}

function autoSaveJournal() {
  if (!requireUser()) return;
  const user = AppState.currentUser;
  const day  = AppState.currentDay;
  const text = document.getElementById('journal-entry').value;
  saveJournalEntry(user, day, text);
}

function submitJournal() {
  if (!requireUser()) return;
  const user    = AppState.currentUser;
  const day     = AppState.currentDay;
  const entry   = document.getElementById('journal-entry').value.trim();
  const excerpt = document.getElementById('share-excerpt').value.trim();

  if (entry.length < 10) {
    alert('Write a little more before finishing 🌿');
    return;
  }

  saveJournalEntry(user, day, entry);
  if (excerpt) saveSharedExcerpt(user, day, excerpt);

  markComplete(user, day, 'journal');
  loadHomeScreen();
  showScreen('screen-home');
}

// ── MEDITATION SCREEN ─────────────────────────────────────────────
let timerInterval   = null;
let timerSeconds    = 15 * 60;
let timerTotal      = 15 * 60;
let timerRunning    = false;
let selectedMinutes = 15;

function openMeditation() {
  if (!requireUser()) return;
  const day  = AppState.currentDay;
  const data = DAYS[day] || DAYS[1];

  document.getElementById('med-focus-text').textContent    = data.meditation.focus;
  document.getElementById('med-instruction').textContent   = data.meditation.instruction;

  setDuration(15);
  resetTimer();
  showScreen('screen-meditation');
}

function setDuration(mins) {
  selectedMinutes = mins;
  document.querySelectorAll('.dur-btn').forEach(b => {
    b.classList.toggle('selected', parseInt(b.dataset.mins) === mins);
  });
  if (!timerRunning) {
    timerSeconds = mins * 60;
    timerTotal   = mins * 60;
    updateTimerDisplay();
    updateTimerRing(1);
  }
}

function toggleTimer() {
  if (timerRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  timerRunning = true;
  document.getElementById('timer-play').textContent = '⏸';
  document.getElementById('timer-phase').textContent = 'Meditating';

  // Sync with partner
  startSharedMeditation(AppState.currentUser, AppState.currentDay, selectedMinutes);

  // Play ambient sound
  playBell();

  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();
    updateTimerRing(timerSeconds / timerTotal);

    if (timerSeconds <= 0) {
      finishTimer();
    }
  }, 1000);
}

function pauseTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  document.getElementById('timer-play').textContent = '▶';
  document.getElementById('timer-phase').textContent = 'Paused';
}

function resetTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  timerSeconds = selectedMinutes * 60;
  timerTotal   = selectedMinutes * 60;
  document.getElementById('timer-play').textContent  = '▶';
  document.getElementById('timer-phase').textContent = 'Ready';
  updateTimerDisplay();
  updateTimerRing(1);
}

function finishTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  document.getElementById('timer-phase').textContent = 'Complete 🌿';
  document.getElementById('timer-play').textContent  = '▶';
  playBell();
  markComplete(AppState.currentUser, AppState.currentDay, 'meditation');
  loadHomeScreen();
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const s = (timerSeconds % 60).toString().padStart(2, '0');
  document.getElementById('timer-time').textContent = `${m}:${s}`;
}

function updateTimerRing(fraction) {
  const circle = document.getElementById('timer-circle');
  const r      = 90;
  const circ   = 2 * Math.PI * r;
  circle.style.strokeDasharray  = circ;
  circle.style.strokeDashoffset = circ * (1 - fraction);
}

// Bell sound using Web Audio API
function playBell() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type      = 'sine';
    osc.frequency.setValueAtTime(528, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(396, ctx.currentTime + 2);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 3);
  } catch(e) {}
}

// Ambient sound (soft wind tone)
let ambientCtx = null;
function toggleAmbient() {
  if (ambientCtx) {
    ambientCtx.close();
    ambientCtx = null;
    return;
  }
  try {
    ambientCtx = new (window.AudioContext || window.webkitAudioContext)();
    const bufferSize = ambientCtx.sampleRate * 2;
    const buffer     = ambientCtx.createBuffer(1, bufferSize, ambientCtx.sampleRate);
    const data       = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source  = ambientCtx.createBufferSource();
    source.buffer = buffer;
    source.loop   = true;
    const filter  = ambientCtx.createBiquadFilter();
    filter.type   = 'lowpass';
    filter.frequency.value = 400;
    const gain    = ambientCtx.createGain();
    gain.gain.value = 0.04;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ambientCtx.destination);
    source.start();
  } catch(e) {}
}

// ── SHARED SCREEN ─────────────────────────────────────────────────
function openShared() {
  if (!requireUser()) return;
  const user    = AppState.currentUser;
  const partner = user === 'pavlo' ? 'olivia' : 'pavlo';
  const day     = AppState.currentDay;

  document.getElementById('your-status').textContent  = `Day ${day} · ${completedCount(user, day)}/3 done`;
  document.getElementById('partner-status').textContent = `Listening for ${partner}...`;

  // Try load partner excerpt
  const cached = localStorage.getItem(`shared_${partner}_day${day}`);
  if (cached) showPartnerExcerpt(partner, cached);

  // Listen for real-time updates
  listenForPartnerExcerpt(day, val => {
    showPartnerExcerpt(partner, val.excerpt || '');
    document.getElementById('partner-status').textContent = 'Shared today ✓';
  });

  listenForPartnerPresence(presence => {
    const dot = document.getElementById('partner-dot');
    if (dot) dot.classList.toggle('offline', !presence.online);
    document.getElementById('partner-status').textContent =
      presence.online ? 'Online now 🌿' : 'Not yet online';
  });

  showScreen('screen-shared');
}

function completedCount(user, day) {
  return ['reading','journal','meditation'].filter(s => isComplete(user, day, s)).length;
}

function showPartnerExcerpt(partner, text) {
  const box = document.getElementById('partner-excerpt-box');
  const txt = document.getElementById('partner-excerpt-text');
  if (text && box && txt) {
    txt.textContent = `"${text}"`;
    box.style.display = 'block';
    const name = partner === 'pavlo' ? 'Pavlo' : 'Olivia';
    document.getElementById('partner-excerpt-name').textContent = `— ${name}`;
  }
}

// ── SHARE MESSAGE ─────────────────────────────────────────────────
function copyShareMessage() {
  if (!requireUser()) return;
  const excerpt = document.getElementById('share-excerpt').value.trim();
  const user    = AppState.currentUser === 'pavlo' ? 'Pavlo' : 'Olivia';
  const day     = AppState.currentDay;
  const data    = DAYS[day] || DAYS[1];

  const msg = excerpt
    ? `🌿 Day ${day} — ${data.theme}\n\n${user} shared:\n"${excerpt}"\n\n— from our partnership practice`
    : `🌿 ${user} completed Day ${day} of our partnership practice — "${data.theme}"`;

  const btn = document.getElementById('copy-btn');

  const markCopied = () => {
    if (!btn) return;
    btn.textContent = 'Copied ✓';
    setTimeout(() => { btn.textContent = 'Copy to send'; }, 2000);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).then(markCopied).catch(() => {});
    return;
  }

  const fallback = document.createElement('textarea');
  fallback.value = msg;
  fallback.setAttribute('readonly', '');
  fallback.style.position = 'absolute';
  fallback.style.left = '-9999px';
  document.body.appendChild(fallback);
  fallback.select();
  try {
    document.execCommand('copy');
    markCopied();
  } catch (e) {
    alert('Copy failed. You can still manually copy your excerpt.');
  }
  document.body.removeChild(fallback);
}

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  updateTimerDisplay();
  updateTimerRing(1);
  setNavState('screen-home');

  // Shake keyframe
  const style = document.createElement('style');
  style.textContent = `@keyframes shake {
    0%,100%{transform:translateX(0)}
    25%{transform:translateX(-8px)}
    75%{transform:translateX(8px)}
  }`;
  document.head.appendChild(style);
});
