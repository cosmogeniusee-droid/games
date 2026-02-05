// Переменные для состояния игры
let currentNumber = 1;
let currentGridSize = 3;
let reverseMode = false;
let gameActive = false;
let timerInterval;
let startTime;

// DOM-элементы
const orderInstructionElement = document.getElementById('order-instruction');
const gridElement = document.getElementById('schulte-grid');
const startButton = document.getElementById('start-button');
const fullscreenButton = document.getElementById('fullscreen-btn'); // Новая кнопка
const currentNumberSpan = document.getElementById('current-number');
const totalNumbersSpan = document.getElementById('total-numbers');
const timerSpan = document.getElementById('timer');
const confettiContainer = document.getElementById('confetti-container');
const correctSound = new Audio('correct.mp3');
const incorrectSound = new Audio('incorrect.mp3');
const finishSound = new Audio('finish.mp3');

/**
 * Перемешивает массив (алгоритм Фишера-Йейтса).
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function toggleFullscreen() {
    const gameContainer = document.querySelector('.game-container');
    if (!document.fullscreenElement) {
        // Запрос перехода в полноэкранный режим
        if (gameContainer.requestFullscreen) {
            gameContainer.requestFullscreen();
        } else if (gameContainer.webkitRequestFullscreen) { /* Safari */
            gameContainer.webkitRequestFullscreen();
        } else if (gameContainer.msRequestFullscreen) { /* IE11 */
            gameContainer.msRequestFullscreen();
        }
    } else {
        // Выход из полноэкранного режима
        document.exitFullscreen();
    }
}

/**
 * Генерирует и отображает сетку Шульте.
 */
function generateGrid() {
    const TOTAL_NUMBERS = currentGridSize * currentGridSize;
    
    // Обновление класса сетки и информации
    gridElement.className = ''; // Сброс классов
    gridElement.classList.add(`grid-${currentGridSize}x${currentGridSize}`);
    totalNumbersSpan.textContent = reverseMode ? `${TOTAL_NUMBERS} до 1` : `1 до ${TOTAL_NUMBERS}`;
    orderInstructionElement.textContent = reverseMode ? 'в обратном порядке' : 'в порядке возрастания';
    // Создаем массив чисел
    const numbers = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1);
    const shuffledNumbers = shuffleArray(numbers);

    gridElement.innerHTML = ''; // Очищаем сетку
    
    shuffledNumbers.forEach(number => {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.textContent = number;
        cell.dataset.number = number; 
        cell.addEventListener('click', handleCellClick);
        gridElement.appendChild(cell);
    });
}

/**
 * Обработчик клика по ячейке.
 */
function handleCellClick(event) {
    if (!gameActive) return;

    const clickedNumber = parseInt(event.target.dataset.number, 10);
    const cell = event.target;
    const TOTAL_NUMBERS = currentGridSize * currentGridSize;
    const expectedNumber = reverseMode ? (TOTAL_NUMBERS - currentNumber + 1) : currentNumber;

    if (clickedNumber === expectedNumber) {
        // Правильное нажатие
        correctSound.currentTime = 0; // Сбрасываем звук, чтобы он проигрывался сразу
        correctSound.play().catch(e => console.error("Ошибка проигрывания звука: ", e));
        
        cell.classList.add('correct');
        cell.removeEventListener('click', handleCellClick); 
        currentNumber++;
        currentNumberSpan.textContent = reverseMode ? (TOTAL_NUMBERS - currentNumber + 1) : currentNumber;

        if (currentNumber > TOTAL_NUMBERS) {            
            finishSound.currentTime = 0; // Сбрасываем звук, чтобы он проигрывался сразу
            finishSound.play().catch(e => console.error("Ошибка проигрывания звука: ", e));
            // Победа!
            stopTimer();
            gridElement.classList.remove('active');
            triggerConfetti();
            gameActive = false;
            startButton.textContent = 'Сыграть снова!';
            displayMessage(`Победа! Ваше время: ${timerSpan.textContent} с`, 'green');
        }
    } else {
        // Неправильное нажатие
        incorrectSound.currentTime = 0;
        incorrectSound.play().catch(e => console.error("Ошибка проигрывания звука: ", e));
        cell.classList.add('incorrect');
        
        // Блокируем игру
        gridElement.classList.remove('active');
        stopTimer();
        gameActive = false;
        startButton.textContent = 'Попробовать снова';        
        displayMessage('Неправильно! Попробуй снова...', 'red');
    }
}

/**
 * Запускает таймер.
 */
function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsedTime = (Date.now() - startTime) / 1000;
        timerSpan.textContent = elapsedTime.toFixed(2);
    }, 100);
}

/**
 * Останавливает таймер.
 */
function stopTimer() {
    clearInterval(timerInterval);
}


/**
 * Запускает игру.
 */
function startGame() {
    if (gameActive) return; 
    
    stopTimer();
    currentNumber = 1;
    const TOTAL_NUMBERS = currentGridSize * currentGridSize;
    currentNumberSpan.textContent = reverseMode ? TOTAL_NUMBERS : currentNumber;
    timerSpan.textContent = '0.00';
    
    // Удаляем все классы обратной связи и анимацию
    const allCells = document.querySelectorAll('.cell');
    allCells.forEach(cell => {
        cell.classList.remove('correct', 'incorrect');
        // Возвращаем обработчик клика
        cell.addEventListener('click', handleCellClick);
    });

    // Перезагрузка сетки с новыми случайными числами
    generateGrid();
    hideMessage();
    confettiContainer.innerHTML = ''; // Очищаем звездочки
    
    gameActive = true;
    gridElement.classList.add('active');
    startButton.textContent = 'Игра началась!';
    startTimer();
}

function displayMessage(text, color) {
    const messageElement = document.getElementById('message');
    messageElement.textContent = text;
    // Используем классы Bootstrap для стилизации
    messageElement.className = 'alert'; // Сброс классов
    messageElement.style.opacity = '1'; // Делаем видимым
    messageElement.style.visibility = 'visible';
    const alertClass = color === 'green' ? 'alert-success' : 'alert-danger';
    messageElement.classList.add(alertClass);
}

function hideMessage() {
    const messageElement = document.getElementById('message');
    messageElement.style.opacity = '0'; // Делаем невидимым
    messageElement.style.visibility = 'hidden';
}

function triggerConfetti() {
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.left = `${Math.random() * 100}%`; 
        confetti.style.setProperty('--end-x', `${(Math.random() - 0.5) * 500}px`);
        confettiContainer.appendChild(confetti);

        confetti.addEventListener('animationend', () => {
            confetti.remove();
        });
    }
}

startButton.addEventListener('click', startGame);
fullscreenButton.addEventListener('click', toggleFullscreen);