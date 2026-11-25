/* Play with Zile — trò giải đố một mình: Sudoku, Truy án ô vuông (kiểu Murdoku), Ô chữ.
   Gắn thêm vào window.TLC_GAMES, file này phải nạp sau games.js và trước app.js. */
(function () {
const G = window.TLC_GAMES;
const { esc } = window.TLC_HELPERS;
const $ = (s, r = document) => r.querySelector(s);
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ================= SOLO: Sudoku ================= */
const SD_LEVELS = { de: { name: "Dễ", keep: 40 }, vua: { name: "Vừa", keep: 32 }, kho: { name: "Khó", keep: 25 } };
const box = i => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);
// Đếm số lời giải, dừng khi đạt limit. Nếu fill = true thì điền lời giải ngẫu nhiên đầu tiên vào g.
function sdSolve(g, limit, fill) {
  const R = Array(9).fill(0), C = Array(9).fill(0), B = Array(9).fill(0);
  for (let i = 0; i < 81; i++) if (g[i]) { const b = 1 << g[i]; R[Math.floor(i / 9)] |= b; C[i % 9] |= b; B[box(i)] |= b; }
  let count = 0;
  const rec = () => {
    let best = -1, bestMask = 0, bestN = 10;
    for (let i = 0; i < 81; i++) if (!g[i]) {
      const m = ~(R[Math.floor(i / 9)] | C[i % 9] | B[box(i)]) & 0x3fe;
      let n = 0; for (let x = m; x; x &= x - 1) n++;
      if (n < bestN) { best = i; bestMask = m; bestN = n; if (n === 0) return false; }
    }
    if (best < 0) { count++; return count >= limit; }
    const digits = []; for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
    if (fill) shuffle(digits);
    const r = Math.floor(best / 9), c = best % 9, b = box(best);
    for (const d of digits) {
      const bit = 1 << d; g[best] = d; R[r] |= bit; C[c] |= bit; B[b] |= bit;
      if (rec()) { if (!fill) g[best] = 0; return true; }
      g[best] = 0; R[r] &= ~bit; C[c] &= ~bit; B[b] &= ~bit;
    }
    return false;
  };
  rec();
  return count;
}
function sdMake(level) {
  const sol = Array(81).fill(0); sdSolve(sol, 1, true);
  const puz = sol.slice(), keep = SD_LEVELS[level].keep;
  let left = 81;
  for (const i of shuffle([...Array(81).keys()])) {
    if (left <= keep) break;
    const v = puz[i]; puz[i] = 0;
    if (sdSolve(puz.slice(), 2, false) !== 1) puz[i] = v; else left--;
  }
  return { sol, puz };
}
G.sudoku = { kind: "solo", name: "Sudoku", desc: "Điền số từ 1 đến 9 vào bảng 9 x 9. Mỗi hàng, mỗi cột và mỗi khối 3 x 3 có đủ 9 số, không số nào lặp lại.",
  mount(el) {
    el.innerHTML = `<div class="score"><span id="sd-lv">MỨC VỪA</span><span id="sd-t">00:00</span><span id="sd-err">0 LỖI</span></div>
      <div class="sdk" id="sd-b" role="grid" aria-label="Bảng Sudoku"></div>
      <div class="sdpad" id="sd-pad">${[1,2,3,4,5,6,7,8,9].map(d => `<button class="lcdbtn" data-d="${d}">${d}</button>`).join("")}<button class="lcdbtn" data-d="0">XÓA</button></div>
      <div class="lcdrow"><button class="lcdbtn" id="sd-note" aria-pressed="false">GHI CHÚ: TẮT</button><button class="lcdbtn" id="sd-hint">GỢI Ý 1 Ô</button><button class="lcdbtn" id="sd-undo">HOÀN TÁC</button></div>
      <div class="lcdrow">${Object.entries(SD_LEVELS).map(([k, v]) => `<button class="lcdbtn" data-lv="${k}">VÁN MỚI ${v.name.toUpperCase()}</button>`).join("")}</div>
      <div class="msg" id="sd-msg" aria-live="polite">Chọn một ô rồi bấm số. Bật ghi chú để viết nháp nhiều số nhỏ trong một ô.</div>`;
    const T = { list: [] }, clear = () => T.list.forEach(clearInterval);
    let s, sel = -1, noteMode = false, history = [];
    const KEY = "tlc-sudoku";
    function fresh(level) {
      $("#sd-msg", el).textContent = "Đang tạo bảng mới.";
      setTimeout(() => {
        const { sol, puz } = sdMake(level);
        s = { level, sol, puz, val: puz.slice(), notes: Array(81).fill(0), err: 0, sec: 0, done: false };
        sel = -1; history = []; save(); draw();
        $("#sd-msg", el).textContent = `Bảng ${SD_LEVELS[level].name.toLowerCase()} có ${puz.filter(Boolean).length} số cho sẵn.`;
      }, 20);
    }
    const save = () => store.set(KEY, s);
    function draw() {
      if (!s) return;
      const b = $("#sd-b", el), sv = sel >= 0 ? s.val[sel] : 0;
      const conflict = i => { const v = s.val[i]; if (!v) return false; for (let j = 0; j < 81; j++) if (j !== i && s.val[j] === v && (Math.floor(j / 9) === Math.floor(i / 9) || j % 9 === i % 9 || box(j) === box(i))) return true; return false; };
      b.innerHTML = s.val.map((v, i) => {
        const cls = ["sdc"]; if (s.puz[i]) cls.push("given"); if (i === sel) cls.push("sel");
        else if (sel >= 0 && (Math.floor(i / 9) === Math.floor(sel / 9) || i % 9 === sel % 9 || box(i) === box(sel))) cls.push("peer");
        if (v && sv && v === sv && i !== sel) cls.push("same");
        if (!s.puz[i] && v && (v !== s.sol[i] || conflict(i))) cls.push("bad");
        if (i % 9 === 2 || i % 9 === 5) cls.push("br"); if (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5) cls.push("bb");
        const inner = v ? v : s.notes[i] ? `<span class="nt">${[1,2,3,4,5,6,7,8,9].map(d => `<i>${s.notes[i] & (1 << d) ? d : ""}</i>`).join("")}</span>` : "";
        return `<button class="${cls.join(" ")}" data-i="${i}" aria-label="Hàng ${Math.floor(i / 9) + 1} cột ${i % 9 + 1}${v ? ", số " + v : ", trống"}">${inner}</button>`;
      }).join("");
      $("#sd-lv", el).textContent = "MỨC " + SD_LEVELS[s.level].name.toUpperCase();
      $("#sd-err", el).textContent = s.err + " LỖI"; $("#sd-t", el).textContent = mmss(s.sec);
      el.querySelectorAll("#sd-pad [data-d]").forEach(btn => { const d = +btn.dataset.d; if (d) btn.disabled = s.val.filter(x => x === d).length >= 9; });
    }
    function put(d) {
      if (!s || s.done || sel < 0 || s.puz[sel]) return;
      history.push({ i: sel, v: s.val[sel], n: s.notes[sel] }); if (history.length > 200) history.shift();
      if (d === 0) { s.val[sel] = 0; s.notes[sel] = 0; }
      else if (noteMode && !s.val[sel]) s.notes[sel] ^= 1 << d;
      else {
        s.val[sel] = s.val[sel] === d ? 0 : d; s.notes[sel] = 0;
        if (s.val[sel] && s.val[sel] !== s.sol[sel]) { s.err++; $("#sd-msg", el).textContent = `Số ${d} chưa đúng ở ô này.`; }
        else if (s.val[sel]) {
          // điền đúng thì xóa ghi chú số đó ở các ô cùng hàng, cột, khối
          for (let j = 0; j < 81; j++) if (Math.floor(j / 9) === Math.floor(sel / 9) || j % 9 === sel % 9 || box(j) === box(sel)) s.notes[j] &= ~(1 << d);
          $("#sd-msg", el).textContent = "";
        }
      }
      if (s.val.every((v, i) => v === s.sol[i])) { s.done = true; $("#sd-msg", el).textContent = `Xong bảng ${SD_LEVELS[s.level].name.toLowerCase()} trong ${mmss(s.sec)} với ${s.err} lỗi.`; }
      save(); draw();
    }
    el.addEventListener("click", e => {
      const c = e.target.closest(".sdc"); if (c) { sel = +c.dataset.i; draw(); return; }
      const d = e.target.closest("[data-d]"); if (d) { put(+d.dataset.d); return; }
      const lv = e.target.closest("[data-lv]"); if (lv) fresh(lv.dataset.lv);
    });
    $("#sd-note", el).onclick = e => { noteMode = !noteMode; e.target.textContent = "GHI CHÚ: " + (noteMode ? "BẬT" : "TẮT"); e.target.setAttribute("aria-pressed", String(noteMode)); };
    $("#sd-undo", el).onclick = () => { const h = history.pop(); if (!h || !s || s.done) return; s.val[h.i] = h.v; s.notes[h.i] = h.n; sel = h.i; save(); draw(); };
    $("#sd-hint", el).onclick = () => {
      if (!s || s.done) return;
      let i = sel >= 0 && !s.puz[sel] && s.val[sel] !== s.sol[sel] ? sel : -1;
      if (i < 0) { const empty = s.val.map((v, j) => v !== s.sol[j] ? j : -1).filter(j => j >= 0); if (!empty.length) return; i = empty[rnd(empty.length)]; }
      sel = i; noteMode = false; $("#sd-note", el).textContent = "GHI CHÚ: TẮT"; put(s.sol[i]); s.err = Math.max(0, s.err); save(); draw();
      if (!s.done) $("#sd-msg", el).textContent = `Đã mở ô hàng ${Math.floor(i / 9) + 1} cột ${i % 9 + 1}.`;
    };
    const onKey = e => {
      if (!s || e.target.closest("input, textarea, select")) return;
      if (/^[1-9]$/.test(e.key)) { put(+e.key); e.preventDefault(); }
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") { put(0); e.preventDefault(); }
      else if (e.key.startsWith("Arrow")) {
        if (sel < 0) sel = 0; else { const r = Math.floor(sel / 9), c = sel % 9;
          sel = e.key === "ArrowUp" ? ((r + 8) % 9) * 9 + c : e.key === "ArrowDown" ? ((r + 1) % 9) * 9 + c : e.key === "ArrowLeft" ? r * 9 + (c + 8) % 9 : r * 9 + (c + 1) % 9; }
        draw(); e.preventDefault();
      } else if (e.key === "n" || e.key === "N") $("#sd-note", el).click();
    };
    document.addEventListener("keydown", onKey);
    T.list.push(setInterval(() => { if (s && !s.done && !document.hidden) { s.sec++; $("#sd-t", el).textContent = mmss(s.sec); if (s.sec % 10 === 0) save(); } }, 1000));
    const old = store.get(KEY);
    if (old && old.sol && !old.done) { s = old; draw(); $("#sd-msg", el).textContent = "Đang chơi tiếp ván lần trước."; } else fresh("vua");
    return () => { clear(); document.removeEventListener("keydown", onKey); if (s) save(); };
  } };

/* ================= SOLO: Truy án ô vuông (giải đố kiểu Murdoku) ================= */
const MD_ROOMS = ["Bếp", "Phòng khách", "Thư viện", "Phòng ngủ", "Vườn", "Hầm rượu"];
const MD_COLORS = ["#f3cf9a", "#c9e0a6", "#b4d3ea", "#ebbfd3", "#d4c8ef", "#a9ddd2"];
const MD_PEOPLE = [
  { name: "An", col: "#2f6fd6" }, { name: "Bình", col: "#1e9c8f" }, { name: "Chi", col: "#7b55d1" },
  { name: "Dũng", col: "#c26b12" }, { name: "Giang", col: "#566012" }
];
const MD_VICTIM = { name: "Lâm", col: "#c23b3b" };
// Đồ vật: block = không ai đứng được ở ô đó.
const MD_OBJ = {
  cay: { icon: "🪴", label: "chậu cây", block: true, near: "sát một chậu cây" },
  tu: { icon: "🗄️", label: "tủ", block: true, near: "sát một cái tủ" },
  ghe: { icon: "🪑", label: "ghế", block: false, on: "ngồi trên ghế", near: "sát một cái ghế" },
  tham: { icon: "", label: "thảm", block: false, on: "đứng trên thảm", near: "sát một tấm thảm" }
};
const COLS = "ABCDEF";
function mdRooms(n) {
  for (let t = 0; t < 400; t++) {
    const room = Array(n * n).fill(-1), seeds = shuffle([...Array(n * n).keys()]).slice(0, n);
    seeds.forEach((c, k) => room[c] = k);
    const nb = i => [i - n, i + n, i % n ? i - 1 : -1, (i + 1) % n ? i + 1 : -1].filter(j => j >= 0 && j < n * n);
    let left = n * n - n, guard = 0;
    while (left && guard++ < 5000) {
      const sizes = Array(n).fill(0); room.forEach(r => r >= 0 && sizes[r]++);
      const order = [...Array(n).keys()].sort((a, b) => sizes[a] - sizes[b] + (Math.random() - .5) * 3);
      for (const k of order) {
        const front = []; room.forEach((r, i) => { if (r === k) nb(i).forEach(j => room[j] < 0 && front.push(j)); });
        if (front.length) { room[front[rnd(front.length)]] = k; left--; break; }
      }
    }
    const sizes = Array(n).fill(0); room.forEach(r => r >= 0 && sizes[r]++);
    if (!left && sizes.every(z => z >= 3 && z <= n + 3)) return room;
  }
  return null;
}
function mdCheck(cl, pos, P) {
  const a = pos[cl.p], b = cl.q !== undefined ? pos[cl.q] : null;
  if (!a || (cl.q !== undefined && !b)) return true; // chưa đặt đủ thì chưa xét
  const cell = a.r * P.n + a.c, room = P.room[cell];
  switch (cl.t) {
    case "in": return room === cl.room;
    case "notin": return room !== cl.room;
    case "on": return P.obj[cell] === cl.obj;
    case "near": return P.nbr(cell).some(j => P.obj[j] === cl.obj);
    case "row": return a.r === cl.v;
    case "col": return a.c === cl.v;
    case "same": return room === P.room[b.r * P.n + b.c];
    case "diff": return room !== P.room[b.r * P.n + b.c];
    case "above": return a.r < b.r;
    case "left": return a.c < b.c;
  }
  return true;
}
function mdText(cl, P) {
  const nm = i => P.people[i].name;
  switch (cl.t) {
    case "in": return `${nm(cl.p)} ở trong ${MD_ROOMS[cl.room].toLowerCase()}.`;
    case "notin": return `${nm(cl.p)} không ở ${MD_ROOMS[cl.room].toLowerCase()}.`;
    case "on": return `${nm(cl.p)} ${MD_OBJ[cl.obj].on}.`;
    case "near": return `${nm(cl.p)} đứng ${MD_OBJ[cl.obj].near}.`;
    case "row": return `${nm(cl.p)} ở hàng ${cl.v + 1}.`;
    case "col": return `${nm(cl.p)} ở cột ${COLS[cl.v]}.`;
    case "same": return `${nm(cl.p)} và ${nm(cl.q)} ở cùng một phòng.`;
    case "diff": return `${nm(cl.p)} và ${nm(cl.q)} ở hai phòng khác nhau.`;
    case "above": return `${nm(cl.p)} đứng ở hàng cao hơn ${nm(cl.q)}.`;
    case "left": return `${nm(cl.p)} đứng ở cột bên trái ${nm(cl.q)}.`;
  }
  return "";
}
// Đếm số cách xếp người thỏa mọi gợi ý và luật, dừng ở limit.
function mdCount(P, clues, limit) {
  const n = P.n, V = n - 1, pos = Array(n).fill(null), usedR = Array(n).fill(false), usedC = Array(n).fill(false);
  const uni = clues.filter(c => c.q === undefined), bin = clues.filter(c => c.q !== undefined);
  const cand = [...Array(n).keys()].map(p => {
    const out = [];
    for (let i = 0; i < n * n; i++) if (!(P.obj[i] && MD_OBJ[P.obj[i]].block)) {
      const pp = []; pp[p] = { r: Math.floor(i / n), c: i % n };
      if (uni.every(cl => cl.p !== p || mdCheck(cl, pp, P))) out.push(pp[p]);
    }
    return out;
  });
  const order = [...Array(n).keys()].sort((a, b) => cand[a].length - cand[b].length);
  let count = 0;
  const victimOk = () => { const vr = P.room[pos[V].r * n + pos[V].c]; return pos.filter((q, i) => i !== V && P.room[q.r * n + q.c] === vr).length === 1; };
  const rec = k => {
    if (k === n) { if (victimOk()) count++; return count >= limit; }
    const p = order[k];
    for (const x of cand[p]) {
      if (usedR[x.r] || usedC[x.c]) continue;
      pos[p] = x; usedR[x.r] = usedC[x.c] = true;
      if (bin.every(cl => (cl.p !== p && cl.q !== p) || mdCheck(cl, pos, P)) && rec(k + 1)) return true;
      usedR[x.r] = usedC[x.c] = false; pos[p] = null;
    }
    return false;
  };
  rec(0);
  return count;
}
function mdMake(n) {
  for (let t = 0; t < 60; t++) {
    const room = mdRooms(n); if (!room) continue;
    const obj = Array(n * n).fill("");
    const cells = shuffle([...Array(n * n).keys()]);
    const kinds = shuffle(["cay", "cay", "tu", "ghe", "ghe", "ghe", "tham", "tham", ...(n > 5 ? ["tu", "ghe", "tham"] : [])]);
    kinds.forEach((k, i) => obj[cells[i]] = k);
    const people = [...MD_PEOPLE.slice(0, n - 1), MD_VICTIM];
    const P = { n, room, obj, people, nbr: i => [i - n, i + n, i % n ? i - 1 : -1, (i + 1) % n ? i + 1 : -1].filter(j => j >= 0 && j < n * n) };
    // xếp người: mỗi hàng một người, mỗi cột một người, không đứng trên đồ chắn
    let sol = null;
    for (let k = 0; k < 200 && !sol; k++) {
      const rows = shuffle([...Array(n).keys()]), cols = shuffle([...Array(n).keys()]);
      const s = rows.map((r, p) => ({ r, c: cols[p] }));
      if (s.some(x => obj[x.r * n + x.c] && MD_OBJ[obj[x.r * n + x.c]].block)) continue;
      const vr = room[s[n - 1].r * n + s[n - 1].c];
      if (s.filter((x, p) => p < n - 1 && room[x.r * n + x.c] === vr).length !== 1) continue;
      sol = s;
    }
    if (!sol) continue;
    const V = n - 1, cellOf = p => sol[p].r * n + sol[p].c;
    // mọi gợi ý đúng với lời giải
    const pool = [];
    for (let p = 0; p < n; p++) {
      const c = cellOf(p);
      pool.push({ t: "in", p, room: room[c], w: 3 });
      for (let k = 0; k < n; k++) if (k !== room[c]) pool.push({ t: "notin", p, room: k, w: 1 });
      if (obj[c] && !MD_OBJ[obj[c]].block) pool.push({ t: "on", p, obj: obj[c], w: 3 });
      new Set(P.nbr(c).map(j => obj[j]).filter(Boolean)).forEach(o => pool.push({ t: "near", p, obj: o, w: 2 }));
      pool.push({ t: "row", p, v: sol[p].r, w: 0.4 }, { t: "col", p, v: sol[p].c, w: 0.4 });
      for (let q = 0; q < n; q++) if (q !== p) {
        if (p !== V && q !== V && p < q) pool.push({ t: room[c] === room[cellOf(q)] ? "same" : "diff", p, q, w: 1.5 });
        if (sol[p].r < sol[q].r) pool.push({ t: "above", p, q, w: 1 });
        if (sol[p].c < sol[q].c) pool.push({ t: "left", p, q, w: 1 });
      }
    }
    pool.forEach(x => x.k = Math.random() * x.w); pool.sort((a, b) => b.k - a.k);
    const clues = [];
    for (const cl of pool) {
      clues.push(cl);
      if (mdCount(P, clues, 2) === 1) break;
      if (clues.length > n * 3) break;
    }
    if (mdCount(P, clues, 2) !== 1) continue;
    for (let i = clues.length - 1; i >= 0; i--) { const rest = clues.filter((_, j) => j !== i); if (mdCount(P, rest, 2) === 1) clues.splice(i, 1); }
    if (clues.length > n + 4) continue;
    const vr = room[cellOf(V)], killer = sol.findIndex((x, p) => p !== V && room[x.r * n + x.c] === vr);
    shuffle(clues);
    return { n, room, obj, sol, killer, clues: clues.map(({ w, k, ...c }) => c) };
  }
  return null;
}
G.murdoku = { kind: "solo", name: "Truy án ô vuông", desc: "Giải đố kiểu Murdoku. Xếp từng người vào sơ đồ căn nhà theo lời khai, mỗi hàng và mỗi cột có đúng một người. Xếp xong thì chỉ ra hung thủ.",
  mount(el) {
    el.innerHTML = `<div class="score"><span id="md-n">NHÀ 6 x 6</span><span id="md-t">00:00</span></div>
      <div class="mdwrap"><div class="mdk" id="md-b" aria-label="Sơ đồ căn nhà"></div>
        <div class="mdside"><div class="mdppl" id="md-ppl"></div><ol class="mdclues" id="md-cl"></ol><div class="mdleg" id="md-leg"></div></div></div>
      <div class="lcdrow"><button class="lcdbtn" id="md-x" aria-pressed="false">ĐÁNH DẤU X: TẮT</button><button class="lcdbtn" id="md-ok">KIỂM TRA</button><button class="lcdbtn" id="md-show">XEM LỜI GIẢI</button></div>
      <div class="lcdrow" id="md-acc"></div>
      <div class="lcdrow"><button class="lcdbtn" data-n="5">VÁN MỚI 5 x 5</button><button class="lcdbtn" data-n="6">VÁN MỚI 6 x 6</button></div>
      <div class="msg" id="md-msg" aria-live="polite"></div>`;
    let P = null, n = 6, place = [], marks = new Set(), cur = 0, xMode = false, accused = -1, done = false, sec = 0;
    const T = setInterval(() => { if (P && !done && !document.hidden) { sec++; $("#md-t", el).textContent = mmss(sec); } }, 1000);
    const people = () => [...MD_PEOPLE.slice(0, n - 1), MD_VICTIM];
    function fresh(size) {
      n = size; $("#md-msg", el).textContent = "Đang dựng hiện trường.";
      setTimeout(() => {
        P = mdMake(n); if (!P) { $("#md-msg", el).textContent = "Chưa tạo được vụ án, bấm ván mới lần nữa."; return; }
        P.people = people(); P.nbr = i => [i - n, i + n, i % n ? i - 1 : -1, (i + 1) % n ? i + 1 : -1].filter(j => j >= 0 && j < n * n);
        place = Array(n).fill(-1); marks = new Set(); cur = 0; accused = -1; done = false; sec = 0;
        draw(); $("#md-msg", el).textContent = `Nạn nhân là ${MD_VICTIM.name}. Trong phòng của ${MD_VICTIM.name} chỉ có thêm một người, đó là hung thủ.`;
      }, 20);
    }
    function draw() {
      const ppl = P.people, b = $("#md-b", el);
      $("#md-n", el).textContent = `NHÀ ${n} x ${n}`;
      b.style.gridTemplateColumns = `22px repeat(${n}, minmax(0, 1fr))`;
      let h = `<span></span>` + [...Array(n).keys()].map(c => `<span class="mdh">${COLS[c]}</span>`).join("");
      for (let r = 0; r < n; r++) {
        h += `<span class="mdh">${r + 1}</span>`;
        for (let c = 0; c < n; c++) {
          const i = r * n + c, rm = P.room[i], o = P.obj[i], who = place.indexOf(i);
          const bd = [r === 0 || P.room[i - n] !== rm, c === n - 1 || P.room[i + 1] !== rm, r === n - 1 || P.room[i + n] !== rm, c === 0 || P.room[i - 1] !== rm].map(x => x ? "3px solid #24321c" : "1px dashed rgba(36,50,28,.35)");
          const blk = o && MD_OBJ[o].block;
          h += `<button class="mdc${o === "tham" ? " rug" : ""}${blk ? " blk" : ""}" data-i="${i}" style="background-color:${MD_COLORS[rm]};border-top:${bd[0]};border-right:${bd[1]};border-bottom:${bd[2]};border-left:${bd[3]}" aria-label="Ô ${COLS[c]}${r + 1}, ${MD_ROOMS[rm]}${o ? ", " + MD_OBJ[o].label : ""}${who >= 0 ? ", " + ppl[who].name : ""}">
            ${o && MD_OBJ[o].icon ? `<span class="mdo">${MD_OBJ[o].icon}</span>` : ""}${who >= 0 ? `<span class="mdp" style="background:${ppl[who].col}">${esc(ppl[who].name[0])}</span>` : marks.has(i) ? `<span class="mdx">×</span>` : ""}</button>`;
        }
      }
      b.innerHTML = h;
      $("#md-ppl", el).innerHTML = ppl.map((p, k) => `<button class="mdchip${k === cur && !xMode ? " on" : ""}" data-p="${k}" style="--pc:${p.col}"><span class="mdp" style="background:${p.col}">${esc(p.name[0])}</span>${esc(p.name)}${k === n - 1 ? " · nạn nhân" : ""}${place[k] >= 0 ? ` · ${COLS[place[k] % n]}${Math.floor(place[k] / n) + 1}` : ""}</button>`).join("");
      $("#md-cl", el).innerHTML = P.clues.map(cl => `<li>${esc(mdText(cl, P))}</li>`).join("");
      $("#md-leg", el).innerHTML = MD_ROOMS.slice(0, n).map((r, k) => `<span><i style="background:${MD_COLORS[k]}"></i>${esc(r)}</span>`).join("") +
        Object.values(MD_OBJ).map(o => `<span>${o.icon ? o.icon : `<i class="rug"></i>`} ${esc(o.label)}${o.block ? ", không đứng được" : ""}</span>`).join("");
      $("#md-acc", el).innerHTML = `<span class="small">HUNG THỦ LÀ</span>` + ppl.slice(0, n - 1).map((p, k) => `<button class="lcdbtn${accused === k ? " on" : ""}" data-a="${k}" aria-pressed="${accused === k}">${esc(p.name.toUpperCase())}</button>`).join("");
    }
    el.addEventListener("click", e => {
      if (!P) return;
      const c = e.target.closest(".mdc");
      if (c && !done) {
        const i = +c.dataset.i, who = place.indexOf(i);
        if (P.obj[i] && MD_OBJ[P.obj[i]].block) { $("#md-msg", el).textContent = `Không ai đứng được ở ô có ${MD_OBJ[P.obj[i]].label}.`; return; }
        if (xMode) { if (who < 0) marks.has(i) ? marks.delete(i) : marks.add(i); }
        else if (who >= 0) { place[who] = -1; cur = who; }
        else { place[cur] = i; marks.delete(i); const nx = place.findIndex(x => x < 0); if (nx >= 0) cur = nx; }
        $("#md-msg", el).textContent = ""; draw(); return;
      }
      const p = e.target.closest("[data-p]"); if (p) { cur = +p.dataset.p; xMode = false; $("#md-x", el).textContent = "ĐÁNH DẤU X: TẮT"; draw(); return; }
      const a = e.target.closest("[data-a]"); if (a && !done) { accused = +a.dataset.a; draw(); return; }
      const nb = e.target.closest("[data-n]"); if (nb) fresh(+nb.dataset.n);
    });
    $("#md-x", el).onclick = e => { xMode = !xMode; e.target.textContent = "ĐÁNH DẤU X: " + (xMode ? "BẬT" : "TẮT"); e.target.setAttribute("aria-pressed", String(xMode)); if (P) draw(); };
    $("#md-ok", el).onclick = () => {
      if (!P || done) return;
      const m = $("#md-msg", el), ppl = P.people;
      if (place.some(x => x < 0)) { m.textContent = `Còn ${place.filter(x => x < 0).length} người chưa có chỗ đứng.`; return; }
      const rows = new Set(place.map(i => Math.floor(i / n))), cols = new Set(place.map(i => i % n));
      if (rows.size < n || cols.size < n) { m.textContent = "Có hàng hoặc cột đang có hai người."; return; }
      const pos = place.map(i => ({ r: Math.floor(i / n), c: i % n })), bad = P.clues.findIndex(cl => !mdCheck(cl, pos, P));
      if (bad >= 0) { m.textContent = `Lời khai số ${bad + 1} chưa khớp.`; return; }
      const wrong = place.filter((i, p) => i !== P.sol[p].r * n + P.sol[p].c).length;
      if (wrong) { m.textContent = `Lời khai đều khớp nhưng còn ${wrong} người đứng sai chỗ. Xem lại luật hung thủ ở cùng phòng nạn nhân.`; return; }
      if (accused < 0) { m.textContent = "Sơ đồ đã đúng. Chọn hung thủ ở hàng nút bên trên."; return; }
      done = true;
      m.textContent = accused === P.killer ? `Đúng, ${ppl[P.killer].name} là hung thủ. Phá án trong ${mmss(sec)}.` : `Sơ đồ đúng nhưng hung thủ là ${ppl[P.killer].name}, người ở cùng phòng với ${MD_VICTIM.name}.`;
    };
    $("#md-show", el).onclick = () => { if (!P) return; place = P.sol.map(x => x.r * n + x.c); accused = P.killer; done = true; draw(); $("#md-msg", el).textContent = `Hung thủ là ${P.people[P.killer].name}.`; };
    fresh(6);
    return () => clearInterval(T);
  } };

/* ================= SOLO: Ô chữ ================= */
// Đáp án viết liền, không dấu. Gợi ý ngắn gọn.
const CW_WORDS = [
  ["HANOI", "Thủ đô của Việt Nam"], ["HUE", "Cố đô bên dòng sông Hương"], ["DALAT", "Thành phố ngàn hoa ở Lâm Đồng"], ["SAPA", "Thị trấn mù sương ở Lào Cai"],
  ["HALONG", "Vịnh đá vôi ở Quảng Ninh"], ["MEKONG", "Con sông lớn chảy qua miền Tây"], ["PHUQUOC", "Đảo lớn nhất Việt Nam"], ["HOGUOM", "Hồ gắn với truyền thuyết trả gươm"],
  ["VANMIEU", "Nơi có bia tiến sĩ ở Hà Nội"], ["BENTHANH", "Ngôi chợ ở trung tâm Sài Gòn"], ["PHO", "Món nước có bánh và thịt bò"], ["BANHMI", "Ổ bánh kẹp pate, chả, rau"],
  ["CHE", "Món ngọt nấu từ đậu, ăn với đá"], ["CAPHE", "Thức uống pha bằng phin"], ["BANHXEO", "Bánh đổ chảo kêu xèo xèo"], ["GOICUON", "Tôm thịt cuốn bánh tráng, ăn sống"],
  ["BUNCHA", "Bún ăn với thịt nướng kiểu Hà Nội"], ["COMTAM", "Cơm nấu từ hạt gạo vỡ"], ["NUOCMAM", "Nước chấm làm từ cá ủ muối"], ["BANHCHUNG", "Bánh vuông gói lá dong ngày Tết"],
  ["AODAI", "Trang phục truyền thống của phụ nữ Việt"], ["NONLA", "Nón hình chóp đan bằng lá"], ["TET", "Dịp năm mới theo âm lịch"], ["LIXI", "Phong bao đỏ trẻ con nhận dịp Tết"],
  ["HOASEN", "Loài hoa mọc dưới ao, lá to tròn"], ["HOAMAI", "Hoa vàng chưng Tết ở miền Nam"], ["HOADAO", "Hoa hồng nhạt chưng Tết ở miền Bắc"], ["MEO", "Con vật kêu meo meo, hay bắt chuột"],
  ["CHO", "Con vật canh nhà, hay vẫy đuôi"], ["VOI", "Con vật to lớn có vòi dài"], ["KHI", "Con vật leo cây giỏi, thích ăn chuối"], ["TRAU", "Con vật kéo cày trên ruộng"],
  ["CACHEP", "Loài cá vượt vũ môn hóa rồng"], ["LUA", "Cây trồng cho ra hạt gạo"], ["GAO", "Hạt dùng để nấu cơm"], ["DUAHAU", "Quả vỏ xanh ruột đỏ, ăn mát ngày hè"],
  ["XOAI", "Quả vàng, ngọt, loại cát Hòa Lộc"], ["CHUOI", "Quả dài, vỏ vàng, khỉ thích ăn"], ["BUOI", "Quả to, vỏ dày, múi lớn"], ["CAM", "Quả tròn cùng tên với một màu"],
  ["MUA", "Nước từ mây rơi xuống"], ["NANG", "Ánh sáng ấm của mặt trời"], ["GIO", "Không khí chuyển động"], ["MAY", "Đám trắng trôi trên trời"],
  ["TRANG", "Vầng sáng trên trời đêm rằm"], ["SAO", "Điểm sáng nhỏ lấp lánh ban đêm"], ["BIEN", "Vùng nước mặn rộng lớn"], ["NUI", "Khối đất đá cao hơn đồi"],
  ["SONG", "Dòng nước lớn chảy ra biển"], ["CAU", "Công trình bắc qua sông"], ["TRUONG", "Nơi học sinh đến học mỗi ngày"], ["BACSI", "Người khám và chữa bệnh"],
  ["SACH", "Nhiều trang giấy đóng lại để đọc"], ["BUT", "Đồ dùng để viết"], ["GHE", "Đồ dùng để ngồi"], ["DONGHO", "Vật chỉ giờ"],
  ["MAYTINH", "Máy để soạn thảo và chơi game"], ["BONG", "Quả tròn dùng để đá"], ["COTUONG", "Môn cờ có tướng, xe, pháo, mã"], ["XUCXAC", "Khối vuông có chấm từ 1 đến 6"],
  ["DOMINO", "Trò xếp quân chữ nhật có chấm"], ["SUDOKU", "Trò điền số vào bảng 9 x 9"], ["CAUVONG", "Dải bảy màu hiện ra sau mưa"], ["MUAXUAN", "Mùa đầu tiên trong năm"],
  ["MUAHE", "Mùa nóng nhất trong năm"], ["MUATHU", "Mùa lá vàng rơi"], ["MUADONG", "Mùa lạnh nhất trong năm"], ["TOI", "Củ nhỏ nhiều tép, mùi hăng"],
  ["GUNG", "Củ cay ấm, hay pha trà"], ["TAI", "Bộ phận để nghe"], ["MUI", "Bộ phận để ngửi"], ["TOC", "Thứ mọc trên đầu"],
  ["TIM", "Bộ phận đập liên tục trong lồng ngực"], ["PIANO", "Đàn có phím đen và trắng"], ["GUITAR", "Đàn 6 dây, gảy bằng ngón tay"], ["TRONG", "Nhạc cụ đánh bằng dùi"],
  ["SAOTRUC", "Nhạc cụ thổi làm từ ống trúc"], ["XEDAP", "Xe hai bánh đạp bằng chân"], ["XEMAY", "Xe hai bánh chạy bằng xăng"], ["MAYBAY", "Phương tiện bay trên trời"],
  ["TAUHOA", "Phương tiện chạy trên đường ray"], ["THUYEN", "Phương tiện nhỏ đi trên mặt nước"], ["CAYTRE", "Cây thân đốt mọc thành lũy quanh làng"], ["DIEUSAO", "Đồ chơi bay trên trời nhờ gió và dây"],
  ["KEOCO", "Trò hai đội nắm dây kéo về phía mình"], ["OANQUAN", "Trò rải sỏi vào các ô, có hai ô quan"], ["NHAYDAY", "Trò bật qua sợi dây đang quay"], ["TRONTIM", "Trò một người đếm, cả nhóm đi nấp"]
];
const CW_MAX = 11;
function cwBuild(target) {
  let best = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const words = shuffle(CW_WORDS.slice()), grid = new Map(), placed = [];
    const key = (r, c) => r + "," + c, at = (r, c) => grid.get(key(r, c));
    let minR = 0, maxR = 0, minC = 0, maxC = 0;
    const fits = (w, r, c, dr, dc) => {
      let cross = 0;
      if (at(r - dr, c - dc) || at(r + dr * w.length, c + dc * w.length)) return -1;
      const nr0 = Math.min(minR, r), nc0 = Math.min(minC, c), nr1 = Math.max(maxR, r + dr * (w.length - 1)), nc1 = Math.max(maxC, c + dc * (w.length - 1));
      if (nr1 - nr0 + 1 > CW_MAX || nc1 - nc0 + 1 > CW_MAX) return -1;
      for (let k = 0; k < w.length; k++) {
        const rr = r + dr * k, cc = c + dc * k, ch = at(rr, cc);
        if (ch) { if (ch !== w[k]) return -1; cross++; }
        else if (at(rr + dc, cc + dr) || at(rr - dc, cc - dr)) return -1; // không cho chữ chạm cạnh song song
      }
      return cross === w.length ? -1 : cross;
    };
    const put = (item, r, c, dr, dc) => {
      const w = item[0];
      for (let k = 0; k < w.length; k++) grid.set(key(r + dr * k, c + dc * k), w[k]);
      minR = Math.min(minR, r); minC = Math.min(minC, c); maxR = Math.max(maxR, r + dr * (w.length - 1)); maxC = Math.max(maxC, c + dc * (w.length - 1));
      placed.push({ w, clue: item[1], r, c, dr, dc });
    };
    const first = words.find(w => w[0].length >= 5 && w[0].length <= 8);
    put(first, 0, 0, 0, 1);
    for (let pass = 0; pass < 2 && placed.length < target; pass++) for (const item of words) {
      if (placed.length >= target) break;
      if (placed.some(p => p.w === item[0])) continue;
      const w = item[0]; let opt = null;
      for (const p of placed) for (let i = 0; i < p.w.length; i++) for (let j = 0; j < w.length; j++) {
        if (p.w[i] !== w[j]) continue;
        const dr = p.dc, dc = p.dr, r = p.r + p.dr * i - dr * j, c = p.c + p.dc * i - dc * j, s = fits(w, r, c, dr, dc);
        if (s > 0 && (!opt || s > opt.s || (s === opt.s && Math.random() < .5))) opt = { r, c, dr, dc, s };
      }
      if (opt) put(item, opt.r, opt.c, opt.dr, opt.dc);
    }
    const score = placed.length * 10 - (maxR - minR + maxC - minC);
    if (!best || score > best.score) best = { score, placed, minR, minC, H: maxR - minR + 1, W: maxC - minC + 1 };
    if (placed.length >= target) break;
  }
  const { placed, minR, minC, H, W } = best;
  placed.forEach(p => { p.r -= minR; p.c -= minC; });
  const sol = Array.from({ length: H }, () => Array(W).fill(""));
  placed.forEach(p => { for (let k = 0; k < p.w.length; k++) sol[p.r + p.dr * k][p.c + p.dc * k] = p.w[k]; });
  // đánh số theo thứ tự đọc, ô bắt đầu của từ nào thì mang số đó
  const starts = [...new Set(placed.map(p => p.r * W + p.c))].sort((a, b) => a - b);
  placed.forEach(p => p.num = starts.indexOf(p.r * W + p.c) + 1);
  placed.sort((a, b) => a.num - b.num);
  return { H, W, sol, words: placed };
}
const deaccent = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toUpperCase().replace(/[^A-Z]/g, "");
G.crossword = { kind: "solo", name: "Ô chữ", desc: "Đọc gợi ý hàng ngang, hàng dọc rồi điền đáp án vào ô. Gõ chữ không dấu, mỗi ô một chữ cái.",
  mount(el) {
    el.innerHTML = `<div class="score"><span id="cw-n">0 TỪ</span><span id="cw-t">00:00</span></div>
      <div class="cwnow" id="cw-now">Bấm vào một ô để bắt đầu.</div>
      <div class="cwk" id="cw-b" aria-label="Bảng ô chữ"></div>
      <div class="lcdrow"><button class="lcdbtn" id="cw-ok">KIỂM TRA</button><button class="lcdbtn" id="cw-hint">MỞ 1 CHỮ</button><button class="lcdbtn" id="cw-show">XEM ĐÁP ÁN</button></div>
      <div class="lcdrow"><button class="lcdbtn" data-sz="8">Ô CHỮ NHỎ</button><button class="lcdbtn" data-sz="12">Ô CHỮ LỚN</button></div>
      <div class="msg" id="cw-msg" aria-live="polite"></div>
      <div class="cwclues"><div><h4>HÀNG NGANG</h4><ol id="cw-across"></ol></div><div><h4>HÀNG DỌC</h4><ol id="cw-down"></ol></div></div>`;
    let P, val, dir = 0, cur = null, sec = 0, done = false, wrong = new Set();
    const T = setInterval(() => { if (P && !done && !document.hidden) { sec++; $("#cw-t", el).textContent = mmss(sec); } }, 1000);
    const wordAt = (r, c, d) => P.words.find(w => (d === 0 ? w.dc : w.dr) && [...w.w].some((_, k) => w.r + w.dr * k === r && w.c + w.dc * k === c));
    function fresh(size) {
      P = cwBuild(size); val = P.sol.map(row => row.map(() => "")); dir = 0; cur = null; sec = 0; done = false; wrong = new Set();
      const b = $("#cw-b", el); b.style.gridTemplateColumns = `repeat(${P.W}, minmax(0, 1fr))`; b.style.maxWidth = Math.min(460, P.W * 42) + "px";
      const nums = {}; P.words.forEach(w => nums[w.r + "," + w.c] = w.num);
      b.innerHTML = P.sol.map((row, r) => row.map((ch, c) => ch
        ? `<label class="cwc" data-r="${r}" data-c="${c}">${nums[r + "," + c] ? `<sup>${nums[r + "," + c]}</sup>` : ""}<input maxlength="2" autocomplete="off" autocapitalize="characters" spellcheck="false" data-r="${r}" data-c="${c}" aria-label="Hàng ${r + 1} cột ${c + 1}"></label>`
        : `<span class="cwe"></span>`).join("")).join("");
      const li = w => `<li value="${w.num}" data-w="${P.words.indexOf(w)}">${esc(w.clue)} <small>${w.w.length} chữ</small></li>`;
      $("#cw-across", el).innerHTML = P.words.filter(w => w.dc).map(li).join("");
      $("#cw-down", el).innerHTML = P.words.filter(w => w.dr).map(li).join("");
      $("#cw-n", el).textContent = `${P.words.length} TỪ`; $("#cw-msg", el).textContent = ""; $("#cw-now", el).textContent = "Bấm vào một ô để bắt đầu.";
      paint();
    }
    const input = (r, c) => el.querySelector(`input[data-r="${r}"][data-c="${c}"]`);
    function curWord() { if (!cur) return null; return wordAt(cur.r, cur.c, dir) || wordAt(cur.r, cur.c, 1 - dir); }
    function paint() {
      const w = curWord(); if (w) dir = w.dc ? 0 : 1;
      el.querySelectorAll(".cwc").forEach(l => {
        const r = +l.dataset.r, c = +l.dataset.c, inp = l.querySelector("input");
        if (inp.value !== val[r][c]) inp.value = val[r][c];
        const inW = w && [...w.w].some((_, k) => w.r + w.dr * k === r && w.c + w.dc * k === c);
        l.classList.toggle("hl", !!inW); l.classList.toggle("cur", !!cur && cur.r === r && cur.c === c); l.classList.toggle("bad", wrong.has(r + "," + c));
        l.classList.toggle("ok", done && val[r][c] === P.sol[r][c]);
      });
      el.querySelectorAll(".cwclues li").forEach(li => { const x = P.words[+li.dataset.w]; li.classList.toggle("on", x === w); li.classList.toggle("fin", [...x.w].every((ch, k) => val[x.r + x.dr * k][x.c + x.dc * k] === ch)); });
      $("#cw-now", el).textContent = w ? `${w.num} ${w.dc ? "NGANG" : "DỌC"} · ${w.clue} · ${w.w.length} chữ` : "Bấm vào một ô để bắt đầu.";
    }
    function focus(r, c) { cur = { r, c }; const i = input(r, c); if (i) { i.focus({ preventScroll: true }); i.select(); } paint(); }
    function step(back) {
      const w = curWord(); if (!w) return; dir = w.dc ? 0 : 1;
      const k = [...w.w].findIndex((_, k) => w.r + w.dr * k === cur.r && w.c + w.dc * k === cur.c), nk = k + (back ? -1 : 1);
      if (nk >= 0 && nk < w.w.length) focus(w.r + w.dr * nk, w.c + w.dc * nk);
    }
    function checkWin() {
      if (P.sol.every((row, r) => row.every((ch, c) => !ch || val[r][c] === ch))) { done = true; $("#cw-msg", el).textContent = `Xong ô chữ ${P.words.length} từ trong ${mmss(sec)}.`; }
    }
    el.addEventListener("focusin", e => { const i = e.target.closest(".cwc input"); if (i) { const r = +i.dataset.r, c = +i.dataset.c; if (!cur || cur.r !== r || cur.c !== c) { cur = { r, c }; paint(); } } });
    el.addEventListener("mousedown", e => {
      const i = e.target.closest(".cwc"); if (!i) return;
      const r = +i.dataset.r, c = +i.dataset.c;
      if (cur && cur.r === r && cur.c === c && wordAt(r, c, 1 - dir)) { dir = 1 - dir; paint(); }
    });
    el.addEventListener("input", e => {
      const i = e.target.closest(".cwc input"); if (!i || done) return;
      const r = +i.dataset.r, c = +i.dataset.c, ch = deaccent(i.value).slice(-1);
      val[r][c] = ch; wrong.delete(r + "," + c); i.value = ch; cur = { r, c };
      if (ch) step(false); else paint();
      checkWin(); if (done) paint();
    });
    el.addEventListener("keydown", e => {
      const i = e.target.closest(".cwc input"); if (!i || !cur) return;
      if (e.key === "Backspace" && !i.value) { e.preventDefault(); step(true); const j = input(cur.r, cur.c); if (j && !done) { val[cur.r][cur.c] = ""; paint(); } }
      else if (e.key.startsWith("Arrow")) {
        e.preventDefault(); const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
        const nd = d[0] ? 1 : 0; if (nd !== dir && wordAt(cur.r, cur.c, nd)) { dir = nd; paint(); return; }
        let r = cur.r + d[0], c = cur.c + d[1];
        while (r >= 0 && c >= 0 && r < P.H && c < P.W) { if (P.sol[r][c]) { focus(r, c); break; } r += d[0]; c += d[1]; }
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault(); const w = curWord(), k = P.words.indexOf(w), nx = P.words[(k + (e.shiftKey ? P.words.length - 1 : 1)) % P.words.length];
        dir = nx.dc ? 0 : 1; focus(nx.r, nx.c);
      }
    });
    el.addEventListener("click", e => {
      const li = e.target.closest(".cwclues li"); if (li) { const w = P.words[+li.dataset.w]; dir = w.dc ? 0 : 1; const k = [...w.w].findIndex((ch, k) => val[w.r + w.dr * k][w.c + w.dc * k] !== ch); const kk = k < 0 ? 0 : k; focus(w.r + w.dr * kk, w.c + w.dc * kk); return; }
      const sz = e.target.closest("[data-sz]"); if (sz) fresh(+sz.dataset.sz);
    });
    $("#cw-ok", el).onclick = () => {
      if (done) return; wrong = new Set(); let empty = 0;
      P.sol.forEach((row, r) => row.forEach((ch, c) => { if (!ch) return; if (!val[r][c]) empty++; else if (val[r][c] !== ch) wrong.add(r + "," + c); }));
      $("#cw-msg", el).textContent = wrong.size ? `Có ${wrong.size} chữ chưa đúng, đã tô đỏ.` : empty ? `Các chữ đã điền đều đúng, còn ${empty} ô trống.` : "";
      checkWin(); paint();
    };
    $("#cw-hint", el).onclick = () => {
      if (done) return; const w = curWord() || P.words[0];
      const k = [...w.w].findIndex((ch, k) => val[w.r + w.dr * k][w.c + w.dc * k] !== ch); if (k < 0) { $("#cw-msg", el).textContent = "Từ này đã đúng hết."; return; }
      const r = w.r + w.dr * k, c = w.c + w.dc * k; val[r][c] = w.w[k]; wrong.delete(r + "," + c); dir = w.dc ? 0 : 1; focus(r, c); checkWin(); paint();
    };
    $("#cw-show", el).onclick = () => { val = P.sol.map(row => row.slice()); wrong = new Set(); done = true; $("#cw-msg", el).textContent = "Đã mở toàn bộ đáp án."; paint(); };
    fresh(8);
    return () => clearInterval(T);
  } };
})();
