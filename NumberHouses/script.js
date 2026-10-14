// --- Получение параметров из URL ---
const urlParams = new URLSearchParams(window.location.search);
const urlNumbers = urlParams.get('numbers');     // например "5,7,10" — числа на крышах
const urlMin = urlParams.get('min');             // мин. число на крыше (если numbers не задан)
const urlMax = urlParams.get('max');             // макс. число на крыше (если numbers не задан)
const urlHouses = urlParams.get('houses');       // количество домиков
const urlFloors = urlParams.get('floors');       // количество этажей (окошек) в каждом домике
const urlCellSize = urlParams.get('cellSize');   // размер окошек в пикселях
const urlAllCombos = urlParams.get('allCombos'); // '1' — один домик со всеми комбинациями числа

// --- Настройки игры ---
const MIN_NUMBER = urlMin ? parseInt(urlMin, 10) : 5;
const MAX_NUMBER = urlMax ? parseInt(urlMax, 10) : 10;
const HOUSES_COUNT = urlHouses ? parseInt(urlHouses, 10) : 3;
const FLOORS_COUNT = urlFloors ? parseInt(urlFloors, 10) : 4;
const CELL_SIZE = urlCellSize ? parseInt(urlCellSize, 10) : 70;

// Режим «все комбинации»: один домик с одним числом и всеми вариантами состава
const ALL_COMBOS = urlAllCombos === '1';

// Явно заданные числа на крышах (приоритетнее min/max)
const CUSTOM_NUMBERS = urlNumbers
    ? urlNumbers.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n) && n >= 0)
    : null;

// --- DOM элементы ---
const gameBoard = document.getElementById('game-board');
const numberPalette = document.getElementById('number-palette');
const remainingCountDisplay = document.getElementById('remaining-count');
const startButton = document.getElementById('start-button');
const messageArea = document.getElementById('message-area');
const fullscreenButton = document.getElementById('fullscreen-button');
const timerDisplay = document.getElementById('timer');
const errorCountDisplay = document.getElementById('error-count');

// --- Состояние игры ---
let remainingCount = 0;
let isGameActive = false;
let errorCount = 0;
let timerInterval;

// --- Полноэкранный режим ---
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
    if (!document.fullscreenElement) {
        fullscreenButton.textContent = 'На весь экран ↔️';
    }
});

// --- Таймер ---
function startTimer() {
    const startTime = Date.now();
    timerInterval = setInterval(() => {
        const totalSeconds = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        timerDisplay.textContent =
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 500);
}

function stopTimer() {
    clearInterval(timerInterval);
}

// --- Вспомогательные функции ---
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Выбирает числа на крышах домиков.
 * @returns {number[]}
 */
function chooseRoofNumbers() {
    const lo = Math.min(MIN_NUMBER, MAX_NUMBER);
    const hi = Math.max(MIN_NUMBER, MAX_NUMBER);

    // Режим «все комбинации» — ровно один домик с одним числом
    if (ALL_COMBOS) {
        const single = (CUSTOM_NUMBERS && CUSTOM_NUMBERS.length > 0)
            ? CUSTOM_NUMBERS[0]
            : randomInt(lo, hi);
        return [single];
    }

    if (CUSTOM_NUMBERS && CUSTOM_NUMBERS.length > 0) {
        return CUSTOM_NUMBERS.slice(0, HOUSES_COUNT > CUSTOM_NUMBERS.length ? CUSTOM_NUMBERS.length : HOUSES_COUNT);
    }
    const numbers = [];
    for (let i = 0; i < HOUSES_COUNT; i++) {
        numbers.push(randomInt(lo, hi));
    }
    return numbers;
}

/**
 * Строит этажи для одного домика с числом N на крыше.
 * Каждый этаж — пара [left, right], дающая в сумме N.
 * Для одной из частей создаётся пропуск (которую нужно вписать).
 * @param {number} roof Число на крыше.
 * @returns {{left:number, right:number, blank:'left'|'right'}[]}
 */
function buildFloors(roof) {
    // Все возможные пары (0..roof)
    const allPairs = [];
    for (let left = 0; left <= roof; left++) {
        allPairs.push({ left, right: roof - left });
    }

    // Режим «все комбинации»: показываем каждый вариант по порядку (0+N … N+0)
    if (ALL_COMBOS) {
        return allPairs.map(pair => ({
            left: pair.left,
            right: pair.right,
            blank: Math.random() < 0.5 ? 'left' : 'right',
        }));
    }

    // Перемешиваем и берём нужное количество этажей
    for (let i = allPairs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allPairs[i], allPairs[j]] = [allPairs[j], allPairs[i]];
    }

    const count = Math.min(FLOORS_COUNT, allPairs.length);
    const chosen = allPairs.slice(0, count);

    // Для каждого этажа случайно выбираем, какое окошко пустое
    return chosen.map(pair => ({
        left: pair.left,
        right: pair.right,
        blank: Math.random() < 0.5 ? 'left' : 'right',
    }));
}

