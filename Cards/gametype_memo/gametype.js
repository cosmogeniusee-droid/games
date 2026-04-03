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
    const CARD_RATIO = 300 / 200; // height / width
    const GAP = 10;

    function computeLayout() {
      // Use the grid's own client dimensions — it is already flex-constrained
      // to the available space (flex:1 1 0; min-height:0; overflow:hidden).
      // Subtract the grid's own padding (12px×2 = 24 horizontal, 10px×2 = 20 vertical).
      const W = (grid.clientWidth  || window.innerWidth)  - 24;
      const H = (grid.clientHeight || window.innerHeight) - 20;

      let bestCols = totalCards, bestCardH = 1;

      for (let c = 1; c <= totalCards; c++) {
        const rows    = Math.ceil(totalCards / c);
        // Card size limited by available width
        const cardH_w = ((W - GAP * (c - 1)) / c) * CARD_RATIO;
        // Card size limited by available height
        const cardH_h = (H - GAP * (rows - 1)) / rows;
        // Use whichever is more restrictive
        const cardH   = Math.min(cardH_w, cardH_h);

        if (cardH > bestCardH) {
          bestCardH = cardH;
          bestCols  = c;
        }
      }

      const bestCardW = Math.floor(bestCardH / CARD_RATIO);
      grid.style.setProperty('--memo-cols',   bestCols);
      grid.style.setProperty('--memo-card-w', bestCardW + 'px');
      grid.style.setProperty('--memo-row-h',  Math.floor(bestCardH) + 'px');
    }

    requestAnimationFrame(() => computeLayout());
    window.addEventListener('resize', computeLayout);

    // Cleanup on restart
    const _removeResize = () => window.removeEventListener('resize', computeLayout);
    grid.addEventListener('DOMNodeRemoved', _removeResize, { once: true });

    // Each card appears twice; shuffle all 2N cards
    const deck = config.memoSplitCards
      ? shuffle([
          ...config.cards.map((c, i) => ({ ...c, _pairId: i, _variant: 'image' })),
          ...config.cards.map((c, i) => ({ ...c, _pairId: i, _variant: 'text'  })),
        ])
      : shuffle([
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

      if (card._variant === 'text') {
        // Text-only card: show just the word, centered, no image
        const wordEl = document.createElement('div');
        wordEl.className = 'card-word card-word-only'; wordEl.textContent = card.word;
        front.appendChild(wordEl);
      } else {
        // Image/emoji card (default and 'image' variant)
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

        front.appendChild(imageArea);

        if (!card._variant) {
          // Normal (non-split) mode: also show word below image
          const wordEl = document.createElement('div');
          wordEl.className = 'card-word'; wordEl.textContent = card.word;
          front.appendChild(wordEl);
        }
      }
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
        locked = false;
        playSound('matchSound');

        matchedPairs++;
        openedEl.textContent = matchedPairs;

        if (config.memoDisappear) {
          const wa = a.closest('.card-wrapper');
          const wb = b.closest('.card-wrapper');
          if (wa) wa.classList.add('vanish');
          if (wb) wb.classList.add('vanish');
          setTimeout(() => {
            // Keep wrappers in DOM so other cards don't reposition
            if (wa) { wa.classList.remove('vanish'); wa.classList.add('vanished'); }
            if (wb) { wb.classList.remove('vanish'); wb.classList.add('vanished'); }
          }, 700);
        }

        if (matchedPairs === totalPairs) {
          clearInterval(timerInterval);
          gameActive = false;
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          timerEl.textContent = elapsed;
          setTimeout(() => onFinish(elapsed), config.memoDisappear ? 800 : 480);
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
