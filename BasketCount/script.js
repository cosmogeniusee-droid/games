// ── Настройки из URL ────────────────────────────────────────
const params = new URLSearchParams(window.location.search);

// Разбирает список предметов одной корзины: "🍎:4,🧍:2" → [{emoji,target}, ...]
function parseBasket(raw) {
    const list = [];
    raw.split(',').forEach(part => {
        const token = part.trim();
        if (!token) return;
        const idx = token.lastIndexOf(':');
        if (idx < 1) return;
        const emoji = token.slice(0, idx).trim();
        const count = parseInt(token.slice(idx + 1), 10);
        if (!emoji || isNaN(count) || count < 0) return;
        list.push({ emoji, target: count });
    });
    return list;
}

// task: несколько корзин через ";", предметы внутри корзины через ",".
// Напр. "🍎:4,🍌:2;🐱:3" — две корзины.
function parseTask(raw) {
    if (!raw) return null;
    const baskets = raw.split(';')
        .map(parseBasket)
        .filter(b => b.length > 0);
    return baskets.length ? baskets : null;
}

const DEFAULT_TASK = [
    [ { emoji: '🍎', target: 4 }, { emoji: '🍌', target: 2 } ],
];

// BASKETS — массив корзин (уровней). Каждая корзина — список предметов.
const BASKETS = parseTask(params.get('task')) || DEFAULT_TASK;

// Текущая корзина (уровень)
let basketIdx = 0;
let TASK = BASKETS[0]; // список предметов текущей корзины

// Сколько «лишних» предметов каждого вида положить на склад сверх нужного
// (чтобы ребёнок считал, а не просто перетаскивал всё подряд).
const EXTRA = parseInt(params.get('extra') ?? '3', 10);

const bgColor = params.get('bgcolor') ? `#${params.get('bgcolor')}` : '';
if (bgColor) document.body.style.setProperty('background-color', bgColor, 'important');

// ── DOM ─────────────────────────────────────────────────────
const taskInfo        = document.getElementById('task-info');
const taskListEl      = document.getElementById('task-list');
const sourceArea      = document.getElementById('source-area');
const basket          = document.getElementById('basket');
const basketItems     = document.getElementById('basket-items');
const errorCountDisp  = document.getElementById('error-count');
const checkButton     = document.getElementById('check-button');
const startButton     = document.getElementById('start-button');
const fullscreenButton= document.getElementById('fullscreen-button');
const messageArea     = document.getElementById('message-area');

// ── Состояние ───────────────────────────────────────────────
let isGameActive = false;
let errorCount = 0;
let chipEls = {}; // emoji -> элемент чипа задания

// ── Полноэкранный режим ─────────────────────────────────────
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        fullscreenButton.textContent = 'Выйти ↔️';
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
        fullscreenButton.textContent = 'На весь экран ↔️';
    }
}
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) fullscreenButton.textContent = 'На весь экран ↔️';
});

// ── Построение поля ─────────────────────────────────────────
function createItem(emoji, where) {
    const el = document.createElement('div');
    el.className = 'item';
    el.textContent = emoji;
    el.dataset.emoji = emoji;
    el.addEventListener('pointerdown', onItemPointerDown);
    where.appendChild(el);
    return el;
}

function buildField() {
    sourceArea.innerHTML = '';
    basketItems.innerHTML = '';
    chipEls = {};

    // Чипы задания
    taskListEl.innerHTML = '';
    TASK.forEach(t => {
        const chip = document.createElement('div');
        chip.className = 'task-chip';
        chip.innerHTML = `<span class="chip-count">${t.target}</span><span class="chip-emoji">${t.emoji}</span>`;
        taskListEl.appendChild(chip);
        chipEls[t.emoji] = chip;
    });

    // Текст задания (с номером корзины, если их несколько)
    const prefix = BASKETS.length > 1
        ? `Корзина ${basketIdx + 1} из ${BASKETS.length}. `
        : '';
    taskInfo.textContent = prefix + 'Положи в корзину: ' +
        TASK.map(t => `${t.target} ${t.emoji}`).join(', ');

    // Предметы на складе: нужное количество + немного лишних, затем перемешиваем
    const pool = [];
    TASK.forEach(t => {
        const total = t.target + Math.max(0, EXTRA);
        for (let i = 0; i < total; i++) pool.push(t.emoji);
    });
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool.forEach(emoji => createItem(emoji, sourceArea));

    updateProgress();
}

