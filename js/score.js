/* Bảng tính điểm cho buổi chơi Heavy 13 ngoài đời.
   Cả nhóm chơi bằng thẻ và chip thật, một người nhập lá bài đã lật vào đây.
   Trang chỉ cộng tổng giá đỡ, ghi điểm phạt và xếp hạng. Dữ liệu lưu trên máy đang dùng. */
(function () {
const KEY = "tlc-h13-score";
const STANDS = { r: "Đỏ", g: "Xanh lục", b: "Xanh lam" };
const CHIPS = { r: "Đỏ", g: "Xanh lục", b: "Xanh lam", w: "Cầu vồng" };
const CHIP_MAX = { r: 2, g: 2, b: 2, w: 1 };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } };
const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
const sum = a => a.reduce((x, y) => x + y, 0);

function newGame(names, first) {
  const n = names.length;
  return { names, first, round: 1, stands: { r: [], g: [], b: [] }, pen: Array(n).fill(0), lastPen: Array(n).fill(0),
           used: names.map(() => ({ cards: [], chips: [] })), log: [], hist: [] };
}

function order(s, e) {
  const n = s.names.length, dist = i => (i - s.first + n) % n;
  const play = e.map((x, i) => ({ ...x, i })).filter(x => !x.pass);
  play.sort((a, b) => ((a.chip === "w" ? 0 : 1) - (b.chip === "w" ? 0 : 1)) || (b.card - a.card) || (dist(a.i) - dist(b.i)));
  const passed = e.map((x, i) => ({ ...x, i })).filter(x => x.pass).sort((a, b) => b.pass - a.pass);
  return [...play, ...passed];
}

function check(s, e) {
  const errs = [];
  e.forEach((x, i) => {
    const nm = s.names[i];
    if (!(x.card >= 0 && x.card <= 6)) errs.push(`${nm} chưa chọn thẻ.`);
    if (!x.chip) errs.push(`${nm} chưa chọn chip.`);
    if (x.chip === "w" && !x.stand) errs.push(`${nm} nộp chip cầu vồng, cần chọn giá đỡ.`);
    if (s.used[i].cards.includes(x.card)) errs.push(`${nm} đã dùng thẻ ${x.card} trong bộ này.`);
    if (x.chip && s.used[i].chips.filter(c => c === x.chip).length >= CHIP_MAX[x.chip]) errs.push(`${nm} đã dùng hết chip ${CHIPS[x.chip].toLowerCase()} trong bộ này.`);
  });
  const ps = e.map(x => x.pass).filter(Boolean);
  if (new Set(ps).size !== ps.length) errs.push("Hai người không được trùng số thứ tự bỏ lượt.");
  if (ps.length === e.length) errs.push("Phải có ít nhất một người không bỏ lượt.");
  return errs;
}

function playRound(s0, e) {
  const s = JSON.parse(JSON.stringify(s0)); s.hist = undefined;
  const lines = []; let lastHit = -1;
  for (const x of order(s, e)) {
    const st = x.chip === "w" ? x.stand : x.chip, pile = s.stands[st];
    pile.push(x.card);
    const tot = sum(pile);
    let line = `${s.names[x.i]} đặt đá ${x.card} lên giá ${STANDS[st].toLowerCase()}${x.pass ? " sau khi bỏ lượt" : ""}, tổng ${tot}.`;
    if (tot >= 13) {
      const taken = pile.slice(0, -1);
      s.pen[x.i] += taken.length; s.lastPen[x.i] = s.round; lastHit = x.i;
      s.stands[st] = [x.card];
      line += ` Chạm 13, nhận ${taken.length} viên đá, bị phạt ${taken.length} điểm.`;
    }
    lines.push(line);
    s.used[x.i].cards.push(x.card); s.used[x.i].chips.push(x.chip);
  }
  if (lastHit >= 0) { s.first = lastHit; lines.push(`${s.names[lastHit]} giữ thẻ đi trước ở vòng sau.`); }
  else lines.push(`Không ai bị phạt, ${s.names[s.first]} giữ thẻ đi trước.`);
  s.log.unshift({ round: s.round, lines });
  if (s.round === 7) { s.used = s.names.map(() => ({ cards: [], chips: [] })); s.log[0].lines.push("Hết vòng 7, mọi người nhận bộ thẻ và chip mới. Đá trên giá giữ nguyên."); }
  s.round++;
  s.hist = [...(s0.hist || []), JSON.stringify({ ...s0, hist: undefined })];
  return s;
}

function ranking(s) {
  return s.names.map((name, i) => ({ name, i, pen: s.pen[i], last: s.lastPen[i] }))
    .sort((a, b) => (a.pen - b.pen) || (a.last - b.last));
}

