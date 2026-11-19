/* Play with Zile — game modules.
   Solo games:   {kind:"solo", name, desc, mount(el) -> cleanup}
   Online games: {kind:"online", name, desc, minP, maxP, init(players) -> state,
                  move(state, mv, seat) -> new state (throws Error with Vietnamese message),
                  view(el, ctx)}  ctx = {state, seat (my seat or -1), players, send(mv), hotseat}
*/
(function () {
const G = {};
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clone = o => JSON.parse(JSON.stringify(o));
function timers() { const list = []; return {
  every(ms, f) { const t = setInterval(f, ms); list.push(() => clearInterval(t)); return t; },
  later(ms, f) { const t = setTimeout(f, ms); list.push(() => clearTimeout(t)); return t; },
  clear() { list.forEach(f => f()); list.length = 0; } }; }
function fail(msg) { throw new Error(msg); }

/* ================= SOLO: Đếm khối ================= */
G.cubes = { kind: "solo", name: "Đếm khối", desc: "Đếm số khối lập phương trong một chồng 3 chiều. Xoay hình để thấy cột bị che.",
  mount(el) {
    const T = timers();
    el.innerHTML = `<div class="score"><span id="c-lv">CẤP 1</span><span id="c-sc">ĐÚNG 0</span></div>
      <canvas id="cv" width="560" height="360" aria-label="Chồng khối lập phương"></canvas>
      <div class="lcdrow"><button class="lcdbtn" id="c-rot">XOAY</button><input class="lcdinput" id="c-in" inputmode="numeric" aria-label="Số khối"><button class="lcdbtn" id="c-ok">NỘP</button><button class="lcdbtn" id="c-new">HÌNH MỚI</button></div>
      <div class="msg" id="c-msg" aria-live="polite"></div>`;
    const cv = $("#cv", el), ctx = cv.getContext("2d");
    let lv = 1, right = 0, H = [], rot = 0, lock = 0;
    const total = () => H.flat().reduce((a, b) => a + b, 0);
    function gen() {
      const n = Math.min(3 + lv, 7), maxH = Math.min(2 + lv, 6);
      H = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Math.random() < .15 ? 0 : Math.max(0, Math.round(maxH * (1 - (i + j) / (2 * n)) * Math.random() + Math.random() * 1.4))));
      rot = 0; draw(); $("#c-in", el).value = ""; $("#c-msg", el).textContent = "Đếm cả khối bị che phía sau."; $("#c-lv", el).textContent = "CẤP " + lv;
    }
    function draw() {
      const n = H.length; ctx.clearRect(0, 0, cv.width, cv.height);
      const s = Math.min(36, 300 / n), w = s, h = s / 2, z = s * .95, cx = cv.width / 2, cy = 60 + Math.max(0, 200 - n * h);
      const get = (i, j) => { let a = i, b = j; for (let r = 0; r < rot; r++) { const t = a; a = b; b = n - 1 - t; } return H[a][b]; };
      const face = (pts, col) => { ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = "#24321c"; ctx.lineWidth = 1.2; ctx.stroke(); };
      for (let sum = 0; sum <= 2 * (n - 1); sum++) for (let i = 0; i < n; i++) { const j = sum - i; if (j < 0 || j >= n) continue;
        for (let k = 0; k < get(i, j); k++) { const x = cx + (i - j) * w, y = cy + (i + j) * h - k * z;
          face([[x, y], [x + w, y + h], [x, y + 2 * h], [x - w, y + h]], "#f4f7e8");
          face([[x - w, y + h], [x, y + 2 * h], [x, y + 2 * h + z], [x - w, y + h + z]], "#9fb08a");
          face([[x + w, y + h], [x, y + 2 * h], [x, y + 2 * h + z], [x + w, y + h + z]], "#6f8360"); } }
    }
    function submit() {
      if (Date.now() < lock) return;
      const v = parseInt($("#c-in", el).value, 10);
      if (Number.isNaN(v)) { $("#c-msg", el).textContent = "Nhập một con số trước."; return; }
      if (v === total()) { right++; $("#c-sc", el).textContent = "ĐÚNG " + right; $("#c-msg", el).textContent = "Đúng, có " + total() + " khối."; if (right % 2 === 0) lv = Math.min(lv + 1, 6); T.later(1200, gen); }
      else { lock = Date.now() + 5000; $("#c-ok", el).disabled = true; $("#c-msg", el).textContent = "Chưa đúng. Chờ 5 giây rồi đếm lại."; T.later(5000, () => { $("#c-ok", el).disabled = false; $("#c-msg", el).textContent = "Nộp lại được rồi."; }); }
    }
    $("#c-rot", el).onclick = () => { rot = (rot + 1) % 4; draw(); };
    $("#c-ok", el).onclick = submit; $("#c-new", el).onclick = gen;
    $("#c-in", el).addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
    gen(); return T.clear;
  } };

/* ================= Poker helpers ================= */
const RANKS = "23456789TJQKA", SUITS = ["♠", "♥", "♦", "♣"];
const rl = r => RANKS[r] === "T" ? "10" : RANKS[r];
function handValue(cards) {
  const rs = cards.map(c => c.r).sort((a, b) => b - a), cnt = {}; rs.forEach(r => cnt[r] = (cnt[r] || 0) + 1);
  const gr = Object.entries(cnt).map(([r, c]) => [c, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const fl = cards.every(c => c.s === cards[0].s), u = [...new Set(rs)];
  let st = -1; if (u.length === 5) { if (u[0] - u[4] === 4) st = u[0]; else if (u.join() === "12,3,2,1,0") st = 3; }
  const k = gr.map(g => g[1]);
  if (st >= 0 && fl) return [8, st]; if (gr[0][0] === 4) return [7, ...k]; if (gr[0][0] === 3 && gr[1][0] === 2) return [6, ...k];
  if (fl) return [5, ...rs]; if (st >= 0) return [4, st]; if (gr[0][0] === 3) return [3, ...k];
  if (gr[0][0] === 2 && gr[1][0] === 2) return [2, ...k]; if (gr[0][0] === 2) return [1, ...k]; return [0, ...rs];
}
const HANDS = ["Mậu thầu", "Một đôi", "Hai đôi", "Bộ ba", "Sảnh", "Thùng", "Cù lũ", "Tứ quý", "Thùng phá sảnh"];
const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? -1) - (b[i] ?? -1); if (d) return d; } return 0; };
const cardHTML = (c, cls = "", extra = "") => `<div class="pc ${c.s === 1 || c.s === 2 ? "red" : ""} ${cls}" ${extra}>${rl(c.r)}${SUITS[c.s]}</div>`;

/* ================= SOLO: Poker trí nhớ ================= */
G.poker = { kind: "solo", name: "Poker trí nhớ", desc: "Nhớ 16 lá bài trong 20 giây, chọn hai lá úp để ghép bộ mạnh hơn máy. Ai thắng 3 ván trước thì thắng.",
  mount(el) {
    const T = timers();
    el.innerHTML = `<div class="score"><span id="p-me">BẠN 0</span><span id="p-t">20</span><span id="p-bot">MÁY 0</span></div>
      <div class="comm" id="p-comm"></div><div class="cards" id="p-grid"></div>
      <div class="lcdrow"><button class="lcdbtn" id="p-go" disabled>LẬT BÀI</button><button class="lcdbtn" id="p-new">CHIA VÁN MỚI</button></div>
      <div class="msg" id="p-msg" aria-live="polite"></div>`;
    let grid, comm, phase, picks, bot, me = 0, mb = 0, tick;
    function deal() {
      if (me >= 3 || mb >= 3) { me = 0; mb = 0; }
      const d = []; for (let r = 0; r < 13; r++) for (let s = 0; s < 4; s++) d.push({ r, s }); shuffle(d);
      grid = d.slice(0, 16); comm = d.slice(16, 19); picks = []; bot = []; phase = "memo";
      $("#p-me", el).textContent = "BẠN " + me; $("#p-bot", el).textContent = "MÁY " + mb;
      $("#p-comm", el).innerHTML = comm.map(() => `<div class="pc down"></div>`).join(""); draw(); $("#p-go", el).disabled = true;
      let t = 20; $("#p-t", el).textContent = t; $("#p-msg", el).textContent = "Ghi nhớ vị trí 16 lá bài.";
      clearInterval(tick); tick = T.every(1000, () => { t--; $("#p-t", el).textContent = Math.max(t, 0); if (t <= 0) { clearInterval(tick); phase = "pick"; $("#p-comm", el).innerHTML = comm.map(c => cardHTML(c)).join(""); $("#p-msg", el).textContent = "Bài đã úp. Chọn hai lá để ghép với 3 lá chung."; draw(); } });
    }
    function draw() {
      const show = phase !== "pick";
      $("#p-grid", el).innerHTML = grid.map((c, i) => show ? cardHTML(c, (picks.includes(i) ? "sel " : "") + (phase === "done" && bot.includes(i) ? "bot" : ""), `data-i="${i}"`) : `<div class="pc down ${picks.includes(i) ? "sel" : ""}" data-i="${i}" role="button" tabindex="0" aria-label="Lá úp số ${i + 1}"></div>`).join("");
      el.querySelectorAll("#p-grid [data-i]").forEach(x => { const f = () => { if (phase !== "pick") return; const i = +x.dataset.i; picks = picks.includes(i) ? picks.filter(y => y !== i) : picks.length < 2 ? [...picks, i] : [picks[1], i]; $("#p-go", el).disabled = picks.length !== 2; draw(); }; x.onclick = f; x.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f(); } }; });
    }
    $("#p-go", el).onclick = () => {
      if (phase !== "pick" || picks.length !== 2) return;
      const mem = grid.map(() => Math.random() < .62); let best = null;
      for (let a = 0; a < 16; a++) for (let b = a + 1; b < 16; b++) { if (!mem[a] || !mem[b]) continue; const v = handValue([...comm, grid[a], grid[b]]); if (!best || cmp(v, best) > 0) { best = v; bot = [a, b]; } }
      if (bot.length < 2) { const a = rnd(16); bot = [a, (a + 1 + rnd(15)) % 16]; }
      phase = "done";
      const mv = handValue([...comm, grid[picks[0]], grid[picks[1]]]), bv = handValue([...comm, grid[bot[0]], grid[bot[1]]]), d = cmp(mv, bv);
      if (d > 0) me++; else if (d < 0) mb++;
      let res = d > 0 ? "Bạn thắng ván này" : d < 0 ? "Máy thắng ván này" : "Hòa ván này";
      if (me >= 3) res = "Bạn thắng cả trận"; else if (mb >= 3) res = "Máy thắng cả trận";
      $("#p-me", el).textContent = "BẠN " + me; $("#p-bot", el).textContent = "MÁY " + mb;
      $("#p-msg", el).textContent = `${HANDS[mv[0]]} so với ${HANDS[bv[0]]}. ${res}.`; $("#p-go", el).disabled = true; draw();
    };
    $("#p-new", el).onclick = deal; deal(); return T.clear;
  } };