// ── Подсчёт и прогресс ──────────────────────────────────────
function countInBasket(emoji) {
    let n = 0;
    basketItems.querySelectorAll('.item').forEach(el => {
        if (el.dataset.emoji === emoji) n++;
    });
    return n;
}

// Пока игра идёт — подсказки не показываем (чтобы ребёнок считал сам).
// При любом изменении корзины сбрасываем прошлый результат проверки.
function updateProgress() {
    if (!isGameActive) return;
    TASK.forEach(t => {
        const chip = chipEls[t.emoji];
        chip.classList.remove('done', 'over');
    });
    basket.classList.remove('correct', 'wrong');
    messageArea.classList.add('hidden');
}

// Проверка по нажатию кнопки «Проверить»
function checkAnswer() {
    if (!isGameActive) return;

    let allCorrect = true;
    TASK.forEach(t => {
        const have = countInBasket(t.emoji);
        const chip = chipEls[t.emoji];
        chip.classList.toggle('done', have === t.target);
        chip.classList.toggle('over', have !== t.target);
        if (have !== t.target) allCorrect = false;
    });

    // Посторонние предметы (не из задания) тоже считаются ошибкой
    const totalWanted = TASK.reduce((s, t) => s + t.target, 0);
    const totalInBasket = basketItems.querySelectorAll('.item').length;
    if (totalInBasket !== totalWanted) allCorrect = false;

    if (allCorrect) {
        if (basketIdx < BASKETS.length - 1) {
            nextBasket();
        } else {
            endGame();
        }
    } else {
        errorCount++;
        errorCountDisp.textContent = errorCount;
        playWrong();
        basket.classList.add('wrong');
        setTimeout(() => basket.classList.remove('wrong'), 400);
        messageArea.classList.remove('hidden');
        messageArea.innerHTML = 'Не совсем! Проверь количество и попробуй ещё раз. 🤔';
        messageArea.style.backgroundColor = '#ffcdd2';
    }
}

// Корзина собрана верно, но есть ещё — показываем успех и грузим следующую
function nextBasket() {
    isGameActive = false; // блокируем перетаскивание на время перехода
    playClunk();
    basket.classList.add('correct');
    TASK.forEach(t => chipEls[t.emoji].classList.add('done'));
    messageArea.classList.remove('hidden');
    messageArea.style.backgroundColor = '#a4f5aa';
    messageArea.innerHTML = `Отлично! Корзина ${basketIdx + 1} готова! 🎉 Готовим следующую…`;

    setTimeout(() => {
        basketIdx++;
        TASK = BASKETS[basketIdx];
        basket.classList.remove('correct');
        isGameActive = true;
        buildField();
    }, 1400);
}

function endGame() {
    isGameActive = false;
    messageArea.classList.remove('hidden');
    const allDone = BASKETS.length > 1
        ? `МОЛОДЕЦ! 🎉 Все ${BASKETS.length} корзины собраны! Ошибок: ${errorCount}.`
        : `МОЛОДЕЦ! 🎉 Корзина собрана правильно! Ошибок: ${errorCount}.`;
    messageArea.innerHTML = allDone;
    messageArea.style.backgroundColor = '#a4f5aa';
    basket.classList.remove('wrong');
    basket.classList.add('correct');
    playFanfare();
}

// ── Перетаскивание (мышь + сенсор) через Pointer Events ──────
let dragGhost = null;
let dragItem = null;
let dragEmoji = null;
let dragFromBasket = false;
let startX = 0, startY = 0, moved = false;
const THRESHOLD = 6;

