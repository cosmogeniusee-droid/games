// ── Настройки из URL ────────────────────────────────────────
const params = new URLSearchParams(window.location.search);

// Направления: вектор [dx, dy] в клетках (y вниз)
const DIR_VEC = {
    up:    [0, -1],
    down:  [0,  1],
    left:  [-1, 0],
    right: [1,  0],
    // диагонали
    upleft:    [-1, -1],
    upright:   [ 1, -1],
    downleft:  [-1,  1],
    downright: [ 1,  1],
};
const DIR_ARROW = {
    up: '↑', down: '↓', left: '←', right: '→',
    upleft: '↖', upright: '↗', downleft: '↙', downright: '↘',
};
const DIAG_DIRS = ['upleft', 'upright', 'downleft', 'downright'];

// Разбор слова-направления (поддержка стрелок и русских слов)
function parseDir(token) {
    const t = token.trim().toLowerCase();
    if (['↑','up','вверх','в','u'].includes(t)) return 'up';
    if (['↓','down','вниз','н','d'].includes(t)) return 'down';
    if (['←','left','влево','л','l'].includes(t)) return 'left';
    if (['→','right','вправо','п','r'].includes(t)) return 'right';
    if (['↖','upleft','вверх-влево','влево-вверх'].includes(t)) return 'upleft';
    if (['↗','upright','вверх-вправо','вправо-вверх'].includes(t)) return 'upright';
    if (['↙','downleft','вниз-влево','влево-вниз'].includes(t)) return 'downleft';
    if (['↘','downright','вниз-вправо','вправо-вниз'].includes(t)) return 'downright';
    return null;
}

// moves: "вправо:3,вверх:2,влево:3,вниз:2" или со стрелками "→:3,↑:2"
function parseMoves(raw) {
    if (!raw) return null;
    const list = [];
    raw.split(',').forEach(part => {
        const token = part.trim();
        if (!token) return;
        // форматы: "dir:n" или "dir n" или "n dir"
        let m = token.match(/^(.+?)[:\s]+(\d+)$/);
        let dirPart, n;
        if (m && parseDir(m[1]) !== null) { dirPart = m[1]; n = parseInt(m[2], 10); }
        else {
            m = token.match(/^(\d+)[:\s]+(.+)$/);
            if (m) { dirPart = m[2]; n = parseInt(m[1], 10); }
        }
        if (!m) return;
        const dir = parseDir(dirPart);
        if (!dir || isNaN(n) || n < 1) return;
        list.push({ dir, count: n });
    });
    return list.length ? list : null;
}

// Фигура по умолчанию — «ступенька» (простая и наглядная)
const DEFAULT_MOVES = [
    { dir: 'right', count: 2 },
    { dir: 'up',    count: 2 },
    { dir: 'right', count: 2 },
    { dir: 'down',  count: 2 },
    { dir: 'right', count: 2 },
];

const MOVES = parseMoves(params.get('moves')) || DEFAULT_MOVES;
// Режим проверки: 'step' (после каждого хода) или 'end' (только в конце)
const CHECK_MODE = params.get('check') === 'end' ? 'end' : 'step';
// Диагональный режим: показывать ли угловые стрелки на пульте.
// Включаем, если задано diag=1 ИЛИ в командах уже есть диагональные ходы.
const DIAG_MODE = params.get('diag') === '1' ||
    MOVES.some(mv => DIAG_DIRS.includes(mv.dir));

const bgColor = params.get('bgcolor') ? `#${params.get('bgcolor')}` : '';
if (bgColor) document.body.style.setProperty('background-color', bgColor, 'important');

// Режим предпросмотра: показать готовую фигуру (для конфигуратора)
const PREVIEW_MODE = params.get('preview') === '1';

// Размер клетки из URL (переопределяет значение по умолчанию из CSS)
const CELL_PARAM = parseInt(params.get('cell') ?? '', 10);

