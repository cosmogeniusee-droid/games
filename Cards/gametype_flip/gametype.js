'use strict';

/* ===========================================================
   Gametype: Открывашки (flip) — deck edition
   Cards are shown as a face-down deck.
   Player clicks the top card; it flies to the discard pile
   face-up. When the deck is empty, click the slot to finish.
   =========================================================== */

window.CARDS_GAME_ENGINE = window.CARDS_GAME_ENGINE || {};

window.CARDS_GAME_ENGINE['flip'] = (function () {

  function init(opts) {
    const { config, theme, grid, overlay,
            openedEl, totalEl, progressLabelEl,
            shuffle } = opts;

    const cards       = shuffle(config.cards);
    const totalCards  = cards.length;
    let deckIdx       = 0;
    let animating     = false;
    let gameActive    = true;

    document.body.className = '';

    if (progressLabelEl) progressLabelEl.textContent = 'Открыто';
    totalEl.textContent  = totalCards;
    openedEl.textContent = '0';
    document.querySelector('.timer-display').style.display = 'none';
    overlay.innerHTML    = '';
    grid.className       = 'deck-layout';
    grid.innerHTML       = '';

    if (totalCards === 0) {
      grid.innerHTML = '<div class="empty-state">Карточки не добавлены.<br>Откройте конфигуратор и создайте карточки.</div>';
      return;
    }

    // ── DOM ───────────────────────────────────────────────────────────────────
    const deckPile      = document.createElement('div');
    deckPile.className  = 'dl-pile';
    const discardPile     = document.createElement('div');
    discardPile.className = 'dl-pile';

    const deckCountEl    = document.createElement('div');
    deckCountEl.className = 'dl-count';
    const discardCountEl    = document.createElement('div');
    discardCountEl.className = 'dl-count';

    grid.appendChild(makePileWrap('Колода',    deckPile,    deckCountEl));
    grid.appendChild(makePileWrap('Открытые',  discardPile, discardCountEl));


    function computeLayout() {
      // Fill available vertical space, maintain aspect ratio 4:3 (h:w)
      const headerH = document.querySelector('.game-header')?.offsetHeight || 0;
      const controlsH = document.querySelector('.game-controls')?.offsetHeight || 0;
      const availH = window.innerHeight - headerH - controlsH - 80;
      const availW = Math.floor((grid.clientWidth || window.innerWidth) / 2) - 60;
      // 2 piles side by side, gap 80px, some margin
      const CARD_RATIO = 420 / 320;
      let cardW = Math.min(420, availW);
      let cardH = cardW * CARD_RATIO;
      if (cardH > availH) {
        cardH = availH;
        cardW = cardH / CARD_RATIO;
      }
      grid.style.setProperty('--flip-card-w', Math.floor(cardW) + 'px');
      grid.style.setProperty('--flip-card-h', Math.floor(cardH) + 'px');
    }

    requestAnimationFrame(() => computeLayout());
    window.addEventListener('resize', computeLayout);
    // Cleanup on restart
    const _removeResize = () => window.removeEventListener('resize', computeLayout);
    grid.addEventListener('DOMNodeRemoved', _removeResize, { once: true });

    renderDeck();
    renderDiscard(false);

    function makePileWrap(label, pileEl, countEl) {
      const wrap = document.createElement('div');
      wrap.className = 'dl-pile-wrap';
      const lbl = document.createElement('div');
      lbl.className = 'dl-label';
      lbl.textContent = label;
      wrap.appendChild(lbl);
      wrap.appendChild(pileEl);
      wrap.appendChild(countEl);
      return wrap;
    }

    // ── Deck rendering ────────────────────────────────────────────────────────
    function renderDeck() {
      deckPile.innerHTML = '';
      const remaining = totalCards - deckIdx;
      deckCountEl.textContent = remaining + ' ' + plural(remaining);

      if (remaining === 0) {
        const empty = document.createElement('div');
        empty.className = 'dl-slot dl-empty';
        empty.innerHTML = '<span>✓</span><small>Готово!</small>';
        empty.addEventListener('click', finishGame);
        deckPile.appendChild(empty);
        return;
      }

      // Depth layers
      const layerCount = Math.min(3, remaining - 1);
      for (let i = layerCount; i >= 1; i--) {
        const layer = document.createElement('div');
        layer.className = 'dl-card dl-back dl-depth-layer';
        layer.style.transform = `translate(${i * 2}px, ${i * 3}px)`;
        deckPile.appendChild(layer);
      }

      // Top card
      const top = makeBackCard();
      top.classList.add('dl-top');
      top.addEventListener('click', () => handleFlip(top));
      deckPile.appendChild(top);
    }

    // ── Discard rendering ─────────────────────────────────────────────────────
    function renderDiscard(animate) {
      discardPile.innerHTML = '';
      const discarded = deckIdx;
      discardCountEl.textContent = discarded + ' ' + plural(discarded);

      if (discarded === 0) {
        const slot = document.createElement('div');
        slot.className = 'dl-slot';
        discardPile.appendChild(slot);
        return;
      }

      // Depth layers
      const layerCount = Math.min(3, discarded - 1);
      for (let i = layerCount; i >= 1; i--) {
        const layer = document.createElement('div');
        layer.className = 'dl-card dl-back dl-depth-layer';
        layer.style.opacity = '0.5';
        layer.style.transform = `translate(${-i * 2}px, ${i * 3}px)`;
        discardPile.appendChild(layer);
      }

      // Top face-up card
      const top = makeFrontCard(cards[deckIdx - 1]);
      if (animate) top.classList.add('dl-flip-in');
      discardPile.appendChild(top);
    }

    // ── Card factories ────────────────────────────────────────────────────────
    function makeBackCard() {
      const el = document.createElement('div');
      el.className = 'dl-card dl-back';
      el.innerHTML = '<div class="card-back-dots"></div><div class="card-back-shine"></div>';
      return el;
    }

    function makeFrontCard(card) {
      const el = document.createElement('div');
      el.className = 'dl-card dl-front';
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
      el.appendChild(imageArea);
      el.appendChild(wordEl);
      return el;
    }

    // ── Flip animation ────────────────────────────────────────────────────────
    function playFlipSound() {
      const url = theme && theme.flipSound;
      if (!url) return;
      try {
        const a = (window._preloadedAudio && window._preloadedAudio[url])
          ? window._preloadedAudio[url]
          : new Audio(url);
        a.currentTime = 0;
        a.play().catch(() => {});
      } catch (_) {}
    }

    const FLIP_CONFIGS = {
      flip:   { tr: 'transform 0.50s cubic-bezier(0.4, 0, 0.2, 1)',           tx: 'rotateY(180deg)' },
      bounce: { tr: 'transform 0.60s cubic-bezier(0.34, 1.56, 0.64, 1)',      tx: 'rotateY(180deg)' },
      spin:   { tr: 'transform 0.85s cubic-bezier(0.25, 0.46, 0.45, 0.94)',   tx: 'rotateY(540deg)' },
      fade:   null,  // handled separately via opacity
    };

    function handleFlip(topEl) {
      if (!gameActive || animating) return;
      animating = true;
      playFlipSound();

      const fromRect = deckPile.getBoundingClientRect();
      const toRect   = discardPile.getBoundingClientRect();
      const dx = toRect.left - fromRect.left;
      const dy = toRect.top  - fromRect.top;

      const card      = cards[deckIdx];
      const flipStyle = (theme && theme.flipAnim) || 'flip';
      const flipCfg   = FLIP_CONFIGS[flipStyle] || FLIP_CONFIGS.flip;

      // ── Build flying card ──
      const flyCard = document.createElement('div');
      flyCard.className = 'dl-flying';
      flyCard.style.left   = fromRect.left   + 'px';
      flyCard.style.top    = fromRect.top    + 'px';
      flyCard.style.width  = fromRect.width  + 'px';
      flyCard.style.height = fromRect.height + 'px';

      const flyInner = document.createElement('div');
      flyInner.className = 'dl-flying-inner';
      if (flipStyle === 'fade') flyInner.classList.add('fade-mode');

      const flyBack = document.createElement('div');
      flyBack.className = 'dl-flying-face dl-back';
      flyBack.innerHTML = '<div class="card-back-dots"></div><div class="card-back-shine"></div>';

      const flyFront = document.createElement('div');
      flyFront.className = 'dl-flying-face dl-front';
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
      flyFront.appendChild(imageArea);
      flyFront.appendChild(wordEl);

      flyInner.appendChild(flyBack);
      flyInner.appendChild(flyFront);
      flyCard.appendChild(flyInner);
      document.body.appendChild(flyCard);

      topEl.style.opacity = '0';

      // ── Phase 1: flip / fade ──
      function startPhase2() {
        // slide to discard pile
        flyCard.style.transition = 'transform 0.40s cubic-bezier(0.4, 0, 0.2, 1)';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          flyCard.style.transform = `translate(${dx}px, ${dy}px)`;
        }));
        // Add cleanup listener via setTimeout(0) so the still-bubbling
        // phase-1 transitionend from flyInner doesn't fire it immediately.
        setTimeout(() => {
          flyCard.addEventListener('transitionend', () => {
            flyCard.remove();
            deckIdx++;
            openedEl.textContent = deckIdx;
            renderDeck();
            renderDiscard(false);
            animating = false;
          }, { once: true });
        }, 0);
      }

      if (flipStyle === 'fade') {
        // CSS class handles opacity transitions (fade-mode class already applied)
        requestAnimationFrame(() => requestAnimationFrame(() => {
          flyInner.classList.add('dl-flying-flip');
        }));
        // flyFront opacity goes 0→1; listen on it for the end
        flyFront.addEventListener('transitionend', startPhase2, { once: true });
      } else {
        // 3D flip via inline transition + transform
        flyInner.style.transition = flipCfg.tr;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          flyInner.style.transform = flipCfg.tx;
        }));
        flyInner.addEventListener('transitionend', startPhase2, { once: true });
      }
    }

    // ── Finish ────────────────────────────────────────────────────────────────
    function finishGame() {
      if (!gameActive) return;
      gameActive = false;
      // No timer, no finish overlay for flip mode
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    function plural(n) {
      const mod = n % 100, mod10 = n % 10;
      if (mod >= 11 && mod <= 14) return 'карт';
      if (mod10 === 1) return 'карта';
      if (mod10 >= 2 && mod10 <= 4) return 'карты';
      return 'карт';
    }
  }

  return { init };
})();