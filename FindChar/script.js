// Русские буквы для игры
const RUSSIAN_ALPHABET = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"; 
const FREQUENT_LETTERS = "АЕИОУРСТНЛКВДМПБГЖЗК"; // Более частые для отвлекающего фона

// --- Получение параметров из URL ---
const urlParams = new URLSearchParams(window.location.search);
const urlGridSize = urlParams.get('gridSize');
const urlTargets = urlParams.get('targets');
const urlMin = urlParams.get('min');
const urlMax = urlParams.get('max');
const urlCustomTargets = urlParams.get('customTargets');
const urlFontSize = urlParams.get('fontSize');

// Настройки игры
const GRID_SIZE = urlGridSize ? parseInt(urlGridSize, 10) : 15; // Размер сетки
let TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const TARGET_LETTERS_COUNT = urlTargets ? parseInt(urlTargets, 10) : 3; // Сколько разных букв нужно найти
const MIN_OCCURRENCE = urlMin ? parseInt(urlMin, 10) : 6; // Минимальное количество каждой целевой буквы
const MAX_OCCURRENCE = urlMax ? parseInt(urlMax, 10) : 12; // Максимальное количество каждой целевой буквы
const FONT_SIZE = urlFontSize ? parseFloat(urlFontSize) : 1.7; // Размер шрифта букв



// DOM элементы
const gameBoard = document.getElementById('game-board');
const targetLettersDisplay = document.getElementById('target-letters-display');
const remainingCountDisplay = document.getElementById('remaining-count');
const startButton = document.getElementById('start-button');
const messageArea = document.getElementById('message-area');
const fullscreenButton = document.getElementById('fullscreen-button');
const timerDisplay = document.getElementById('timer'); // Новый элемент таймера

// Переменные состояния игры
let targetLetters = [];
let remainingCount = 0;
let isGameActive = false;
let timerInterval;


// --- Функции для полноэкранного режима ---

/**
 * Переключает полноэкранный режим.
 */
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        fullscreenButton.textContent = 'Выйти ↔️';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
            fullscreenButton.textContent = 'На весь экран ↔️';
        }
    }
}

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        fullscreenButton.textContent = 'На весь экран ↔️';
    }
});


// --- Функции для таймера ---

/**
 * Запускает таймер с точностью до 10 миллисекунд.
 */
function startTimer() {
    let startTime = Date.now();
    // Обновляем каждые 10 мс
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        
        const seconds = Math.floor(elapsedTime / 1000);
        // Миллисекунды (две цифры)
        const milliseconds = Math.floor((elapsedTime % 1000) / 10); 

        timerDisplay.textContent = 
            `${String(seconds).padStart(2, '0')}:${String(milliseconds).padStart(2, '0')}`;
    }, 10);
}

/**
 * Останавливает таймер.
 */
function stopTimer() {
    clearInterval(timerInterval);
}


// --- Функции для генерации игры ---

/**
 * Выбирает заданное количество уникальных целевых букв.
 * @param {number} count Количество букв для выбора.
 * @returns {string[]} Массив выбранных букв.
 */
function chooseTargetLetters(count) {
    const letters = RUSSIAN_ALPHABET.split('');
    const chosen = [];
    while (chosen.length < count) {
        const randomIndex = Math.floor(Math.random() * letters.length);
        const letter = letters[randomIndex];
        if (!chosen.includes(letter)) {
            chosen.push(letter);
            letters.splice(randomIndex, 1);
        }
    }
    return chosen;
}

/**
 * Генерирует массив всех букв для игрового поля.
 * @param {string[]} targets Целевые буквы.
 * @returns {string[]} Массив всех букв на поле.
 */
function generateLetterArray(targets) {
    let letters = [];
    let totalTargets = 0;

    // 1. Добавляем целевые буквы
    targets.forEach(target => {
        const count = Math.floor(Math.random() * (MAX_OCCURRENCE - MIN_OCCURRENCE + 1)) + MIN_OCCURRENCE;
        for (let i = 0; i < count; i++) {
            letters.push(target);
        }
        totalTargets += count;
    });

    remainingCount = totalTargets;
    
    // 2. Добавляем отвлекающие буквы до заполнения поля
    const frequentLettersArr = FREQUENT_LETTERS.split('');
    while (letters.length < TOTAL_CELLS) {
        const randomIndex = Math.floor(Math.random() * frequentLettersArr.length);
        const distracter = frequentLettersArr[randomIndex];
        // Убедимся, что отвлекающая буква не является целевой
        if (!targets.includes(distracter)) {
            letters.push(distracter);
        }
    }

    // 3. Перемешиваем массив
    for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
    }

    return letters;
}