// ── Разворачиваем в поэтапные единичные шаги и строим эталонный путь ──
const UNIT_STEPS = []; // массив направлений, по одному на клетку
MOVES.forEach(mv => { for (let i = 0; i < mv.count; i++) UNIT_STEPS.push(mv.dir); });
const TOTAL_STEPS = UNIT_STEPS.length;

// Построить путь (список точек-клеток) от [0,0]
function buildPathFrom(sx, sy, steps) {
    const pts = [[sx, sy]];
    let x = sx, y = sy;
    steps.forEach(dir => {
        const [dx, dy] = DIR_VEC[dir];
        x += dx; y += dy;
        pts.push([x, y]);
    });
    return pts;
}

// Границы фигуры, чтобы подобрать размер поля и стартовую клетку
function pathBounds(pts) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(([x, y]) => {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    });
    return { minX, minY, maxX, maxY };
}

const rawPath = buildPathFrom(0, 0, UNIT_STEPS);
const b = pathBounds(rawPath);
const MARGIN = 1; // клетка запаса со всех сторон
const COLS = (b.maxX - b.minX) + 1 + MARGIN * 2;
const ROWS = (b.maxY - b.minY) + 1 + MARGIN * 2;
const START = [MARGIN - b.minX, MARGIN - b.minY]; // стартовая клетка в координатах поля
const EXPECTED_PATH = buildPathFrom(START[0], START[1], UNIT_STEPS);

// ── DOM ─────────────────────────────────────────────────────
const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
const commandsList = document.getElementById('commands-list');
const stepProgress = document.getElementById('step-progress');
const errorCountEl = document.getElementById('error-count');
const modeBadge = document.getElementById('mode-badge');
const checkButton = document.getElementById('check-button');
const restartButton = document.getElementById('restart-button');
const fullscreenButton = document.getElementById('fullscreen-button');
const messageArea = document.getElementById('message-area');

// ── Состояние игры ──────────────────────────────────────────
let cell = 42;
let drawnPath = [];  // список клеток, которые ребёнок уже прошёл
let stepIdx = 0;     // индекс следующего ожидаемого единичного шага (для режима step)
let errorCount = 0;
let finished = false;
let cmdEls = [];     // элементы команд
let ghostTarget = null; // узел, к которому тянут линию (предпросмотр при перетаскивании)
let ghostErase = false; // режим предпросмотра — стирание (назад по линии)

const MIN_CELL = 14;   // минимально допустимый размер клетки
const GAP_CELL = 56;   // запас на рамку/отступы поля

// Предпочтительный (максимальный) размер клетки: из URL, иначе из CSS, иначе 42
function preferredCell() {
    if (!isNaN(CELL_PARAM) && CELL_PARAM > 0) return CELL_PARAM;
    const v = getComputedStyle(document.querySelector('.game-container')).getPropertyValue('--cell');
    return parseInt(v, 10) || 42;
}

// Сколько места реально доступно под поле (по ширине и высоте)
function availableSpace() {
    const container = document.querySelector('.game-container');
    const cRect = container.getBoundingClientRect();
    const cStyle = getComputedStyle(container);
    const padX = parseFloat(cStyle.paddingLeft) + parseFloat(cStyle.paddingRight);

    // Ширина: место внутри контейнера минус колонка команд и отступ между ними
    const commandsEl = document.querySelector('.commands');
    const cmdW = commandsEl ? commandsEl.getBoundingClientRect().width : 0;
    const layoutGap = 20;
    let availW = cRect.width - padX - cmdW - layoutGap - GAP_CELL;
    // Если команды переносятся под поле (узкий экран) — даём полную ширину
    if (availW < 180) availW = cRect.width - padX - GAP_CELL;

    // Высота: высота окна минус то, что над полем (заголовок, панель) и подпись под полем.
    const fieldRect = canvas.getBoundingClientRect();
    const hintH = 40; // подпись-подсказка под полем
    const topUsed = fieldRect.top; // всё, что выше поля
    let availH = window.innerHeight - topUsed - hintH - GAP_CELL;
    if (availH < 160) availH = window.innerHeight * 0.6; // страховка

    return { availW: Math.max(availW, 120), availH: Math.max(availH, 120) };
}

