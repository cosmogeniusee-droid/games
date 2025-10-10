// Переменные для состояния игры
let currentGridSize = 5; // Изначально 5x5
let currentNumber = 1;
let gameActive = false;
let timerInterval;
let startTime;

// DOM-элементы
const gridElement = document.getElementById('schulte-grid');
const startButton = document.getElementById('start-button');
const currentNumberSpan = document.getElementById('current-number');
const totalNumbersSpan = document.getElementById('total-numbers');
const timerSpan = document.getElementById('timer');
const confettiContainer = document.getElementById('confetti-container');
const sizeButtons = document.querySelectorAll('.size-btn');

// Звуковые эффекты (Используются общедоступные ссылки)
// Звук для правильного нажатия (Correct / Beep)
const correctSound = new Audio('https://onlinetestcase.com/wp-content/uploads/2023/06/100-KB-MP3.mp3'); 
// Звук для неправильного нажатия (Incorrect / Buzz)
const incorrectSound = new Audio('https://s3.eu-central-1.amazonaws.com/s.siteapi.org/a4/0c19a0a049e39e2.mp3');

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

/**
 * Генерирует и отображает сетку Шульте.
 */
function generateGrid() {
    const TOTAL_NUMBERS = currentGridSize * currentGridSize;
    
    // Обновление класса сетки и информации
    gridElement.className = ''; // Сброс классов
    gridElement.classList.add(`grid-${currentGridSize}x${currentGridSize}`);
    totalNumbersSpan.textContent = TOTAL_NUMBERS;
    
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

    if (clickedNumber === currentNumber) {
        // Правильное нажатие
        correctSound.currentTime = 0; // Сбрасываем звук, чтобы он проигрывался сразу
        correctSound.play().catch(e => console.error("Ошибка проигрывания звука: ", e));
        
        cell.classList.add('correct');
        cell.removeEventListener('click', handleCellClick); 
        currentNumber++;
        currentNumberSpan.textContent = currentNumber;

        if (currentNumber > TOTAL_NUMBERS) {
            // Победа!
            stopTimer();
            gameActive = false;
            gridElement.classList.remove('active');
            displayMessage(`Победа! Ваше время: ${timerSpan.textContent} с`, 'green');
            triggerConfetti();
            startButton.textContent = 'Сыграть снова';
            enableSizeButtons(true);
        }
    } else {
        // Неправильное нажатие
        incorrectSound.currentTime = 0;
        incorrectSound.play().catch(e => console.error("Ошибка проигрывания звука: ", e));
        cell.classList.add('incorrect');
        
        // Блокируем игру
        gameActive = false;
        gridElement.classList.remove('active');
        stopTimer();
        
        displayMessage('Неправильно! Игра начнется заново через 3 секунды...', 'red');

        // Сброс через 3 секунды
        setTimeout(() => {
            resetGame();
            enableSizeButtons(true);
        }, 3000);
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
 * Сбрасывает игру до начального состояния.
 */
function resetGame() {
    stopTimer();
    currentNumber = 1;
    currentNumberSpan.textContent = currentNumber;
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
    
    startButton.textContent = 'Начать игру';
    gridElement.classList.remove('active');
    hideMessage();
    confettiContainer.innerHTML = ''; // Очищаем звездочки
}

/**
 * Запускает игру.
 */
function startGame() {
    if (gameActive) return; 
    
    resetGame(); 
    
    gameActive = true;
    gridElement.classList.add('active');
    startButton.textContent = 'В процессе...';
    startTimer();
    enableSizeButtons(false); // Блокируем изменение размера во время игры
}

/**
 * Обработчик для кнопок выбора размера.
 */
function handleSizeChange(event) {
    if (gameActive) return;

    const newSize = parseInt(event.target.dataset.size, 10);
    if (newSize === currentGridSize) return;

    currentGridSize = newSize;

    // Обновляем активную кнопку
    sizeButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    resetGame(); // Перезапускаем игру с новой сеткой
}

/**
 * Блокирует/разблокирует кнопки выбора размера.
 */
function enableSizeButtons(enable) {
    sizeButtons.forEach(btn => {
        btn.disabled = !enable;
        btn.style.opacity = enable ? '1.0' : '0.5';
    });
}


function displayMessage(text, color) {
    const messageElement = document.getElementById('message');
    messageElement.textContent = text;
    messageElement.style.color = color;
    messageElement.classList.remove('hidden');
}

function hideMessage() {
    document.getElementById('message').classList.add('hidden');
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


// Инициализация: Добавление слушателей событий
startButton.addEventListener('click', startGame);
sizeButtons.forEach(button => {
    button.addEventListener('click', handleSizeChange);
});

// Первоначальная генерация сетки (5x5)
generateGrid();