'use strict';

/* ================================================
   Cards Game — script.js
   Thin loader: loads theme + gametype engine,
   delegates all game logic to gametype_{id}/gametype.js
   ================================================ */

// ── Default config (shown when no teacher config saved) ───────────────────────
const DEFAULT_CONFIG = {
  cards: [
    { word: 'Яблоко',  emoji: '🍎', image: null },
    { word: 'Кот',     emoji: '🐱', image: null },
    { word: 'Собака',  emoji: '🐶', image: null },
    { word: 'Солнце',  emoji: '☀️', image: null },
    { word: 'Дом',     emoji: '🏠', image: null },
    { word: 'Машина',  emoji: '🚗', image: null },
  ],
  theme:    'ocean',
  gameType: 'flip',
  // Animation settings live in theme_{id}/theme.js — not stored in config
};

const BACK_ICONS = ['🌟','🎨','🎯','🎪','🎭','🎬','🦋','🌙','🔮','🌺','🍀','🎵'];

// ── State ─────────────────────────────────────────────────────────────────────
let currentTheme  = null;   // loaded from theme_{id}/theme.js

// ── Theme sound preload cache ─────────────────────────────────────────────────
window._preloadedAudio = window._preloadedAudio || {};

function preloadThemeSounds(theme) {
  if (!theme) return;
  ['flipSound', 'matchSound', 'mismatchSound', 'finishSound'].forEach(key => {
    const url = theme[key];
    if (url && !window._preloadedAudio[url]) {
      const a = new Audio(url);
      a.preload = 'auto';
      window._preloadedAudio[url] = a;
    }
  });
}

// ── Theme loader ──────────────────────────────────────────────────────────────
function loadTheme(themeId) {
  return new Promise(resolve => {
    // Update the <link> tag so CSS variables switch immediately
    const link = document.getElementById('theme-css');
    if (link) link.href = 'theme_' + themeId + '/theme.css';

    const done = (t) => { preloadThemeSounds(t); resolve(t); };

    // If already loaded by a previous call, reuse
    if (window.CARDS_THEMES && window.CARDS_THEMES[themeId]) {
      done(window.CARDS_THEMES[themeId]);
      return;
    }
    // Dynamically inject theme.js (works from file:// as well as http)
    const s = document.createElement('script');
    s.src = 'theme_' + themeId + '/theme.js';
    s.onload  = () => done((window.CARDS_THEMES || {})[themeId] || null);
    s.onerror = () => done(null);
    document.head.appendChild(s);
  });
}

