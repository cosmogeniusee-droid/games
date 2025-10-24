// --- Настройки Игры ---
const WORD_LIST = [
    "ШИФРАТОР",
    "ЛАБИРИНТ",
    "КОДИРОВКА",
    "КРИПТОС",
    "РЕБУС",
    "ЗАГАДКА",
    "ГОЛОВОЛОМКА"
];

const NUM_RANDOM_POINTS = 4;
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;

// --- Элементы DOM ---
const startButton = document.getElementById('start-button');
const gameArea = document.getElementById('game-area');
const leftColumn = document.getElementById('left-column');
const rightColumn = document.getElementById('right-column');
const timerDisplay = document.getElementById('timer');
const targetWordDisplay = document.getElementById('target-word-display');
const messageDisplay = document.getElementById('message');
const canvas = document.getElementById('maze-canvas');
const ctx = canvas.getContext('2d');

// --- Переменные Игры ---
let gameStarted = false;
let timerInterval;
let startTime;
let targetWordLetters; // Массив букв целевого слова
let shuffledLetters; // Массив букв анаграммы (перемешанный)
let selectedNumberIndex = -1; // Индекс выбранной цифры (0 - NUM_PATHS-1)
let matchedPairs = 0;
let paths = []; // Массив для хранения данных пути (точек)
let NUM_PATHS; // Будет установлено автоматически
let revealedWord; // Массив для отображения угаданного слова

// Индекс: Позиция в TARGET_WORD (цифра)
// Значение: Позиция в SHUFFLED_LETTERS (ячейка анаграммы)
let targetLetterPositions = [];

const PATH_COLORS = [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#ff9800', '#4caf50', '#8bc34a', '#ffeb3b', '#ffc107', '#ff5722', '#795548', '#607d8b'
];

// --- Вспомогательные Функции ---

// Случайное перемешивание массива
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Форматирование времени в MM:SS:mmm (миллисекунды для "детского" таймера)
 * @param {number} totalMilliseconds - Общее время в миллисекундах
 */
