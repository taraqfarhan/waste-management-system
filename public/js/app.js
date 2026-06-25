/* ═══════════════════════════════════════
   app.js — Shared utilities
   ═══════════════════════════════════════ */

// ── Language strings ─────────────────────────────────
const LANG = {
  en: {
    home: 'Home', about: 'About', stations: 'Stations',
    map: 'Map', login: 'Login', logout: 'Logout',
    dashboard: 'Dashboard', myComplaints: 'My Complaints',
    adminPanel: 'Admin Panel',
    liveMon: 'Live Monitoring', transferStations: 'Transfer Stations',
    loading: 'Loading stations…', contact: 'Contact Station',
    complaint: 'Submit Complaint', history: 'View History',
    noContact: 'No Contact Available',
  },
  bn: {
    home: 'হোম', about: 'সম্পর্কে', stations: 'স্টেশন',
    map: 'মানচিত্র', login: 'লগইন', logout: 'লগআউট',
    dashboard: 'ড্যাশবোর্ড', myComplaints: 'আমার অভিযোগ',
    adminPanel: 'অ্যাডমিন প্যানেল',
    liveMon: 'সরাসরি পর্যবেক্ষণ', transferStations: 'ট্রান্সফার স্টেশন',
    loading: 'স্টেশন লোড হচ্ছে…', contact: 'স্টেশন যোগাযোগ',
    complaint: 'অভিযোগ দাখিল', history: 'ইতিহাস দেখুন',
    noContact: 'যোগাযোগ নম্বর নেই',
  },
};

let currentLang = localStorage.getItem('lang') || 'en';

function t(key) {
  return LANG[currentLang][key] || LANG.en[key] || key;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
  applyLang();
}

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });
}

// ── Dark / Light mode ─────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved, false);
}

function applyTheme(theme, save = true) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('light-mode', !isDark);
  if (save) localStorage.setItem('theme', theme);
  // Update all toggle buttons on the page
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  });
}

function toggleTheme() {
  const current = localStorage.getItem('theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ── Auth state ────────────────────────────────────────
let currentUser = null;

async function loadAuthState() {
  try {
    const r = await fetch('/api/auth/me');
    const { user } = await r.json();
    currentUser = user;
    renderNavAuth();
  } catch {}
}

function renderNavAuth() {
  const navLinks = document.getElementById('navLinks');
  if (!navLinks) return;

  // Remove old auth items
  navLinks.querySelectorAll('.auth-nav-item').forEach(el => el.remove());

  if (currentUser) {
    const pill = document.createElement('div');
    pill.className = 'user-pill auth-nav-item';
    pill.innerHTML = `👤 <span>${currentUser.name.split(' ')[0]}</span>`;

    if (currentUser.role === 'admin') {
      const adminBtn = makeNavBtn('adminPanel', '/admin.html', 'nav-btn--gold');
      adminBtn.className += ' auth-nav-item';
      navLinks.appendChild(adminBtn);
    } else {
      const myBtn = makeNavBtn('myComplaints', '/my-complaints.html');
      myBtn.className += ' auth-nav-item';
      navLinks.appendChild(myBtn);
    }

    navLinks.appendChild(pill);

    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'nav-btn nav-btn--red auth-nav-item';
    logoutBtn.dataset.i18n = 'logout';
    logoutBtn.textContent = t('logout');
    logoutBtn.onclick = async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      currentUser = null;
      renderNavAuth();
      showToast('Logged out');
    };
    navLinks.appendChild(logoutBtn);
  } else {
    const loginBtn = makeNavBtn('login', '/login.html');
    loginBtn.className += ' auth-nav-item';
    navLinks.appendChild(loginBtn);
  }
  applyLang();
}

function makeNavBtn(i18nKey, href, extraClass = '') {
  const a = document.createElement('a');
  a.href = href;
  a.className = `nav-btn ${extraClass}`;
  a.dataset.i18n = i18nKey;
  a.textContent = t(i18nKey);
  return a;
}

// ── Nav active state ──────────────────────────────────
function highlightNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
}

// ── Toast ─────────────────────────────────────────────
function showToast(msg, isError = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (isError ? ' toast-error' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  highlightNav();
  await loadAuthState();

  // Lang toggle buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
  applyLang();

  // Theme toggle buttons
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });
  // Re-apply to sync icon state after DOM is ready
  applyTheme(localStorage.getItem('theme') || 'dark', false);
});