/**
 * Рендерит игровое поле на основе массива букв.
 * @param {string[]} letters Массив букв для поля.
 */
function renderGameBoard(letters) {
    gameBoard.innerHTML = '';
    letters.forEach((letter, index) => {
        const cell = document.createElement('div');
        cell.classList.add('letter-cell');
        cell.textContent = letter;
        cell.dataset.index = index;
        cell.addEventListener('click', handleCellClick);
        gameBoard.appendChild(cell);
    });
}


// --- Функции для логики игры ---

/**
 * Обработчик клика по ячейке.
 * @param {Event} event Событие клика.
 */
function handleCellClick(event) {
    if (!isGameActive) return;

    const cell = event.currentTarget;
    const letter = cell.textContent;

    // Проверяем, является ли буква целевой
    if (targetLetters.includes(letter)) {
        // Правильный клик
        if (!cell.classList.contains('found')) {
            cell.classList.add('found');
            remainingCount--;
            updateRemainingCount();
            
            // Проверка на победу
            if (remainingCount === 0) {
                endGame(true);
            }
        }
    } else {
        // Неправильный клик
        cell.classList.add('wrong');
        
        // Удаляем класс 'wrong' через короткое время
        setTimeout(() => {
            cell.classList.remove('wrong');
        }, 500);
    }
}

/**
 * Обновляет отображение оставшегося количества букв.
 */
function updateRemainingCount() {
    remainingCountDisplay.textContent = remainingCount;
}

/**
 * Завершает игру и выводит сообщение.
 * @param {boolean} isWin Флаг победы.
 */
function endGame(isWin) {
    stopTimer(); // Останавливаем таймер при завершении
    isGameActive = false;
    gameBoard.classList.add('disabled');
    startButton.textContent = 'Сыграть еще раз! 🎉';
    
    messageArea.classList.remove('hidden');
    if (isWin) {
        const finalTime = timerDisplay.textContent;
        messageArea.innerHTML = `ПОБЕДА! 🎉 Время: ${finalTime}. Ты нашел все буквы!`;
        messageArea.style.backgroundColor = '#a4f5aa';
        messageArea.style.borderColor = '#3cb371';
    } else {
        messageArea.innerHTML = 'Время вышло! Попробуй снова. ⏳'; // (для будущих версий с лимитом времени)
        messageArea.style.backgroundColor = '#ffc0cb';
        messageArea.style.borderColor = '#ff1493';
    }
}
function generateGameField() {
       // 2. Генерируем буквы
    if (urlCustomTargets) {
        // Используем заданные буквы, отфильтровав пустые значения
        targetLetters = urlCustomTargets.split(',').filter(letter => letter.trim() !== '');
    } else {
        // Выбираем случайные буквы
        targetLetters = chooseTargetLetters(TARGET_LETTERS_COUNT);
    }
    const letterArray = generateLetterArray(targetLetters);

    // 3. Обновляем UI задания
    targetLettersDisplay.textContent = targetLetters.join(', ');
    updateRemainingCount();
    
    // 4. Рендерим поле
    renderGameBoard(letterArray);
}

/**
 * Инициализирует новую игру.
 */
function startGame() {
    // 1. Сбрасываем состояние
    isGameActive = true;
    messageArea.classList.add('hidden');
    gameBoard.classList.remove('disabled');
    gameBoard.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
    gameBoard.style.setProperty('--letter-font-size', `${FONT_SIZE}em`);
    startButton.textContent = 'Новая игра!';
    stopTimer(); // Сброс таймера перед стартом
    timerDisplay.textContent = '00:00';

    generateGameField();
    
    // 5. Запускаем таймер
    startTimer();
}


// --- Инициализация при загрузке ---

// Назначаем обработчик на кнопку "Начать игру"
startButton.addEventListener('click', startGame);
fullscreenButton.addEventListener('click', toggleFullScreen);

// Настраиваем начальный вид
generateGameField();
remainingCountDisplay.textContent = '...';
gameBoard.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
gameBoard.style.setProperty('--letter-font-size', `${FONT_SIZE}em`);
timerDisplay.textContent = '00:00';
gameBoard.classList.add('disabled');