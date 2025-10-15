document.addEventListener('DOMContentLoaded', () => {
    // 1. Новое предложение
    const phrase = "Прочитай меня если сможешь ";
    const container = document.getElementById('circle-container');
    
    // Удаляем все пробелы, так как они не нужны для движения по кругу
    const letters = phrase.split('');

    // Параметры круга
    const radius = 200; 
    const center = { x: radius, y: radius };
    const totalLetters = letters.length;
    
    // Скорость вращения в радианах за кадр. (Положительное = по часовой)
    const rotationSpeed = 0.008; 

    let currentAngle = 0; // Начинаем с 0
    let letterElements = [];

    // 2. Создание элементов
    letters.forEach((letter) => {
        const letterBlock = document.createElement('div');
        letterBlock.className = 'letter-block';
        letterBlock.textContent = letter;
        container.appendChild(letterBlock);
        letterElements.push(letterBlock);
    });
    
    // 3. Анимация (вращение)
    function animateRotation() {
        // Увеличиваем угол вращения по часовой стрелке
        currentAngle += rotationSpeed;

        letterElements.forEach((el, index) => {
            const angleStep = (2 * Math.PI) / totalLetters;
            // Угол для текущего элемента на круге
            const angle = index * angleStep + currentAngle; 
            
            // Новые позиции (x, y)
            const x = center.x + radius * Math.cos(angle);
            const y = center.y + radius * Math.sin(angle);
            
            // Перемещение и вращение блока
            el.style.transform = `
                /* 1. Позиционируем центр блока по его орбите */
                translate(${x}px, ${y}px)
            `;
        });

        requestAnimationFrame(animateRotation);
    }

    // Запускаем анимацию
    requestAnimationFrame(animateRotation);
});