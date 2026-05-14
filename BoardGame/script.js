// ─── Constants ───────────────────────────────────────────────────────────────

const DICE_EMOJI = { 1:'⚀', 2:'⚁', 3:'⚂', 4:'⚃', 5:'⚄', 6:'⚅' };

const CELL_COLS = 5; // board columns

// ─── Game state ───────────────────────────────────────────────────────────────

const cfg = {
    cells:   20,
    diceMax: 6,
    title:   'Настольная игра',
    tasks: []
};

const state = {
    boardCells: [],  // { idx, number, type, content, gridRow, gridCol }
    player:     { position: 0, skipsLeft: 0, finished: false },
    gameActive: false,
    busy:       false
};

// ─── URL param parsing ────────────────────────────────────────────────────────

function parseParams() {
    const p = new URLSearchParams(window.location.search);

    cfg.cells   = clamp(parseInt(p.get('cells')) || 20, 6, 50);
    cfg.diceMax = 6;
    cfg.title   = p.get('title') || 'Настольная игра';

    const tasksB64 = p.get('tasks');
    if (tasksB64) {
        try {
            cfg.tasks = JSON.parse(decodeURIComponent(atob(tasksB64)));
        } catch (_) {
            cfg.tasks = [];
        }
    }
}

// ─── Board building ───────────────────────────────────────────────────────────

function buildBoard() {
    const total    = cfg.cells;
    const cols     = CELL_COLS;
    const totalRows = Math.ceil(total / cols);
    state.boardCells = [];

    for (let idx = 0; idx < total; idx++) {
        const rowNum   = Math.floor(idx / cols);          // 0 = bottom row
        const colInRow = idx % cols;
        const gridRow  = totalRows - rowNum;              // CSS grid row (1 = top)
        const gridCol  = (rowNum % 2 === 0)
            ? colInRow + 1
            : cols - colInRow;                            // snake reversal

        let type, icon, content = '';

        if (idx === 0) {
            type = 'start';  icon = '🏠'; content = 'Старт';
        } else if (idx === total - 1) {
            type = 'finish'; icon = '🏆'; content = 'Финиш';
        } else {
            const raw = (cfg.tasks[idx - 1] || '').trim();
            if (!raw) {
                type = 'empty'; icon = '⭕'; content = '';
            } else if (/^!вперед:(\d+)$/i.test(raw)) {
                const n = parseInt(raw.split(':')[1]);
                type = 'forward'; icon = '⚡'; content = `Вперёд +${n}`;
            } else if (/^!назад:(\d+)$/i.test(raw)) {
                const n = parseInt(raw.split(':')[1]);
                type = 'back'; icon = '🌀'; content = `Назад −${n}`;
            } else if (/^!пропуск$/i.test(raw)) {
                type = 'skip'; icon = '💤'; content = 'Пропуск хода';
            } else {
                type = 'task'; icon = '📋'; content = raw;
            }
        }

        state.boardCells.push({ idx, number: idx + 1, type, icon, content, gridRow, gridCol });
    }
}

// ─── Board rendering ──────────────────────────────────────────────────────────

function renderBoard() {
    const board     = document.getElementById('game-board');
    const totalRows = Math.ceil(cfg.cells / CELL_COLS);
    board.style.gridTemplateColumns = `repeat(${CELL_COLS}, 1fr)`;
    board.style.gridTemplateRows    = `repeat(${totalRows}, 1fr)`;
    board.innerHTML = '';

    state.boardCells.forEach(cell => {
        const div = document.createElement('div');
        div.id        = `cell-${cell.idx}`;
        div.className = `cell cell-${cell.type}`;
        div.style.gridRow    = cell.gridRow;
        div.style.gridColumn = cell.gridCol;
        if (cell.type === 'task') div.title = cell.content;

        div.innerHTML = `
            <div class="cell-number">${cell.number}</div>
            <div class="cell-icon">${cell.icon}</div>
            <div class="players-on-cell" id="tokens-${cell.idx}"></div>`;

        board.appendChild(div);
    });
}

// ─── Player token ─────────────────────────────────────────────────────────────

function renderToken() {
    document.querySelectorAll('.players-on-cell').forEach(el => el.innerHTML = '');
    const container = document.getElementById(`tokens-${state.player.position}`);
    if (!container) return;
    const tok = document.createElement('div');
    tok.className = 'player-token';
    tok.style.background = '#e74c3c';
    tok.textContent = '★';
    container.appendChild(tok);
}

function renderStatus() {
    const p = state.player;
    document.getElementById('player-pos').textContent = p.position + 1;
    document.getElementById('player-skip').textContent = p.skipsLeft > 0 ? ' 💤' : '';
}

// ─── Dice ─────────────────────────────────────────────────────────────────────

function showDice(val) {
    const el = document.getElementById('dice');
    el.textContent = (val >= 1 && val <= 6) ? DICE_EMOJI[val] : val;
}

async function rollDice() {
    if (state.busy || !state.gameActive) return;
    const player = state.player;

    // Handle skip
    if (player.skipsLeft > 0) {
        player.skipsLeft--;
        setMessage('Ход пропускается! 💤');
        renderStatus();
        await sleep(1400);
        setMessage('Нажмите «Бросить кубик»');
        document.getElementById('roll-btn').disabled = false;
        return;
    }

    state.busy = true;
    document.getElementById('roll-btn').disabled = true;

    // Animate dice
    const diceEl = document.getElementById('dice');
    diceEl.classList.add('rolling');
    const anim = setInterval(() => showDice(randInt(1, Math.min(cfg.diceMax, 6))), 80);
    await sleep(650);
    clearInterval(anim);
    diceEl.classList.remove('rolling');

    const result = randInt(1, cfg.diceMax);
    showDice(Math.min(result, 6));
    setMessage(`Выпало: <strong>${result}</strong>`);

    await sleep(350);
    await movePlayer(result);
}

