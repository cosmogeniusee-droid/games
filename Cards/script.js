'use strict';

/* ================================================
   Cards Game — script.js
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
  theme: 'ocean',
  // Animation settings live in theme_{id}/theme.js — not stored in config
};

const BACK_ICONS = ['🌟','🎨','🎯','🎪','🎭','🎬','🦋','🌙','🔮','🌺','🍀','🎵'];

// ── State ─────────────────────────────────────────────────────────────────────
let config        = null;
let currentTheme  = null;   // loaded from theme_{id}/theme.js
let timerInterval = null;
let startTime     = null;
let timerStarted  = false;
let openedCount   = 0;
let totalCards    = 0;
let gameActive    = false;

// ── Theme loader ──────────────────────────────────────────────────────────────
function loadTheme(themeId) {
  return new Promise(resolve => {
    // Update the <link> tag so CSS variables switch immediately
    const link = document.getElementById('theme-css');
    if (link) link.href = 'theme_' + themeId + '/theme.css';

    // If already loaded by a previous call, reuse
    if (window.CARDS_THEMES && window.CARDS_THEMES[themeId]) {
      resolve(window.CARDS_THEMES[themeId]);
      return;
    }
    // Dynamically inject theme.js (works from file:// as well as http)
    const s = document.createElement('script');
    s.src = 'theme_' + themeId + '/theme.js';
    s.onload  = () => resolve((window.CARDS_THEMES || {})[themeId] || null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const timerEl   = document.getElementById('timerEl');
const openedEl  = document.getElementById('openedCount');
const totalEl   = document.getElementById('totalCount');
const cardsGrid = document.getElementById('cardsGrid');
const finishOvr = document.getElementById('finish-overlay');

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
  config = loadConfig();

  clearInterval(timerInterval);
  timerInterval = null;
  startTime     = null;
  timerStarted  = false;
  openedCount   = 0;
  gameActive    = true;
  totalCards    = config.cards.length;

  // Load theme data from theme_{id}/ subfolder
  const themeId = config.theme || 'ocean';
  currentTheme  = await loadTheme(themeId);
  const flipAnim  = (currentTheme && currentTheme.flipAnim)  || 'flip';
  const startAnim = (currentTheme && currentTheme.startAnim) || 'cascade';

  document.body.className = `anim-${flipAnim}`;

  // Reset UI
  timerEl.textContent  = '0.0';
  openedEl.textContent = '0';
  totalEl.textContent  = totalCards;
  finishOvr.innerHTML  = '';
  const oldMsg = document.querySelector('.finish-message');
  if (oldMsg) oldMsg.remove();
  document.getElementById('cardsGrid').classList.remove('finish-rainbow');

  // Build shuffled card grid
  cardsGrid.innerHTML = '';
  cardsGrid.className = `cards-grid start-${startAnim}`;

  if (totalCards === 0) {
    cardsGrid.innerHTML = '<div class="empty-state">Карточки не добавлены.<br>Откройте конфигуратор и создайте карточки.</div>';
    gameActive = false;
    return;
  }

  shuffle(config.cards).forEach((card, i) => {
    const wrapper = buildCard(card, i);
    cardsGrid.appendChild(wrapper);
  });
}

function restartGame() {
  init();
}

// ── Card element factory ──────────────────────────────────────────────────────
function buildCard(card, index) {
  const wrapper = document.createElement('div');
  wrapper.className = 'card-wrapper';
  wrapper.style.animationDelay = (index * 70) + 'ms';

  const inner = document.createElement('div');
  inner.className = 'card-inner';

  // Back face
  const back = document.createElement('div');
  back.className = 'card-face card-back';
  back.innerHTML = `
    <div class="card-back-dots"></div>
    <div class="card-back-shine"></div>
    <div class="card-back-icon">${BACK_ICONS[index % BACK_ICONS.length]}</div>
  `;

  // Front face
  const front = document.createElement('div');
  front.className = 'card-face card-front';

  const imageArea = document.createElement('div');
  imageArea.className = 'card-image-area';

  if (card.image) {
    const img = document.createElement('img');
    img.className = 'card-img';
    img.src = card.image;
    img.alt = card.word;
    imageArea.appendChild(img);
  } else {
    const emojiEl = document.createElement('div');
    emojiEl.className = 'card-emoji';
    emojiEl.textContent = card.emoji || '❓';
    imageArea.appendChild(emojiEl);
  }

  const wordEl = document.createElement('div');
  wordEl.className = 'card-word';
  wordEl.textContent = card.word;

  front.appendChild(imageArea);
  front.appendChild(wordEl);

  inner.appendChild(back);
  inner.appendChild(front);
  wrapper.appendChild(inner);

  wrapper.addEventListener('click', () => handleClick(inner, wrapper));
  return wrapper;
}

// ── Card click handler ────────────────────────────────────────────────────────
function handleClick(inner, wrapper) {
  if (!gameActive || inner.classList.contains('flipped')) return;

  // Start timer on first flip
  if (!timerStarted) {
    timerStarted = true;
    startTime    = Date.now();
    timerInterval = setInterval(() => {
      timerEl.textContent = ((Date.now() - startTime) / 1000).toFixed(1);
    }, 100);
  }

  inner.classList.add('flipped');
  wrapper.style.cursor = 'default';
  onCardRevealed();
}

function onCardRevealed() {
  openedCount++;
  openedEl.textContent = openedCount;

  if (openedCount === totalCards) {
    clearInterval(timerInterval);
    gameActive = false;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    timerEl.textContent = elapsed;
    // Slight delay so last card animation can settle
    setTimeout(() => triggerFinish(elapsed), 480);
  }
}

// ── Finish animations ─────────────────────────────────────────────────────────
function triggerFinish(time) {
  // Congratulation popup
  const msg = document.createElement('div');
  msg.className = 'finish-message';
  msg.innerHTML = `🎉 Молодец!<br><span style="font-size:.85em;font-weight:500">Время: ${time} с</span>`;
  document.body.appendChild(msg);

  const anim = (currentTheme && currentTheme.finishAnim) || 'confetti';
  if      (anim === 'confetti')  triggerConfetti();
  else if (anim === 'stars')     triggerStars();
  else if (anim === 'fireworks') triggerFireworks();
  else if (anim === 'rainbow')   triggerRainbow();
}

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
