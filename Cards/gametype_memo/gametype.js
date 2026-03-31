'use strict';

/* ===========================================================
   Gametype: Мемо (memo)
   Classic concentration / memory game.
   Each card appears twice; find all matching pairs.
   =========================================================== */

window.CARDS_GAME_ENGINE = window.CARDS_GAME_ENGINE || {};

window.CARDS_GAME_ENGINE['memo'] = (function () {

  function init(opts) {
    const { config, theme, grid, overlay,
            timerEl, openedEl, totalEl, progressLabelEl,
            shuffle, BACK_ICONS, onFinish } = opts;

    let timerInterval  = null;
    let startTime      = null;
    let timerStarted   = false;
    let matchedPairs   = 0;
    const totalPairs   = config.cards.length;
    let gameActive     = true;
    let flippedCards   = [];   // up to 2 { inner, wrapper } while checking
    let locked         = false;

    const flipAnim  = (theme && theme.flipAnim)  || 'flip';
    const startAnim = (theme && theme.startAnim) || 'cascade';

    document.body.className = `anim-${flipAnim} memo-mode`;

    if (progressLabelEl) progressLabelEl.textContent = 'Пары';
    totalEl.textContent  = totalPairs;
    openedEl.textContent = '0';
    timerEl.textContent  = '0.0';
    overlay.innerHTML    = '';
    grid.className = `cards-grid memo-grid start-${startAnim}`;

    if (totalPairs === 0) {
      grid.innerHTML = '<div class="empty-state">Карточки не добавлены.<br>Откройте конфигуратор и создайте карточки.</div>';
      return;
    }

    // ── Compute optimal column count to fill available space ──────────────────
    const totalCards = totalPairs * 2;
    const CARD_RATIO = 4 / 3; // height / width
    const GAP = 10;
    const PAD = 24; // total horizontal padding


    function computeLayout() {
      // Fill width, multirow, header included
      const headerH = document.querySelector('.game-header')?.offsetHeight || 0;
      const W = grid.clientWidth  || (window.innerWidth  - PAD);
      const H = (window.innerHeight - headerH - 32);

      let bestCols = 1, bestCardH = H;

      for (let c = totalCards; c >= 1; c--) {
        const rows  = Math.ceil(totalCards / c);
        const cardW = (W - GAP * (c - 1)) / c;
        const cardH = cardW * CARD_RATIO;
        const totalH = cardH * rows + GAP * (rows - 1);
        if (totalH <= H) {
          bestCols  = c;
          bestCardH = cardH;
          break;
        }
      }

      grid.style.setProperty('--memo-cols',  bestCols);
      grid.style.setProperty('--memo-row-h', Math.floor(bestCardH) + 'px');
    }

    requestAnimationFrame(() => computeLayout());
    window.addEventListener('resize', computeLayout);

    // Cleanup on restart
    const _removeResize = () => window.removeEventListener('resize', computeLayout);
    grid.addEventListener('DOMNodeRemoved', _removeResize, { once: true });

    // Each card appears twice; shuffle all 2N cards
    const deck = shuffle([
      ...config.cards.map((c, i) => ({ ...c, _pairId: i })),
      ...config.cards.map((c, i) => ({ ...c, _pairId: i })),
    ]);

    deck.forEach((card, i) => {
      grid.appendChild(buildCard(card, i));
    });

    function buildCard(card, index) {
      const wrapper = document.createElement('div');
      wrapper.className = 'card-wrapper';
      wrapper.style.animationDelay = (index * 45) + 'ms';

      const inner = document.createElement('div');
      inner.className = 'card-inner';
      inner.dataset.pairId = card._pairId;

      const back = document.createElement('div');
      back.className = 'card-face card-back';
      back.innerHTML = `
        <div class="card-back-dots"></div>
        <div class="card-back-shine"></div>
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

      wrapper.addEventListener('click', () => handleClick(inner));
      return wrapper;
    }

    function playSound(key) {
      const url = theme && theme[key];
      if (!url) return;
      try {
        const a = (window._preloadedAudio && window._preloadedAudio[url])
          ? window._preloadedAudio[url]
          : new Audio(url);
        a.currentTime = 0;
        a.play().catch(() => {});
      } catch (_) {}
    }

    function handleClick(inner) {
      if (!gameActive || locked) return;
      if (inner.classList.contains('matched')) return;
      if (inner.classList.contains('flipped')) return;
      if (!timerStarted) {
        timerStarted  = true;
        startTime     = Date.now();
        timerInterval = setInterval(() => {
          timerEl.textContent = ((Date.now() - startTime) / 1000).toFixed(1);
        }, 100);
      }

      inner.classList.add('flipped');
      flippedCards.push(inner);

      if (flippedCards.length < 2){        
        playSound('flipSound');
        return;
      }

      // Two cards face-up — evaluate match
      locked = true;
      const [a, b] = flippedCards;
      flippedCards  = [];

      if (a.dataset.pairId === b.dataset.pairId) {
        // Matched — keep flipped, mark as matched
        a.classList.add('matched');
        b.classList.add('matched');
        // flipped class stays so the front face remains visible
        locked = false;
        playSound('matchSound');

        matchedPairs++;
        openedEl.textContent = matchedPairs;

        if (matchedPairs === totalPairs) {
          clearInterval(timerInterval);
          gameActive = false;
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          timerEl.textContent = elapsed;
          setTimeout(() => onFinish(elapsed), 480);
        }
      } else {
        // No match — flip both back after a short pause
        playSound('mismatchSound');
        setTimeout(() => {
          a.classList.remove('flipped');
          b.classList.remove('flipped');
          locked = false;
        }, 950);
      }
    }
  }

  return { init };
})();
