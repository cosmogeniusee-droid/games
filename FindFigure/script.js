// ==================== Data ====================

const SHAPE_KEYS = ['triangle','square','rectangle','circle','rhombus','hexagon','heart','star5','star6','parallelogram','trapezoid','ellipse'];

const COLORS = ['#4251f5', '#f22225', '#f2f222','#03a806','#f52fc7','#8e2ff5','#f5812f','#42f5e3'];

// Default: 3 shapes — indices: 0=red,2=yellow,3=green,4=blue,5=purple,6=pink,9=cyan,11=lime
const DEFAULT_CONFIG = [
    { s: 'circle',   c: [0, 4, 3],  t: [0]  },
    { s: 'triangle', c: [2, 1, 5],  t: [2]  },
    { s: 'square',   c: [9, 6, 11], t: [9]  }
];

// ==================== URL Parameters ====================

const urlParams  = new URLSearchParams(window.location.search);
const GRID_SIZE  = parseInt(urlParams.get('gridSize') || '7', 10);
const MIN_OCC    = parseInt(urlParams.get('min')      || '4', 10);
const MAX_OCC    = parseInt(urlParams.get('max')      || '7', 10);
const TIME_LIMIT = parseInt(urlParams.get('time')     || '0', 10);
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

let figureConfig;
try {
    const raw = urlParams.get('config');
    figureConfig = raw
        ? raw.split('.').filter(Boolean).map(seg => {
            const [si, c, t] = seg.split('-');
            const s = SHAPE_KEYS[+si];
            return { s, c: c ? c.split('_').map(Number) : [], t: t ? t.split('_').map(Number) : [] };
          })
        : DEFAULT_CONFIG;
} catch (e) {
    figureConfig = DEFAULT_CONFIG;
}

// ==================== SVG Generation ====================