/* ================= Kim tự tháp số: bộ sinh đề dùng chung ================= */
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const PY_LEVELS = {
  de:   { name: "Dễ",  ops: ["+", "-"],           nmax: 9,  tmin: 3,  tmax: 20, sol: [1, 6] },
  vua:  { name: "Vừa", ops: ["+", "-", "×"],      nmax: 9,  tmin: 5,  tmax: 40, sol: [1, 5] },
  kho:  { name: "Khó", ops: ["+", "-", "×", "÷"], nmax: 12, tmin: 10, tmax: 80, sol: [1, 4] },
  quai: { name: "Quái", ops: ["+", "-", "×", "÷"], nmax: 15, tmin: 20, tmax: 150, sol: [1, 3] }
};
function pyEval(a, b, c) { // ô đầu bỏ phép tính, nhân chia trước cộng trừ, chỉ nhận kết quả nguyên
  const n = [a.n, b.n, c.n], o = [b.o, c.o];
  const ap = (x, op, y) => op === "+" ? [x[0] * y[1] + y[0] * x[1], x[1] * y[1]] : op === "-" ? [x[0] * y[1] - y[0] * x[1], x[1] * y[1]] : op === "×" ? [x[0] * y[0], x[1] * y[1]] : (y[0] === 0 ? null : [x[0] * y[1], x[1] * y[0]]);
  const hi = op => op === "×" || op === "÷"; let v;
  if (hi(o[1]) && !hi(o[0])) { const r = ap([n[1], 1], o[1], [n[2], 1]); if (!r) return null; v = ap([n[0], 1], o[0], r); }
  else { const l = ap([n[0], 1], o[0], [n[1], 1]); if (!l) return null; v = ap(l, o[1], [n[2], 1]); }
  return v && v[1] !== 0 && v[0] % v[1] === 0 ? v[0] / v[1] : null;
}
function pyGen(rand, levelKey) {
  const L = PY_LEVELS[levelKey] || PY_LEVELS.vua, r = n => Math.floor(rand() * n);
  for (let tries = 0; tries < 400; tries++) {
    const tiles = Array.from({ length: 10 }, () => ({ o: L.ops[r(L.ops.length)], n: 1 + r(L.nmax) }));
    const tally = {};
    for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) for (let c = 0; c < 10; c++) {
      if (a === b || b === c || a === c) continue;
      const v = pyEval(tiles[a], tiles[b], tiles[c]); if (v === null || v < L.tmin || v > L.tmax) continue;
      (tally[v] ||= []).push([a, b, c].join("-"));
    }
    const cands = Object.entries(tally).filter(([, l]) => l.length >= L.sol[0] && l.length <= L.sol[1]);
    if (!cands.length) continue;
    cands.sort((x, y) => +x[0] - +y[0]);
    const [tv, list] = cands[r(cands.length)];
    return { tiles, target: +tv, sols: list, level: levelKey };
  }
  return pyGen(rand, "de");
}
function pyramidHTML(tiles, sel) {
  let i = 0, h = ""; for (let row = 1; row <= 4; row++) { let x = ""; for (let k = 0; k < row; k++, i++) x += `<button class="hex ${sel.includes(i) ? "on" : ""}" data-i="${i}">${tiles[i].o}${tiles[i].n}</button>`; h += `<div class="row">${x}</div>`; }
  return h;
}
const pyExpr = (tiles, sel) => sel.map((i, k) => (k ? " " + tiles[i].o + " " : "") + tiles[i].n).join("");

