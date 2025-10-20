document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Получение параметров из URL и установка значений по умолчанию ---
    const urlParams = new URLSearchParams(window.location.search);

    const phrase = urlParams.get('text') || "Прочитай меня если сможешь ";
    const shape = urlParams.get('shape') || 'circle'; // 'circle' или 'spiral'
    const radius = parseInt(urlParams.get('radius'), 10) || 200; // Начальный радиус
    const rotationSpeed = (parseInt(urlParams.get('speed'), 10) || 5) / 1000; // Делим для более плавной скорости
    const fontSize = urlParams.get('size') ? `${urlParams.get('size')}px` : '24px';
    const fontColor = urlParams.get('color') ? `#${urlParams.get('color')}` : '#333';
    const bgColor = urlParams.get('bgcolor') ? `#${urlParams.get('bgcolor')}` : '#f0f8ff';
    const bgImage = urlParams.get('bg');
    const spiralGap = parseInt(urlParams.get('gap'), 10) || 5; // Расстояние между витками спирали
    const spiralTurns = parseFloat(urlParams.get('turns')) || 1.5; // Количество оборотов спирали

    const letterSize = Number(fontSize.replace('px', '')) + 20;
    // --- 2. Настройка DOM элементов ---
    const container = document.getElementById('circle-container');
    if (shape === 'spiral') {
        container.classList.add('spiral');
    }
    const letters = phrase.split('');
    const totalLetters = letters.length;
    const containerSize = shape === 'spiral' ? (radius + totalLetters * spiralGap) * 2 : radius * 2; 
    const center = { x: containerSize / 2, y: containerSize / 2 };
    container.style.width = `${containerSize + letterSize}px`;
    container.style.height = `${containerSize + letterSize}px`;

    // Применение фона
    if (bgImage) {
        document.body.style.backgroundImage = `url('${decodeURIComponent(bgImage)}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
    } else {
        document.body.style.backgroundColor = bgColor;
    }



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

    // Вычисляем правильное расстояние между буквами для спирали, чтобы соответствовать spiralTurns
    let letterSpacing;
    if (shape === 'spiral' && totalLetters > 1) {
        const totalAngle = 2 * Math.PI * spiralTurns;
        // Сумма обратных радиусов. Это нужно, чтобы вычислить, какой "вес" вносит каждый сегмент в общий угол.
        let inverseRadiusSum = 0;
        for (let i = 0; i < totalLetters - 1; i++) {
            inverseRadiusSum += 1 / (radius + i * spiralGap);
        }
        // Рассчитываем расстояние, чтобы суммарный угол соответствовал заданным оборотам
        letterSpacing = totalAngle / inverseRadiusSum;
    } else {
        letterSpacing = 30; // Значение по умолчанию, если не спираль
    }

    // --- 4. Анимация (вращение) ---
    function animateRotation() {
        // Увеличиваем угол вращения
        currentAngle += rotationSpeed;

        let accumulatedAngle = 0; // Накопленный угол для спирали

        letterElements.forEach((el, index) => {
            let angle;
            let currentRadius;

            if (shape === 'spiral') {
                // Для спирали радиус увеличивается для каждой буквы
                currentRadius = radius + index * spiralGap;
                if (index > 0) {
                    // Вычисляем угол так, чтобы сохранить постоянное расстояние между буквами
                    const prevRadius = radius + (index - 1) * spiralGap;
                    const angleIncrement = letterSpacing / prevRadius;
                    accumulatedAngle += angleIncrement;
                }
                angle = accumulatedAngle + currentAngle;
            } else {
                // Для круга радиус постоянный
                currentRadius = radius;
                const angleStep = (2 * Math.PI) / totalLetters;
                angle = index * angleStep + currentAngle;
            }

            // Новые позиции (x, y)
            const x = center.x + currentRadius * Math.cos(angle);
            const y = center.y + currentRadius * Math.sin(angle);

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