// Вычисляет размер клетки так, чтобы поле поместилось по ширине и высоте
function computeFitCell() {
    const pref = preferredCell();
    const { availW, availH } = availableSpace();
    const byW = Math.floor(availW / COLS);
    const byH = Math.floor(availH / ROWS);
    let c = Math.min(pref, byW, byH);
    if (c < MIN_CELL) c = MIN_CELL; // не уменьшаем ниже читаемого минимума
    return c;
}

function applyCell(c) {
    cell = c;
    canvas.width = COLS * cell;
    canvas.height = ROWS * cell;
    canvas.style.setProperty('--cell', cell + 'px');
    canvas.style.backgroundSize = `${cell}px ${cell}px, ${cell}px ${cell}px`;
}

function setupCanvas() {
    // Два прохода: первый задаёт приблизительный размер, второй уточняет
    // по фактической раскладке (высота зависит от позиции канваса).
    applyCell(computeFitCell());
    applyCell(computeFitCell());
}

// ── Отрисовка ───────────────────────────────────────────────
// Точки пути ставим на УЗЛАХ сетки (пересечениях линий), а не в центрах клеток,
// чтобы ребёнок ориентировался по линиям клетчатого поля.
function cellCenter(cx, cy) {
    return [cx * cell, cy * cell];
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Стартовая точка
    const [sx, sy] = cellCenter(START[0], START[1]);
    ctx.fillStyle = '#43a047';
    ctx.beginPath();
    ctx.arc(sx, sy, cell * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Нарисованный путь
    if (drawnPath.length > 0) {
        ctx.strokeStyle = '#3949ab';
        ctx.lineWidth = Math.max(4, cell * 0.14);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        drawnPath.forEach(([cx, cy], i) => {
            const [px, py] = cellCenter(cx, cy);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.stroke();
    }

    const cur = drawnPath.length ? drawnPath[drawnPath.length - 1] : START;

    // «Призрак» при перетаскивании: синий пунктир — новая линия, красный — стирание назад
    if (ghostTarget && (ghostTarget[0] !== cur[0] || ghostTarget[1] !== cur[1])) {
        const [cpx, cpy] = cellCenter(cur[0], cur[1]);
        const [gpx, gpy] = cellCenter(ghostTarget[0], ghostTarget[1]);
        ctx.save();
        ctx.strokeStyle = ghostErase ? 'rgba(229,57,53,0.6)' : 'rgba(57,73,171,0.5)';
        ctx.lineWidth = Math.max(3, cell * 0.1);
        ctx.setLineDash([Math.max(4, cell * 0.2), Math.max(4, cell * 0.16)]);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cpx, cpy);
        ctx.lineTo(gpx, gpy);
        ctx.stroke();
        ctx.restore();
    }

    // Текущая позиция (курсор)
    const [px, py] = cellCenter(cur[0], cur[1]);
    ctx.fillStyle = '#ff6d00';
    ctx.beginPath();
    ctx.arc(px, py, cell * 0.22, 0, Math.PI * 2);
    ctx.fill();
}

// ── Команды (список слева) ──────────────────────────────────
function renderCommands() {
    commandsList.innerHTML = '';
    cmdEls = [];
    MOVES.forEach((mv, i) => {
        const el = document.createElement('div');
        el.className = 'cmd';
        el.innerHTML = `<span class="num">${mv.count}</span><span class="arrow">${DIR_ARROW[mv.dir]}</span>`;
        commandsList.appendChild(el);
        cmdEls.push(el);
    });
    updateCommandHighlight();
}

// Подсветка текущей команды по числу пройденных шагов
function updateCommandHighlight() {
    let acc = 0;
    let activeCmd = -1;
    let doneCount = drawnPath.length; // сколько шагов пройдено (в режиме end — свободно)
    for (let i = 0; i < MOVES.length; i++) {
        const start = acc;
        const end = acc + MOVES[i].count;
        cmdEls[i].classList.remove('active', 'done');
        if (CHECK_MODE === 'step') {
            if (stepIdx >= end) cmdEls[i].classList.add('done');
            else if (stepIdx >= start && stepIdx < end) { cmdEls[i].classList.add('active'); activeCmd = i; }
        }
        acc = end;
    }
}

// ── Логика ходов ────────────────────────────────────────────
function cursor() {
    return drawnPath.length ? drawnPath[drawnPath.length - 1] : [...START];
}

// Направление последнего нарисованного сегмента (куда шла линия в конце), или null
function lastSegmentDir() {
    if (drawnPath.length < 2) return null;
    const [ax, ay] = drawnPath[drawnPath.length - 2];
    const [bx, by] = drawnPath[drawnPath.length - 1];
    return dirBetweenRaw(bx - ax, by - ay);
}

// Направление по вектору (dx,dy) без ограничений режима
function dirBetweenRaw(dx, dy) {
    const sx = Math.sign(dx), sy = Math.sign(dy);
    for (const [name, [vx, vy]] of Object.entries(DIR_VEC)) {
        if (vx === sx && vy === sy) return name;
    }
    return null;
}

const OPPOSITE = {
    up: 'down', down: 'up', left: 'right', right: 'left',
    upleft: 'downright', downright: 'upleft', upright: 'downleft', downleft: 'upright',
};

// Узлы сетки допустимы от 0 до COLS/ROWS включительно (это пересечения линий)
function withinField(x, y) {
    return x >= 0 && x <= COLS && y >= 0 && y <= ROWS;
}

// suppressError=true — не засчитывать ошибку самим move (её засчитает вызывающий код,
// например при перетаскивании, чтобы не было нескольких ошибок за один жест).
function move(dir, suppressError) {
    if (finished) return;

    if (CHECK_MODE === 'step') {
        if (stepIdx >= TOTAL_STEPS) { if (!suppressError) wrongFlash(); return; }
        const expected = UNIT_STEPS[stepIdx];
        if (dir === expected) {
            const [cx, cy] = cursor();
            const [dx, dy] = DIR_VEC[dir];
            if (drawnPath.length === 0) drawnPath.push([...START]);
            drawnPath.push([cx + dx, cy + dy]);
            stepIdx++;
            playStep();
            updateProgress();
            draw();
            updateCommandHighlight();
            if (stepIdx === TOTAL_STEPS) finish(true);
        } else {
            // неправильное направление
            if (!suppressError) wrongFlash();
        }
    } else {
        // Свободное рисование — просто двигаемся по полю
        const [cx, cy] = cursor();
        const [dx, dy] = DIR_VEC[dir];
        const nx = cx + dx, ny = cy + dy;
        if (!withinField(nx, ny)) { wrongFlash(); return; }
        if (drawnPath.length === 0) drawnPath.push([...START]);
        drawnPath.push([nx, ny]);
        playStep();
        updateProgress();
        draw();
    }
}

// Стереть последний нарисованный сегмент (ход назад по линии).
// Возвращает true, если было что стирать.
function eraseStep() {
    if (finished) return false;
    if (drawnPath.length > 1) {
        drawnPath.pop();
        if (CHECK_MODE === 'step' && stepIdx > 0) stepIdx--;
        playStep();
        updateProgress();
        draw();
        updateCommandHighlight();
        return true;
    } else if (drawnPath.length === 1) {
        drawnPath = [];
        if (CHECK_MODE === 'step') stepIdx = 0;
        updateProgress();
        draw();
        updateCommandHighlight();
        return true;
    }
    return false;
}

function updateProgress() {
    if (CHECK_MODE === 'step') {
        stepProgress.textContent = `${stepIdx} / ${TOTAL_STEPS}`;
    } else {
        const drawn = Math.max(0, drawnPath.length - 1);
        stepProgress.textContent = `${drawn} / ${TOTAL_STEPS}`;
    }
}

function wrongFlash() {
    errorCount++;
    errorCountEl.textContent = errorCount;
    playWrong();
    canvas.style.transition = 'none';
    canvas.style.boxShadow = '0 0 0 4px #e53935';
    setTimeout(() => { canvas.style.boxShadow = ''; }, 300);
}

// Проверка в режиме «в конце»
function checkAnswer() {
    if (finished) return;
    const drawn = drawnPath.length ? drawnPath : [START];
    const ok = drawn.length === EXPECTED_PATH.length &&
        drawn.every(([x, y], i) => x === EXPECTED_PATH[i][0] && y === EXPECTED_PATH[i][1]);
    if (ok) {
        finish(true);
    } else {
        errorCount++;
        errorCountEl.textContent = errorCount;
        playWrong();
        showMessage('Не совсем так. Посмотри на команды и попробуй ещё раз. 🤔', false);
    }
}

function finish(win) {
    finished = true;
    if (win) {
        playFanfare();
        // подсветим все команды как выполненные
        cmdEls.forEach(el => { el.classList.remove('active'); el.classList.add('done'); });
        showMessage('МОЛОДЕЦ! 🎉 Фигура нарисована правильно!', true);
    }
}

function showMessage(text, win) {
    messageArea.classList.remove('hidden');
    messageArea.textContent = text;
    messageArea.style.backgroundColor = win ? '#c8e6c9' : '#ffcdd2';
    messageArea.style.color = win ? '#1b5e20' : '#b71c1c';
}

function hideMessage() {
    messageArea.classList.add('hidden');
}

// ── Старт / сброс ───────────────────────────────────────────
function resetGame() {
    drawnPath = [];
    stepIdx = 0;
    errorCount = 0;
    finished = false;
    errorCountEl.textContent = '0';
    hideMessage();
    setupCanvas();
    renderCommands();
    updateProgress();
    draw();
}

// ── Управление: рисование пальцем/мышью по полю ─────────────
// Переводит вектор между клетками в направление (с учётом диагоналей, если включены)
function dirBetween(fromX, fromY, toX, toY) {
    const dx = Math.sign(toX - fromX);
    const dy = Math.sign(toY - fromY);
    for (const [name, [vx, vy]] of Object.entries(DIR_VEC)) {
        if (vx === dx && vy === dy) {
            // диагональ разрешена только в диагональном режиме
            if (DIAG_DIRS.includes(name) && !DIAG_MODE) continue;
            return name;
        }
    }
    return null;
}

// Ближайший УЗЕЛ сетки (пересечение линий) под точкой экрана —
// путь идёт по узлам, поэтому округляем, а не отбрасываем дробную часть.
function cellUnderPoint(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    // поправка на возможный масштаб canvas (CSS vs внутренний размер)
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    const nx = Math.round(((clientX - r.left) * scaleX) / cell);
    const ny = Math.round(((clientY - r.top) * scaleY) / cell);
    return [nx, ny];
}

let dragging = false; // тянем линию от курсора

// Рисуем линию только при ОТПУСКАНИИ: тянем от курсора к узлу и «роняем».
function onFieldPointerDown(e) {
    if (finished) return;
    const [tx, ty] = cellUnderPoint(e.clientX, e.clientY);
    const [cx, cy] = cursor();
    // Начинаем тянуть, только если взялись за текущий кончик линии (курсор)
    if (tx !== cx || ty !== cy) return;
    e.preventDefault();
    dragging = true;
    ghostTarget = [cx, cy];
    canvas.setPointerCapture(e.pointerId);
}

function onFieldPointerMove(e) {
    if (!dragging || finished) return;
    const [tx, ty] = cellUnderPoint(e.clientX, e.clientY);
    const [cx, cy] = cursor();
    const dragDir = dirBetween(cx, cy, tx, ty);
    const lastDir = lastSegmentDir();

    if (dragDir && lastDir && dragDir === OPPOSITE[lastDir]) {
        // Назад по линии — показываем «стирание» (красный пунктир)
        ghostTarget = [tx, ty];
        ghostErase = true;
    } else {
        // Обычный призрак новой линии до достижимого узла
        ghostTarget = reachableEndpoint(cx, cy, tx, ty);
        ghostErase = false;
    }
    draw();
}

function onFieldPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}

    const [tx, ty] = cellUnderPoint(e.clientX, e.clientY);
    const [cx, cy] = cursor();
    ghostTarget = null;
    ghostErase = false;

    // Направление, куда тянет ребёнок
    const dragDir = dirBetween(cx, cy, tx, ty);

    // Если тянут НАЗАД по уже нарисованной линии — стираем её, а не рисуем новую
    const lastDir = lastSegmentDir();
    if (dragDir && lastDir && dragDir === OPPOSITE[lastDir]) {
        eraseTowardNode(tx, ty);
        draw();
        return;
    }

    // Иначе рисуем прямую линию до достижимого узла.
    const end = reachableEndpoint(cx, cy, tx, ty);
    if (!end) { draw(); return; }

    if (CHECK_MODE === 'step') {
        // Всё или ничего: линия рисуется, только если КАЖДЫЙ её шаг совпадает
        // с ожидаемыми командами. Иначе — ошибка и ничего не рисуем.
        if (dragMatchesExpected(cx, cy, end[0], end[1])) {
            commitDragTo(end[0], end[1]);
        } else {
            wrongFlash();
        }
    } else {
        // Свободный режим — просто рисуем прямую линию
        commitDragTo(end[0], end[1]);
    }
    draw();
}