/* ================= SOLO: Kim tự tháp số ================= */
G.pyramid = { kind: "solo", name: "Kim tự tháp số", desc: "Chọn 3 ô theo thứ tự để ghép phép tính bằng con số mục tiêu. Có 4 mức khó, mỗi vòng 3 phút, tìm càng nhiều cách càng nhiều điểm.",
  mount(el) {
    const T = timers();
    el.innerHTML = `<div class="lcdrow">${Object.entries(PY_LEVELS).map(([k, L]) => `<button class="lcdbtn" data-lv="${k}">${L.name.toUpperCase()}</button>`).join("")}<button class="lcdbtn" data-lv="tron">TRỘN</button></div>
      <div class="score"><span id="y-r">VÒNG 1/10</span><span id="y-t">3:00</span><span id="y-s">ĐIỂM 0</span></div>
      <div class="target"><span class="small" id="y-lv">MỤC TIÊU</span><br><span id="y-target">0</span></div>
      <div class="pyr" id="y-pyr"></div><div class="msg" id="y-expr">Chọn 3 ô theo thứ tự</div><div class="found" id="y-found"></div>
      <div class="lcdrow"><button class="lcdbtn" id="y-ok" disabled>NỘP</button><button class="lcdbtn" id="y-clr">XÓA CHỌN</button><button class="lcdbtn" id="y-next">VÒNG SAU</button><button class="lcdbtn" id="y-re">CHƠI LẠI</button></div>
      <div class="msg" id="y-msg" aria-live="polite"></div>`;
    let P, found, sel, round = 1, score = 0, tl, tick, mode = "tron";
    const lvFor = () => mode !== "tron" ? mode : round <= 3 ? "de" : round <= 6 ? "vua" : round <= 9 ? "kho" : "quai";
    function newRound() {
      P = pyGen(Math.random, lvFor()); found = []; sel = [];
      $("#y-target", el).textContent = P.target; $("#y-r", el).textContent = `VÒNG ${round}/10`; $("#y-lv", el).textContent = "MỤC TIÊU · " + PY_LEVELS[P.level].name.toUpperCase();
      $("#y-msg", el).textContent = `Có ${P.sols.length} cách ra ${P.target}.`;
      draw(); tl = 180; show(); clearInterval(tick); tick = T.every(1000, () => { tl--; show(); if (tl <= 0) end("Hết giờ."); });
    }
    const show = () => { const t = Math.max(tl, 0); $("#y-t", el).textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
    function draw() {
      $("#y-pyr", el).innerHTML = pyramidHTML(P.tiles, sel);
      el.querySelectorAll("#y-pyr .hex").forEach(b => b.onclick = () => { const i = +b.dataset.i; if (sel.includes(i)) sel = sel.filter(x => x !== i); else if (sel.length < 3) sel.push(i); draw(); });
      $("#y-expr", el).textContent = sel.length ? pyExpr(P.tiles, sel) + (sel.length === 3 ? " = ?" : "") : "Chọn 3 ô theo thứ tự";
      $("#y-found", el).innerHTML = found.map(f => `<span>${esc(f)}</span>`).join(""); $("#y-ok", el).disabled = sel.length !== 3;
    }
    function end(why) { clearInterval(tick); $("#y-msg", el).textContent = `${why} Bạn tìm được ${found.length} trên ${P.sols.length} cách.`; }
    $("#y-ok", el).onclick = () => {
      if (sel.length !== 3 || tl <= 0) return; const k = sel.join("-"), t = pyExpr(P.tiles, sel);
      if (found.includes(t)) { score--; $("#y-msg", el).textContent = "Đáp án này đã có, trừ một điểm."; }
      else if (P.sols.includes(k)) { score++; found.push(t); $("#y-msg", el).textContent = "Đúng, cộng một điểm."; if (found.length === P.sols.length) end("Đủ hết các cách."); }
      else { score--; const v = pyEval(P.tiles[sel[0]], P.tiles[sel[1]], P.tiles[sel[2]]); $("#y-msg", el).textContent = `Phép tính ra ${v === null ? "số lẻ" : v}, trừ một điểm.`; }
      $("#y-s", el).textContent = "ĐIỂM " + score; sel = []; draw();
    };
    $("#y-clr", el).onclick = () => { sel = []; draw(); };
    $("#y-next", el).onclick = () => { if (round >= 10) { end(`Hết 10 vòng với ${score} điểm.`); return; } round++; newRound(); };
    const restart = () => { round = 1; score = 0; $("#y-s", el).textContent = "ĐIỂM 0"; newRound(); };
    $("#y-re", el).onclick = restart;
    el.querySelectorAll("[data-lv]").forEach(b => b.onclick = () => { mode = b.dataset.lv; restart(); });
    newRound(); return T.clear;
  } };

/* ================= ONLINE: Đua kim tự tháp (nhiều người, cùng đề) ================= */
const RACE_Q = 10, RACE_MS = 90000;
const raceLevel = q => q < 3 ? "de" : q < 6 ? "vua" : q < 9 ? "kho" : "quai";
const racePuzzle = (seed, q) => pyGen(mulberry(seed + q * 7919), raceLevel(q));
G.pyramidrace = { kind: "online", flexible: true, name: "Đua kim tự tháp", minP: 2, maxP: 8,
  desc: "Mọi người trong phòng giải cùng 10 câu kim tự tháp, đề giống hệt nhau trên mọi máy. Mỗi câu tìm một phép tính đúng. Ai đúng nhiều câu nhất thắng, bằng điểm thì ai tốn ít thời gian hơn thắng.",
  init(players) { return { seed: Math.floor(Math.random() * 2e9), prog: players.map(() => ({ q: 0, score: 0, time: 0, done: false })), winner: null, rank: null }; },
  move(s0, mv, seat) {
    const s = clone(s0); if (s.winner !== null) fail("Ván đã kết thúc."); const p = s.prog[seat]; if (!p) fail("Bạn không có ghế trong ván này.");
    if (p.done) fail("Bạn đã làm xong 10 câu."); if (mv.q !== p.q) fail("Câu này đã được ghi rồi.");
    const ms = Math.max(0, Math.min(RACE_MS, Math.floor(mv.ms || 0)));
    if (mv.pick) { const P = racePuzzle(s.seed, p.q), [a, b, c] = mv.pick; if (new Set(mv.pick).size !== 3 || pyEval(P.tiles[a], P.tiles[b], P.tiles[c]) !== P.target) fail("Phép tính chưa đúng."); p.score++; }
    p.time += ms; p.q++; if (p.q >= RACE_Q) p.done = true;
    if (s.prog.every(x => x.done)) {
      s.rank = s.prog.map((x, i) => i).sort((a, b) => (s.prog[b].score - s.prog[a].score) || (s.prog[a].time - s.prog[b].time));
      s.winner = s.rank[0];
    }
    return s;
  },
  view(el, ctx) {
    const s = ctx.state, P = ctx.players, seat = ctx.seat, me = s.prog[seat];
    const fmt = ms => (ms / 1000).toFixed(1) + " giây";
    const board = `<table class="sheet-t race"><thead><tr><th>Người chơi</th><th>Câu</th><th>Đúng</th><th>Thời gian</th></tr></thead><tbody>${(s.rank || s.prog.map((_, i) => i)).map((i, k) => `<tr${i === seat ? ' class="first"' : ""}><td>${s.rank ? (k + 1) + ". " : ""}${esc(P[i]?.name)}</td><td>${s.prog[i].done ? "Xong" : (s.prog[i].q + 1) + "/" + RACE_Q}</td><td>${s.prog[i].score}</td><td>${fmt(s.prog[i].time)}</td></tr>`).join("")}</tbody></table>`;
    if (s.winner !== null) { el.innerHTML = `<div class="msg">${esc(P[s.winner]?.name)} thắng với ${s.prog[s.winner].score} câu đúng trong ${fmt(s.prog[s.winner].time)}.</div>${board}`; return; }
    if (!me || me.done || ctx.hotseat) { el.innerHTML = `<div class="msg">${me && me.done ? "Bạn đã xong 10 câu, chờ mọi người làm xong." : "Bạn đang xem ván này."}</div>${board}`; return; }
    const Pz = racePuzzle(s.seed, me.q);
    if (el._q !== me.q) { el._q = me.q; el._start = Date.now(); el._sel = []; el._busy = false; }
    const sel = el._sel;
    el.innerHTML = `<div class="score"><span>CÂU ${me.q + 1}/${RACE_Q} · ${PY_LEVELS[Pz.level].name.toUpperCase()}</span><span id="rc-t">90</span><span>ĐÚNG ${me.score}</span></div>
      <div class="target"><span class="small">MỤC TIÊU</span><br><span>${Pz.target}</span></div>
      <div class="pyr">${pyramidHTML(Pz.tiles, sel)}</div>
      <div class="msg">${sel.length ? esc(pyExpr(Pz.tiles, sel)) + (sel.length === 3 ? " = ?" : "") : "Chọn 3 ô theo thứ tự"}</div>
      <div class="lcdrow"><button class="lcdbtn" id="rc-ok" ${sel.length === 3 ? "" : "disabled"}>NỘP</button><button class="lcdbtn" id="rc-clr">XÓA CHỌN</button><button class="lcdbtn" id="rc-skip">BỎ CÂU</button></div>
      <div class="msg" id="rc-msg" aria-live="polite">${esc(el._msg || "")}</div>${board}`;
    el._msg = "";
    const redraw = () => G.pyramidrace.view(el, ctx);
    el.querySelectorAll(".pyr .hex").forEach(b => b.onclick = () => { const i = +b.dataset.i; if (sel.includes(i)) sel.splice(sel.indexOf(i), 1); else if (sel.length < 3) sel.push(i); redraw(); });
    const send = pick => { if (el._busy) return; el._busy = true; clearInterval(el._tick); ctx.send({ q: me.q, pick, ms: Date.now() - el._start }); };
    $("#rc-ok", el).onclick = () => {
      if (sel.length !== 3) return;
      if (pyEval(Pz.tiles[sel[0]], Pz.tiles[sel[1]], Pz.tiles[sel[2]]) === Pz.target) send([...sel]);
      else { const v = pyEval(Pz.tiles[sel[0]], Pz.tiles[sel[1]], Pz.tiles[sel[2]]); el._msg = `Phép tính ra ${v === null ? "số lẻ" : v}, chưa đúng. Thử lại.`; el._sel = []; G.pyramidrace.view(el, ctx); }
    };
    $("#rc-clr", el).onclick = () => { el._sel = []; redraw(); };
    $("#rc-skip", el).onclick = () => send(null);
    clearInterval(el._tick);
    const tick = () => { if (!el.isConnected) { clearInterval(el._tick); return; } const left = Math.max(0, Math.ceil((RACE_MS - (Date.now() - el._start)) / 1000)); const t = $("#rc-t", el); if (t) t.textContent = left; if (left <= 0) send(null); };
    tick(); el._tick = setInterval(tick, 500);
  } };

/* ================= SOLO: Lục giác ================= */
G.hexagon = { kind: "solo", name: "Lục giác", desc: "Nhớ 12 con số trong 20 giây. Số biến thành chữ cái, bạn tìm 3 chữ có tổng bằng mục tiêu.",
  mount(el) {
    const T = timers(), L = "ABCDEFGHIJKL";
    el.innerHTML = `<div class="score"><span id="h-r">VÒNG 1/8</span><span id="h-t">20</span><span id="h-s">ĐIỂM 0</span></div>
      <div class="target"><span class="small" id="h-lab">GHI NHỚ</span><br><span id="h-target">?</span></div>
      <div class="honey" id="h-grid"></div><div class="found" id="h-found"></div>
      <div class="lcdrow"><button class="lcdbtn" id="h-ok" disabled>NỘP</button><button class="lcdbtn" id="h-next">MỤC TIÊU MỚI</button><button class="lcdbtn" id="h-re">BẢNG MỚI</button></div>
      <div class="msg" id="h-msg" aria-live="polite"></div>`;
    let nums, memo, sel, target, sols, found, score = 0, round = 1, tick;
    function board() {
      nums = Array.from({ length: 12 }, () => 1 + rnd(9)); memo = true; sel = []; round = 1;
      let t = 20; $("#h-t", el).textContent = t; $("#h-lab", el).textContent = "GHI NHỚ"; $("#h-target", el).textContent = "?"; $("#h-msg", el).textContent = "Ghi nhớ số trong từng ô.";
      draw(); clearInterval(tick); tick = T.every(1000, () => { t--; $("#h-t", el).textContent = Math.max(t, 0); if (t <= 0) { clearInterval(tick); memo = false; newTarget(); } });
    }
    function newTarget() {
      const tally = {};
      for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) for (let c = b + 1; c < 12; c++) { const s = nums[a] + nums[b] + nums[c]; (tally[s] ||= []).push([a, b, c].join("")); }
      const c = Object.entries(tally).filter(([, l]) => l.length >= 2 && l.length <= 5); const [tv, l] = c[rnd(c.length)];
      target = +tv; sols = new Set(l.map(x => [...x].map(Number).length ? x : x)); sols = new Set(tally[tv].map(x => x)); found = []; sel = [];
      $("#h-lab", el).textContent = "MỤC TIÊU"; $("#h-target", el).textContent = target; $("#h-r", el).textContent = `VÒNG ${round}/8`;
      $("#h-msg", el).textContent = `Có ${sols.size} bộ 3 chữ cộng ra ${target}.`; draw();
    }
    function draw() {
      $("#h-grid", el).innerHTML = nums.map((n, i) => `<button class="hex ${sel.includes(i) ? "on" : ""}" data-i="${i}" ${memo ? "disabled" : ""}>${memo ? n : L[i]}</button>`).join("");
      el.querySelectorAll("#h-grid .hex").forEach(b => b.onclick = () => { const i = +b.dataset.i; if (sel.includes(i)) sel = sel.filter(x => x !== i); else if (sel.length < 3) sel.push(i); draw(); });
      $("#h-found", el).innerHTML = (found || []).map(f => `<span>${f}</span>`).join(""); $("#h-ok", el).disabled = memo || sel.length !== 3;
    }
    $("#h-ok", el).onclick = () => {
      const key = [...sel].sort((a, b) => a - b).join(""), txt = [...sel].sort((a, b) => a - b).map(i => L[i]).join(" ");
      if (found.includes(txt)) { score--; $("#h-msg", el).textContent = "Bộ này đã tìm rồi, trừ một điểm."; }
      else if (sols.has(key)) { score++; found.push(txt); $("#h-msg", el).textContent = found.length === sols.size ? "Đủ hết các bộ, bấm Mục tiêu mới." : "Đúng, cộng một điểm."; }
      else { score--; $("#h-msg", el).textContent = `Tổng là ${sel.reduce((s, i) => s + nums[i], 0)}, trừ một điểm.`; }
      $("#h-s", el).textContent = "ĐIỂM " + score; sel = []; draw();
    };
    $("#h-next", el).onclick = () => { if (memo) return; if (round >= 8) { $("#h-msg", el).textContent = `Hết 8 vòng với ${score} điểm. Bấm Bảng mới để chơi tiếp.`; return; } round++; newTarget(); };
    $("#h-re", el).onclick = () => { score = 0; $("#h-s", el).textContent = "ĐIỂM 0"; board(); };
    board(); return T.clear;
  } };

