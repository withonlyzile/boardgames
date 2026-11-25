/* Play with Zile — trò giải đố một mình: Sudoku, Truy án ô vuông (kiểu Murdoku), Ô chữ.
   Gắn thêm vào window.TLC_GAMES, file này phải nạp sau games.js và trước app.js. */
(function () {
const G = window.TLC_GAMES;
const { esc } = window.TLC_HELPERS;
const $ = (s, r = document) => r.querySelector(s);
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const dur = s => (s >= 60 ? `${Math.floor(s / 60)} phút ` : "") + `${s % 60} giây`;
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
      if (s.val.every((v, i) => v === s.sol[i])) { s.done = true; $("#sd-msg", el).textContent = `Xong bảng ${SD_LEVELS[s.level].name.toLowerCase()} trong ${dur(s.sec)} với ${s.err} lỗi.`; }
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

/* ================= SOLO: Truy án ô vuông (giải đố kiểu Murdoku) =================
   Luật: mỗi hàng, mỗi cột có đúng một người. Không ai đứng ở ô có cây, bàn hay tủ.
   Mỗi người có một tấm thẻ lời khai. Nạn nhân thường ở ô còn lại cuối cùng.
   Hung thủ là người duy nhất ở cùng phòng với nạn nhân. Hình vẽ do trang tự vẽ bằng SVG. */
const COLS = "ABCDEFGH";
const MD_SUSPECTS = [
  { name: "An", bg: "#d9784f", hair: "#2b1d16", hs: 0, shirt: "#7fa86b", skin: "#f1b98d" },
  { name: "Bình", bg: "#3f8f6a", hair: "#8c3b22", hs: 2, shirt: "#9b86c9", skin: "#eab48a" },
  { name: "Chi", bg: "#3f8fa0", hair: "#d0662a", hs: 3, shirt: "#2c2c34", skin: "#f3c39c" },
  { name: "Dũng", bg: "#5a6fc0", hair: "#e8cf4a", hs: 1, shirt: "#2f4f8a", skin: "#eeb487" },
  { name: "Giang", bg: "#5c4a86", hair: "#6b4a2f", hs: 4, shirt: "#c8b590", skin: "#e9b08a" }
];
const MD_VICTIM = { name: "Lâm", bg: "#b8473f", hair: "#3a2a20", hs: 0, shirt: "#3f63a8", skin: "#eeb487", victim: true };
const MD_TOKEN = ["#2f6fd6", "#1e9c8f", "#7b55d1", "#c26b12", "#566012"];
const MD_ROOMNAMES = ["Phòng khách", "Phòng ngủ", "Bếp", "Phòng ăn", "Thư viện", "Phòng tắm", "Sảnh", "Hành lang", "Phòng làm việc"];
const MD_FLOORS = [
  { base: "#cfe9e6", alt: "#b7dcd8", kind: "check" }, { base: "#d7c8ea", alt: "#c3b0de", kind: "plank" },
  { base: "#ecd0dc", alt: "#ddb6c8", kind: "plank" }, { base: "#cfe0ef", alt: "#b9d5e8", kind: "diamond" },
  { base: "#f1dfb8", alt: "#e4cb98", kind: "plank" }, { base: "#d6e8c4", alt: "#c0dba7", kind: "check" },
  { base: "#f2d3bd", alt: "#e7bc9f", kind: "diamond" }, { base: "#e2e2d0", alt: "#cfcfb6", kind: "check" },
  { base: "#d9d4ee", alt: "#c4bde3", kind: "diamond" }
];
// block: không đứng được. stand: đứng hoặc ngồi được.
const MD_ITEMS = {
  plant: { block: true, label: "cây cảnh", near: "Đứng cạnh một chậu cây cảnh." },
  table: { block: true, label: "bàn", near: "Đứng cạnh một cái bàn." },
  shelf: { block: true, label: "tủ sách", near: "Đứng cạnh một tủ sách." },
  chair: { block: false, label: "ghế", on: "Ngồi trên một chiếc ghế." },
  rug: { block: false, label: "thảm", on: "Đứng trên thảm." },
  bed: { block: false, label: "giường", on: "Nằm trên giường." }
};
const mdNbr = (n, i) => [i - n, i + n, i % n ? i - 1 : -1, (i + 1) % n ? i + 1 : -1].filter(j => j >= 0 && j < n * n);
function mdRooms(n, k) {
  for (let t = 0; t < 200; t++) {
    let rects = [{ r: 0, c: 0, h: n, w: n }];
    while (rects.length < k) {
      const can = rects.filter(x => x.h * x.w >= 4 && (x.h >= 2 || x.w >= 2)); if (!can.length) break;
      can.sort((a, b) => b.h * b.w - a.h * a.w + (Math.random() - .5) * 4);
      const x = can[0]; rects = rects.filter(y => y !== x);
      const vert = x.w > x.h || (x.w === x.h && Math.random() < .5);
      if (vert && x.w >= 2) { const s = 1 + rnd(x.w - 1); rects.push({ ...x, w: s }, { ...x, c: x.c + s, w: x.w - s }); }
      else if (x.h >= 2) { const s = 1 + rnd(x.h - 1); rects.push({ ...x, h: s }, { ...x, r: x.r + s, h: x.h - s }); }
      else rects.push(x);
    }
    if (rects.length !== k || rects.some(x => x.h * x.w < 2)) continue;
    const room = Array(n * n); rects.forEach((x, id) => { for (let r = x.r; r < x.r + x.h; r++) for (let c = x.c; c < x.c + x.w; c++) room[r * n + c] = id; });
    return { room, rects };
  }
  return null;
}
function mdLayout(n) {
  const k = n === 4 ? 4 : n === 5 ? 5 : 6, R = mdRooms(n, k); if (!R) return null;
  const names = shuffle(MD_ROOMNAMES.slice()).slice(0, k), floors = shuffle([...MD_FLOORS.keys()]).slice(0, k);
  const bedroom = names.indexOf("Phòng ngủ");
  const item = Array(n * n).fill(null), free = i => !item[i];
  const cells = shuffle([...Array(n * n).keys()]);
  // giường hai ô trong phòng ngủ
  if (bedroom >= 0) for (const i of cells) { if (R.room[i] !== bedroom || !free(i)) continue;
    const j = shuffle(mdNbr(n, i)).find(j => R.room[j] === bedroom && free(j)); if (j === undefined) continue;
    item[i] = { k: "bed", part: 0, other: j }; item[j] = { k: "bed", part: 1, other: i }; break; }
  const want = shuffle(["plant", "plant", "table", "shelf", "chair", "chair", "chair", "rug", "rug", ...(n >= 5 ? ["table", "chair", "plant"] : []), ...(n >= 6 ? ["shelf", "rug", "chair"] : [])]);
  let blocked = 0;
  for (const kind of want) {
    const i = cells.find(x => free(x) && Math.random() < .5) ?? cells.find(free); if (i === undefined) break;
    if (MD_ITEMS[kind].block) { if (blocked >= n - 1) continue; blocked++; }
    item[i] = { k: kind };
  }
  // cửa sổ trên tường ngoài
  const wins = [], edges = [];
  for (let c = 0; c < n; c++) edges.push({ i: c, s: "t" }, { i: (n - 1) * n + c, s: "b" });
  for (let r = 0; r < n; r++) edges.push({ i: r * n, s: "l" }, { i: r * n + n - 1, s: "r" });
  shuffle(edges).slice(0, n - 1 + rnd(2)).forEach(e => wins.push(e));
  return { n, room: R.room, rects: R.rects, names, floors, item, wins };
}
function mdAtoms(L, i) {
  const n = L.n, out = [], it = L.item[i];
  out.push({ t: "room", v: L.room[i], w: 2 });
  if (it && !MD_ITEMS[it.k].block) out.push({ t: "on", v: it.k, w: 3 });
  if (L.wins.some(w => w.i === i)) out.push({ t: "win", w: 3 });
  new Set(mdNbr(n, i).map(j => L.item[j] && MD_ITEMS[L.item[j].k].block ? L.item[j].k : null).filter(Boolean)).forEach(k => out.push({ t: "near", v: k, w: 3 }));
  if (!it) out.push({ t: "empty", w: .6 });
  out.push({ t: "row", v: Math.floor(i / n), w: .5 }, { t: "col", v: i % n, w: .5 });
  return out;
}
function mdHolds(L, a, i) {
  const n = L.n, it = L.item[i];
  switch (a.t) {
    case "room": return L.room[i] === a.v;
    case "on": return !!it && it.k === a.v;
    case "win": return L.wins.some(w => w.i === i);
    case "near": return mdNbr(n, i).some(j => L.item[j] && L.item[j].k === a.v);
    case "empty": return !it;
    case "row": return Math.floor(i / n) === a.v;
    case "col": return i % n === a.v;
  }
  return false;
}
function mdAtomText(L, a) {
  switch (a.t) {
    case "room": return `Ở trong ${L.names[a.v].toLowerCase()}.`;
    case "on": return MD_ITEMS[a.v].on;
    case "win": return "Đứng trước một cửa sổ.";
    case "near": return MD_ITEMS[a.v].near;
    case "empty": return "Đứng ở ô trống, không có đồ vật nào.";
    case "row": return `Ở hàng ${a.v + 1}.`;
    case "col": return `Ở cột ${COLS[a.v]}.`;
  }
  return "";
}
function mdCardText(L, card) {
  if (!card.length) return "Ở ô còn lại cuối cùng.";
  if (card.length === 1) return mdAtomText(L, card[0]);
  const a = mdAtomText(L, card[0]).replace(/\.$/, ""), b = mdAtomText(L, card[1]);
  return `${a}, ${b.charAt(0).toLowerCase()}${b.slice(1)}`;
}
// Đếm số cách xếp thỏa mọi thẻ lời khai, dừng ở limit.
function mdCount(L, cards, limit) {
  const n = L.n, V = n - 1, open = i => !(L.item[i] && MD_ITEMS[L.item[i].k].block);
  const cand = cards.map(cd => [...Array(n * n).keys()].filter(i => open(i) && cd.every(a => mdHolds(L, a, i))));
  const order = [...Array(n).keys()].sort((a, b) => cand[a].length - cand[b].length);
  const pos = Array(n), uR = Array(n).fill(false), uC = Array(n).fill(false); let count = 0;
  const rec = k => {
    if (k === n) { const vr = L.room[pos[V]]; if (pos.filter((x, p) => p !== V && L.room[x] === vr).length === 1) count++; return count >= limit; }
    const p = order[k];
    for (const i of cand[p]) { const r = Math.floor(i / n), c = i % n; if (uR[r] || uC[c]) continue;
      pos[p] = i; uR[r] = uC[c] = true; if (rec(k + 1)) return true; uR[r] = uC[c] = false; }
    return false;
  };
  rec(0); return count;
}
function mdMake(n) {
  for (let t = 0; t < 600; t++) {
    const L = mdLayout(n); if (!L) continue;
    const open = i => !(L.item[i] && MD_ITEMS[L.item[i].k].block);
    let sol = null;
    for (let k = 0; k < 100 && !sol; k++) {
      const rows = shuffle([...Array(n).keys()]), cols = shuffle([...Array(n).keys()]), s = rows.map((r, p) => r * n + cols[p]);
      if (!s.every(open)) continue;
      const vr = L.room[s[n - 1]]; if (s.filter((x, p) => p < n - 1 && L.room[x] === vr).length !== 1) continue;
      sol = s;
    }
    if (!sol) continue;
    const atoms = sol.map(i => mdAtoms(L, i));
    const pick = p => { const A = atoms[p], tot = A.reduce((s, a) => s + a.w, 0); let x = Math.random() * tot; for (const a of A) { x -= a.w; if (x <= 0) return a; } return A[0]; };
    // thử nhiều bộ thẻ: mỗi người một lời khai, nạn nhân ở ô còn lại, cần thì ghép hai ý trong một thẻ
    for (let pass = 0; pass < 3; pass++) for (let tr = 0; tr < 40; tr++) {
      const cards = [];
      for (let p = 0; p < n - 1; p++) {
        const a = pick(p); let cd = [a];
        if (pass > 0 && Math.random() < (pass === 1 ? .25 : .45)) { const b = pick(p); if (b.t !== a.t && !(["row", "col"].includes(a.t) && ["row", "col"].includes(b.t))) cd = b.t === "room" ? [b, a] : [a, b]; }
        cards.push(cd);
      }
      cards.push(pass === 2 && Math.random() < .3 ? [pick(n - 1)] : []);
      if (cards.reduce((s, c) => s + (c.length > 1), 0) > Math.floor(n / 2)) continue;
      if (mdCount(L, cards, 2) === 1) {
        const vr = L.room[sol[n - 1]], killer = sol.findIndex((x, p) => p < n - 1 && L.room[x] === vr);
        return { ...L, sol, killer, cards };
      }
    }
  }
  return null;
}
/* ---------- vẽ ---------- */
function mdAvatar(p) {
  const h = p.hair, hair = [
    `<path d="M22 40 Q22 18 40 18 Q58 18 58 40 Q54 28 40 28 Q26 28 22 40Z" fill="${h}"/>`,
    `<path d="M21 38 Q20 14 40 15 Q60 14 59 38 L56 30 Q48 24 40 26 Q30 24 24 30Z" fill="${h}"/><path d="M26 22 Q34 10 50 16" stroke="${h}" stroke-width="6" fill="none"/>`,
    `<path d="M20 62 Q16 20 40 17 Q64 20 60 62 L54 62 Q56 34 40 30 Q24 34 26 62Z" fill="${h}"/>`,
    `<circle cx="40" cy="14" r="9" fill="${h}"/><path d="M22 38 Q22 19 40 19 Q58 19 58 38 Q52 27 40 27 Q28 27 22 38Z" fill="${h}"/>`,
    `<path d="M20 58 Q14 18 40 16 Q66 18 60 58 Q58 40 54 32 Q40 26 26 32 Q22 40 20 58Z" fill="${h}"/>`
  ][p.hs];
  return `<svg viewBox="0 0 80 80" aria-hidden="true"><rect width="80" height="80" fill="${p.bg}"/>
    <path d="M10 80 Q12 60 40 58 Q68 60 70 80Z" fill="${p.shirt}"/><rect x="34" y="48" width="12" height="12" fill="${p.skin}"/>
    <ellipse cx="40" cy="38" rx="16" ry="19" fill="${p.skin}"/>${hair}
    ${p.victim ? `<path d="M16 16 L64 64 M64 16 L16 64" stroke="#d62828" stroke-width="5" stroke-linecap="round" opacity=".85"/>` : ""}</svg>`;
}
function mdFloorDefs(id, L) {
  return L.floors.map((f, k) => {
    const F = MD_FLOORS[f], pid = `${id}-f${k}`;
    if (F.kind === "check") return `<pattern id="${pid}" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="${F.base}"/><rect width="15" height="15" fill="${F.alt}"/><rect x="15" y="15" width="15" height="15" fill="${F.alt}"/></pattern>`;
    if (F.kind === "plank") return `<pattern id="${pid}" width="40" height="20" patternUnits="userSpaceOnUse"><rect width="40" height="20" fill="${F.base}"/><path d="M0 10 H40 M0 0 H40 M12 0 V10 M32 10 V20" stroke="${F.alt}" stroke-width="2"/></pattern>`;
    return `<pattern id="${pid}" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="${F.base}"/><path d="M15 0 L30 15 L15 30 L0 15Z" fill="${F.alt}"/></pattern>`;
  }).join("");
}
function mdItemSVG(L, i, x, y, S) {
  const it = L.item[i]; if (!it) return "";
  const n = L.n, cx = x + S / 2, cy = y + S / 2;
  switch (it.k) {
    case "plant": return `<g><path d="M${cx - 11} ${cy + 4} L${cx + 11} ${cy + 4} L${cx + 8} ${cy + 22} L${cx - 8} ${cy + 22}Z" fill="#4f6fb5" stroke="#2c3e70" stroke-width="1.5"/>
      ${[-40, -18, 0, 18, 40].map(a => `<ellipse cx="${cx}" cy="${cy - 8}" rx="4.5" ry="15" fill="${a % 36 ? "#3f8f3a" : "#58a84a"}" transform="rotate(${a} ${cx} ${cy + 4})"/>`).join("")}</g>`;
    case "table": return `<g><rect x="${x + 7}" y="${y + 9}" width="${S - 14}" height="${S - 22}" rx="3" fill="#9fb0cf" stroke="#2f3a55" stroke-width="2"/><rect x="${x + 11}" y="${y + S - 14}" width="5" height="8" fill="#2f3a55"/><rect x="${x + S - 16}" y="${y + S - 14}" width="5" height="8" fill="#2f3a55"/></g>`;
    case "shelf": return `<g><rect x="${x + 8}" y="${y + 6}" width="${S - 16}" height="${S - 12}" fill="#8a5a34" stroke="#4a2f1a" stroke-width="2"/>${[0, 1, 2].map(r => `<line x1="${x + 8}" x2="${x + S - 8}" y1="${y + 6 + (S - 12) * (r + 1) / 3}" y2="${y + 6 + (S - 12) * (r + 1) / 3}" stroke="#4a2f1a" stroke-width="2"/>` + [0, 1, 2, 3].map(b => `<rect x="${x + 11 + b * 9}" y="${y + 9 + r * (S - 12) / 3}" width="6" height="${(S - 12) / 3 - 5}" fill="${["#d24b3e", "#3f7fd0", "#e2b23a", "#4aa36b"][(b + r) % 4]}"/>`).join("")).join("")}</g>`;
    case "chair": return `<g><rect x="${cx - 12}" y="${cy - 2}" width="24" height="14" rx="2" fill="#b07a4a" stroke="#5a3a20" stroke-width="2"/><rect x="${cx - 12}" y="${cy - 16}" width="24" height="7" rx="2" fill="#8c5a32" stroke="#5a3a20" stroke-width="2"/><line x1="${cx - 9}" x2="${cx - 9}" y1="${cy - 9}" y2="${cy - 2}" stroke="#5a3a20" stroke-width="3"/><line x1="${cx + 9}" x2="${cx + 9}" y1="${cy - 9}" y2="${cy - 2}" stroke="#5a3a20" stroke-width="3"/></g>`;
    case "rug": return `<g><rect x="${x + 5}" y="${y + 5}" width="${S - 10}" height="${S - 10}" fill="#c9a6e0" stroke="#6a4c8c" stroke-width="2"/><rect x="${x + 11}" y="${y + 11}" width="${S - 22}" height="${S - 22}" fill="none" stroke="#6a4c8c" stroke-width="1.5" stroke-dasharray="4 3"/></g>`;
    case "bed": {
      if (it.part === 1) return "";
      const j = it.other, r0 = Math.min(Math.floor(i / n), Math.floor(j / n)), c0 = Math.min(i % n, j % n), hor = Math.floor(i / n) === Math.floor(j / n);
      const bx = c0 * S + (x - (i % n) * S), by = r0 * S + (y - Math.floor(i / n) * S), w = hor ? 2 * S : S, h = hor ? S : 2 * S;
      return `<g><rect x="${bx + 7}" y="${by + 7}" width="${w - 14}" height="${h - 14}" rx="4" fill="#f7f7f2" stroke="#4a4f6a" stroke-width="2"/>
        ${hor ? `<rect x="${bx + 11}" y="${by + 14}" width="14" height="${h - 28}" rx="3" fill="#fff" stroke="#4a4f6a" stroke-width="1.5"/><rect x="${bx + 30}" y="${by + 9}" width="${w - 39}" height="${h - 18}" rx="3" fill="#8fb0d9"/>`
              : `<rect x="${bx + 14}" y="${by + 11}" width="${w - 28}" height="14" rx="3" fill="#fff" stroke="#4a4f6a" stroke-width="1.5"/><rect x="${bx + 9}" y="${by + 30}" width="${w - 18}" height="${h - 39}" rx="3" fill="#8fb0d9"/>`}</g>`;
    }
  }
  return "";
}
function mdBoardSVG(L, id, st) {
  const n = L.n, S = 64, M = 26, W = n * S + 2 * M, ppl = st.people;
  let s = `<svg viewBox="0 0 ${W} ${W}" class="mdsvg" role="img" aria-label="Sơ đồ căn nhà ${n} x ${n}"><defs>${mdFloorDefs(id, L)}</defs><g transform="translate(${M} ${M})">`;
  L.rects.forEach((x, k) => s += `<rect x="${x.c * S}" y="${x.r * S}" width="${x.w * S}" height="${x.h * S}" fill="url(#${id}-f${k})"/>`);
  for (let i = 1; i < n; i++) s += `<line x1="${i * S}" x2="${i * S}" y1="0" y2="${n * S}" class="mdgrid"/><line y1="${i * S}" y2="${i * S}" x1="0" x2="${n * S}" class="mdgrid"/>`;
  for (let i = 0; i < n * n; i++) s += mdItemSVG(L, i, (i % n) * S, Math.floor(i / n) * S, S);
  // tường giữa các phòng
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const i = r * n + c;
    if (c < n - 1 && L.room[i] !== L.room[i + 1]) s += `<line x1="${(c + 1) * S}" x2="${(c + 1) * S}" y1="${r * S - 3}" y2="${(r + 1) * S + 3}" class="mdwall"/>`;
    if (r < n - 1 && L.room[i] !== L.room[i + n]) s += `<line y1="${(r + 1) * S}" y2="${(r + 1) * S}" x1="${c * S - 3}" x2="${(c + 1) * S + 3}" class="mdwall"/>`; }
  s += `<rect x="0" y="0" width="${n * S}" height="${n * S}" fill="none" class="mdouter"/>`;
  L.wins.forEach(w => { const r = Math.floor(w.i / n), c = w.i % n, a = 14, len = S - 28;
    const [x, y, ww, hh] = w.s === "t" ? [c * S + a, -6, len, 12] : w.s === "b" ? [c * S + a, n * S - 6, len, 12] : w.s === "l" ? [-6, r * S + a, 12, len] : [n * S - 6, r * S + a, 12, len];
    s += `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" rx="5" fill="#e9f6fb" stroke="#2a3140" stroke-width="2.5"/><rect x="${x + (ww > hh ? 6 : 3)}" y="${y + (ww > hh ? 3 : 6)}" width="${ww > hh ? ww - 12 : 6}" height="${ww > hh ? 6 : hh - 12}" rx="3" fill="#9fd1e8"/>`; });
  L.rects.forEach((x, k) => { const label = L.names[k].toUpperCase(), need = label.length * 7.4 + 16;
    // phòng hẹp thì tên chạy dọc sát tường phải để không bị cắt chữ
    const vert = need > x.w * S - 6 && x.h * S > x.w * S, tw = Math.min((vert ? x.h : x.w) * S - 8, need);
    const cx = vert ? (x.c + x.w) * S - 12 : x.c * S + x.w * S / 2, cy = vert ? x.r * S + x.h * S / 2 : (x.r + x.h) * S - 12.5;
    s += `<g class="mdlabel"${vert ? ` transform="rotate(-90 ${cx} ${cy})"` : ""}><rect x="${cx - tw / 2}" y="${cy - 8.5}" width="${tw}" height="17" rx="8.5"/><text x="${cx}" y="${cy + 4}" text-anchor="middle">${esc(label)}</text></g>`; });
  for (let i = 0; i < n * n; i++) { const x = (i % n) * S, y = Math.floor(i / n) * S, who = st.place.indexOf(i);
    if (who >= 0) s += `<g class="mdtok"><circle cx="${x + S / 2}" cy="${y + S / 2 - 2}" r="19" fill="${who === n - 1 ? "#c23b3b" : MD_TOKEN[who]}" stroke="#fff" stroke-width="3"/><text x="${x + S / 2}" y="${y + S / 2 + 6}" text-anchor="middle">${esc(ppl[who].name[0])}</text></g>`;
    else if (st.marks.has(i)) s += `<text x="${x + S / 2}" y="${y + S / 2 + 10}" text-anchor="middle" class="mdxm">×</text>`;
    s += `<rect x="${x}" y="${y}" width="${S}" height="${S}" fill="transparent" class="mdhit" data-i="${i}"><title>Ô ${COLS[i % n]}${Math.floor(i / n) + 1}</title></rect>`; }
  for (let c = 0; c < n; c++) s += `<text x="${c * S + S / 2}" y="-12" text-anchor="middle" class="mdcoord">${COLS[c]}</text>`;
  for (let r = 0; r < n; r++) s += `<text x="-17" y="${r * S + S / 2 + 4}" text-anchor="middle" class="mdcoord">${r + 1}</text>`;
  return s + `</g></svg>`;
}
let mdSeq = 0;
G.murdoku = { kind: "solo", name: "Truy án ô vuông", desc: "Giải đố kiểu Murdoku. Đọc thẻ lời khai của từng người rồi xếp họ vào sơ đồ căn nhà. Xếp xong thì chỉ ra hung thủ.",
  mount(el) {
    const id = "md" + (++mdSeq), KEY = "tlc-murdoku";
    el.innerHTML = `<div class="score"><span id="md-n">VỤ ÁN</span><span id="md-t">00:00</span></div>
      <div class="mdbook"><div class="mdcards" id="md-cards"></div><div class="mdplan"><div id="md-b"></div>
        <div class="mdverdict"><span>Hung thủ là</span><div id="md-acc"></div></div></div></div>
      <div class="lcdrow"><button class="lcdbtn" id="md-x" aria-pressed="false">ĐÁNH DẤU X: TẮT</button><button class="lcdbtn" id="md-ok">KIỂM TRA</button><button class="lcdbtn" id="md-show">XEM LỜI GIẢI</button></div>
      <div class="lcdrow"><button class="lcdbtn" data-n="4">VỤ 4 x 4</button><button class="lcdbtn" data-n="5">VỤ 5 x 5</button><button class="lcdbtn" data-n="6">VỤ 6 x 6</button></div>
      <div class="msg" id="md-msg" aria-live="polite"></div>
      <p class="mdrule">Mỗi hàng và mỗi cột có đúng một người. Không ai đứng ở ô có cây cảnh, bàn hay tủ sách. Trong phòng của nạn nhân chỉ có thêm một người, đó là hung thủ.</p>`;
    let P = null, st = null;
    const save = () => P && store.set(KEY, { P, place: st.place, marks: [...st.marks], accused: st.accused, done: st.done, sec: st.sec, cur: st.cur });
    const T = setInterval(() => { if (P && !st.done && !document.hidden) { st.sec++; $("#md-t", el).textContent = mmss(st.sec); if (st.sec % 10 === 0) save(); } }, 1000);
    let xMode = false;
    function start(data) {
      P = data.P; const n = P.n;
      st = { people: [...MD_SUSPECTS.slice(0, n - 1), MD_VICTIM], place: data.place || Array(n).fill(-1), marks: new Set(data.marks || []), cur: data.cur || 0, accused: data.accused ?? -1, done: !!data.done, sec: data.sec || 0 };
      draw();
    }
    function fresh(n) {
      $("#md-msg", el).textContent = "Đang dựng hiện trường.";
      setTimeout(() => { const p = mdMake(n); if (!p) { $("#md-msg", el).textContent = "Chưa tạo được vụ án, bấm lần nữa."; return; }
        start({ P: p }); save(); $("#md-msg", el).textContent = `Bấm vào thẻ một người rồi bấm vào ô trên sơ đồ để đặt người đó.`; }, 20);
    }
    function draw() {
      const n = P.n;
      $("#md-n", el).textContent = `VỤ ÁN ${n} x ${n} · ${n} NGƯỜI`;
      $("#md-cards", el).innerHTML = st.people.map((p, k) => `<button class="mdcard${k === st.cur && !xMode ? " on" : ""}${p.victim ? " victim" : ""}" data-p="${k}">
        <span class="mdpic">${mdAvatar(p)}</span><span class="mdname">${esc(p.name)}${st.place[k] >= 0 ? ` <small>${COLS[st.place[k] % n]}${Math.floor(st.place[k] / n) + 1}</small>` : ""}</span>
        <span class="mdsay">${p.victim ? "<b>NẠN NHÂN</b> " : ""}${esc(mdCardText(P, P.cards[k]))}</span></button>`).join("");
      $("#md-b", el).innerHTML = mdBoardSVG(P, id, { ...st, done: st.done });
      $("#md-acc", el).innerHTML = st.people.slice(0, n - 1).map((p, k) => `<button class="lcdbtn${st.accused === k ? " on" : ""}" data-a="${k}" aria-pressed="${st.accused === k}">${esc(p.name.toUpperCase())}</button>`).join("");
      $("#md-t", el).textContent = mmss(st.sec);
    }
    el.addEventListener("click", e => {
      if (!P) return;
      const hit = e.target.closest(".mdhit");
      if (hit && !st.done) {
        const i = +hit.dataset.i, who = st.place.indexOf(i), it = P.item[i];
        if (it && MD_ITEMS[it.k].block) { $("#md-msg", el).textContent = `Không ai đứng được ở ô có ${MD_ITEMS[it.k].label}.`; return; }
        if (xMode) { if (who < 0) st.marks.has(i) ? st.marks.delete(i) : st.marks.add(i); }
        else if (who >= 0) { st.place[who] = -1; st.cur = who; }
        else { st.place[st.cur] = i; st.marks.delete(i); const nx = st.place.findIndex(x => x < 0); if (nx >= 0) st.cur = nx; }
        $("#md-msg", el).textContent = ""; save(); draw(); return;
      }
      const p = e.target.closest("[data-p]"); if (p) { st.cur = +p.dataset.p; xMode = false; $("#md-x", el).textContent = "ĐÁNH DẤU X: TẮT"; draw(); return; }
      const a = e.target.closest("[data-a]"); if (a && !st.done) { st.accused = +a.dataset.a; save(); draw(); return; }
      const nb = e.target.closest("[data-n]"); if (nb) fresh(+nb.dataset.n);
    });
    $("#md-x", el).onclick = e => { xMode = !xMode; e.target.textContent = "ĐÁNH DẤU X: " + (xMode ? "BẬT" : "TẮT"); e.target.setAttribute("aria-pressed", String(xMode)); if (P) draw(); };
    $("#md-ok", el).onclick = () => {
      if (!P || st.done) return;
      const n = P.n, m = $("#md-msg", el), ppl = st.people;
      if (st.place.some(x => x < 0)) { m.textContent = `Còn ${st.place.filter(x => x < 0).length} người chưa có chỗ.`; return; }
      if (new Set(st.place.map(i => Math.floor(i / n))).size < n || new Set(st.place.map(i => i % n)).size < n) { m.textContent = "Có hàng hoặc cột đang có hai người."; return; }
      const bad = st.place.findIndex((i, k) => !P.cards[k].every(a => mdHolds(P, a, i)));
      if (bad >= 0) { m.textContent = `Lời khai của ${ppl[bad].name} chưa khớp với chỗ đứng.`; return; }
      const wrong = st.place.filter((i, k) => i !== P.sol[k]).length;
      if (wrong) { m.textContent = `Lời khai đều khớp nhưng còn ${wrong} người sai chỗ. Nhớ luật hung thủ ở cùng phòng nạn nhân.`; return; }
      if (st.accused < 0) { m.textContent = "Sơ đồ đã đúng. Chọn hung thủ ở ô Hung thủ là."; return; }
      st.done = true; save(); draw();
      m.textContent = st.accused === P.killer ? `Đúng, ${ppl[P.killer].name} là hung thủ. Phá án trong ${dur(st.sec)}.` : `Sơ đồ đúng nhưng hung thủ là ${ppl[P.killer].name}, người ở cùng phòng với ${MD_VICTIM.name}.`;
    };
    $("#md-show", el).onclick = () => { if (!P) return; st.place = P.sol.slice(); st.accused = P.killer; st.done = true; save(); draw(); $("#md-msg", el).textContent = `Hung thủ là ${st.people[P.killer].name}.`; };
    const old = store.get(KEY);
    if (old && old.P && old.P.cards && !old.done) { start(old); $("#md-msg", el).textContent = "Đang điều tra tiếp vụ lần trước."; } else fresh(4);
    return () => { clearInterval(T); save(); };
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
      if (P.sol.every((row, r) => row.every((ch, c) => !ch || val[r][c] === ch))) { done = true; $("#cw-msg", el).textContent = `Xong ô chữ ${P.words.length} từ trong ${dur(sec)}.`; }
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
