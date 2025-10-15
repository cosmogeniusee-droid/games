// Данные для игры по умолчанию (если URL-параметры не заданы)
const gameData = {
    easy: [
        "СО-БА-КА", 
        "КО-ТЁ-НОК", 
        "МО-ЛО-КО",
        "У-ЧИ-ТЕЛЬ"
    ],
    hard: [
        "КО-РО-ТКИЙ СЛОГ,|ДЛИН-НО-Е СЛО-ВО.",
        "ПРО-ЧТИ-ТЕ ВНИ-МА-ТЕЛЬ-НО|КА-ЖДОЕ ПРЕД-ЛО-ЖЕ-НИ-Е|ДО КОН-ЦА.",
        "МА-ЛЕНЬ-КИЙ ГЕ-РОЙ|БОЛЬ-ШО-ГО МИ-РА|ЧИТА-ЕТ КНИ-ГУ."
    ]
};

// --- 1. ПОЛУЧЕНИЕ ПАРАМЕТРОВ ИЗ URL ---
const urlParams = new URLSearchParams(window.location.search);
const urlText = urlParams.get('text');
const urlColor = urlParams.get('color');
const urlBgColor = urlParams.get('bgcolor');
const urlBg = urlParams.get('bg');
const urlSize = urlParams.get('size');

// --- 2. ГЛОБАЛЬНЫЕ НАСТРОЙКИ ИГРЫ ---
const highlightColor = urlColor ? `#${urlColor}` : '#1dbd45'; // Цвет для выделения
const fontSize = urlSize ? `${urlSize}em` : '3em'; // Размер шрифта
const gameBody = document.getElementById('game-body');
const fullscreenButton = document.getElementById('fullscreen-btn');

// Применяем фон, если он задан в URL
if (urlBg) {
    // Декодируем URL на случай, если в нем есть спецсимволы
    const backgroundUrl = decodeURIComponent(urlBg);
    gameBody.style.backgroundImage = `url('${backgroundUrl}')`;
    gameBody.style.backgroundSize = 'cover';
    gameBody.style.backgroundPosition = 'center';
    gameBody.style.backgroundRepeat = 'no-repeat';
} 
if (urlBgColor) {
    // Если задан цвет фона, применяем его
    gameBody.style.backgroundColor = `#${urlBgColor}`;
} else {
    gameBody.style.backgroundColor = '#f7e1ff'; // Цвет по умолчанию
}

// --- 3. ОСНОВНАЯ ФУНКЦИЯ ЗАГРУЗКИ ИГРЫ ---
function loadGame(){
    
let currentText;

if (urlText) {
    // Если параметр 'text' есть в URL, используем его
    // Декодируем, так как в URL пробелы могут быть как '+' или '%20'
    currentText = decodeURIComponent(urlText);
} else {
    // Если параметра нет, сохраняем логику случайного выбора
    const levels = ['easy', 'hard'];
    const currentLevel = levels[Math.floor(Math.random() * levels.length)];
    
    const texts = gameData[currentLevel];
    currentText = texts[Math.floor(Math.random() * texts.length)];
}

const container = document.getElementById('game-container');
container.style.maxWidth = '';
const lines = currentText.split('|');
let maxLen = 0;
lines.forEach((lineText, lineIndex) => {
    const wrapper = document.createElement('div');
    wrapper.classList.add('line-wrapper');
    
    const lineDisplay = document.createElement('div');
    lineDisplay.classList.add('word-line');
    lineDisplay.style.fontSize = fontSize; // Применяем размер шрифта

    // Заменяем пробелы и дефисы на неразрывные символы
    const normalizedLine = lineText.replace(/ /g, '\u00A0').replace(/-/g, '\u2011'); 
    const characters = normalizedLine.split('');
    
    characters.forEach((char) => {
        const span = document.createElement('span');
        span.textContent = char;
        span.classList.add('letter-span');
        lineDisplay.appendChild(span);
    });

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = characters.length.toString(); 
    slider.value = '0';
    slider.classList.add('slider');

    wrapper.appendChild(lineDisplay);
    wrapper.appendChild(slider);
    
    container.appendChild(wrapper); 

    const THUMB_WIDTH_COMPENSATION = 20; 
    const textWidth = lineDisplay.offsetWidth;
    
    wrapper.style.width = `${textWidth + THUMB_WIDTH_COMPENSATION}px`;
    if (maxLen < (textWidth + THUMB_WIDTH_COMPENSATION)){
        maxLen = textWidth + THUMB_WIDTH_COMPENSATION;
    }
    console.log('Line '+ lineIndex , lineDisplay.offsetWidth)
    slider.addEventListener('input', (event) => {
        updateColors(lineDisplay, parseInt(event.target.value), highlightColor);
    });

    updateColors(lineDisplay, 0);
});

container.style.maxWidth = maxLen+ 'px'; 
}

// --- 4. ОБРАБОТЧИКИ СОБЫТИЙ ---
fullscreenButton.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        // Запрос перехода в полноэкранный режим
        gameBody.requestFullscreen().catch(err => {
            alert(`Ошибка перехода в полноэкранный режим: ${err.message}`);
        });
    } else {
        // Выход из полноэкранного режима
        document.exitFullscreen();
    }
});

/**
 * Обновляет цвет букв в строке в зависимости от положения слайдера.
 * @param {HTMLElement} lineElement - Элемент div.word-line, содержащий спаны с буквами.
 * @param {number} sliderValue - Текущее значение слайдера.
 * @param {string} color - Цвет для выделенных букв.
 */
function updateColors(lineElement, sliderValue, color = '#1dbd45') {
    const spans = lineElement.querySelectorAll('.letter-span');
    spans.forEach((span, charIndex) => {
        if (charIndex < sliderValue) {
            span.style.color = color;
        } else {
            span.style.color = '#333'; 
        }
    });
}

window.addEventListener('load', loadGame);