/* ================= SOLO: Hành trình quân mã ================= */
G.knight = { kind: "solo", name: "Đường đi quân mã", desc: "Đi quân mã qua mỗi ô đúng một lần. Thử từ bàn 5 x 5 rồi lên tới 8 x 8.",
  mount(el) {
    el.innerHTML = `<div class="score"><span id="k-n">BÀN 5 x 5</span><span id="k-c">0 Ô</span></div>
      <div class="board" id="k-b"></div>
      <div class="lcdrow"><button class="lcdbtn" data-n="5">5 x 5</button><button class="lcdbtn" data-n="6">6 x 6</button><button class="lcdbtn" data-n="7">7 x 7</button><button class="lcdbtn" data-n="8">8 x 8</button><button class="lcdbtn" id="k-u">LÙI LẠI</button></div>
      <div class="msg" id="k-msg" aria-live="polite">Bấm một ô bất kỳ để đặt quân mã.</div>`;
    let n = 5, path = [];
    const J = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
    const legal = () => { if (!path.length) return null; const [r, c] = path[path.length - 1]; return J.map(([a, b]) => [r + a, c + b]).filter(([x, y]) => x >= 0 && y >= 0 && x < n && y < n && !path.some(p => p[0] === x && p[1] === y)); };
    function draw() {
      const lg = legal(), b = $("#k-b", el); b.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
      let h = ""; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const idx = path.findIndex(p => p[0] === r && p[1] === c), last = idx === path.length - 1 && idx >= 0, can = lg ? lg.some(p => p[0] === r && p[1] === c) : true;
        h += `<button class="sq ${(r + c) % 2 ? "dk" : ""} ${idx >= 0 ? "vis" : ""} ${can && idx < 0 ? "can" : ""}" data-r="${r}" data-c="${c}" aria-label="Hàng ${r + 1} cột ${c + 1}">${last ? "♞" : idx >= 0 ? idx + 1 : ""}</button>`; }
      b.innerHTML = h; $("#k-n", el).textContent = `BÀN ${n} x ${n}`; $("#k-c", el).textContent = `${path.length}/${n * n} Ô`;
      b.querySelectorAll(".sq").forEach(s => s.onclick = () => { const r = +s.dataset.r, c = +s.dataset.c, l = legal(); if (l && !l.some(p => p[0] === r && p[1] === c)) return; if (path.some(p => p[0] === r && p[1] === c)) return; path.push([r, c]); after(); });
    }
    function after() { draw(); const l = legal(); if (path.length === n * n) $("#k-msg", el).textContent = "Xong, quân mã đã đi hết bàn."; else if (l && !l.length) $("#k-msg", el).textContent = "Hết đường đi. Bấm Lùi lại hoặc chọn bàn để làm lại."; else $("#k-msg", el).textContent = "Bấm một ô sáng để đi tiếp."; }
    el.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { n = +b.dataset.n; path = []; draw(); $("#k-msg", el).textContent = "Bấm một ô bất kỳ để đặt quân mã."; });
    $("#k-u", el).onclick = () => { path.pop(); after(); };
    draw(); return () => {};
  } };

/* ================= SOLO: Ma phương ================= */
G.magic = { kind: "solo", name: "Ma phương", desc: "Điền số vào bảng sao cho tổng mỗi hàng, cột và hai đường chéo bằng nhau.",
  mount(el) {
    el.innerHTML = `<div class="score"><span id="m-n">BẢNG 3 x 3</span><span id="m-sum">TỔNG 15</span></div>
      <div class="board magic" id="m-b"></div>
      <div class="lcdrow"><button class="lcdbtn" data-n="3">3 x 3</button><button class="lcdbtn" data-n="4">4 x 4</button><button class="lcdbtn" id="m-ok">KIỂM TRA</button></div>
      <div class="msg" id="m-msg" aria-live="polite"></div>`;
    let n = 3, sol, given;
    const sym = m => { const k = m.length; let a = m.map(r => [...r]); for (let t = rnd(4); t > 0; t--) a = a[0].map((_, i) => a.map(r => r[i]).reverse()); if (rnd(2)) a = a.map(r => r.reverse()); return a; };
    function gen() {
      if (n === 3) sol = sym([[2, 7, 6], [9, 5, 1], [4, 3, 8]]);
      else { sol = sym([[16, 3, 2, 13], [5, 10, 11, 8], [9, 6, 7, 12], [4, 15, 14, 1]]); if (rnd(2)) sol = sol.map(r => r.map(v => 17 - v)); }
      given = sol.map(r => r.map(() => Math.random() < (n === 3 ? .34 : .45)));
      const S = n * (n * n + 1) / 2; $("#m-n", el).textContent = `BẢNG ${n} x ${n}`; $("#m-sum", el).textContent = `TỔNG ${S}`;
      const b = $("#m-b", el); b.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
      b.innerHTML = sol.map((r, i) => r.map((v, j) => given[i][j] ? `<div class="sq given">${v}</div>` : `<input class="sq" inputmode="numeric" maxlength="2" data-i="${i}" data-j="${j}" aria-label="Hàng ${i + 1} cột ${j + 1}">`).join("")).join("");
      $("#m-msg", el).textContent = `Dùng mỗi số từ 1 đến ${n * n} đúng một lần.`;
    }
    $("#m-ok", el).onclick = () => {
      const g = sol.map((r, i) => r.map((v, j) => given[i][j] ? v : parseInt((el.querySelector(`[data-i="${i}"][data-j="${j}"]`) || {}).value, 10)));
      if (g.flat().some(Number.isNaN)) { $("#m-msg", el).textContent = "Còn ô trống."; return; }
      const S = n * (n * n + 1) / 2, set = new Set(g.flat());
      const sums = [...g.map(r => r.reduce((a, b) => a + b, 0)), ...g[0].map((_, j) => g.reduce((a, r) => a + r[j], 0)), g.reduce((a, r, i) => a + r[i], 0), g.reduce((a, r, i) => a + r[n - 1 - i], 0)];
      if (set.size !== n * n || [...set].some(v => v < 1 || v > n * n)) $("#m-msg", el).textContent = `Mỗi số từ 1 đến ${n * n} chỉ được dùng một lần.`;
      else if (sums.every(s => s === S)) $("#m-msg", el).textContent = "Đúng hết, mọi tổng đều bằng " + S + ".";
      else $("#m-msg", el).textContent = `Có ${sums.filter(s => s !== S).length} đường chưa ra ${S}.`;
    };
    el.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { n = +b.dataset.n; gen(); });
    gen(); return () => {};
  } };