function onItemPointerDown(event) {
    if (!isGameActive) return;
    event.preventDefault();
    dragItem = event.currentTarget;
    dragEmoji = dragItem.dataset.emoji;
    dragFromBasket = basketItems.contains(dragItem);
    startX = event.clientX;
    startY = event.clientY;
    moved = false;

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
}

function startGhost() {
    dragItem.classList.add('dragging');
    dragGhost = document.createElement('div');
    dragGhost.className = 'item drag-ghost';
    dragGhost.textContent = dragEmoji;
    // размер эмодзи как у обычного предмета
    const size = getComputedStyle(dragItem).width;
    dragGhost.style.width = size;
    dragGhost.style.height = size;
    dragGhost.style.fontSize = getComputedStyle(dragItem).fontSize;
    document.body.appendChild(dragGhost);
}

function moveGhost(x, y) {
    if (dragGhost) { dragGhost.style.left = `${x}px`; dragGhost.style.top = `${y}px`; }
}

function onPointerMove(event) {
    if (!moved) {
        if (Math.hypot(event.clientX - startX, event.clientY - startY) < THRESHOLD) return;
        moved = true;
        startGhost();
    }
    moveGhost(event.clientX, event.clientY);
    // Подсветка корзины, когда предмет над ней
    const overBasket = isPointOverBasket(event.clientX, event.clientY);
    basket.classList.toggle('hover', overBasket && !dragFromBasket);
}

function onPointerUp(event) {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);

    if (moved) {
        const overBasket = isPointOverBasket(event.clientX, event.clientY);
        if (!dragFromBasket && overBasket) {
            // Переносим предмет со склада в корзину
            moveItemTo(dragItem, basketItems);
            flashBasket();
        } else if (dragFromBasket && !overBasket) {
            // Вынимаем предмет из корзины обратно на склад
            moveItemTo(dragItem, sourceArea);
        }
        updateProgress();
    }

    basket.classList.remove('hover');
    if (dragGhost) dragGhost.remove();
    if (dragItem) dragItem.classList.remove('dragging');
    dragGhost = null; dragItem = null; dragEmoji = null; moved = false;
}

function moveItemTo(item, container) {
    container.appendChild(item);
}

function isPointOverBasket(x, y) {
    const r = basket.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

// Нейтральный звук при добавлении предмета. Проверка — только по кнопке.
function flashBasket() {
    playClunk();
}

// ── Старт игры ──────────────────────────────────────────────
function startGame() {
    isGameActive = true;
    errorCount = 0;
    errorCountDisp.textContent = '0';
    basketIdx = 0;              // начинаем с первой корзины
    TASK = BASKETS[0];
    messageArea.classList.add('hidden');
    messageArea.style.backgroundColor = '';
    basket.classList.remove('correct', 'wrong');
    buildField();
}

checkButton.addEventListener('click', checkAnswer);
startButton.addEventListener('click', startGame);
fullscreenButton.addEventListener('click', toggleFullScreen);

// Строим поле и сразу делаем игру активной, чтобы можно было перетаскивать без нажатия «Начать».
buildField();
isGameActive = true;

// ── Звук (Web Audio API) ────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let actx = null;
function readyCtx() {
    if (!actx) actx = new AudioCtx();
    if (actx.state !== 'running') actx.resume();
    return actx;
}
// разблокируем звук на первом взаимодействии
checkButton.addEventListener('click', () => readyCtx(), { once: true });
startButton.addEventListener('click', () => readyCtx(), { once: true });

function playClunk() {
    const ctx = readyCtx();
    const t = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(760, t + 0.1);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t); osc.stop(t + 0.16);
}

function playWrong() {
    const ctx = readyCtx();
    const t = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.25);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.start(t); osc.stop(t + 0.26);
}

function playFanfare() {
    const ctx = readyCtx();
    const t0 = ctx.currentTime + 0.01;
    [523, 659, 784, 1047].forEach((f, i) => {
        const t = t0 + i * 0.18;
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.04);
        gain.gain.setValueAtTime(0.3, t + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t); osc.stop(t + 0.36);
    });
}