// ── Game type loader ──────────────────────────────────────────────────────────
function loadGameType(id) {
  return new Promise(resolve => {
    if (window.CARDS_GAME_ENGINE && window.CARDS_GAME_ENGINE[id]) {
      resolve(window.CARDS_GAME_ENGINE[id]);
      return;
    }
    const s = document.createElement('script');
    s.src = 'gametype_' + id + '/gametype.js';
    s.onload  = () => resolve((window.CARDS_GAME_ENGINE || {})[id] || null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const timerEl         = document.getElementById('timerEl');
const openedEl        = document.getElementById('openedCount');
const totalEl         = document.getElementById('totalCount');
const progressLabelEl = document.getElementById('progressLabel');
const cardsGrid       = document.getElementById('cardsGrid');
const finishOvr       = document.getElementById('finish-overlay');

// ── Config loader ─────────────────────────────────────────────────────────────
function loadConfig() {
  try {
    const raw = localStorage.getItem('cards-game-config');
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return DEFAULT_CONFIG;
}

// ── Shuffle (Fisher-Yates) ────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Init / Restart ────────────────────────────────────────────────────────────
async function init() {
  const config     = loadConfig();
  const themeId    = config.theme    || 'ocean';
  const gameTypeId = config.gameType || 'flip';

  // Clean up DOM
  cardsGrid.innerHTML = '';
  finishOvr.innerHTML = '';
  cardsGrid.classList.remove('finish-rainbow');
  const oldMsg = document.querySelector('.finish-message');
  if (oldMsg) oldMsg.remove();

  const [theme, engine] = await Promise.all([
    loadTheme(themeId),
    loadGameType(gameTypeId),
  ]);
  currentTheme = theme;

  if (!engine) {
    cardsGrid.innerHTML = '<div class="empty-state">Тип игры не найден.</div>';
    return;
  }

  engine.init({
    config, theme,
    grid:            cardsGrid,
    overlay:         finishOvr,
    timerEl, openedEl, totalEl, progressLabelEl,
    shuffle, BACK_ICONS,
    onFinish(elapsed) { showFinish(elapsed, theme); },
  });
}

function restartGame() { init(); }

// ── Finish UI ─────────────────────────────────────────────────────────────────
function showFinish(elapsed, theme) {
  const msg = document.createElement('div');
  msg.className = 'finish-message';
  msg.innerHTML = `🎉 Молодец!<br><span style="font-size:.85em;font-weight:500">Время: ${elapsed} с</span>`;
  document.body.appendChild(msg);

  // Play finish sound if theme defines one
  const fsUrl = theme && theme.finishSound;
  if (fsUrl) {
    try {
      const a = (window._preloadedAudio && window._preloadedAudio[fsUrl])
        ? window._preloadedAudio[fsUrl]
        : new Audio(fsUrl);
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch (_) {}
  }

  const anim = (theme && theme.finishAnim) || 'confetti';
  if      (anim === 'confetti')  triggerConfetti();
  else if (anim === 'stars')     triggerStars();
  else if (anim === 'fireworks') triggerFireworks();
  else if (anim === 'rainbow')   triggerRainbow();
}

// ── Finish animations ─────────────────────────────────────────────────────────
function triggerConfetti() {
  const colors = ['#ff4757','#ffa502','#2ed573','#1e90ff','#ff6b81','#eccc68','#a29bfe','#fd79a8','#00cec9'];
  for (let i = 0; i < 90; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left      = (Math.random() * 100) + 'vw';
      p.style.top       = '-18px';
      p.style.width     = (7 + Math.random() * 7) + 'px';
      p.style.height    = (10 + Math.random() * 10) + 'px';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dur',  (1.4 + Math.random() * 2.2) + 's');
      p.style.setProperty('--spin', (Math.random() * 720 - 360) + 'deg');
      finishOvr.appendChild(p);
      p.addEventListener('animationend', () => p.remove(), { once: true });
    }, i * 22);
  }
}

function triggerStars() {
  const emojis = ['⭐','🌟','✨','💫','🌠'];
  for (let i = 0; i < 50; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.className = 'star-piece';
      p.textContent = emojis[i % emojis.length];
      p.style.left     = (5 + Math.random() * 90) + 'vw';
      p.style.top      = (20 + Math.random() * 60) + 'vh';
      p.style.fontSize = (1.2 + Math.random() * 1.6) + 'rem';
      p.style.setProperty('--dur', (0.8 + Math.random() * 1.4) + 's');
      finishOvr.appendChild(p);
      p.addEventListener('animationend', () => p.remove(), { once: true });
    }, i * 40);
  }
}

function triggerFireworks() {
  const colors = ['#ff4757','#ffa502','#2ed573','#1e90ff','#a29bfe','#fdcb6e','#e17055','#fd79a8'];
  for (let b = 0; b < 6; b++) {
    setTimeout(() => {
      const cx = (10 + Math.random() * 80) + 'vw';
      const cy = (5  + Math.random() * 55) + 'vh';
      for (let j = 0; j < 24; j++) {
        const el = document.createElement('div');
        el.className = 'fw-piece';
        el.style.left = cx;
        el.style.top  = cy;
        el.style.background = colors[(b * 4 + j) % colors.length];
        const angle = (j / 24) * Math.PI * 2;
        const dist  = 70 + Math.random() * 130;
        el.style.setProperty('--fx', (Math.cos(angle) * dist) + 'px');
        el.style.setProperty('--fy', (Math.sin(angle) * dist) + 'px');
        el.style.setProperty('--dur', (0.5 + Math.random() * 0.5) + 's');
        finishOvr.appendChild(el);
        el.addEventListener('animationend', () => el.remove(), { once: true });
      }
    }, b * 300);
  }
}

function triggerRainbow() {
  cardsGrid.classList.add('finish-rainbow');
  setTimeout(() => cardsGrid.classList.remove('finish-rainbow'), 2200);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
window.addEventListener('load', init);