/* ================= SOLO: Rào vòng (loop puzzle) ================= */
G.loop = { kind: "solo", name: "Rào vòng", desc: "Nối các chấm thành một vòng rào khép kín. Số trong ô cho biết ô đó có bao nhiêu cạnh là rào.",
  mount(el) {
    el.innerHTML = `<div class="score"><span id="l-n">BẢNG 5 x 5</span><span id="l-c">0 ĐOẠN</span></div>
      <canvas id="l-cv" width="420" height="420" aria-label="Bảng rào vòng"></canvas>
      <div class="lcdrow"><button class="lcdbtn" data-n="5">5 x 5</button><button class="lcdbtn" data-n="6">6 x 6</button><button class="lcdbtn" data-n="7">7 x 7</button><button class="lcdbtn" id="l-ok">KIỂM TRA</button><button class="lcdbtn" id="l-clr">XÓA HẾT</button></div>
      <div class="msg" id="l-msg" aria-live="polite">Bấm vào khoảng giữa hai chấm để đặt rào, bấm lần nữa để đánh dấu X.</div>`;
    const cv = $("#l-cv", el), ctx = cv.getContext("2d");
    let n = 5, inside, clue, show, H, V; // H[r][c]: edge top of cell row r (r 0..n), V[r][c]: left edge col c (c 0..n)
    function gen() {
      for (let tries = 0; tries < 500; tries++) {
        inside = Array.from({ length: n }, () => Array(n).fill(false));
        const target = Math.floor(n * n * (.35 + Math.random() * .2));
        let r0 = rnd(n), c0 = rnd(n); inside[r0][c0] = true; let cnt = 1;
        const isIn = (r, c) => r >= 0 && c >= 0 && r < n && c < n && inside[r][c];
        for (let k = 0; k < 4000 && cnt < target; k++) {
          const r = rnd(n), c = rnd(n); if (inside[r][c]) continue;
          if (!(isIn(r - 1, c) || isIn(r + 1, c) || isIn(r, c - 1) || isIn(r, c + 1))) continue;
          let ok = true; for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (isIn(r + dr, c + dc) && !isIn(r + dr, c) && !isIn(r, c + dc)) ok = false;
          if (ok) { inside[r][c] = true; cnt++; }
        }
        // fill holes: outside cells not reachable from border
        const seen = Array.from({ length: n }, () => Array(n).fill(false)), st = [];
        for (let i = 0; i < n; i++) for (const [r, c] of [[i, 0], [i, n - 1], [0, i], [n - 1, i]]) if (!inside[r][c] && !seen[r][c]) { seen[r][c] = true; st.push([r, c]); }
        while (st.length) { const [r, c] = st.pop(); for (const [a, b] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) if (a >= 0 && b >= 0 && a < n && b < n && !inside[a][b] && !seen[a][b]) { seen[a][b] = true; st.push([a, b]); } }
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!inside[r][c] && !seen[r][c]) inside[r][c] = true;
        // vertex degree check
        let bad = false;
        for (let r = 0; r <= n && !bad; r++) for (let c = 0; c <= n; c++) {
          const q = [isIn(r - 1, c - 1), isIn(r - 1, c), isIn(r, c - 1), isIn(r, c)];
          if ((q[0] && q[3] && !q[1] && !q[2]) || (q[1] && q[2] && !q[0] && !q[3])) { bad = true; break; }
        }
        if (bad || cnt < 3) continue;
        clue = inside.map((row, r) => row.map((v, c) => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => isIn(a, b) !== v).length));
        show = clue.map(row => row.map(() => Math.random() < .62));
        H = Array.from({ length: n + 1 }, () => Array(n).fill(0)); V = Array.from({ length: n }, () => Array(n + 1).fill(0));
        break;
      }
      $("#l-n", el).textContent = `BẢNG ${n} x ${n}`; draw();
    }
    const geo = () => { const m = 28, s = (cv.width - 2 * m) / n; return { m, s }; };
    function draw() {
      const { m, s } = geo(); ctx.clearRect(0, 0, cv.width, cv.height); ctx.font = `${Math.floor(s * .55)}px VT323, monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      let lines = 0;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (show[r][c]) { ctx.fillStyle = "#24321c"; ctx.fillText(clue[r][c], m + (c + .5) * s, m + (r + .5) * s + 2); }
      const edge = (x1, y1, x2, y2, st) => { if (st === 1) { ctx.strokeStyle = "#24321c"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); lines++; } else if (st === 2) { const x = (x1 + x2) / 2, y = (y1 + y2) / 2; ctx.strokeStyle = "#b3261e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke(); } };
      for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) edge(m + c * s, m + r * s, m + (c + 1) * s, m + r * s, H[r][c]);
      for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) edge(m + c * s, m + r * s, m + c * s, m + (r + 1) * s, V[r][c]);
      ctx.fillStyle = "#24321c"; for (let r = 0; r <= n; r++) for (let c = 0; c <= n; c++) { ctx.beginPath(); ctx.arc(m + c * s, m + r * s, 3, 0, 7); ctx.fill(); }
      $("#l-c", el).textContent = `${lines} ĐOẠN`;
    }
    cv.addEventListener("click", e => {
      const b = cv.getBoundingClientRect(), x = (e.clientX - b.left) * cv.width / b.width, y = (e.clientY - b.top) * cv.height / b.height, { m, s } = geo();
      const fx = (x - m) / s, fy = (y - m) / s, rx = Math.round(fx), ry = Math.round(fy), dx = Math.abs(fx - rx), dy = Math.abs(fy - ry);
      if (dy < dx) { const r = ry, c = Math.floor(fx); if (r >= 0 && r <= n && c >= 0 && c < n) H[r][c] = (H[r][c] + 1) % 3; }
      else { const c = rx, r = Math.floor(fy); if (c >= 0 && c <= n && r >= 0 && r < n) V[r][c] = (V[r][c] + 1) % 3; }
      draw();
    });
    $("#l-ok", el).onclick = () => {
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (show[r][c]) { const k = (H[r][c] === 1) + (H[r + 1][c] === 1) + (V[r][c] === 1) + (V[r][c + 1] === 1); if (k !== clue[r][c]) { $("#l-msg", el).textContent = `Ô hàng ${r + 1} cột ${c + 1} cần ${clue[r][c]} cạnh rào.`; return; } }
      const deg = {}, adj = {}, add = (a, b) => { deg[a] = (deg[a] || 0) + 1; deg[b] = (deg[b] || 0) + 1; (adj[a] ||= []).push(b); (adj[b] ||= []).push(a); };
      let edges = 0;
      for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) if (H[r][c] === 1) { add(`${r},${c}`, `${r},${c + 1}`); edges++; }
      for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) if (V[r][c] === 1) { add(`${r},${c}`, `${r + 1},${c}`); edges++; }
      if (!edges) { $("#l-msg", el).textContent = "Chưa có đoạn rào nào."; return; }
      if (Object.values(deg).some(d => d !== 2)) { $("#l-msg", el).textContent = "Rào bị hở hoặc rẽ nhánh. Mỗi chấm có đúng 0 hoặc 2 đoạn."; return; }
      const start = Object.keys(adj)[0], seen = new Set([start]), st = [start];
      while (st.length) { const v = st.pop(); for (const w of adj[v]) if (!seen.has(w)) { seen.add(w); st.push(w); } }
      $("#l-msg", el).textContent = seen.size === Object.keys(adj).length ? "Đúng, vòng rào đã khép kín." : "Đang có nhiều vòng rào. Chỉ được một vòng.";
    };
    $("#l-clr", el).onclick = () => { H = H.map(r => r.map(() => 0)); V = V.map(r => r.map(() => 0)); draw(); };
    el.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { n = +b.dataset.n; gen(); });
    gen(); return () => {};
  } };

/* ================= SOLO: Tìm điểm khác ================= */
G.spot = { kind: "solo", name: "Tìm điểm khác", desc: "Hai bức tranh có 5 điểm khác nhau. Bấm vào tranh bên phải để đánh dấu trong 2 phút.",
  mount(el) {
    const T = timers();
    el.innerHTML = `<div class="score"><span id="s-f">0/5</span><span id="s-t">2:00</span><span id="s-x">SAI 0</span></div>
      <div class="pair"><canvas id="s-a" width="300" height="220" aria-label="Tranh gốc"></canvas><canvas id="s-b" width="300" height="220" aria-label="Tranh đã đổi"></canvas></div>
      <div class="lcdrow"><button class="lcdbtn" id="s-new">TRANH MỚI</button></div>
      <div class="msg" id="s-msg" aria-live="polite">Bấm vào chỗ khác nhau ở tranh bên phải.</div>`;
    const A = $("#s-a", el), B = $("#s-b", el); let shapes, diffs, found, miss, tl, tick, over;
    const COLS = ["#d23a3a", "#2f6fd6", "#2f8a4c", "#e9a92b", "#7b55d1", "#1e9c8f", "#24321c"];
    function gen() {
      shapes = Array.from({ length: 16 }, () => ({ t: rnd(3), x: 20 + rnd(260), y: 20 + rnd(180), r: 10 + rnd(16), c: COLS[rnd(COLS.length)] }));
      const pick = shuffle([...shapes.keys()]).slice(0, 5); diffs = pick.map(i => { const s = shapes[i], k = rnd(3); const m = { ...s }; if (k === 0) m.c = COLS[(COLS.indexOf(s.c) + 1 + rnd(COLS.length - 1)) % COLS.length]; else if (k === 1) m.gone = true; else m.r = s.r > 16 ? s.r - 8 : s.r + 8; return { i, m }; });
      found = []; miss = 0; over = false; draw(); tl = 120; showT(); clearInterval(tick); tick = T.every(1000, () => { tl--; showT(); if (tl <= 0) { over = true; clearInterval(tick); $("#s-msg", el).textContent = `Hết giờ, bạn tìm được ${found.length} trên 5 điểm.`; draw(true); } });
      $("#s-x", el).textContent = "SAI 0"; $("#s-msg", el).textContent = "Bấm vào chỗ khác nhau ở tranh bên phải.";
    }
    const showT = () => { const t = Math.max(tl, 0); $("#s-t", el).textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
    function paint(cv, list, mark) {
      const c = cv.getContext("2d"); c.fillStyle = "#fbfbf4"; c.fillRect(0, 0, cv.width, cv.height);
      list.forEach(s => { if (s.gone) return; c.fillStyle = s.c; c.beginPath(); if (s.t === 0) c.arc(s.x, s.y, s.r, 0, 7); else if (s.t === 1) c.rect(s.x - s.r, s.y - s.r, 2 * s.r, 2 * s.r); else { c.moveTo(s.x, s.y - s.r); c.lineTo(s.x + s.r, s.y + s.r); c.lineTo(s.x - s.r, s.y + s.r); c.closePath(); } c.fill(); });
      (mark || []).forEach(d => { const s = shapes[d.i]; c.strokeStyle = "#24321c"; c.lineWidth = 3; c.beginPath(); c.arc(s.x, s.y, s.r + 8, 0, 7); c.stroke(); });
    }
    function draw(reveal) { paint(A, shapes); const alt = shapes.map((s, i) => { const d = diffs.find(x => x.i === i); return d ? d.m : s; }); paint(B, alt, reveal ? diffs : diffs.filter(d => found.includes(d.i))); $("#s-f", el).textContent = `${found.length}/5`; }
    B.addEventListener("click", e => {
      if (over) return; const b = B.getBoundingClientRect(), x = (e.clientX - b.left) * B.width / b.width, y = (e.clientY - b.top) * B.height / b.height;
      const hit = diffs.find(d => !found.includes(d.i) && Math.hypot(shapes[d.i].x - x, shapes[d.i].y - y) < shapes[d.i].r + 12);
      if (hit) { found.push(hit.i); if (found.length === 5) { over = true; clearInterval(tick); $("#s-msg", el).textContent = "Tìm đủ 5 điểm khác."; } }
      else { miss++; $("#s-x", el).textContent = "SAI " + miss; }
      draw();
    });
    $("#s-new", el).onclick = gen; gen(); return T.clear;
  } };

/* ================= SOLO: Ghép mặt (montage) ================= */
G.montage = { kind: "solo", name: "Nhớ mặt", desc: "Các khuôn mặt hiện lần lượt. Bấm nút khi thấy một khuôn mặt đã xuất hiện trước đó.",
  mount(el) {
    const T = timers();
    el.innerHTML = `<div class="score"><span id="f-i">0/30</span><span id="f-s">ĐIỂM 0</span></div>
      <canvas id="f-cv" width="240" height="240" aria-label="Khuôn mặt"></canvas>
      <div class="lcdrow"><button class="lcdbtn big" id="f-hit">ĐÃ GẶP</button><button class="lcdbtn" id="f-go">BẮT ĐẦU</button></div>
      <div class="msg" id="f-msg" aria-live="polite">Mỗi mặt hiện 2 giây. Bấm Đã gặp hoặc phím cách khi thấy mặt lặp lại.</div>`;
    const cv = $("#f-cv", el), c = cv.getContext("2d");
    const SK = ["#f2c9a0", "#d9a274", "#a8714a", "#f5d7bd"], HA = ["#24321c", "#6b3d1f", "#e9a92b", "#b3261e", "#7b55d1"];
    let seq, idx, score, answered, run;
    const face = () => ({ sk: rnd(4), ha: rnd(5), hs: rnd(3), ey: rnd(3), mo: rnd(3), gl: rnd(3) === 0, be: rnd(4) === 0 });
    function drawFace(f) {
      const p = 12; c.fillStyle = "#d9e3c3"; c.fillRect(0, 0, 240, 240);
      const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x * p, y * p, w * p, h * p); };
      R(5, 5, 10, 12, SK[f.sk]);
      if (f.hs === 0) R(4, 3, 12, 3, HA[f.ha]); else if (f.hs === 1) { R(4, 3, 12, 2, HA[f.ha]); R(4, 5, 1, 8, HA[f.ha]); R(15, 5, 1, 8, HA[f.ha]); } else { R(6, 2, 8, 3, HA[f.ha]); R(5, 4, 2, 2, HA[f.ha]); R(13, 4, 2, 2, HA[f.ha]); }
      if (f.ey === 0) { R(7, 9, 2, 2, "#24321c"); R(11, 9, 2, 2, "#24321c"); } else if (f.ey === 1) { R(7, 10, 2, 1, "#24321c"); R(11, 10, 2, 1, "#24321c"); } else { R(7, 9, 1, 2, "#24321c"); R(12, 9, 1, 2, "#24321c"); }
      if (f.gl) { c.strokeStyle = "#24321c"; c.lineWidth = 3; c.strokeRect(6.5 * p, 8.5 * p, 3 * p, 3 * p); c.strokeRect(10.5 * p, 8.5 * p, 3 * p, 3 * p); }
      if (f.mo === 0) R(8, 14, 4, 1, "#b3261e"); else if (f.mo === 1) { R(8, 14, 4, 1, "#24321c"); R(7, 13, 1, 1, "#24321c"); R(12, 13, 1, 1, "#24321c"); } else R(9, 13, 2, 2, "#b3261e");
      if (f.be) R(6, 15, 8, 2, HA[f.ha]);
    }
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    function start() {
      const pool = []; seq = [];
      for (let i = 0; i < 30; i++) { if (pool.length > 2 && Math.random() < .3) seq.push(pool[rnd(pool.length)]); else { const f = face(); pool.push(f); seq.push(f); } }
      idx = -1; score = 0; run = true; $("#f-s", el).textContent = "ĐIỂM 0"; next();
    }
    function next() {
      idx++; answered = false;
      if (idx >= seq.length) { run = false; $("#f-msg", el).textContent = `Xong 30 khuôn mặt với ${score} điểm.`; c.fillStyle = "#d9e3c3"; c.fillRect(0, 0, 240, 240); return; }
      drawFace(seq[idx]); $("#f-i", el).textContent = `${idx + 1}/30`;
      T.later(2000, () => { const rep = seq.slice(0, idx).some(f => same(f, seq[idx])); if (rep && !answered) { score--; $("#f-msg", el).textContent = "Bỏ lỡ một mặt lặp lại, trừ một điểm."; $("#f-s", el).textContent = "ĐIỂM " + score; } next(); });
    }
    function hit() {
      if (!run || answered) return; answered = true; const rep = seq.slice(0, idx).some(f => same(f, seq[idx]));
      score += rep ? 1 : -1; $("#f-msg", el).textContent = rep ? "Đúng, mặt này đã gặp." : "Mặt này mới gặp lần đầu, trừ một điểm."; $("#f-s", el).textContent = "ĐIỂM " + score;
    }
    $("#f-hit", el).onclick = hit; $("#f-go", el).onclick = () => { T.clear(); start(); };
    const key = e => { if (e.code === "Space" && run) { e.preventDefault(); hit(); } }; document.addEventListener("keydown", key);
    c.fillStyle = "#d9e3c3"; c.fillRect(0, 0, 240, 240);
    return () => { T.clear(); document.removeEventListener("keydown", key); };
  } };

/* ================= ONLINE: Cờ 9 quân (Nine Men's Morris) ================= */
const MP = [[0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [3, 2], [4, 2], [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3], [2, 4], [3, 4], [4, 4], [1, 5], [3, 5], [5, 5], [0, 6], [3, 6], [6, 6]];
const MADJ = [[1, 9], [0, 2, 4], [1, 14], [4, 10], [1, 3, 5, 7], [4, 13], [7, 11], [4, 6, 8], [7, 12], [0, 10, 21], [3, 9, 11, 18], [6, 10, 15], [8, 13, 17], [5, 12, 14, 20], [2, 13, 23], [11, 16], [15, 17, 19], [12, 16], [10, 19], [16, 18, 20, 22], [13, 19], [9, 22], [19, 21, 23], [14, 22]];
const MILLS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23], [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23]];
const inMill = (b, p) => MILLS.some(m => m.includes(p) && m.every(q => b[q] === b[p]));
function morrisCanMove(s, pl) {
  if (s.hand[pl] > 0) return s.b.some(x => x === null);
  const mine = s.b.map((x, i) => x === pl ? i : -1).filter(i => i >= 0), fly = s.left[pl] === 3;
  return mine.some(i => fly ? s.b.some(x => x === null) : MADJ[i].some(j => s.b[j] === null));
}
G.morris = { kind: "online", name: "Cờ 9 quân", desc: "Cờ cổ châu Âu cho 2 người. Xếp 3 quân thẳng hàng để bắt quân đối thủ.", minP: 2, maxP: 2,
  init() { return { b: Array(24).fill(null), hand: [9, 9], left: [9, 9], turn: 0, remove: false, winner: null, last: null }; },
  move(s0, mv, seat) {
    const s = clone(s0); if (s.winner !== null) fail("Ván đã kết thúc."); if (seat !== s.turn) fail("Chưa tới lượt bạn.");
    const me = seat, op = 1 - seat;
    if (s.remove) {
      if (mv.t !== "remove" || s.b[mv.p] !== op) fail("Chọn một quân của đối thủ để bắt.");
      const all = s.b.map((x, i) => x === op ? i : -1).filter(i => i >= 0);
      if (inMill(s.b, mv.p) && !all.every(i => inMill(s.b, i))) fail("Quân đang nằm trong hàng 3, chọn quân khác.");
      s.b[mv.p] = null; s.left[op]--; s.remove = false; s.last = mv.p;
    } else if (s.hand[me] > 0) {
      if (mv.t !== "place" || s.b[mv.p] !== null) fail("Đặt quân vào một điểm trống.");
      s.b[mv.p] = me; s.hand[me]--; s.last = mv.p; if (inMill(s.b, mv.p)) { s.remove = true; return s; }
    } else {
      if (mv.t !== "move" || s.b[mv.from] !== me || s.b[mv.to] !== null) fail("Chọn quân của bạn rồi chọn điểm trống.");
      if (s.left[me] > 3 && !MADJ[mv.from].includes(mv.to)) fail("Chỉ được đi sang điểm kề bên.");
      s.b[mv.from] = null; s.b[mv.to] = me; s.last = mv.to; if (inMill(s.b, mv.to)) { s.remove = true; return s; }
    }
    s.turn = op;
    if (s.hand[op] === 0 && s.left[op] < 3) s.winner = me;
    else if (!morrisCanMove(s, op)) s.winner = me;
    return s;
  },
  view(el, ctx) {
    const s = ctx.state, my = ctx.hotseat ? s.turn : ctx.seat, P = ctx.players;
    let sel = el._sel ?? null; if (s.turn !== my) sel = null;
    const status = s.winner !== null ? `${esc(P[s.winner]?.name || "Người chơi")} thắng.` : s.remove ? `${esc(P[s.turn]?.name)} được bắt một quân.` : `Lượt của ${esc(P[s.turn]?.name)}.`;
    const pt = i => [40 + MP[i][0] * 50, 40 + MP[i][1] * 50];
    let svg = `<svg viewBox="0 0 380 380" class="mboard" role="img" aria-label="Bàn cờ 9 quân">`;
    for (const k of [0, 1, 2]) { const a = 40 + k * 50, w = 300 - k * 100; svg += `<rect x="${a}" y="${a}" width="${w}" height="${w}" fill="none" stroke="#24321c" stroke-width="3"/>`; }
    svg += `<path d="M190 40V140M190 240V340M40 190H140M240 190H340" stroke="#24321c" stroke-width="3"/>`;
    s.b.forEach((x, i) => { const [cx, cy] = pt(i); svg += `<circle data-p="${i}" cx="${cx}" cy="${cy}" r="${x === null ? 9 : 16}" fill="${x === null ? "#24321c" : x === 0 ? "#fbfbf4" : "#b3261e"}" stroke="${sel === i ? "#e9a92b" : s.last === i ? "#2f6fd6" : "#24321c"}" stroke-width="${sel === i || s.last === i ? 5 : 2}" style="cursor:pointer"/>`; });
    svg += `</svg>`;
    el.innerHTML = `<div class="score"><span>${esc(P[0]?.name)} quân trắng ${s.hand[0]} chưa đặt, còn ${s.left[0]}</span><span>${esc(P[1]?.name)} quân đỏ ${s.hand[1]} chưa đặt, còn ${s.left[1]}</span></div>${svg}<div class="msg" aria-live="polite">${status}</div>`;
    el.querySelectorAll("[data-p]").forEach(c => c.onclick = () => {
      if (s.winner !== null || s.turn !== my) return; const p = +c.dataset.p;
      if (s.remove) return ctx.send({ t: "remove", p });
      if (s.hand[my] > 0) return ctx.send({ t: "place", p });
      if (s.b[p] === my) { el._sel = p; return G.morris.view(el, ctx); }
      if (sel !== null && s.b[p] === null) { el._sel = null; ctx.send({ t: "move", from: sel, to: p }); }
    });
  } };