// ─── Movement ─────────────────────────────────────────────────────────────────

async function movePlayer(steps) {
    const player = state.player;
    const maxPos = cfg.cells - 1;
    const target = Math.min(player.position + steps, maxPos);

    for (let pos = player.position + 1; pos <= target; pos++) {
        player.position = pos;
        renderToken();
        const cellEl = document.getElementById(`cell-${pos}`);
        if (cellEl) {
            cellEl.classList.add('cell-active');
            await sleep(220);
            cellEl.classList.remove('cell-active');
        } else {
            await sleep(220);
        }
    }

    await applyCell(state.boardCells[player.position]);
}

async function applyCell(cell) {
    const player = state.player;

    // ── Finish ──────────────────────────────────────────────
    if (cell.type === 'finish') {
        player.finished = true;
        renderToken();
        renderStatus();
        launchConfetti();
        state.gameActive = false;
        await showWinModal();
        setMessage('🎉 Игра окончена!');
        return;
    }

    // ── Task ────────────────────────────────────────────────
    if (cell.type === 'task') {
        await showTaskModal(cell);
    }

    // ── Forward ─────────────────────────────────────────────
    else if (cell.type === 'forward') {
        const n = parseInt(cell.content.match(/\d+/)?.[0]) || 2;
        await showSpecialModal('⚡', 'Удача!', cell.content, false);
        await movePlayer(n);
        return;
    }

    // ── Back ────────────────────────────────────────────────
    else if (cell.type === 'back') {
        const n = parseInt(cell.content.match(/\d+/)?.[0]) || 2;
        await showSpecialModal('🌀', 'Упс!', cell.content, true);
        const backPos = Math.max(0, player.position - n);
        for (let pos = player.position - 1; pos >= backPos; pos--) {
            player.position = pos;
            renderToken();
            await sleep(220);
        }
        const newCell = state.boardCells[player.position];
        if (newCell.type === 'task') await showTaskModal(newCell);
    }

    // ── Skip ────────────────────────────────────────────────
    else if (cell.type === 'skip') {
        player.skipsLeft++;
        await showSpecialModal('💤', 'Пропуск!', 'Следующий ход пропускается', true);
    }

    state.busy = false;
    renderStatus();
    document.getElementById('roll-btn').disabled = false;
    setMessage('Нажмите «Бросить кубик»');
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function showTaskModal(cell) {
    return new Promise(resolve => {
        document.getElementById('task-modal-sub').textContent  = `Клетка ${cell.number}`;
        document.getElementById('task-modal-text').textContent = cell.content;
        const modal = document.getElementById('task-modal');
        modal.classList.add('show');
        document.getElementById('task-done-btn').onclick = () => {
            modal.classList.remove('show');
            resolve();
        };
    });
}

function showSpecialModal(icon, title, text, warn) {
    return new Promise(resolve => {
        document.getElementById('special-modal-icon').textContent  = icon;
        document.getElementById('special-modal-title').textContent = title;
        document.getElementById('special-modal-text').textContent  = text;
        const btn = document.getElementById('special-ok-btn');
        btn.className = 'modal-btn' + (warn ? ' modal-btn-warn' : '');
        const modal = document.getElementById('special-modal');
        modal.classList.add('show');
        btn.onclick = () => { modal.classList.remove('show'); resolve(); };
    });
}

function showWinModal() {
    return new Promise(resolve => {
        document.getElementById('win-title').textContent = '🏆 Финиш!';
        document.getElementById('win-text').textContent  = 'Ты добрался(ась) до конца! Молодец!';
        const modal = document.getElementById('win-modal');
        modal.classList.add('show');
        document.getElementById('win-continue-btn').onclick = () => {
            modal.classList.remove('show');
            resolve();
        };
    });
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

function launchConfetti() {
    const colors = ['#e74c3c','#2980b9','#27ae60','#f39c12','#9b59b6','#1abc9c'];
    for (let i = 0; i < 70; i++) {
        const delay = i * 25;
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'confetti-piece';
            const size = 6 + Math.random() * 8;
            el.style.cssText = `
                left: ${Math.random() * 100}vw;
                top: -10px;
                width: ${size}px;
                height: ${size}px;
                background: ${colors[i % colors.length]};
                animation-duration: ${2.2 + Math.random() * 1.8}s;
            `;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 4500);
        }, delay);
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function randInt(min, max)   { return Math.floor(Math.random() * (max - min + 1)) + min; }
function sleep(ms)           { return new Promise(r => setTimeout(r, ms)); }
function setMessage(html)    { document.getElementById('game-message').innerHTML = html; }

// ─── Fullscreen ───────────────────────────────────────────────────────────────

document.getElementById('fullscreen-btn').addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
    } else {
        document.exitFullscreen?.();
    }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

document.getElementById('roll-btn').addEventListener('click', rollDice);

window.addEventListener('load', () => {
    parseParams();
    document.getElementById('game-title').textContent = '🎲 ' + cfg.title;
    document.title = cfg.title;
    buildBoard();
    renderBoard();
    renderToken();
    renderStatus();
    state.gameActive = true;
    showDice(1);
    setMessage('Игра началась! Нажмите «Бросить кубик»!');
    document.getElementById('roll-btn').disabled = false;
});
