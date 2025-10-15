document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Получение параметров из URL и установка значений по умолчанию ---
    const urlParams = new URLSearchParams(window.location.search);

    const phrase = urlParams.get('text') || "Прочитай меня если сможешь ";
    const radius = parseInt(urlParams.get('radius'), 10) || 200;
    const rotationSpeed = (parseInt(urlParams.get('speed'), 10) || 8) / 1000; // Делим для более плавной скорости
    const fontSize = urlParams.get('size') ? `${urlParams.get('size')}px` : '24px';
    const fontColor = urlParams.get('color') ? `#${urlParams.get('color')}` : '#333';
    const bgColor = urlParams.get('bgcolor') ? `#${urlParams.get('bgcolor')}` : '#f0f8ff';
    const bgImage = urlParams.get('bg');

    const letterSize = Number(fontSize.replace('px', '')) + 20;
    // --- 2. Настройка DOM элементов ---
    const container = document.getElementById('circle-container');
    container.style.width = `${radius * 2 + letterSize}px`;
    container.style.height = `${radius * 2 + letterSize}px`;

    // Применение фона
    if (bgImage) {
        document.body.style.backgroundImage = `url('${decodeURIComponent(bgImage)}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
    } else {
        document.body.style.backgroundColor = bgColor;
    }

    // --- 3. Создание букв ---
    const letters = phrase.split('');
    const center = { x: radius, y: radius };
    const totalLetters = letters.length;

    let currentAngle = 0; // Начинаем с 0
    let letterElements = [];

    letters.forEach((letter) => {
        const letterBlock = document.createElement('div');
        letterBlock.className = 'letter-block';
        letterBlock.textContent = letter;
        // Применение стилей из параметров
        letterBlock.style.fontSize = fontSize;
        letterBlock.style.color = fontColor;

        letterBlock.style.width = letterSize+ 'px';
        letterBlock.style.height = letterSize + 'px';
        letterBlock.style.lineHeight = fontSize
        container.appendChild(letterBlock);
        letterElements.push(letterBlock);
    });

    // --- 4. Анимация (вращение) ---
    function animateRotation() {
        // Увеличиваем угол вращения
        currentAngle += rotationSpeed;

        letterElements.forEach((el, index) => {
            const angleStep = (2 * Math.PI) / totalLetters;
            // Угол для текущего элемента на круге
            const angle = index * angleStep + currentAngle;

            // Новые позиции (x, y)
            const x = center.x + radius * Math.cos(angle);
            const y = center.y + radius * Math.sin(angle);

            // Перемещение блока с учетом его центра
            el.style.transform = `
                translate(${x}px, ${y}px)
            `;
        });

        requestAnimationFrame(animateRotation);
    }

    // Запускаем анимацию
    requestAnimationFrame(animateRotation);
});