// Стирает линию, идя назад к узлу (tx,ty), пока линия продолжается в эту сторону.
function eraseTowardNode(tx, ty) {
    let guard = 0;
    while (guard < 200) {
        guard++;
        const [cx, cy] = cursor();
        if (cx === tx && cy === ty) break;         // дошли до цели стирания
        const lastDir = lastSegmentDir();
        if (!lastDir) break;                       // стирать больше нечего
        const back = OPPOSITE[lastDir];
        // продолжаем стирать, только если цель всё ещё в направлении «назад»
        if (dirBetween(cx, cy, tx, ty) !== back) break;
        if (!eraseStep()) break;
    }
}

// Проверяет (не меняя состояние), что прямая линия от (cx,cy) к (tx,ty)
// целиком совпадает с ожидаемыми единичными шагами, начиная с stepIdx.
function dragMatchesExpected(cx, cy, tx, ty) {
    const dir = dirBetween(cx, cy, tx, ty);
    if (!dir) return false;
    const [vx, vy] = DIR_VEC[dir];
    let x = cx, y = cy, idx = stepIdx, guard = 0;
    while (guard < 200) {
        guard++;
        if (x === tx && y === ty) return true; // дошли ровно до конца — всё совпало
        if (idx >= TOTAL_STEPS) return false;  // линия длиннее, чем осталось команд
        if (UNIT_STEPS[idx] !== dir) return false; // направление не совпало с командой
        x += vx; y += vy; idx++;
    }
    return false;
}