function starPts(cx, cy, outerR, innerR, n) {
    return Array.from({ length: n * 2 }, (_, i) => {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (i * Math.PI / n) - Math.PI / 2;
        return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
}

function hexPts(cx, cy, r) {
    return Array.from({ length: 6 }, (_, i) => {
        const a = (i * 60 - 30) * Math.PI / 180;
        return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
}

function shapeSVG(shape, color) {
    const fill   = COLORS[color] || '#aaa';
    const stroke = 'rgba(0,0,0,0.2)';
    const sw     = 3;
    let body = '';
    switch (shape) {
        case 'triangle':
            body = `<polygon points="50,7 93,90 7,90" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
            break;
        case 'square':
            body = `<rect x="10" y="10" width="80" height="80" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
            break;
        case 'rectangle':
            body = `<rect x="5" y="22" width="90" height="56" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
            break;
        case 'circle':
            body = `<circle cx="50" cy="50" r="43" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
            break;
        case 'rhombus':
            body = `<polygon points="50,5 95,50 50,95 5,50" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
            break;
        case 'hexagon':
            body = `<polygon points="${hexPts(50,50,44)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
            break;
        case 'heart':
            body = `<path d="M50,78 C18,60 5,35 5,25 C5,11 16,5 28,5 C37,5 44,11 50,20 C56,11 63,5 72,5 C84,5 95,11 95,25 C95,35 82,60 50,78 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
            break;
        case 'star5':
            body = `<polygon points="${starPts(50,50,46,18,5)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
            break;
        case 'star6':
            body = `<polygon points="${starPts(50,50,46,22,6)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
            break;
        case 'parallelogram':
            body = `<polygon points="22,88 10,12 78,12 90,88" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
            break;
        case 'trapezoid':
            body = `<polygon points="10,88 90,88 70,12 30,12" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
            break;
        case 'ellipse':
            body = `<ellipse cx="50" cy="50" rx="47" ry="28" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
            break;
        default:
            body = `<circle cx="50" cy="50" r="43" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    }
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

// ==================== DOM ====================

const gameBoard             = document.getElementById('game-board');
const targetDisplay         = document.getElementById('target-letters-display');
const remainingCountDisplay = document.getElementById('remaining-count');
const startButton           = document.getElementById('start-button');
const messageArea           = document.getElementById('message-area');
const fullscreenButton      = document.getElementById('fullscreen-button');
const timerDisplay          = document.getElementById('timer');
const errorCountDisplay     = document.getElementById('error-count');

// ==================== Game State ====================

let remainingCount = 0;
let isGameActive   = false;
let errorCount     = 0;
let timerInterval  = null;

// ==================== Fullscreen ====================

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        fullscreenButton.textContent = 'Выйти ↔️';
    } else {
        document.exitFullscreen();
        fullscreenButton.textContent = 'На весь экран ↔️';
    }
}

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) fullscreenButton.textContent = 'На весь экран ↔️';
});

// ==================== Timer ====================

function fmtTime(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function startTimer() {
    if (TIME_LIMIT > 0) {
        // Countdown mode
        let remaining = TIME_LIMIT;
        timerDisplay.textContent = fmtTime(remaining);
        timerInterval = setInterval(() => {
            remaining--;
            timerDisplay.textContent = fmtTime(remaining);
            if (remaining <= 10) {
                timerDisplay.classList.add('timer-urgent');
            }
            if (remaining <= 0) {
                stopTimer();
                endGame(false);
            }
        }, 1000);
    } else {
        // Count-up mode
        const t0 = Date.now();
        timerInterval = setInterval(() => {
            const s = Math.floor((Date.now() - t0) / 1000);
            timerDisplay.textContent = fmtTime(s);
        }, 500);
    }
}

function stopTimer() {
    clearInterval(timerInterval);
    timerDisplay.classList.remove('timer-urgent');
}

// ==================== Generation ====================

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function buildCombos() {
    const targets = [], distractors = [];
    figureConfig.forEach(fc => {
        const tSet = new Set(fc.t || []);
        (fc.c || []).forEach(color => {
            (tSet.has(color) ? targets : distractors).push({ shape: fc.s, color });
        });
    });
    return { targets, distractors };
}

function generateCells() {
    const { targets, distractors } = buildCombos();
    const cells = [];

    targets.forEach(combo => {
        const n = Math.floor(Math.random() * (MAX_OCC - MIN_OCC + 1)) + MIN_OCC;
        for (let i = 0; i < n; i++) cells.push({ ...combo, isTarget: true });
    });

    const pool = distractors.length ? distractors : targets;
    while (cells.length < TOTAL_CELLS) {
        cells.push({ ...pool[Math.floor(Math.random() * pool.length)], isTarget: false });
    }
    cells.length = TOTAL_CELLS;
    remainingCount = cells.filter(c => c.isTarget).length;
    return shuffle(cells);
}

function buildTargetHTML() {
    const { targets } = buildCombos();
    if (!targets.length) return '—';
    const seen = new Set();
    return targets
        .filter(t => { const k = `${t.shape}:${t.color}`; return seen.has(k) ? false : seen.add(k); })
        .map(t => {
            const icon = shapeSVG(t.shape, t.color);
            return `<span class="target-item"><span class="target-icon">${icon}</span></span>`;
        }).join(' ');
}

function renderBoard(cells) {
    gameBoard.innerHTML = '';
    gameBoard.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
    gameBoard.style.gridTemplateRows    = `repeat(${GRID_SIZE}, 1fr)`;
    cells.forEach((cell, i) => {
        const div = document.createElement('div');
        div.className = 'figure-cell';
        div.innerHTML = shapeSVG(cell.shape, cell.color);
        div.dataset.isTarget = cell.isTarget ? '1' : '0';
        div.dataset.index = i;
        div.addEventListener('click', handleClick);
        gameBoard.appendChild(div);
    });
}

// ==================== Game Logic ====================

function handleClick(e) {
    if (!isGameActive) return;
    const cell = e.currentTarget;
    if (cell.classList.contains('found')) return;
    if (cell.dataset.isTarget === '1') {
        cell.classList.add('found');
        remainingCount--;
        remainingCountDisplay.textContent = remainingCount;
        if (remainingCount === 0) endGame(true);
    } else {
        cell.classList.add('wrong');
        errorCount++;
        errorCountDisplay.textContent = errorCount;
        setTimeout(() => cell.classList.remove('wrong'), 500);
    }
}

function endGame(win) {
    stopTimer();
    isGameActive = false;
    gameBoard.classList.add('disabled');
    startButton.textContent = 'Сыграть ещё раз! 🎉';
    messageArea.classList.remove('hidden');
    if (win) {
        messageArea.innerHTML = `ПОБЕДА! 🎉 Время: ${timerDisplay.textContent}. Ошибок: ${errorCount}. Ты нашёл все фигуры!`;
        messageArea.style.backgroundColor = '#a4f5aa';
        messageArea.style.borderColor = '#3cb371';
    } else {
        messageArea.innerHTML = `ВРЕМЯ ВЫШЛО! ⏰ Не успел... Осталось найти: ${remainingCount}. Ошибок: ${errorCount}.`;
        messageArea.style.backgroundColor = '#f5a4a4';
        messageArea.style.borderColor = '#c0392b';
    }
}

function generateGameField() {
    targetDisplay.innerHTML = buildTargetHTML();
    const cells = generateCells();
    remainingCountDisplay.textContent = remainingCount;
    renderBoard(cells);
}

function startGame() {
    isGameActive = true;
    errorCount = 0;
    messageArea.classList.add('hidden');
    gameBoard.classList.remove('disabled');
    startButton.textContent = 'Новая игра!';
    errorCountDisplay.textContent = '0';
    stopTimer();
    timerDisplay.textContent = TIME_LIMIT > 0 ? fmtTime(TIME_LIMIT) : '00:00';
    generateGameField();
    startTimer();
}

// ==================== Init ====================

startButton.addEventListener('click', startGame);
fullscreenButton.addEventListener('click', toggleFullScreen);

generateGameField();
remainingCountDisplay.textContent = '...';
gameBoard.classList.add('disabled');