/**
 * Рендерит один домик.
 */
function renderHouse(roof) {
    const house = document.createElement('div');
    house.classList.add('house');

    const roofEl = document.createElement('div');
    roofEl.classList.add('house-roof');
    const roofNum = document.createElement('span');
    roofNum.classList.add('roof-number');
    roofNum.textContent = roof;
    roofEl.appendChild(roofNum);
    house.appendChild(roofEl);

    const body = document.createElement('div');
    body.classList.add('house-body');

    const floors = buildFloors(roof);

    // Если этажей много (например, в режиме «все комбинации» для большого числа),
    // раскладываем их в несколько колонок, чтобы домик рос в ширину, а не в высоту.
    const MAX_ROWS_PER_COLUMN = 7;
    if (floors.length > MAX_ROWS_PER_COLUMN) {
        body.classList.add('multi-column');
        // Высота столбца = столько строк, чтобы колонок было минимально необходимое количество
        const columns = Math.ceil(floors.length / MAX_ROWS_PER_COLUMN);
        const rowsPerColumn = Math.ceil(floors.length / columns);
        body.style.setProperty('--rows-per-column', rowsPerColumn);
    }

    floors.forEach(floor => {
        const floorEl = document.createElement('div');
        floorEl.classList.add('floor');

        const leftCell = createCell(floor, 'left', roof);
        const rightCell = createCell(floor, 'right', roof);

        floorEl.appendChild(leftCell);
        floorEl.appendChild(rightCell);
        body.appendChild(floorEl);
    });

    house.appendChild(body);
    return house;
}

/**
 * Создаёт одно окошко этажа — либо с заданным числом, либо с полем ввода.
 */
function createCell(floor, side, roof) {
    const cell = document.createElement('div');
    cell.classList.add('cell');

    const isBlank = floor.blank === side;
    const value = side === 'left' ? floor.left : floor.right;

    if (isBlank) {
        // Пустое окошко — цель для перетаскивания или клика
        cell.classList.add('input', 'drop-target');
        cell.dataset.answer = String(value);
        cell.addEventListener('click', onCellClick);
        remainingCount++;
    } else {
        cell.classList.add('given');
        cell.textContent = value;
    }

    return cell;
}

/**
 * Пытается «положить» число в окошко-цель.
 * @param {HTMLElement} cell Окошко-цель.
 * @param {number} droppedValue Перетащенное число.
 */
function tryDropNumber(cell, droppedValue) {
    if (!isGameActive) return;
    if (!cell || !cell.classList.contains('drop-target')) return;
    if (cell.classList.contains('correct')) return; // уже заполнено верно

    const answer = parseInt(cell.dataset.answer, 10);

    if (droppedValue === answer) {
        cell.classList.add('correct');
        cell.classList.remove('wrong', 'drop-target');
        cell.textContent = droppedValue;
        remainingCount--;
        updateRemainingCount();
        if (remainingCount === 0) {
            endGame(true);
        }
    } else {
        cell.classList.add('wrong');
        errorCount++;
        updateErrorCount();
        setTimeout(() => cell.classList.remove('wrong'), 500);
    }
}