/* ================= ONLINE: Hổ và dê (Bagh Chal) ================= */
const BC = (() => { const adj = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const l = [], ds = [[0, 1], [1, 0], [0, -1], [-1, 0]]; if ((r + c) % 2 === 0) ds.push([1, 1], [1, -1], [-1, 1], [-1, -1]); for (const [a, b] of ds) { const x = r + a, y = c + b; if (x >= 0 && y >= 0 && x < 5 && y < 5) l.push([x * 5 + y, a, b]); } adj.push(l); } return adj; })();
function tigerMoves(b, i) { const out = []; const r = Math.floor(i / 5), c = i % 5;
  for (const [j, a, d] of BC[i]) { if (b[j] === null) out.push({ to: j }); else if (b[j] === "G") { const x = r + 2 * a, y = c + 2 * d; if (x >= 0 && y >= 0 && x < 5 && y < 5 && b[x * 5 + y] === null && BC[j].some(e => e[0] === x * 5 + y && e[1] === a && e[2] === d)) out.push({ to: x * 5 + y, cap: j }); } }
  return out; }
G.baghchal = { kind: "online", name: "Hổ và dê", desc: "Cờ cổ Nepal cho 2 người. Một bên cầm 4 hổ, một bên cầm 20 dê.", minP: 2, maxP: 2,
  init() { const b = Array(25).fill(null); [0, 4, 20, 24].forEach(i => b[i] = "T"); return { b, goatsLeft: 20, captured: 0, turn: 0, winner: null, last: null }; },
  move(s0, mv, seat) {
    const s = clone(s0); if (s.winner !== null) fail("Ván đã kết thúc."); if (seat !== s.turn) fail("Chưa tới lượt bạn.");
    if (seat === 0) { // goats
      if (s.goatsLeft > 0) { if (mv.t !== "place" || s.b[mv.p] !== null) fail("Đặt dê vào một điểm trống."); s.b[mv.p] = "G"; s.goatsLeft--; s.last = mv.p; }
      else { if (mv.t !== "move" || s.b[mv.from] !== "G" || s.b[mv.to] !== null || !BC[mv.from].some(e => e[0] === mv.to)) fail("Dê chỉ đi sang điểm kề bên theo đường kẻ."); s.b[mv.from] = null; s.b[mv.to] = "G"; s.last = mv.to; }
    } else {
      if (mv.t !== "move" || s.b[mv.from] !== "T") fail("Chọn một con hổ."); const m = tigerMoves(s.b, mv.from).find(x => x.to === mv.to); if (!m) fail("Hổ không đi tới điểm đó được.");
      s.b[mv.from] = null; s.b[mv.to] = "T"; s.last = mv.to; if (m.cap !== undefined) { s.b[m.cap] = null; s.captured++; }
    }
    s.turn = 1 - s.turn;
    if (s.captured >= 5) s.winner = 1;
    else if (!s.b.some((x, i) => x === "T" && tigerMoves(s.b, i).length)) s.winner = 0;
    return s;
  },
  view(el, ctx) {
    const s = ctx.state, my = ctx.hotseat ? s.turn : ctx.seat, P = ctx.players; let sel = s.turn === my ? el._sel ?? null : null;
    const pt = i => [40 + (i % 5) * 75, 40 + Math.floor(i / 5) * 75];
    let svg = `<svg viewBox="0 0 380 380" class="mboard" role="img" aria-label="Bàn cờ hổ và dê">`;
    BC.forEach((l, i) => l.forEach(([j]) => { if (j > i) { const [a, b] = pt(i), [c, d] = pt(j); svg += `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="#24321c" stroke-width="2"/>`; } }));
    const hints = sel !== null && s.b[sel] === "T" ? tigerMoves(s.b, sel).map(x => x.to) : sel !== null ? BC[sel].filter(e => s.b[e[0]] === null).map(e => e[0]) : [];
    s.b.forEach((x, i) => { const [cx, cy] = pt(i); svg += `<g data-p="${i}" style="cursor:pointer"><circle cx="${cx}" cy="${cy}" r="${x ? 20 : 10}" fill="${x === "T" ? "#e9a92b" : x === "G" ? "#fbfbf4" : hints.includes(i) ? "#2f6fd6" : "#24321c"}" stroke="${sel === i ? "#b3261e" : s.last === i ? "#2f6fd6" : "#24321c"}" stroke-width="${sel === i || s.last === i ? 5 : 2}"/>${x ? `<text x="${cx}" y="${cy + 7}" text-anchor="middle" font-family="VT323" font-size="24" fill="#24321c">${x === "T" ? "HỔ" : "DÊ"}</text>` : ""}</g>`; });
    svg += `</svg>`;
    const status = s.winner !== null ? `${esc(P[s.winner]?.name)} thắng.` : `Lượt của ${esc(P[s.turn]?.name)} cầm ${s.turn === 0 ? "dê" : "hổ"}.`;
    el.innerHTML = `<div class="score"><span>DÊ ${esc(P[0]?.name)}, còn ${s.goatsLeft} chưa đặt</span><span>HỔ ${esc(P[1]?.name)}, bắt ${s.captured}/5</span></div>${svg}<div class="msg" aria-live="polite">${status}</div>`;
    el.querySelectorAll("[data-p]").forEach(g => g.onclick = () => {
      if (s.winner !== null || s.turn !== my) return; const p = +g.dataset.p;
      if (my === 0 && s.goatsLeft > 0) return ctx.send({ t: "place", p });
      const mine = my === 0 ? "G" : "T";
      if (s.b[p] === mine) { el._sel = p; return G.baghchal.view(el, ctx); }
      if (sel !== null && s.b[p] === null) { el._sel = null; ctx.send({ t: "move", from: sel, to: p }); }
    });
  } };

