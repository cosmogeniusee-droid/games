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
    
    const horizontalLength = 10; // Длина горизонтального "уса"
    
    const startPoint = points[0];
    const endPoint = points[points.length - 1];

    // 1. Начальная точка и плавный переход к 10px
    const startCurveX = startPoint.x + horizontalLength;
    const startCurveY = startPoint.y;
    
    context.moveTo(startPoint.x, startPoint.y);
    // Плавный переход, используя startPoint как контрольную точку
    context.quadraticCurveTo(startPoint.x, startPoint.y, startCurveX, startCurveY); 
    
    // 2. Основной сплайн 
    let currentPoint = { x: startCurveX, y: startCurveY }; 

    for (let i = 1; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        
        // Середина следующего сегмента
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        
        // Кривая от текущей точки к середине, p1 как контрольная
        context.quadraticCurveTo(p1.x, p1.y, midX, midY);
        
        currentPoint = { x: midX, y: midY };
    }
    
    // 3. Плавный переход к горизонтальному финалу
    const endCurveX = endPoint.x - horizontalLength;
    const endCurveY = endPoint.y; 

    // Финальная сглаживающая кривая, endPoint как контрольная точка
    context.quadraticCurveTo(endPoint.x, endPoint.y, endCurveX, endCurveY);
    
    // 4. Горизонтальный финал
    context.lineTo(endPoint.x, endPoint.y);
}


// Создание путей лабиринта (Только точки с равномерным распределением)
function generatePaths() {
    paths = [];
    const stepY = CANVAS_HEIGHT / (NUM_PATHS + 1);
    
    const NUM_RANDOM_POINTS = 5; 
    
    const POINT_RANGE_Y = CANVAS_HEIGHT; 
    
    // Равномерное распределение по X и Y
    const POINT_RANGE_X_START = 0; 
    const POINT_RANGE_X_END = CANVAS_WIDTH;

    for (let i = 0; i < NUM_PATHS; i++) {
        const startY = (i + 1) * stepY; // Y-координата входа
        const targetAnagramIndex = targetLetterPositions[i]; 
        const endY = (targetAnagramIndex + 1) * stepY; // Y-координата выхода

        let pathPoints = [];
        pathPoints.push({ x: 0, y: startY }); // Начальная точка (Вход)

        // Генерируем 5 рандомных точек
        for (let j = 0; j < NUM_RANDOM_POINTS; j++) {
            const randomX = POINT_RANGE_X_START + Math.random() * (POINT_RANGE_X_END - POINT_RANGE_X_START);
            const randomY = Math.random() * POINT_RANGE_Y;
            pathPoints.push({ x: randomX, y: randomY });
        }
        
        // Сортируем точки по X, чтобы линия шла слева направо
        const fixedPoints = pathPoints.slice(0, 1);
        const randomPoints = pathPoints.slice(1);
        
        // Сортируем случайные точки по X
        randomPoints.sort((a, b) => a.x - b.x); 
        
        pathPoints = [...fixedPoints, ...randomPoints];

        pathPoints.push({ x: CANVAS_WIDTH, y: endY }); // Конечная точка (Выход)
        
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