// Куда реально дотянется прямая линия от (cx,cy) к (tx,ty): возвращает достижимый узел.
// Учитывает: допустимость направления (диагональ только в DIAG_MODE), прямизну линии и границы поля.
function reachableEndpoint(cx, cy, tx, ty) {
    const dir = dirBetween(cx, cy, tx, ty);
    if (!dir) return null; // не прямая и не чистая диагональ
    const [vx, vy] = DIR_VEC[dir];
    let x = cx, y = cy, guard = 0;
    while (guard < 200) {
        guard++;
        const nx = x + vx, ny = y + vy;
        // дошли до цели?
        if (x === tx && y === ty) break;
        // следующий шаг не должен перескочить цель и выйти за поле
        if (vx !== 0 && Math.sign(tx - nx) !== vx && nx !== tx) break;
        if (vy !== 0 && Math.sign(ty - ny) !== vy && ny !== ty) break;
        if (!withinField(nx, ny)) break;
        x = nx; y = ny;
    }
    if (x === cx && y === cy) return null; // ни одного шага не получилось
    return [x, y];
}

// Прокладывает путь от текущего курсора к (tx,ty) по прямой линии (по одному шагу).
// Возвращает true, если КАЖДЫЙ задуманный шаг был принят (линия нарисована целиком).
function commitDragTo(tx, ty) {
    let guard = 0;
    while (guard < 200) {
        guard++;
        const [cx, cy] = cursor();
        if (cx === tx && cy === ty) return true; // дошли ровно до цели
        const dir = dirBetween(cx, cy, tx, ty);
        if (!dir) return false; // не прямая/не диагональ — не вся линия пройдена
        const [vx, vy] = DIR_VEC[dir];
        const nextX = cx + vx, nextY = cy + vy;
        if ((vx !== 0 && Math.sign(tx - nextX) !== vx && nextX !== tx)) return false;
        if ((vy !== 0 && Math.sign(ty - nextY) !== vy && nextY !== ty)) return false;
        const before = drawnPath.length;
        move(dir, true); // ошибки при перетаскивании считаем один раз в onFieldPointerUp
        if (drawnPath.length === before) return false; // шаг отклонён (ошибка/граница/конец)
    }
    return false;
}