function formatTime(totalMilliseconds) {
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const milliseconds = (totalMilliseconds % 1000).toString().padStart(3, '0');
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}:${milliseconds}`;
}

/**
 * Функция drawSpline (сглаживание ломаной линии с плавными горизонтальными краями)
 * @param {CanvasRenderingContext2D} context - Контекст Canvas
 * @param {Array<Object>} points - Массив точек {x, y}
 */
function drawSpline(context, points) {
    if (points.length < 2) {
        return;
    }

    context.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 2; i++) {
        // Находим среднюю точку между текущей и следующей точкой
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        // Рисуем кривую до этой средней точки, используя следующую точку как контрольную
        context.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }

    // Рисуем последнюю кривую до конечной точки
    const last = points.length - 2;
    context.quadraticCurveTo(points[last].x, points[last].y, points[last + 1].x, points[last + 1].y);
}

/**
 * Сглаживает острые углы в пути, добавляя промежуточные точки.
 * @param {Array<Object>} points - Массив точек пути.
 * @param {number} minAngleDegrees - Минимальный допустимый угол в градусах.
 * @returns {Array<Object>} - Новый массив точек со сглаженными углами.
 */
function smoothPathAngles(points, minAngleDegrees, iteration = 0) {
    const MAX_ITERATIONS = 5; // Предохранитель от бесконечного цикла
    if (points.length < 3 || iteration >= MAX_ITERATIONS) {
        return points;
    }

    const minAngleRad = minAngleDegrees * (Math.PI / 180);
    let newPoints = [points[0]];
    let smoothed = false;

    for (let i = 1; i < points.length - 1; i++) {
        const p1 = newPoints[newPoints.length - 1]; // Предыдущая точка из нового массива
        const p2 = points[i]; // Текущая точка для проверки угла
        const p3 = points[i + 1];

        // Векторы от p2 к p1 и p3
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

        // Угол между векторами в радианах
        const angle = Math.acos((v1.x * v2.x + v1.y * v2.y) / (Math.sqrt(v1.x*v1.x + v1.y*v1.y) * Math.sqrt(v2.x*v2.x + v2.y*v2.y)));

        if (angle < minAngleRad) {
            // Угол слишком острый. "Срезаем" его, заменяя p2 двумя новыми точками.
            const offsetFactor = 0.3; // Насколько "срезать" угол (30%)
            const newP1 = { x: p2.x + (p1.x - p2.x) * offsetFactor, y: p2.y + (p1.y - p2.y) * offsetFactor };
            const newP2 = { x: p2.x + (p3.x - p2.x) * offsetFactor, y: p2.y + (p3.y - p2.y) * offsetFactor };
            newPoints.push(newP1, newP2);
            smoothed = true;
        } else {
            newPoints.push(p2);
        }
    }

    newPoints.push(points[points.length - 1]);

    // Если были сглаживания, рекурсивно вызываем функцию еще раз,
    // так как новые точки могли создать новые острые углы.
    return smoothed ? smoothPathAngles(newPoints, minAngleDegrees, iteration + 1) : newPoints;
}

// Создание путей лабиринта (Только точки с равномерным распределением)
function generatePaths() {
    paths = [];
    
    // Получаем реальные DOM-элементы и позицию canvas
    const numberCells = document.querySelectorAll('.number-cell');
    const letterCells = document.querySelectorAll('.letter-cell');
    const canvasRect = canvas.getBoundingClientRect();

    const STABILIZE_LINE_LENGTH = 20;


    // Равномерное распределение по X и Y
    for (let i = 0; i < NUM_PATHS; i++) {
        // Вычисляем Y-координату на основе реального положения ячейки
        const startCell = numberCells[i];
        const startCellRect = startCell.getBoundingClientRect();
        const startY = (startCellRect.top - canvasRect.top) + (startCellRect.height / 2);

        const targetAnagramIndex = targetLetterPositions[i];
        const endCell = letterCells[targetAnagramIndex];
        const endCellRect = endCell.getBoundingClientRect();
        const endY = (endCellRect.top - canvasRect.top) + (endCellRect.height / 2);

        let pathPoints = [];
        pathPoints.push({ x: 0, y: startY }); // Начальная точка (Вход)
        pathPoints.push({ x: STABILIZE_LINE_LENGTH, y: startY }); // Прямой обязательный отрезок

        // Разделяем доступную ширину на сегменты для каждой случайной точки, чтобы они не скапливались.
        const availableWidth = CANVAS_WIDTH - 2 * STABILIZE_LINE_LENGTH;
        const segmentWidth = availableWidth / NUM_RANDOM_POINTS;

        // Генерируем NUM_RANDOM_POINTS случайных точек, каждая в своем сегменте по X.
        for (let j = 0; j < NUM_RANDOM_POINTS; j++) {
            // Генерируем X в пределах текущего сегмента
            const segmentXStart = STABILIZE_LINE_LENGTH + j * segmentWidth;
            const x = segmentXStart + Math.random() * segmentWidth;
            
            // Генерируем Y в пределах всего холста, чтобы пути были более разнообразными
            const y = Math.random() * CANVAS_HEIGHT;
            
            pathPoints.push({ x, y });
        }

        // Точки уже отсортированы по X благодаря сегментированной генерации
        const startPoints = pathPoints.slice(0, 2); // Первые две точки (стабилизирующие)
        const randomPoints = pathPoints.slice(2);   // Остальные случайные точки
        pathPoints = [...startPoints, ...randomPoints];

        pathPoints.push({ x: CANVAS_WIDTH - STABILIZE_LINE_LENGTH, y: endY });// Прямой обязательный отрезок
        pathPoints.push({ x: CANVAS_WIDTH, y: endY }); // Конечная точка (Выход)

        // Сглаживаем острые углы
        const MIN_ANGLE = 45; // Минимальный угол в 45 градусов
        pathPoints = smoothPathAngles(pathPoints, MIN_ANGLE);

        paths.push({
            points: pathPoints,
            targetAnagramCellIndex: targetAnagramIndex
        });
    }
}


// Отрисовка лабиринта
function drawMaze() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Толщина линии 5px
    const LINE_THICKNESS = 5;
    // paths.length = 1; // Убрал строку для отладки, чтобы видеть все пути
    paths.forEach((pathData, index) => {
        const isMatched = document.querySelector(`.number-cell[data-index="${index}"]`).classList.contains('matched');

        ctx.beginPath();
        ctx.strokeStyle = isMatched ? '#6c757d' : PATH_COLORS[index % PATH_COLORS.length];
        ctx.lineWidth = LINE_THICKNESS;
        ctx.lineCap = 'round'; // Обеспечивает круглые концы

        const points = pathData.points;

        // Рисуем сглаженную кривую с плавными горизонтальными "усами"
        drawSpline(ctx, points);

        ctx.stroke();

        // Отрисовка контрольных точек для отладки
        ctx.fillStyle = 'black';
        points.forEach((p, i) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI); // Маленький черный кружок
            ctx.fill();
            // Добавляем номер точки
            ctx.font = '10px Arial';
            ctx.fillStyle = 'red';
            ctx.fillText(i, p.x + 5, p.y - 5);
        });

        // Отрисовка входов (кругов у цифр)
        const startPoint = points[0];
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(startPoint.x, startPoint.y, 5, 0, 2 * Math.PI);
        ctx.fill();

        // Отрисовка выходов (кругов у букв)
        const endPoint = points[points.length - 1];
        ctx.beginPath();
        ctx.arc(endPoint.x, endPoint.y, 5, 0, 2 * Math.PI);
        ctx.fill();
    });
}


// Создание HTML-элементов игры
function setupGameElements() {
    leftColumn.innerHTML = '';
    rightColumn.innerHTML = '';

    for (let i = 0; i < NUM_PATHS; i++) {
        const cell = document.createElement('div');
        cell.className = 'number-cell';
        cell.textContent = i + 1;
        cell.dataset.index = i;
        cell.addEventListener('click', handleNumberClick);
        leftColumn.appendChild(cell);
    }

    shuffledLetters.forEach((letter, i) => {
        const cell = document.createElement('div');
        cell.className = 'letter-cell';
        cell.textContent = letter;
        cell.dataset.index = i;
        cell.addEventListener('click', handleLetterClick);
        rightColumn.appendChild(cell);
    });
}

// Обновление отображения целевого слова
function updateRevealedWordDisplay() {
    targetWordDisplay.textContent = revealedWord.join('');
}


// --- Обработчики Кликов ---

function handleNumberClick() {
    if (!gameStarted || this.classList.contains('matched')) return;

    document.querySelectorAll('.number-cell').forEach(cell => {
        cell.classList.remove('selected');
    });

    this.classList.add('selected');
    selectedNumberIndex = parseInt(this.dataset.index);
}

function handleLetterClick() {
    if (!gameStarted || this.classList.contains('matched') || selectedNumberIndex === -1) return;

    const clickedLetterCellIndex = parseInt(this.dataset.index);
    const correctAnagramCellIndex = paths[selectedNumberIndex].targetAnagramCellIndex;

    if (clickedLetterCellIndex === correctAnagramCellIndex) {

        // --- Успешное сопоставление ---

        this.classList.add('matched');
        document.querySelector(`.number-cell[data-index="${selectedNumberIndex}"]`).classList.add('matched');

        revealedWord[selectedNumberIndex] = targetWordLetters[selectedNumberIndex];
        updateRevealedWordDisplay();

        matchedPairs++;
        selectedNumberIndex = -1;
        document.querySelectorAll('.number-cell').forEach(cell => cell.classList.remove('selected'));

        drawMaze();

        if (matchedPairs === NUM_PATHS) {
            endGame(true);
        }
    } else {
        // --- Неудачное сопоставление ---
        messageDisplay.textContent = 'Неверное сопоставление! Попробуйте снова.';
        messageDisplay.classList.remove('hidden');

        setTimeout(() => {
            // Убедимся, что после таймаута сообщение снова "скрыто"
            messageDisplay.classList.add('hidden');
        }, 1500);

        document.querySelectorAll('.number-cell').forEach(cell => cell.classList.remove('selected'));
        selectedNumberIndex = -1;
    }
}

// --- Основная Логика Игры ---

function startGame() {
    // 1. Случайный выбор слова из списка
    const randomIndex = Math.floor(Math.random() * WORD_LIST.length);
    const selectedWord = WORD_LIST[randomIndex].toUpperCase();

    // 2. Инициализация слов и длины
    targetWordLetters = selectedWord.split('');
    NUM_PATHS = targetWordLetters.length;

    shuffledLetters = [...targetWordLetters];
    shuffleArray(shuffledLetters);

    revealedWord = Array(NUM_PATHS).fill('?');

    // 3. Генерация правильного сопоставления (для повторяющихся букв)
    targetLetterPositions = [];
    let matchedAnagramIndices = Array(NUM_PATHS).fill(false);

    for (let i = 0; i < NUM_PATHS; i++) {
        const targetLetter = targetWordLetters[i];
        let foundIndex = -1;

        for (let j = 0; j < NUM_PATHS; j++) {
            if (shuffledLetters[j] === targetLetter && !matchedAnagramIndices[j]) {
                foundIndex = j;
                break;
            }
        }

        if (foundIndex !== -1) {
            targetLetterPositions.push(foundIndex);
            matchedAnagramIndices[foundIndex] = true;
        } else {
            targetLetterPositions.push(0);
        }
    }

    // 4. Сброс состояния игры
    gameStarted = true;
    matchedPairs = 0;
    selectedNumberIndex = -1;
    // Скрываем сообщение, используя добавленное CSS-правило
    messageDisplay.classList.add('hidden');
    gameArea.classList.remove('hidden');
    startButton.textContent = 'Перезапустить Игру';

    // 5. Отображение целевого слова
    updateRevealedWordDisplay();

    // 6. Таймер
    clearInterval(timerInterval);
    startTime = Date.now();
    // Частота обновления таймера 20 мс (50 раз в секунду)
    timerDisplay.textContent = '00:00:000';
    timerInterval = setInterval(updateTimer, 20);

    // 7. Создание элементов и лабиринта
    setupGameElements();

    // Устанавливаем высоту canvas равной высоте колонок
    const columnHeight = leftColumn.offsetHeight;
    canvas.height = Math.max(columnHeight, 400);

    generatePaths();
    drawMaze();
}

function updateTimer() {
    const elapsedMilliseconds = Date.now() - startTime;
    timerDisplay.textContent = formatTime(elapsedMilliseconds);
}

function endGame(win) {
    gameStarted = false;
    clearInterval(timerInterval);

    const finalTime = timerDisplay.textContent;

    if (win) {
        messageDisplay.textContent = `Поздравляем! Вы решили головоломку за ${finalTime}! 🎉`;
        targetWordDisplay.textContent = targetWordLetters.join('');
    } else {
        messageDisplay.textContent = 'Игра остановлена.';
    }

    messageDisplay.classList.remove('hidden');

    document.querySelectorAll('.number-cell, .letter-cell').forEach(cell => {
        cell.classList.add('matched');
        cell.classList.remove('selected');
    });
}

// --- Инициализация ---
startButton.addEventListener('click', startGame);

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
ctx.lineCap = 'round';

ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
ctx.font = '24px sans-serif';
ctx.fillStyle = '#333';
ctx.textAlign = 'center';
ctx.fillText('Нажмите "Начать Игру"', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);