function mount(el) {
  let s = load(), entry = null;
  const draw = () => {
    if (!s) return setup();
    if (s.round > 14) return finish();
    roundView();
  };

  function setup() {
    el.innerHTML = `<div class="panel"><h3>BẮT ĐẦU VÁN MỚI</h3>
      <p>Nhập tên người chơi theo thứ tự chỗ ngồi theo chiều kim đồng hồ, mỗi dòng một người. Heavy 13 trong chương trình có 7 người.</p>
      <div class="form-row"><label style="flex:1 1 260px">Tên người chơi<textarea id="h-names" rows="7" style="border:2px solid var(--ink);padding:8px;font-size:15px">Người 1\nNgười 2\nNgười 3\nNgười 4\nNgười 5\nNgười 6\nNgười 7</textarea></label>
      <label>Người giữ thẻ đi trước ở vòng 1<select id="h-first"></select></label></div>
      <div class="lcdrow" style="justify-content:flex-start"><button class="btn primary" id="h-start">Bắt đầu ghi điểm</button></div>
      <p class="hint" id="h-err"></p></div>`;
    const ta = el.querySelector("#h-names"), sel = el.querySelector("#h-first");
    const sync = () => { const ns = ta.value.split("\n").map(x => x.trim()).filter(Boolean); sel.innerHTML = ns.map((x, i) => `<option value="${i}">${esc(x)}</option>`).join(""); };
    ta.oninput = sync; sync();
    el.querySelector("#h-start").onclick = () => {
      const ns = ta.value.split("\n").map(x => x.trim()).filter(Boolean);
      if (ns.length < 3 || ns.length > 8) { el.querySelector("#h-err").textContent = "Cần từ 3 đến 8 người chơi."; return; }
      s = newGame(ns, +sel.value || 0); save(s); entry = null; draw();
    };
  }

  function standsHTML() {
    return `<div class="stands">${Object.keys(STANDS).map(k => `<div class="stand st-${k}"><div class="pile">${s.stands[k].map(v => `<span class="rock">${v}</span>`).join("") || `<span class="hint">Trống</span>`}</div><div class="sbox">${STANDS[k]}</div><div class="stot">Tổng ${sum(s.stands[k])}</div></div>`).join("")}</div>`;
  }
  function scoreHTML() {
    return `<table class="sheet-t"><thead><tr><th>Người chơi</th><th>Điểm phạt</th><th>Vòng bị phạt gần nhất</th></tr></thead><tbody>${s.names.map((n, i) => `<tr${i === s.first ? ' class="first"' : ""}><td>${esc(n)}${i === s.first ? " · đi trước" : ""}</td><td>${s.pen[i]}</td><td>${s.lastPen[i] || "Chưa"}</td></tr>`).join("")}</tbody></table>`;
  }

  function roundView() {
    if (!entry || entry.round !== s.round) entry = { round: s.round, e: s.names.map(() => ({ card: -1, chip: "", stand: "", pass: 0 })) };
    const e = entry.e, set = s.round <= 7 ? 1 : 2;
    el.innerHTML = `<div class="room">
      <div>
        <div class="panel"><h3>VÒNG ${s.round}/14 · BỘ ${set}</h3>
          <p class="hint">Mọi người lật chip và thẻ xong thì nhập vào bảng. Ai bỏ lượt thì ghi thứ tự bỏ lượt 1, 2, 3 theo lúc họ bỏ.</p>
          <div class="tbl"><table class="sheet-t entry"><thead><tr><th>Người chơi</th><th>Thẻ</th><th>Chip</th><th>Giá cho chip cầu vồng</th><th>Bỏ lượt</th></tr></thead><tbody>
          ${s.names.map((n, i) => `<tr><td>${esc(n)}</td>
            <td><select data-i="${i}" data-f="card"><option value="-1">Chọn</option>${[0,1,2,3,4,5,6].map(v => `<option value="${v}" ${e[i].card === v ? "selected" : ""} ${s.used[i].cards.includes(v) ? "disabled" : ""}>${v}</option>`).join("")}</select></td>
            <td><select data-i="${i}" data-f="chip"><option value="">Chọn</option>${Object.keys(CHIPS).map(c => `<option value="${c}" ${e[i].chip === c ? "selected" : ""} ${s.used[i].chips.filter(x => x === c).length >= CHIP_MAX[c] ? "disabled" : ""}>${CHIPS[c]}</option>`).join("")}</select></td>
            <td><select data-i="${i}" data-f="stand" ${e[i].chip === "w" ? "" : "disabled"}><option value="">Không cần</option>${Object.keys(STANDS).map(k => `<option value="${k}" ${e[i].stand === k ? "selected" : ""}>${STANDS[k]}</option>`).join("")}</select></td>
            <td><select data-i="${i}" data-f="pass"><option value="0">Không</option>${s.names.map((_, k) => `<option value="${k + 1}" ${e[i].pass === k + 1 ? "selected" : ""}>Thứ ${k + 1}</option>`).join("")}</select></td></tr>`).join("")}
          </tbody></table></div>
          <div class="lcdrow" style="justify-content:flex-start"><button class="btn primary" id="h-go">Đặt đá vòng này</button><button class="btn" id="h-undo" ${s.hist && s.hist.length ? "" : "disabled"}>Hoàn tác vòng trước</button></div>
          <div class="hint" id="h-err" aria-live="polite"></div>
          <div class="hint" id="h-order"></div>
        </div>
        <div class="sec">GIÁ ĐỠ</div>${standsHTML()}
        <div class="sec">DIỄN BIẾN</div><div class="panel">${s.log.length ? s.log.map(r => `<p><b>Vòng ${r.round}.</b> ${r.lines.map(esc).join(" ")}</p>`).join("") : "<p class=\"hint\">Chưa có vòng nào.</p>"}</div>
      </div>
      <aside><div class="panel"><h3>ĐIỂM PHẠT</h3>${scoreHTML()}<div class="lcdrow" style="justify-content:flex-start"><button class="btn danger" id="h-reset">Bắt đầu ván khác</button></div><div id="h-confirm"></div></div></aside>
    </div>`;
    const preview = () => {
      const ok = e.every(x => x.card >= 0 && x.chip && (x.chip !== "w" || x.stand));
      el.querySelector("#h-order").textContent = ok ? "Thứ tự đặt đá: " + order(s, e).map(x => s.names[x.i]).join(", ") + "." : "";
    };
    el.querySelectorAll("select[data-f]").forEach(x => x.onchange = () => {
      const i = +x.dataset.i, f = x.dataset.f; e[i][f] = f === "card" || f === "pass" ? +x.value : x.value;
      if (f === "chip") { if (x.value !== "w") e[i].stand = ""; roundView(); return; }
      preview();
    });
    preview();
    el.querySelector("#h-go").onclick = () => {
      const errs = check(s, e);
      if (errs.length) { el.querySelector("#h-err").textContent = errs.join(" "); return; }
      s = playRound(s, e); save(s); entry = null; draw();
    };
    el.querySelector("#h-undo").onclick = () => { if (!s.hist || !s.hist.length) return; const prev = JSON.parse(s.hist[s.hist.length - 1]); prev.hist = s.hist.slice(0, -1); s = prev; save(s); entry = null; draw(); };
    el.querySelector("#h-reset").onclick = () => {
      el.querySelector("#h-confirm").innerHTML = `<div class="confirm"><span>Xóa ván đang ghi trên máy này.</span><button class="btn danger" id="h-yes">Xóa ván</button><button class="btn" id="h-no">Giữ lại</button></div>`;
      el.querySelector("#h-yes").onclick = () => { s = null; save(null); try { localStorage.removeItem(KEY); } catch (e) {} draw(); };
      el.querySelector("#h-no").onclick = () => { el.querySelector("#h-confirm").innerHTML = ""; };
    };
  }

  function finish() {
    const r = ranking(s), n = r.length;
    el.innerHTML = `<div class="panel"><h3>KẾT QUẢ SAU 14 VÒNG</h3>
      <table class="sheet-t"><thead><tr><th>Hạng</th><th>Người chơi</th><th>Điểm phạt</th><th>Ghi chú</th></tr></thead><tbody>
      ${r.map((x, k) => `<tr><td>${k + 1}</td><td>${esc(x.name)}</td><td>${x.pen}</td><td>${k === 0 ? "Nhận 4 piece" : k >= n - 2 && n >= 5 ? "Bị loại" : ""}</td></tr>`).join("")}
      </tbody></table>
      <p class="hint">Bằng điểm thì ai bị phạt ở vòng gần đây hơn xếp thấp hơn. Nếu nhiều người cùng hạng nhất, họ chia đều 4 piece.</p>
      <div class="lcdrow" style="justify-content:flex-start"><button class="btn" id="h-undo">Hoàn tác vòng cuối</button><button class="btn primary" id="h-new">Ván mới</button></div></div>
      <div class="sec">DIỄN BIẾN</div><div class="panel">${s.log.map(x => `<p><b>Vòng ${x.round}.</b> ${x.lines.map(esc).join(" ")}</p>`).join("")}</div>`;
    el.querySelector("#h-new").onclick = () => { s = null; try { localStorage.removeItem(KEY); } catch (e) {} draw(); };
    el.querySelector("#h-undo").onclick = () => { const prev = JSON.parse(s.hist[s.hist.length - 1]); prev.hist = s.hist.slice(0, -1); s = prev; save(s); entry = null; draw(); };
  }

  draw();
  return () => {};
}

window.TLC_SCORE = { heavy13: { name: "Bảng tính điểm Heavy 13", mount, order, playRound, newGame, ranking, check } };
})();