canvas.addEventListener('pointerdown', onFieldPointerDown);
canvas.addEventListener('pointermove', onFieldPointerMove);
canvas.addEventListener('pointerup', onFieldPointerUp);
canvas.addEventListener('pointercancel', (e) => { dragging = false; ghostTarget = null; ghostErase = false; draw(); try { canvas.releasePointerCapture(e.pointerId); } catch (_) {} });

checkButton.addEventListener('click', checkAnswer);
restartButton.addEventListener('click', resetGame);

fullscreenButton.addEventListener('click', () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); fullscreenButton.textContent = 'Выйти ↔️'; }
    else if (document.exitFullscreen) { document.exitFullscreen(); fullscreenButton.textContent = 'На весь экран ↔️'; }
});
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) fullscreenButton.textContent = 'На весь экран ↔️';
});

window.addEventListener('resize', () => { setupCanvas(); draw(); });

// Показать готовую фигуру (предпросмотр для конфигуратора).
// Интерфейс полностью такой же, как в игре, — просто уже нарисован результат.
function renderPreview() {
    drawnPath = EXPECTED_PATH.map(p => [...p]);
    stepIdx = TOTAL_STEPS;
    finished = true; // блокируем ввод, но ничего не прячем
    updateProgress();
    draw();
    updateCommandHighlight();
    cmdEls.forEach(el => { el.classList.remove('active'); el.classList.add('done'); });
}

