'use strict';

/* ===========================================================
   Gametype: Открывашки (flip)
   Reveal all cards one by one — timer runs from first flip.
   =========================================================== */

window.CARDS_GAME_ENGINE = window.CARDS_GAME_ENGINE || {};

window.CARDS_GAME_ENGINE['flip'] = (function () {

  function init(opts) {
    const { config, theme, grid, overlay,
            timerEl, openedEl, totalEl, progressLabelEl,
            shuffle, BACK_ICONS, onFinish } = opts;

    let timerInterval = null;
    let startTime     = null;
    let timerStarted  = false;
    let openedCount   = 0;
    const totalCards  = config.cards.length;
    let gameActive    = true;

    const flipAnim  = (theme && theme.flipAnim)  || 'flip';
    const startAnim = (theme && theme.startAnim) || 'cascade';

    document.body.className = `anim-${flipAnim}`;

    if (progressLabelEl) progressLabelEl.textContent = 'Открыто';
    totalEl.textContent  = totalCards;
    openedEl.textContent = '0';
    timerEl.textContent  = '0.0';
    overlay.innerHTML    = '';
    grid.className       = `cards-grid start-${startAnim}`;

    if (totalCards === 0) {
      grid.innerHTML = '<div class="empty-state">Карточки не добавлены.<br>Откройте конфигуратор и создайте карточки.</div>';
      return;
    }

    shuffle(config.cards).forEach((card, i) => {
      grid.appendChild(buildCard(card, i));
    });

    function buildCard(card, index) {
      const wrapper = document.createElement('div');
      wrapper.className = 'card-wrapper';
      wrapper.style.animationDelay = (index * 70) + 'ms';

      const inner = document.createElement('div');
      inner.className = 'card-inner';

      const back = document.createElement('div');
      back.className = 'card-face card-back';
      back.innerHTML = `
        <div class="card-back-dots"></div>
        <div class="card-back-shine"></div>
        <div class="card-back-icon">${BACK_ICONS[index % BACK_ICONS.length]}</div>
      `;

      const front = document.createElement('div');
      front.className = 'card-face card-front';

      const imageArea = document.createElement('div');
      imageArea.className = 'card-image-area';

      if (card.image) {
        const img = document.createElement('img');
        img.className = 'card-img'; img.src = card.image; img.alt = card.word;
        imageArea.appendChild(img);
      } else {
        const em = document.createElement('div');
        em.className = 'card-emoji'; em.textContent = card.emoji || '❓';
        imageArea.appendChild(em);
      }

      const wordEl = document.createElement('div');
      wordEl.className = 'card-word'; wordEl.textContent = card.word;

      front.appendChild(imageArea);
      front.appendChild(wordEl);
      inner.appendChild(back);
      inner.appendChild(front);
      wrapper.appendChild(inner);

      wrapper.addEventListener('click', () => {
        if (!gameActive || inner.classList.contains('flipped')) return;

        if (!timerStarted) {
          timerStarted  = true;
          startTime     = Date.now();
          timerInterval = setInterval(() => {
            timerEl.textContent = ((Date.now() - startTime) / 1000).toFixed(1);
          }, 100);
        }

        inner.classList.add('flipped');
        wrapper.style.cursor = 'default';

        openedCount++;
        openedEl.textContent = openedCount;

        if (openedCount === totalCards) {
          clearInterval(timerInterval);
          gameActive = false;
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          timerEl.textContent = elapsed;
          setTimeout(() => onFinish(elapsed), 480);
        }
      });

      return wrapper;
    }
  }

  return { init };
})();