function updateRemainingCount() {
    remainingCountDisplay.textContent = remainingCount;
}

function updateErrorCount() {
    errorCountDisplay.textContent = errorCount;
}

function endGame(isWin) {
    stopTimer();
    isGameActive = false;
    gameBoard.classList.add('disabled');
    startButton.textContent = 'Сыграть еще раз! 🎉';

    messageArea.classList.remove('hidden');
    if (isWin) {
        const finalTime = timerDisplay.textContent;
        messageArea.innerHTML = `ПОБЕДА! 🎉 Время: ${finalTime}. Ошибок: ${errorCount}. Все домики заселены!`;
        messageArea.style.backgroundColor = '#a4f5aa';
        messageArea.style.borderColor = '#3cb371';
    } else {
        messageArea.innerHTML = 'Попробуй снова! ⏳';
        messageArea.style.backgroundColor = '#ffc0cb';
        messageArea.style.borderColor = '#ff1493';
    }
}

/**
 * Генерирует игровое поле (домики).
 */
function generateGameField() {
    gameBoard.innerHTML = '';
    remainingCount = 0;
    gameBoard.style.setProperty('--house-cell', `${CELL_SIZE}px`);

    const roofNumbers = chooseRoofNumbers();
    roofNumbers.forEach(roof => {
        gameBoard.appendChild(renderHouse(roof));
    });

    // Палитра чисел для перетаскивания: от 0 до самого большого числа на крыше
    const maxRoof = roofNumbers.length ? Math.max(...roofNumbers) : 0;
    buildPalette(maxRoof);

    updateRemainingCount();
}

/**
 * Строит палитру перетаскиваемых чисел 0..max.
 */
function buildPalette(max) {
    clearSelection();
    numberPalette.style.setProperty('--house-cell', `${CELL_SIZE}px`);
    numberPalette.innerHTML = '';
    for (let n = 0; n <= max; n++) {
        const tile = document.createElement('div');
        tile.classList.add('number-tile');
        tile.textContent = n;
        tile.dataset.value = String(n);
        tile.addEventListener('pointerdown', onTilePointerDown);
        numberPalette.appendChild(tile);
    }
}


// --- Перетаскивание (мышь и сенсорный экран) через Pointer Events ---
let dragGhost = null;      // плавающая копия плитки под пальцем/курсором
let dragValue = null;      // перетаскиваемое число
let dragSourceTile = null; // исходная плитка (для подсветки)
let dragStartX = 0;        // точка нажатия — чтобы отличить клик от перетаскивания
let dragStartY = 0;
let dragMoved = false;     // было ли реальное перемещение

// --- Режим «клик-клик»: выбрать число, затем кликнуть окошко ---
let selectedTile = null;   // выбранная (подсвеченная) плитка
let selectedValue = null;  // выбранное число
let suppressNextCellClick = false; // гасим click сразу после перетаскивания

const DRAG_THRESHOLD = 6;  // пикселей; меньше — считаем кликом, больше — перетаскиванием

function onTilePointerDown(event) {
    if (!isGameActive) return;
    event.preventDefault();

    dragSourceTile = event.currentTarget;
    dragValue = parseInt(dragSourceTile.dataset.value, 10);
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragMoved = false;

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
}

/**
 * Создаёт плавающий «призрак» плитки (один раз, когда началось реальное перетаскивание).
 */
function startDragGhost() {
    dragSourceTile.classList.add('dragging');
    dragGhost = dragSourceTile.cloneNode(true);
    dragGhost.classList.remove('dragging', 'selected');
    dragGhost.classList.add('drag-ghost');
    // Передаём размер окошка, т.к. призрак живёт в <body>, а не в палитре
    dragGhost.style.setProperty('--house-cell', `${CELL_SIZE}px`);
    document.body.appendChild(dragGhost);
}