// Настройка под режим (одинаково для игры и предпросмотра)
modeBadge.textContent = (CHECK_MODE === 'step' ? 'Проверка каждого хода' : 'Проверка в конце')
    + (DIAG_MODE ? ' • с диагоналями' : '');
if (CHECK_MODE === 'end') checkButton.classList.remove('hidden');

resetGame();
if (PREVIEW_MODE) renderPreview();

// ── Звук (Web Audio API) ────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let actx = null;
function readyCtx() { if (!actx) actx = new AudioCtx(); if (actx.state !== 'running') actx.resume(); return actx; }
// разблокировка звука на первом клике
document.addEventListener('pointerdown', () => readyCtx(), { once: true });

function playStep() {
    const ctx = readyCtx(); const t = ctx.currentTime + 0.005;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(520, t);
    g.gain.setValueAtTime(0.14, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.start(t); osc.stop(t + 0.09);
}
function playWrong() {
    const ctx = readyCtx(); const t = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.25);
    g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.start(t); osc.stop(t + 0.26);
}
function playFanfare() {
    const ctx = readyCtx(); const t0 = ctx.currentTime + 0.01;
    [523, 659, 784, 1047].forEach((f, i) => {
        const t = t0 + i * 0.18;
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'triangle'; osc.frequency.value = f;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3, t + 0.04);
        g.gain.setValueAtTime(0.3, t + 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t); osc.stop(t + 0.36);
    });
}
