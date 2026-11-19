(function () {
  'use strict';

  // логические координаты 1280x1600 (4:5), физический размер холста 576x720: удобно для iPhone и мало весит
  var W = 1280, H = 1600, FPS = 24, BITRATE = 350000;
  var cv = document.getElementById('cv');
  var ctx = cv.getContext('2d');
  var elText = document.getElementById('text');
  var elSpeed = document.getElementById('speed');
  var btn = document.getElementById('gen');
  var elStatus = document.getElementById('status');
  var elResult = document.getElementById('result');
  var elPreview = document.getElementById('preview');
  var elDl = document.getElementById('dl');
  var elSize = document.getElementById('size');
  var elShare = document.getElementById('share');
  var wakeLock = null;

  // ---------- Раскладка клавиатуры ----------
  // [латиница, кириллица, ширина в юнитах, подпись для служебных]
  var ROWS = [
    [['`','ё',1],['1','',1],['2','',1],['3','',1],['4','',1],['5','',1],['6','',1],['7','',1],['8','',1],['9','',1],['0','',1],['-','',1],['=','',1],['','',2,'⌫']],
    [['','',1.5,'Tab'],['q','й',1],['w','ц',1],['e','у',1],['r','к',1],['t','е',1],['y','н',1],['u','г',1],['i','ш',1],['o','щ',1],['p','з',1],['[','х',1],[']','ъ',1],['\\','',1.5]],
    [['','',1.75,'Caps'],['a','ф',1],['s','ы',1],['d','в',1],['f','а',1],['g','п',1],['h','р',1],['j','о',1],['k','л',1],['l','д',1],[';','ж',1],["'",'э',1],['','',2.25,'Enter']],
    [['','',2.25,'Shift'],['z','я',1],['x','ч',1],['c','с',1],['v','м',1],['b','и',1],['n','т',1],['m','ь',1],[',','б',1],['.','ю',1],['/','',1],['','',2.75,'Shift']],
    [['','',6,'']]
  ];
  var KB_X = 60, KB_Y = H - 330, KB_W = 1160, ROW_H = 52, GAP = 8;
  var U = KB_W / 15;
  var keys = [], keyMap = {}, SHIFT_L = -1, SHIFT_R = -1, ENTER = -1, SPACE = -1, BKSP = -1;

  (function buildKeys() {
    ROWS.forEach(function (row, r) {
      var x = KB_X + (r === 4 ? 4.5 * U : 0);
      var y = KB_Y + r * (ROW_H + GAP);
      row.forEach(function (d) {
        var k = { lat: d[0], cyr: d[1], label: d[3] || '', x: x + 2, y: y, w: d[2] * U - 4, h: ROW_H, press: 0 };
        var i = keys.push(k) - 1;
        if (d[0]) keyMap[d[0]] = i;
        if (d[1]) keyMap[d[1]] = i;
        if (d[3] === 'Shift') { if (SHIFT_L < 0) SHIFT_L = i; else SHIFT_R = i; }
        if (d[3] === 'Enter') ENTER = i;
        if (d[3] === '⌫') BKSP = i;
        if (r === 4) SPACE = i;
        x += d[2] * U;
      });
    });
  })();

  // ---------- Состояние ----------
  var out = [];      // текст, видимый на экране
  var script = [];   // события: {t:'c',ch} | {t:'w',ms} | {t:'d'}
  var pos = 0;

  // "(ТЕКСТ, 2000)": напечатать ТЕКСТ, подождать 2000 мс, стереть ТЕКСТ, продолжить
  function parseScript(src) {
    var ev = [], re = /\{([^{}]*)\}/g, last = 0, m, a;
    function plain(s) { Array.from(s).forEach(function (ch) { ev.push({ t: 'c', ch: ch }); }); }
    while ((m = re.exec(src)) !== null) {
      var body = m[1], ok = true;
      if ((a = /^\s*wait\s*:\s*(\d+)\s*$/i.exec(body))) {            // {wait:1500}
        plain(src.slice(last, m.index));
        ev.push({ t: 'w', ms: parseInt(a[1], 10) });
      } else if ((a = /^\s*back\s*:\s*(\d+)\s*$/i.exec(body))) {     // {back:5}
        plain(src.slice(last, m.index));
        for (var i = 0, n = parseInt(a[1], 10); i < n; i++) ev.push({ t: 'd' });
      } else if ((a = /^([\s\S]*)\|\s*(\d+)\s*$/.exec(body))) {      // {текст|2000}
        plain(src.slice(last, m.index));
        var part = Array.from(a[1]);
        part.forEach(function (ch) { ev.push({ t: 'c', ch: ch }); });
        ev.push({ t: 'w', ms: parseInt(a[2], 10) });
        part.forEach(function () { ev.push({ t: 'd' }); });
      } else { ok = false; }                                          // обычные фигурные скобки
      if (ok) last = m.index + m[0].length;
    }
    plain(src.slice(last));
    return ev;
  }
  var running = false;
  var idleText = 'Введите текст и нажмите «Сгенерировать видео»';

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- Текст ----------
  var FONT = '58px Consolas, "Courier New", monospace';
  var LINE_H = 80, TX = 90, TY = 80, TW = 1100, TH = KB_Y - 70 - 100;

  function layoutLines(arr) {
    ctx.font = FONT;
    var lines = [[]], w = 0;
    arr.forEach(function (ch) {
      if (ch === '\n') { lines.push([]); w = 0; return; }
      var cw = ctx.measureText(ch).width;
      if (w + cw > TW) { lines.push([]); w = 0; }
      lines[lines.length - 1].push(ch);
      w += cw;
    });
    return lines.map(function (l) { return l.join(''); });
  }

  function drawText(t, showCursor) {
    ctx.fillStyle = '#ffffff';
    rr(KB_X, 30, KB_W, KB_Y - 70, 18); ctx.fill();
    ctx.font = FONT;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    var lines = layoutLines(out);
    var maxLines = Math.floor(TH / LINE_H);
    var start = Math.max(0, lines.length - maxLines);
    ctx.fillStyle = '#111827';
    var lastX = TX, lastY = TY;
    for (var i = start; i < lines.length; i++) {
      var y = TY + (i - start) * LINE_H;
      ctx.fillText(lines[i], TX, y);
      lastX = TX + ctx.measureText(lines[i]).width;
      lastY = y;
    }
    if (showCursor && Math.floor(t / 500) % 2 === 0) {
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(lastX + 3, lastY + 4, 6, LINE_H - 16);
    }
  }

  // ---------- Клавиатура ----------
  function drawKeyboard(t) {
    ctx.fillStyle = '#d7dce4';
    rr(KB_X - 14, KB_Y - 14, KB_W + 28, 5 * (ROW_H + GAP) + 12, 18); ctx.fill();
    keys.forEach(function (k) {
      var p = Math.max(0, (k.press - t) / 160); // 1 -> 0 при отпускании
      p = Math.min(1, p);
      var dy = 4 * p;
      ctx.fillStyle = '#9aa3b2';
      rr(k.x, k.y + 4, k.w, k.h, 8); ctx.fill();            // тень/основание
      ctx.fillStyle = p > 0 ? mix('#ffffff', '#60a5fa', p) : '#ffffff';
      rr(k.x, k.y + dy, k.w, k.h, 8); ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = p > 0.3 ? '#ffffff' : '#1f2937';
      if (k.label) {
        ctx.font = '16px system-ui, Arial, sans-serif';
        ctx.fillText(k.label, k.x + k.w / 2, k.y + dy + k.h / 2);
      } else if (k.cyr) {
        ctx.font = '600 24px system-ui, Arial, sans-serif';
        ctx.fillText(k.cyr, k.x + k.w / 2 - 6, k.y + dy + k.h / 2 + 2);
        ctx.font = '13px system-ui, Arial, sans-serif';
        ctx.fillStyle = p > 0.3 ? '#dbeafe' : '#6b7280';
        ctx.fillText(k.lat.toUpperCase(), k.x + k.w - 12, k.y + dy + 14);
      } else if (k.lat) {
        ctx.font = '600 22px system-ui, Arial, sans-serif';
        ctx.fillText(k.lat.toUpperCase(), k.x + k.w / 2, k.y + dy + k.h / 2 + 1);
      }
    });
  }

  function mix(a, b, p) {
    function c(h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
    var x = c(a), y = c(b);
    return 'rgb(' + x.map(function (v, i) { return Math.round(v + (y[i] - v) * p); }).join(',') + ')';
  }

  function render(t) {
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, W, H);
    drawText(t, true);
    drawKeyboard(t);
    drawHands(t);
    if (!running && out.length === 0 && script.length === 0) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '40px system-ui, Arial, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(idleText, TX, TY);
    }
  }

  // ---------- Руки ----------
  var SKIN = '#f0c3a0', SKIN_OUT = '#b9805a', SKIN_SHADE = '#d9a47f', NAIL = '#fbe3d2';
  var LAG = 110;   // за это время рука доходит до клавиши
  var FNAMES = ['pinky', 'ring', 'middle', 'index', 'thumb'];
  var FWIDTH = { pinky: 40, ring: 46, middle: 48, index: 48, thumb: 52 };
  var KNUCKLE_DY = { pinky: 16, ring: -2, middle: -9, index: -3 };
  var hands = [];
  var pending = [];
  var SHIFTED = { '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8',
                  '(': '9', ')': '0', '_': '-', '+': '=', '?': '/', ':': ';', '"': "'", '<': ',', '>': '.', '{': '[', '}': ']', '|': '\\', '~': '`' };

  function homeOf(ch) {
    var k = keys[keyMap[ch]];
    return { x: k.x + k.w / 2, y: k.y + k.h / 2 + 12 };
  }

  function makeHand(side, homeChars) {
    var h = { side: side, inward: side === 'L' ? 1 : -1, fingers: [], sx: 0, sy: 0, tsx: 0, tsy: 0, t: 0, lastUse: 0 };
    homeChars.forEach(function (c, i) {
      var p = homeOf(c);
      h.fingers.push({ n: FNAMES[i], kx: p.x, hx: p.x, hy: p.y, ex: 0, ey: 0, tex: 0, tey: 0, tap: -1e9 });
    });
    var sp = keys[SPACE];
    var tx = side === 'L' ? sp.x + 0.6 * U : sp.x + sp.w - 0.6 * U;
    h.fingers.push({ n: 'thumb', kx: tx, hx: tx, hy: sp.y + 16, ex: 0, ey: 0, tex: 0, tey: 0, tap: -1e9 });
    h.cx = (h.fingers[0].hx + h.fingers[3].hx) / 2;
    h.cy = h.fingers[0].hy + 128;
    // пальцы лежат плотно: сжимаем их относительно кистей, а к клавишам тянемся выдвижением
    for (var i = 0; i < 4; i++) h.fingers[i].hx = h.cx + (h.fingers[i].kx - h.cx) * 0.80;
    return h;
  }

  function resetHands() {
    pending = [];
    hands = [makeHand('L', ['a', 's', 'd', 'f']), makeHand('R', [';', 'l', 'k', 'j'])];
  }
  resetHands();

  // какая рука и какой палец нажимает клавишу
  function fingerFor(ki) {
    if (ki === SPACE) return { h: hands[1], fi: 4 };
    if (ki === ENTER || ki === BKSP || ki === SHIFT_R) return { h: hands[1], fi: 0 };
    if (ki === SHIFT_L) return { h: hands[0], fi: 0 };
    var k = keys[ki], x = k.x + k.w / 2;
    var gx = homeOf('g').x, hx = homeOf('h').x;
    var h, f, mid;
    if (x <= (gx + hx) / 2 + 0.5) {
      h = hands[0]; f = h.fingers;
      mid = function (a, b) { return (f[a].kx + f[b].kx) / 2; };
      return { h: h, fi: x < mid(0, 1) ? 0 : x < mid(1, 2) ? 1 : x < mid(2, 3) ? 2 : 3 };
    }
    h = hands[1]; f = h.fingers;
    mid = function (a, b) { return (f[a].kx + f[b].kx) / 2; };
    return { h: h, fi: x < mid(3, 2) ? 3 : x < mid(2, 1) ? 2 : x < mid(1, 0) ? 1 : 0 };
  }

  // палец едет к клавише, нажатие происходит через delay мс
  function plan(ki, now, delay, hold, fn, forced) {
    var ff = forced || fingerFor(ki);
    var h = ff.h, f = h.fingers[ff.fi], k = keys[ki];
    var dx = k.x + k.w / 2 - f.hx, dy = k.y + k.h / 2 + 4 - f.hy;
    h.tsx = dx * 0.85; h.tsy = dy * 0.85;
    h.fingers.forEach(function (o) { o.tex = 0; o.tey = 0; });
    f.tex = dx - h.tsx; f.tey = dy - h.tsy;
    h.lastUse = now + delay;
    pending.push({ due: now + delay, f: f, ki: ki, hold: hold, fn: fn });
  }

  function planChar(ch, now) {
    var low = ch.toLowerCase(), idx, shift = false;
    if (ch === '\n') idx = ENTER;
    else if (ch === ' ') idx = SPACE;
    else if (keyMap[low] !== undefined) { idx = keyMap[low]; shift = low !== ch; }
    else if (SHIFTED[ch] !== undefined) { idx = keyMap[SHIFTED[ch]]; shift = true; }
    var show = function () { out.push(ch); };
    if (idx === undefined) { pending.push({ due: now + LAG, f: null, ki: -1, hold: 0, fn: show }); return; }
    var ff = fingerFor(idx);
    if (shift) {
      // Shift зажимает палец противоположной руки
      var left = ff.h === hands[0];
      plan(left ? SHIFT_R : SHIFT_L, now, LAG - 30, 320, null, { h: left ? hands[1] : hands[0], fi: 0 });
    }
    plan(idx, now, LAG, 170, show, ff);
  }

  function planBackspace(now) {
    plan(BKSP, now, LAG, 170, function () { out.pop(); });
  }

  function runPending(now) {
    for (var i = 0; i < pending.length;) {
      var p = pending[i];
      if (p.due <= now) {
        if (p.ki >= 0) keys[p.ki].press = now + p.hold;
        if (p.f) p.f.tap = now;
        if (p.fn) p.fn();
        pending.splice(i, 1);
      } else i++;
    }
  }

  function tipOf(h, f, t) {
    var dip = Math.sin(Math.PI * Math.min(1, (t - f.tap) / 170)) * 8;
    return { x: h.sx + f.hx + f.ex, y: h.sy + f.hy + f.ey + dip };
  }

  // точки изогнутого пальца от основания к кончику
  function fingerPts(K, tip, bend) {
    var mx = (K.x + tip.x) / 2, my = (K.y + tip.y) / 2;
    var vx = tip.x - K.x, vy = tip.y - K.y, len = Math.hypot(vx, vy) || 1;
    var cx = mx + (-vy / len) * bend, cy = my + (vx / len) * bend;
    var pts = [];
    for (var i = 0; i <= 14; i++) {
      var s = i / 14, a = (1 - s) * (1 - s), b = 2 * s * (1 - s), c = s * s;
      pts.push({ x: a * K.x + b * cx + c * tip.x, y: a * K.y + b * cy + c * tip.y, s: s });
    }
    return pts;
  }

  // палец, сужающийся к кончику
  function taper(pts, r0, r1, color, grow) {
    ctx.fillStyle = color;
    pts.forEach(function (p) {
      var r = r0 + (r1 - r0) * p.s + grow;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    });
  }

  function palmPath(px, py, inward) {
    var top = py - 52, hw = 100, ww = 58;
    var tb = inward * 14;   // сторона большого пальца чуть шире
    ctx.beginPath();
    ctx.moveTo(px - hw, top + 12);
    ctx.quadraticCurveTo(px, top - 18, px + hw, top + 12);
    ctx.bezierCurveTo(px + hw + 10 + (inward < 0 ? 14 : 0), py + 20, px + ww + 14, py + 60, px + ww, py + 96);
    ctx.lineTo(px - ww, py + 96);
    ctx.bezierCurveTo(px - ww - 14, py + 60, px - hw - 10 - (inward > 0 ? 14 : 0), py + 20, px - hw, top + 12);
    ctx.closePath();
  }

  // предплечье: запястье уже ладони, дальше расширяется к локтю
  function armPath(px, py, lean, g) {
    function cx(y) { return px + lean * (y - (py + 80)) / 300; }
    var ya = py + 70, yb = py + 125, yc = py + 215, yd = H + 260;
    var wa = 58 + g, wb = 44 + g, wc = 58 + g, wd = 68 + g;
    ctx.beginPath();
    ctx.moveTo(cx(ya) - wa, ya);
    ctx.bezierCurveTo(cx(ya) - wa, ya + 30, cx(yb) - wb, yb - 25, cx(yb) - wb, yb);
    ctx.bezierCurveTo(cx(yb) - wb, yb + 40, cx(yc) - wc, yc - 45, cx(yc) - wc, yc);
    ctx.lineTo(cx(yd) - wd, yd);
    ctx.lineTo(cx(yd) + wd, yd);
    ctx.lineTo(cx(yc) + wc, yc);
    ctx.bezierCurveTo(cx(yc) + wc, yc - 45, cx(yb) + wb, yb + 40, cx(yb) + wb, yb);
    ctx.bezierCurveTo(cx(yb) + wb, yb - 25, cx(ya) + wa, ya + 30, cx(ya) + wa, ya);
    ctx.closePath();
  }

  function drawHand(h, t) {
    var px = h.cx + h.sx, py = h.cy + h.sy;
    var order = [0, 1, 2, 3];
    var active = -1, best = 0;
    h.fingers.forEach(function (f, i) {
      var d = Math.abs(f.ex) + Math.abs(f.ey);
      if (d > best + 1) { best = d; active = i; }
    });
    if (active >= 0 && active < 4) { order.splice(order.indexOf(active), 1); order.push(active); }

    var geo = h.fingers.map(function (f) {
      var tip = tipOf(h, f, t), K, r0, r1, bend;
      if (f.n === 'thumb') {
        K = { x: px + h.inward * 70, y: py + 40 }; r0 = 25; r1 = 20; bend = -h.inward * 6;
        // в покое большой палец лежит у ладони, к пробелу тянется только при нажатии
        var wgt = Math.min(1, (Math.abs(f.ex) + Math.abs(f.ey)) / 30);
        var restTip = { x: px + h.inward * 104, y: py - 6 };
        tip = { x: restTip.x + (tip.x - restTip.x) * wgt, y: restTip.y + (tip.y - restTip.y) * wgt };
      } else {
        K = { x: px + (f.hx - h.cx) * 0.88, y: py - 40 + KNUCKLE_DY[f.n] };
        r0 = FWIDTH[f.n] / 2; r1 = r0 * 0.84;
        bend = (f.hx - h.cx) * 0.05;
      }
      return { pts: fingerPts(K, tip, bend), K: K, tip: tip, r0: r0, r1: r1, n: f.n };
    });
    var drawOrder = order.concat([4]);   // большой палец сверху

    ctx.save();
    ctx.globalAlpha = 0.97;

    // --- предплечье и тень ---
    var lean = -h.inward * 70;   // предплечье уходит вниз и к краю кадра
    ctx.shadowColor = 'rgba(0,0,0,.32)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
    ctx.fillStyle = SKIN_OUT;
    armPath(px, py, lean, 2); ctx.fill();
    palmPath(px, py, h.inward); ctx.fill();
    drawOrder.forEach(function (i) { var g = geo[i]; taper(g.pts, g.r0, g.r1, SKIN_OUT, 2.5); });
    ctx.shadowColor = 'transparent';

    // --- заливка кожей ---
    var ag = ctx.createLinearGradient(px - 60, 0, px + 60, 0);
    ag.addColorStop(0, SKIN_SHADE); ag.addColorStop(0.5, SKIN); ag.addColorStop(1, SKIN_SHADE);
    ctx.fillStyle = ag;
    armPath(px, py, lean, 0); ctx.fill();
    // рукав с манжетой
    var sy = py + 205;
    function ax(y) { return px + lean * (y - (py + 80)) / 300; }
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(ax(sy) - 66, sy);
    ctx.quadraticCurveTo(ax(sy), sy + 10, ax(sy) + 66, sy);
    ctx.lineTo(ax(H + 260) + 84, H + 260); ctx.lineTo(ax(H + 260) - 84, H + 260); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(ax(sy) - 62, sy + 4); ctx.quadraticCurveTo(ax(sy), sy + 14, ax(sy) + 62, sy + 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax(sy) - 20, sy + 20); ctx.lineTo(ax(sy + 120) - 26, sy + 120); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax(sy) + 24, sy + 18); ctx.lineTo(ax(sy + 120) + 30, sy + 120); ctx.stroke();
    var pg = ctx.createLinearGradient(0, py - 60, 0, py + 90);
    pg.addColorStop(0, SKIN); pg.addColorStop(1, SKIN_SHADE);
    ctx.fillStyle = pg;
    palmPath(px, py, h.inward); ctx.fill();
    drawOrder.forEach(function (i) { var g = geo[i]; taper(g.pts, g.r0, g.r1, SKIN, 0); });

    // --- детали ---
    drawOrder.forEach(function (i) {
      var g = geo[i], pts = g.pts;
      // блик вдоль пальца
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = g.r0 * 0.5; ctx.lineCap = 'round';
      ctx.beginPath();
      pts.forEach(function (p, k) {
        if (k < 2 || k > 11) return;
        if (k === 2) ctx.moveTo(p.x - g.r0 * 0.25, p.y); else ctx.lineTo(p.x - g.r0 * 0.25, p.y);
      });
      ctx.stroke();
      // складки суставов
      ctx.strokeStyle = 'rgba(140,90,60,.38)'; ctx.lineWidth = 1.4;
      [5, 9].forEach(function (k) {
        var p = pts[k], q = pts[k + 1], dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
        var nx = -dy / l, ny = dx / l, w = (g.r0 + (g.r1 - g.r0) * p.s) * 0.55;
        ctx.beginPath(); ctx.moveTo(p.x - nx * w, p.y - ny * w); ctx.lineTo(p.x + nx * w, p.y + ny * w); ctx.stroke();
      });
      // ноготь
      var a = pts[13], b = pts[14], ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
      ctx.fillStyle = NAIL; ctx.strokeStyle = 'rgba(140,90,60,.5)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(b.x - (b.x - a.x) * 1.6, b.y - (b.y - a.y) * 1.6, g.r1 * 0.62, g.r1 * 0.78, ang, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    });
    // тыльная сторона кисти: сухожилия и блики на костяшках
    ctx.lineCap = 'round';
    for (var i = 0; i < 4; i++) {
      var g = geo[i];
      ctx.strokeStyle = 'rgba(140,90,60,.20)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(g.K.x, g.K.y + 16);
      ctx.quadraticCurveTo(g.K.x * 0.7 + px * 0.3, py + 20, px + (g.K.x - px) * 0.35, py + 70);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath(); ctx.ellipse(g.K.x, g.K.y + 6, g.r0 * 0.55, g.r0 * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawHands(t) {
    hands.forEach(function (h) {
      var dt = h.t ? Math.min(60, t - h.t) : 0;
      h.t = t;
      if (t - h.lastUse > 700) {
        h.tsx = 0; h.tsy = 0;
        h.fingers.forEach(function (f) { f.tex = 0; f.tey = 0; });
      }
      var ks = 1 - Math.exp(-dt / 50), kf = 1 - Math.exp(-dt / 35);
      h.sx += (h.tsx - h.sx) * ks; h.sy += (h.tsy - h.sy) * ks;
      h.fingers.forEach(function (f) {
        f.ex += (f.tex - f.ex) * kf; f.ey += (f.tey - f.ey) * kf;
      });
      drawHand(h, t);
    });
  }

  // ---------- Запись ----------
  function pickMime() {
    // MP4/H.264 первым: только он воспроизводится в Messenger на iPhone
    var list = [
      'video/mp4;codecs=avc1.42E01F', 'video/mp4;codecs=avc1', 'video/mp4',
      'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'
    ];
    for (var i = 0; i < list.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(list[i])) return list[i];
    }
    return '';
  }

  var lastUrl = null;

  function generate() {
    var src = elText.value.replace(/\r/g, '');
    if (!src.trim()) { elStatus.textContent = 'Введите текст.'; return; }
    if (!cv.captureStream || !window.MediaRecorder) {
      elStatus.textContent = 'Браузер не поддерживает запись Canvas.'; return;
    }
    script = parseScript(src);
    out = [];
    pos = 0;
    keys.forEach(function (k) { k.press = 0; });
    resetHands();
    elResult.style.display = 'none';
    elPreview.removeAttribute('src');
    if (lastUrl) { URL.revokeObjectURL(lastUrl); lastUrl = null; }
    btn.disabled = true; elText.disabled = true; elSpeed.disabled = true;
    elStatus.textContent = 'Идёт запись… не переключайте вкладку.';

    if (navigator.wakeLock) {
      navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () {});
    }
    var mime = pickMime();
    var stream = cv.captureStream(FPS);
    var opts = { videoBitsPerSecond: BITRATE };
    if (mime) opts.mimeType = mime;
    var rec;
    try { rec = new MediaRecorder(stream, opts); }
    catch (e) { rec = new MediaRecorder(stream); mime = rec.mimeType; }
    var parts = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) parts.push(e.data); };
    rec.onstop = function () {
      var type = rec.mimeType || mime || 'video/webm';
      var blob = new Blob(parts, { type: type });
      lastUrl = URL.createObjectURL(blob);
      elPreview.src = lastUrl;
      elDl.href = lastUrl;
      elDl.download = 'typing.' + (type.indexOf('mp4') >= 0 ? 'mp4' : 'webm');
      elSize.textContent = (blob.size / 1024).toFixed(0) + ' КБ, ' + type.split(';')[0];
      elResult.style.display = 'block';
      elStatus.textContent = 'Готово.';
      if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; }
      var file = null;
      try { file = new File([blob], elDl.download, { type: type.split(';')[0] }); } catch (e) {}
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        elShare.style.display = 'inline-block';
        elShare.onclick = function () {
          navigator.share({ files: [file] }).catch(function () {});
        };
      } else {
        elShare.style.display = 'none';
      }
      if (type.indexOf('webm') >= 0) {
        elStatus.textContent = 'Готово. Внимание: WebM не откроется в Messenger на iPhone, нужен браузер с поддержкой MP4.';
      }
      btn.disabled = false; elText.disabled = false; elSpeed.disabled = false;
      stream.getTracks().forEach(function (t) { t.stop(); });
    };

    var cps = parseFloat(elSpeed.value);
    var base = 1000 / cps;
    var t0 = performance.now();
    var next = t0 + 700;          // пауза перед началом
    var endAt = 0;
    var planned = 0;   // сколько символов будет на экране с учётом уже запланированных нажатий
    running = true;
    rec.start(500);

    function frame() {
      var now = performance.now();
      while (pos < script.length && now >= next) {
        var e = script[pos++];
        if (e.t === 'w') {
          next = now + e.ms;
          if (pos >= script.length) endAt = next + 1500;
          break;
        }
        if (e.t === 'd') {
          if (planned <= 0) {            // нечего стирать: Backspace не нажимаем
            if (pos >= script.length) endAt = Math.max(endAt, now + 1500);
            continue;
          }
          planned--;
          planBackspace(now);
          var dd = Math.min(base, 90) * (0.8 + Math.random() * 0.4);
          next = now + dd;
          if (pos >= script.length) endAt = now + 1500;
          continue;
        }
        var ch = e.ch;
        planned++;
        planChar(ch, now);
        var d = base * (0.75 + Math.random() * 0.5);
        if (ch === ' ') d *= 1.2;
        if (/[.,!?\n]/.test(ch)) d *= 1.6;
        next += d;
        if (next < now) next = now + d;
        if (pos >= script.length) endAt = now + 1500;
      }
      runPending(now);
      render(now);
      if (pos >= script.length && pending.length === 0 && now >= endAt) {
        running = false;
        rec.stop();
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  btn.addEventListener('click', generate);

  // Холостая отрисовка (мигающий курсор), пока запись не идёт
  (function idle() {
    if (!running) render(performance.now());
    requestAnimationFrame(idle);
  })();
})();