/**
 * Выбирает/снимает выбор плитки для режима «клик-клик».
 */
function toggleSelectTile(tile, value) {
    if (selectedTile === tile) {
        // Повторный клик — снимаем выбор
        clearSelection();
        return;
    }
    clearSelection();
    selectedTile = tile;
    selectedValue = value;
    tile.classList.add('selected');
    // Подсвечиваем пустые окошки, показывая, что теперь можно кликнуть по ним
    gameBoard.classList.add('armed');
}

function clearSelection() {
    if (selectedTile) selectedTile.classList.remove('selected');
    selectedTile = null;
    selectedValue = null;
    gameBoard.classList.remove('armed');
}

/**
 * Клик по окошку: если число выбрано в палитре — ставим его сюда.
 */
function onCellClick(event) {
    if (!isGameActive) return;
    if (suppressNextCellClick) return; // это «хвост» от перетаскивания
    if (selectedValue === null) return; // ничего не выбрано — клик игнорируем

    const cell = event.currentTarget;
    // Выбор остаётся активным — одно и то же число можно поставить в несколько окошек
    tryDropNumber(cell, selectedValue);
}

function moveGhost(x, y) {
    if (!dragGhost) return;
    dragGhost.style.left = `${x}px`;
    dragGhost.style.top = `${y}px`;
}

function onPointerMove(event) {
    // Пока не превышен порог — считаем, что это ещё клик, а не перетаскивание
    if (!dragMoved) {
        const dx = event.clientX - dragStartX;
        const dy = event.clientY - dragStartY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        dragMoved = true;
        startDragGhost();
    }

    moveGhost(event.clientX, event.clientY);

    // Подсвечиваем окошко под указателем
    const cell = cellUnderPoint(event.clientX, event.clientY);
    document.querySelectorAll('.cell.drop-target.hover').forEach(c => c.classList.remove('hover'));
    if (cell) cell.classList.add('hover');
}

function onPointerUp(event) {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);

    if (dragMoved) {
        // Это было перетаскивание — пробуем положить число в окошко под указателем
        const cell = cellUnderPoint(event.clientX, event.clientY);
        if (cell) {
            cell.classList.remove('hover');
            tryDropNumber(cell, dragValue);
        }
        // Гасим синтетический click, который может прилететь сразу после drop
        suppressNextCellClick = true;
        setTimeout(() => { suppressNextCellClick = false; }, 50);
    } else {
        // Движения не было — это клик: выбираем/снимаем выбор плитки
        toggleSelectTile(dragSourceTile, dragValue);
    }

    // Чистим состояние перетаскивания
    if (dragGhost) dragGhost.remove();
    if (dragSourceTile) dragSourceTile.classList.remove('dragging');
    dragGhost = null;
    dragValue = null;
    dragSourceTile = null;
    dragMoved = false;
}

/**
 * Находит окошко-цель под заданной точкой экрана.
 */
function cellUnderPoint(x, y) {
    // Прячем призрак, чтобы он не перехватывал точку
    if (dragGhost) dragGhost.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    if (dragGhost) dragGhost.style.display = '';
    if (!el) return null;
    return el.closest('.cell.drop-target');
}

/**
 * Инициализирует новую игру.
 */
function startGame() {
    isGameActive = true;
    errorCount = 0;
    messageArea.classList.add('hidden');
    gameBoard.classList.remove('disabled');
    startButton.textContent = 'Новая игра!';

    updateErrorCount();
    stopTimer();
    timerDisplay.textContent = '00:00';

    generateGameField();
    startTimer();
}

// --- Инициализация при загрузке ---
startButton.addEventListener('click', startGame);
fullscreenButton.addEventListener('click', toggleFullScreen);

// Начальный вид (поле неактивно до старта)
generateGameField();
remainingCountDisplay.textContent = '...';
timerDisplay.textContent = '00:00';
gameBoard.classList.add('disabled');