/* ================= ONLINE: Cờ caro mù ================= */
const GN = 11;
function five(b, p, who) { const r = Math.floor(p / GN), c = p % GN; for (const [a, d] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { let k = 1; for (const sg of [1, -1]) { let x = r + a * sg, y = c + d * sg; while (x >= 0 && y >= 0 && x < GN && y < GN && b[x * GN + y] === who) { k++; x += a * sg; y += d * sg; } } if (k >= 5) return true; } return false; }
G.gomoku = { kind: "online", name: "Cờ caro mù", desc: "Caro 5 quân cho 2 người, nhưng mọi quân trên bàn đều cùng màu. Phải nhớ quân nào của mình.", minP: 2, maxP: 2,
  init() { return { b: Array(GN * GN).fill(null), turn: 0, winner: null, last: null, n: 0, blind: true }; },
  move(s0, mv, seat) {
    const s = clone(s0); if (s.winner !== null) fail("Ván đã kết thúc."); if (seat !== s.turn) fail("Chưa tới lượt bạn.");
    if (mv.t === "reveal") { s.blind = false; return s; }
    if (s.b[mv.p] !== null) { s.turn = 1 - seat; s.lostTurn = seat; return s; } // đặt trúng ô có quân thì mất lượt
    s.b[mv.p] = seat; s.last = mv.p; s.n++; s.lostTurn = null;
    if (five(s.b, mv.p, seat)) { s.winner = seat; s.blind = false; } else if (s.n >= GN * GN) s.winner = -1;
    s.turn = 1 - seat; return s;
  },
  view(el, ctx) {
    const s = ctx.state, my = ctx.hotseat ? s.turn : ctx.seat, P = ctx.players;
    let h = `<div class="gboard" style="grid-template-columns:repeat(${GN},minmax(0,1fr))">`;
    s.b.forEach((x, i) => { const col = x === null ? "" : s.blind ? "stone grey" : x === 0 ? "stone white" : "stone red"; h += `<button class="gp ${s.last === i ? "last" : ""}" data-p="${i}" aria-label="Ô ${i + 1}"><span class="${col}"></span></button>`; });
    h += `</div>`;
    const status = s.winner === -1 ? "Hòa, bàn đã kín." : s.winner !== null ? `${esc(P[s.winner]?.name)} xếp đủ 5 quân và thắng.` : (s.lostTurn !== null && s.lostTurn !== undefined ? `${esc(P[s.lostTurn]?.name)} đặt vào ô đã có quân nên mất lượt. ` : "") + `Lượt của ${esc(P[s.turn]?.name)}.`;
    el.innerHTML = `<div class="score"><span>${esc(P[0]?.name)} đi trước</span><span>${s.n} QUÂN</span><span>${esc(P[1]?.name)} đi sau</span></div>${h}<div class="msg" aria-live="polite">${status}</div>`;
    el.querySelectorAll(".gp").forEach(b => b.onclick = () => { if (s.winner === null && s.turn === my) ctx.send({ t: "place", p: +b.dataset.p }); });
  } };

/* ================= ONLINE: Lớn hay nhỏ ================= */
G.bigsmall = { kind: "online", name: "Lớn hay nhỏ", desc: "Hai người thay phiên ra bài úp và đoán lớn nhỏ so với bài nhà cái. Ai nhiều chip hơn sau 18 vòng thì thắng.", minP: 2, maxP: 2,
  init() { const d = []; for (let k = 0; k < 2; k++) for (let v = 1; v <= 9; v++) d.push(v); return { dealer: shuffle(d), hands: {0:[0,1,2,3,4,5,6,7,8,9,10], 1:[0,1,2,3,4,5,6,7,8,9,10]}, chips: [10, 10], round: 0, phase: "pick", card: null, log: [], winner: null, turn: 0 }; },
  move(s0, mv, seat) {
    const s = clone(s0); if (s.winner !== null) fail("Ván đã kết thúc.");
    const cont = s.round % 2, bet = 1 - cont;
    if (s.phase === "pick") { if (seat !== cont) fail("Chưa tới lượt bạn."); if (!s.hands[cont].includes(mv.card)) fail("Bạn không còn lá đó."); s.card = mv.card; s.hands[cont] = s.hands[cont].filter(x => x !== mv.card); s.phase = "bet"; s.turn = bet; return s; }
    if (seat !== bet) fail("Chưa tới lượt bạn."); const amt = Math.floor(mv.amt);
    if (!(amt >= 1 && amt <= Math.min(s.chips[bet], s.chips[cont]))) fail("Số chip cược không hợp lệ."); if (mv.guess !== "big" && mv.guess !== "small") fail("Chọn Lớn hoặc Nhỏ.");
    const dv = s.dealer[s.round], res = s.card > dv ? "big" : s.card < dv ? "small" : "draw";
    let line = `Vòng ${s.round + 1}, nhà cái ${dv}, bài úp ${s.card}. `;
    if (res === "draw") line += "Bằng nhau, không ai mất chip.";
    else if (res === mv.guess) { s.chips[bet] += amt; s.chips[cont] -= amt; line += `Đoán đúng, người đoán nhận ${amt} chip.`; }
    else { s.chips[bet] -= amt; s.chips[cont] += amt; line += `Đoán sai, người ra bài nhận ${amt} chip.`; }
    s.log.unshift(line); s.round++; s.card = null; s.phase = "pick"; s.turn = s.round % 2;
    if (s.round >= 18 || s.chips.some(c => c <= 0)) s.winner = s.chips[0] === s.chips[1] ? -1 : s.chips[0] > s.chips[1] ? 0 : 1;
    return s;
  },
  view(el, ctx) {
    const s = ctx.state, my = ctx.hotseat ? s.turn : ctx.seat, P = ctx.players, cont = s.round % 2, bet = 1 - cont;
    const head = `<div class="score"><span>${esc(P[0]?.name)} ${s.chips[0]} CHIP</span><span>VÒNG ${Math.min(s.round + 1, 18)}/18</span><span>${esc(P[1]?.name)} ${s.chips[1]} CHIP</span></div>`;
    if (s.winner !== null) { el.innerHTML = head + `<div class="msg">${s.winner === -1 ? "Hòa chip." : esc(P[s.winner]?.name) + " thắng."}</div><div class="log">${s.log.map(esc).join("<br>")}</div>`; return; }
    const dv = s.dealer[s.round];
    let body = `<div class="comm"><div class="pc">${dv}</div>${s.phase === "bet" ? `<div class="pc down"></div>` : ""}</div>`;
    if (s.phase === "pick") {
      body += my === cont ? `<div class="msg">${ctx.hotseat ? esc(P[cont]?.name) + " cầm máy, người kia nhìn đi chỗ khác. " : ""}Chọn một lá úp.</div><div class="lcdrow">${s.hands[cont].map(v => `<button class="lcdbtn" data-c="${v}">${v}</button>`).join("")}</div>` : `<div class="msg">${esc(P[cont]?.name)} đang chọn lá úp.</div>`;
    } else {
      const max = Math.min(s.chips[bet], s.chips[cont]);
      body += my === bet ? `<div class="msg">${ctx.hotseat ? "Chuyền máy cho " + esc(P[bet]?.name) + ". " : ""}Lá úp lớn hơn hay nhỏ hơn ${dv}.</div><div class="lcdrow"><input class="lcdinput" id="bs-amt" type="number" min="1" max="${max}" value="1" aria-label="Số chip cược"><button class="lcdbtn" data-g="big">LỚN</button><button class="lcdbtn" data-g="small">NHỎ</button></div>` : `<div class="msg">${esc(P[bet]?.name)} đang đoán.</div>`;
    }
    el.innerHTML = head + body + `<div class="log">${s.log.slice(0, 4).map(esc).join("<br>")}</div>`;
    el.querySelectorAll("[data-c]").forEach(b => b.onclick = () => ctx.send({ card: +b.dataset.c }));
    el.querySelectorAll("[data-g]").forEach(b => b.onclick = () => ctx.send({ guess: b.dataset.g, amt: +$("#bs-amt", el).value }));
  } };

window.TLC_GAMES = G;
window.TLC_HELPERS = { esc, handValue, cmp };
})();
