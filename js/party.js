/* Play with Zile — trò chơi nhóm đông người: Mũ trắng mũ đen, Ma sói.
   Cùng giao diện với js/games.js: init(players), move(state, mv, seat), view(el, ctx). */
(function () {
const G = window.TLC_GAMES;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const fail = m => { throw new Error(m); };
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const STALE_MS = 120000; // sau 2 phút ai cũng bấm được nút cho ván chạy tiếp
function armStale(el, s, redraw) { // vẽ lại đúng lúc đủ 2 phút để nút cho ván chạy tiếp tự hiện
  clearTimeout(el._staleT);
  const left = STALE_MS - (Date.now() - (s.phaseAt || 0));
  if (!s.winner && left > 0) el._staleT = setTimeout(() => { if (el.isConnected) redraw(); }, left + 500);
}
const nm = (ctx, i) => esc(ctx.players[i]?.name || "Người chơi " + (i + 1));
function chatBox(s, ctx, can) {
  const list = (s.chat || []).slice(-30).map(m => `<div><b>${nm(ctx, m.seat)}</b> ${esc(m.text)}</div>`).join("");
  return `<div class="chat"><div class="chatlog">${list || '<span class="hint">Chưa có tin nhắn.</span>'}</div>${can ? `<form class="chatform"><input maxlength="120" placeholder="Nhắn cho cả phòng" aria-label="Tin nhắn"><button class="lcdbtn">GỬI</button></form>` : ""}</div>`;
}
function bindChat(el, ctx) {
  const f = el.querySelector(".chatform"); if (!f) return;
  f.onsubmit = e => { e.preventDefault(); const i = f.querySelector("input"); const t = i.value.trim(); if (t) { ctx.send({ t: "chat", text: t }); i.value = ""; } };
  const log = el.querySelector(".chatlog"); if (log) log.scrollTop = log.scrollHeight;
}
function pushChat(s, seat, text) {
  const t = String(text || "").trim().slice(0, 120); if (!t) fail("Tin nhắn trống.");
  s.chat = [...(s.chat || []), { seat, text: t }].slice(-60);
}
const staleBtn = s => Date.now() - (s.phaseAt || 0) > STALE_MS ? `<button class="lcdbtn" data-force="1">CHO VÁN CHẠY TIẾP</button>` : `<span class="hint">Sau 2 phút chờ, nút cho ván chạy tiếp sẽ hiện ra.</span>`;

/* ===================== MŨ TRẮNG MŨ ĐEN ===================== */
const PAIRS = `Cà phê|Trà sữa;Mèo|Chó;Bún bò|Phở;Bánh mì|Bánh bao;Xe máy|Xe đạp;Biển|Hồ bơi;Điện thoại|Máy tính bảng;Kem|Sữa chua;Facebook|Instagram;Táo|Lê;Cam|Quýt;Dưa hấu|Dưa lưới;Bác sĩ|Y tá;Giáo viên|Gia sư;Mưa|Tuyết;Mặt trời|Mặt trăng;Son môi|Phấn má;Giày|Dép;Áo dài|Áo bà ba;Karaoke|Rạp phim;Tết|Trung thu;Bánh chưng|Bánh tét;Lẩu|Đồ nướng;Trà đá|Nước mía;Đà Lạt|Sa Pa;Hà Nội|Sài Gòn;Cơm tấm|Cơm gà;Gấu bông|Búp bê;Netflix|YouTube;Ốc|Sò;Tôm|Cua;Bóng đá|Bóng chuyền;Cầu lông|Quần vợt;Đàn guitar|Đàn piano;Ca sĩ|Diễn viên;Sách|Truyện tranh;Bút bi|Bút chì;Ghế|Sofa;Đồng hồ|Vòng tay;Kính râm|Kính cận;Ô|Áo mưa;Xe buýt|Tàu điện;Máy bay|Trực thăng;Khách sạn|Homestay;Sinh nhật|Đám cưới;Hoa hồng|Hoa ly;Chuối|Xoài;Mì gói|Miến;Trà chanh|Trà tắc;Nước ngọt|Bia;Gối|Chăn;Tủ lạnh|Máy giặt;Điều hòa|Quạt máy;Vịt|Ngỗng;Sư tử|Hổ;Cá heo|Cá mập;Bánh flan|Rau câu;Chè|Sinh tố;Zalo|Messenger;Shopee|Lazada;Pizza|Hamburger;Sushi|Kimbap;Thư viện|Nhà sách;Bệnh viện|Phòng khám;Siêu thị|Chợ;Công viên|Sở thú;Núi|Đồi;Sông|Suối;Ếch|Cóc;Bướm|Chuồn chuồn;Ong|Ruồi;Kẹo|Sô cô la;Bánh quy|Bánh xốp;Nồi cơm điện|Lò vi sóng;Bàn chải|Lược;Xà phòng|Dầu gội;Nhẫn|Dây chuyền;Váy|Quần short;Tai nghe|Loa;Máy ảnh|Máy quay;Thang máy|Cầu thang;Cửa sổ|Ban công;Hoa mai|Hoa đào`.split(";").map(x => x.split("|"));
const UC_ROLE = { dan: "Dân thường", den: "Mũ đen", trang: "Mũ trắng" };
function ucCounts(n) { return n <= 5 ? { den: 1, trang: n >= 5 ? 1 : 0 } : n <= 8 ? { den: 1, trang: 1 } : { den: 2, trang: 1 }; }
function ucWin(s) {
  const alive = s.alive.map((a, i) => a ? i : -1).filter(i => i >= 0);
  const bad = alive.filter(i => s.roles[i] !== "dan").length, good = alive.length - bad;
  if (bad === 0) return "Dân thường";
  if (bad >= good) return "Mũ đen và Mũ trắng";
  return null;
}
const CLUE_MS = 20000, TALK_MS = 120000; // 20 giây mỗi lượt gợi ý, 2 phút trao đổi
function ucNextClue(s) {
  s.phaseAt = Date.now();
  for (let k = s.turnIdx + 1; k < s.order.length; k++) if (s.alive[s.order[k]]) { s.turnIdx = k; return; }
  s.phase = "talk"; s.votes = {};
  s.chat = [...(s.chat || []), { sys: 1, text: "Hết lượt gợi ý. Cả phòng có 2 phút trao đổi trước khi bỏ phiếu." }].slice(-60);
}
function ucStartRound(s) {
  s.round++; s.phase = "clue"; s.turnIdx = -1; s.votes = {};
  s.chat = [...(s.chat || []), { sys: 1, text: `Vòng ${s.round} bắt đầu. Mỗi người có 20 giây để gợi ý.` }].slice(-60);
  ucNextClue(s);
}
function ucClue(s, seat, text, auto) {
  s.clues.push({ r: s.round, seat, text });
  s.chat = [...(s.chat || []), { seat, text, clue: 1, auto: auto ? 1 : 0 }].slice(-60);
  ucNextClue(s);
}
function ucTally(s) {
  const alive = s.alive.filter(Boolean).length, cnt = {};
  Object.values(s.votes).forEach(t => { if (t >= 0) cnt[t] = (cnt[t] || 0) + 1; });
  const top = Math.max(0, ...Object.values(cnt)), who = Object.keys(cnt).filter(k => cnt[k] === top).map(Number);
  if (!top || who.length !== 1) { s.log.unshift(`Vòng ${s.round}, phiếu bị hòa nên không ai bị loại.`); return ucStartRound(s); }
  const out = who[0]; s.alive[out] = false;
  s.log.unshift(`Vòng ${s.round}, ${s.names[out]} bị loại với ${top} trên ${alive} phiếu và lộ vai ${UC_ROLE[s.roles[out]]}.`);
  if (s.roles[out] === "trang") { s.phase = "guess"; s.guessSeat = out; s.phaseAt = Date.now(); return; }
  s.winner = ucWin(s); if (!s.winner) ucStartRound(s);
}
const ucLimit = s => s.phase === "clue" ? CLUE_MS : s.phase === "talk" ? TALK_MS : 0;
G.whitehat = { kind: "online", flexible: true, minP: 4, maxP: 12, name: "Mũ trắng mũ đen",
  desc: "Cả phòng nhận cùng một từ khóa, Mũ đen nhận từ gần giống, Mũ trắng không có từ. Mỗi người có 20 giây gợi ý, cả phòng trao đổi 2 phút rồi bỏ phiếu loại một người.",
  init(players) {
    const n = players.length, c = ucCounts(n), roles = shuffle([...Array(c.den).fill("den"), ...Array(c.trang).fill("trang"), ...Array(n - c.den - c.trang).fill("dan")]);
    const pair = PAIRS[rnd(PAIRS.length)], flip = rnd(2);
    let order = shuffle([...Array(n).keys()]);
    if (roles[order[0]] === "trang") order.push(order.shift());
    const s = { names: players.map((p, i) => p.name || "Người chơi " + (i + 1)), roles, words: { dan: pair[flip], den: pair[1 - flip] }, alive: Array(n).fill(true),
      order, turnIdx: -1, round: 0, phase: "clue", clues: [], votes: {}, guessSeat: -1, guess: "", log: [], chat: [], winner: null, phaseAt: Date.now() };
    ucStartRound(s); return s;
  },
  move(s0, mv, seat) {
    const s = clone(s0); if (s.winner) fail("Ván đã kết thúc.");
    if (mv.t === "chat") {
      if (!s.alive[seat]) fail("Người đã bị loại chỉ được xem.");
      if (s.phase === "clue") fail("Đang tới lượt gợi ý, chờ tới lúc trao đổi rồi hãy nhắn.");
      pushChat(s, seat, mv.text); return s;
    }
    if (mv.t === "timeout") { // máy nào thấy hết giờ trước thì báo, các máy khác bị bỏ qua lặng lẽ
      const late = Date.now() - (s.phaseAt || 0) >= ucLimit(s) - 1500;
      if (s.phase === "clue" && mv.turn === s.turnIdx && late) { ucClue(s, s.order[s.turnIdx], "Hết 20 giây, không gợi ý", true); return s; }
      if (s.phase === "talk" && mv.round === s.round && late) { s.phase = "vote"; s.votes = {}; s.phaseAt = Date.now(); s.chat = [...s.chat, { sys: 1, text: "Hết giờ trao đổi. Mời cả phòng bỏ phiếu." }].slice(-60); return s; }
      fail("");
    }
    if (mv.t === "force") {
      if (Date.now() - (s.phaseAt || 0) < STALE_MS) fail("Chưa đủ 2 phút chờ.");
      if (s.phase === "vote") { s.alive.forEach((a, i) => { if (a && s.votes[i] === undefined) s.votes[i] = -1; }); ucTally(s); }
      else if (s.phase === "guess") { s.log.unshift(`${s.names[s.guessSeat]} không đoán từ khóa.`); s.winner = ucWin(s); if (!s.winner) ucStartRound(s); }
      return s;
    }
    if (s.phase === "clue") {
      if (s.order[s.turnIdx] !== seat) fail("Chưa tới lượt bạn gợi ý.");
      const t = String(mv.text || "").trim().slice(0, 60); if (!t) fail("Nhập một câu gợi ý.");
      const mine = s.roles[seat] === "trang" ? "" : s.words[s.roles[seat] === "den" ? "den" : "dan"];
      if (mine && (" " + norm(t) + " ").includes(" " + norm(mine) + " ")) fail("Gợi ý không được chứa từ khóa của bạn.");
      ucClue(s, seat, t, false); return s;
    }
    if (s.phase === "talk") {
      if (mv.t === "skiptalk") { s.phase = "vote"; s.votes = {}; s.phaseAt = Date.now(); s.chat = [...s.chat, { sys: 1, text: `${s.names[seat]} mở bỏ phiếu sớm.` }].slice(-60); return s; }
      fail("Đang trao đổi, 2 phút sau mới bỏ phiếu.");
    }
    if (s.phase === "vote") {
      if (!s.alive[seat]) fail("Người đã bị loại không được bỏ phiếu.");
      const t = +mv.target; if (t !== -1 && (!s.alive[t] || t === seat)) fail("Chọn một người khác còn trong ván.");
      s.votes[seat] = t;
      if (s.alive.every((a, i) => !a || s.votes[i] !== undefined)) ucTally(s);
      return s;
    }
    if (s.phase === "guess") {
      if (seat !== s.guessSeat) fail("Chỉ Mũ trắng vừa bị loại được đoán.");
      s.guess = String(mv.text || "").trim().slice(0, 40);
      if (norm(s.guess) === norm(s.words.dan)) { s.log.unshift(`${s.names[seat]} đoán đúng từ khóa ${s.words.dan} và lật ngược thế trận.`); s.winner = "Mũ trắng"; }
      else { s.log.unshift(`${s.names[seat]} đoán ${s.guess || "trống"}, chưa đúng.`); s.winner = ucWin(s); if (!s.winner) ucStartRound(s); }
      return s;
    }
    fail("Thao tác không hợp lệ.");
  },
  view(el, ctx) {
    const s = ctx.state, me = ctx.seat, my = s.roles[me], over = !!s.winner, alive = me >= 0 && s.alive[me];
    const wordOf = i => s.roles[i] === "trang" ? "không có từ" : s.words[s.roles[i] === "den" ? "den" : "dan"];
    const card = me >= 0 ? `<div class="rolecard ${my === "trang" ? "trang" : "word"}"><div class="small">TỪ KHÓA CỦA BẠN</div><div class="big">${my === "trang" ? "BẠN LÀ MŨ TRẮNG" : esc(wordOf(me)).toUpperCase()}</div><div class="hint">${my === "trang" ? "Bạn không có từ khóa. Nghe gợi ý của mọi người rồi nói theo cho khéo." : "Có thể bạn là Dân thường, cũng có thể bạn là Mũ đen. Nghe gợi ý để đoán phe mình."}</div>${alive ? "" : `<div class="hint">Bạn đã bị loại, giờ chỉ xem.</div>`}</div>` : "";
    const sp = s.phase === "clue" ? s.order[s.turnIdx] : -1;
    const people = `<ul class="plist">${s.names.map((n, i) => `<li class="${s.alive[i] ? "" : "dead"}${i === sp ? " speaking" : ""}"><span>${esc(n)}${i === me ? " · bạn" : ""}</span><span class="rd">${!s.alive[i] || over ? UC_ROLE[s.roles[i]] : i === sp ? "Đang gợi ý" : s.phase === "vote" ? (s.votes[i] !== undefined ? "Đã bỏ phiếu" : "Đang chọn") : ""}</span></li>`).join("")}</ul>`;
    const limit = ucLimit(s), timer = limit && !over ? `<span id="uc-cd">${Math.max(0, Math.ceil((limit - (Date.now() - s.phaseAt)) / 1000))}</span> GIÂY` : "";
    let act = "";
    if (over) act = `<div class="msg">${esc(s.winner)} thắng. Từ của Dân thường là ${esc(s.words.dan)}, từ của Mũ đen là ${esc(s.words.den)}.</div>`;
    else if (s.phase === "clue") act = sp === me ? `<div class="msg">Tới lượt bạn. Gõ một câu gợi ý trong 20 giây.</div><form class="chatform" id="uc-clue"><input maxlength="60" placeholder="Một câu gợi ý, không nói thẳng từ khóa" aria-label="Gợi ý" autocomplete="off"><button class="lcdbtn">GỬI GỢI Ý</button></form>` : `<div class="msg">Tới lượt ${esc(s.names[sp])} gợi ý, còn ${timer || "vài giây"}.</div>`;
    else if (s.phase === "talk") act = `<div class="msg">Cả phòng trao đổi trong khung chat, còn ${timer}. Hết giờ sẽ tự mở bỏ phiếu.</div>${alive ? `<div class="lcdrow"><button class="lcdbtn" data-skip="1">BỎ PHIẾU LUÔN</button></div>` : ""}`;
    else if (s.phase === "vote") act = alive ? (s.votes[me] !== undefined ? `<div class="msg">Bạn đã bỏ phiếu, chờ mọi người.</div>` : `<div class="msg">Bỏ phiếu loại một người khả nghi.</div><div class="lcdrow">${s.alive.map((a, i) => a && i !== me ? `<button class="lcdbtn" data-vote="${i}">${esc(s.names[i])}</button>` : "").join("")}<button class="lcdbtn" data-vote="-1">KHÔNG BẦU</button></div>`) : `<div class="msg">Mọi người đang bỏ phiếu.</div>`;
    else if (s.phase === "guess") act = me === s.guessSeat ? `<div class="msg">Bạn là Mũ trắng và vừa bị loại. Đoán từ khóa của Dân thường để thắng.</div><form class="chatform" id="uc-guess"><input maxlength="40" placeholder="Từ khóa của Dân thường" aria-label="Đoán từ khóa"><button class="lcdbtn">ĐOÁN</button></form>` : `<div class="msg">${esc(s.names[s.guessSeat])} là Mũ trắng, đang đoán từ khóa của Dân thường.</div>`;
    const msgs = (s.chat || []).slice(-40).map(m => m.sys ? `<div class="sys">${esc(m.text)}</div>` : m.clue ? `<div class="clue${m.auto ? " auto" : ""}"><b>${nm(ctx, m.seat)}</b> gợi ý: ${esc(m.text)}</div>` : `<div><b>${nm(ctx, m.seat)}</b> ${esc(m.text)}</div>`).join("");
    const canChat = alive && !over && (s.phase === "talk" || s.phase === "vote");
    const phaseName = over ? "KẾT THÚC" : { clue: "GỢI Ý", talk: "TRAO ĐỔI", vote: "BỎ PHIẾU", guess: "MŨ TRẮNG ĐOÁN" }[s.phase];
    el.innerHTML = `<div class="score"><span>VÒNG ${s.round}</span><span>${phaseName}</span><span>${timer}</span></div>
      <div class="party">${card}<div>${people}</div></div>
      <div class="chat main"><div class="chatlog">${msgs || '<span class="hint">Chưa có tin nhắn.</span>'}</div>
      ${canChat ? `<form class="chatform" id="uc-chat"><input maxlength="120" placeholder="Nhắn cho cả phòng" aria-label="Tin nhắn" autocomplete="off"><button class="lcdbtn">GỬI</button></form>` : ""}</div>
      ${act}${!over && (s.phase === "vote" || s.phase === "guess") ? `<div class="lcdrow">${staleBtn(s)}</div>` : ""}
      <div class="log">${s.log.slice(0, 6).map(esc).join("<br>")}</div>`;
    const log = el.querySelector(".chatlog"); if (log) log.scrollTop = log.scrollHeight;
    const cf = el.querySelector("#uc-clue"); if (cf) { cf.onsubmit = e => { e.preventDefault(); ctx.send({ text: cf.querySelector("input").value }); }; cf.querySelector("input").focus(); }
    const ch = el.querySelector("#uc-chat"); if (ch) ch.onsubmit = e => { e.preventDefault(); const i = ch.querySelector("input"); if (i.value.trim()) ctx.send({ t: "chat", text: i.value }); i.value = ""; };
    const gf = el.querySelector("#uc-guess"); if (gf) gf.onsubmit = e => { e.preventDefault(); ctx.send({ text: gf.querySelector("input").value }); };
    el.querySelectorAll("[data-vote]").forEach(b => b.onclick = () => ctx.send({ target: +b.dataset.vote }));
    el.querySelectorAll("[data-skip]").forEach(b => b.onclick = () => ctx.send({ t: "skiptalk" }));
    el.querySelectorAll("[data-force]").forEach(b => b.onclick = () => ctx.send({ t: "force" }));
    // Đồng hồ đếm ngược: chỉ đổi con số, không vẽ lại để không mất chữ đang gõ.
    clearInterval(el._cd);
    if (limit && !over) {
      const key = s.phase + ":" + s.round + ":" + s.turnIdx;
      el._cd = setInterval(() => {
        if (!el.isConnected) { clearInterval(el._cd); return; }
        const left = limit - (Date.now() - s.phaseAt), c = el.querySelector("#uc-cd");
        if (c) c.textContent = Math.max(0, Math.ceil(left / 1000));
        if (left <= 0 && el._toSent !== key) { el._toSent = key; ctx.send(s.phase === "clue" ? { t: "timeout", turn: s.turnIdx } : { t: "timeout", round: s.round }); }
      }, 500);
    }
    armStale(el, s, () => G.whitehat.view(el, ctx));
  } };

/* ===================== MA SÓI ===================== */
const WW = { soi: "Ma sói", tientri: "Tiên tri", baove: "Bảo vệ", phuthuy: "Phù thủy", dan: "Dân làng" };
const WW_DESC = {
  soi: "Mỗi đêm cùng bầy sói chọn một người để cắn. Thắng khi số sói bằng số người còn lại.",
  tientri: "Mỗi đêm soi một người để biết người đó có phải sói không.",
  baove: "Mỗi đêm che chở một người khỏi bị sói cắn, không được che cùng một người hai đêm liền.",
  phuthuy: "Có một bình cứu và một bình độc, mỗi bình dùng một lần trong cả ván.",
  dan: "Không có chức năng ban đêm. Ban ngày thảo luận và bỏ phiếu tìm ra sói."
};
function wwRoles(n) {
  const wolves = n <= 6 ? 1 : n <= 9 ? 2 : 3, r = [...Array(wolves).fill("soi"), "tientri", "baove"];
  if (n >= 7) r.push("phuthuy");
  while (r.length < n) r.push("dan");
  return shuffle(r);
}
const aliveOf = (s, role) => s.roles.map((r, i) => r === role && s.alive[i] ? i : -1).filter(i => i >= 0);
function wwWin(s) {
  const w = aliveOf(s, "soi").length, others = s.alive.filter(Boolean).length - w;
  if (w === 0) return "Dân làng"; if (w >= others) return "Ma sói"; return null;
}
function wolfTarget(s) {
  const cnt = {}; aliveOf(s, "soi").forEach(i => { const t = s.picks.wolf[i]; if (t !== undefined && t >= 0) cnt[t] = (cnt[t] || 0) + 1; });
  const top = Math.max(0, ...Object.values(cnt)); if (!top) return -1;
  const c = Object.keys(cnt).filter(k => cnt[k] === top).map(Number); return c[0];
}
function wwStep1Done(s) {
  const wolvesOk = aliveOf(s, "soi").every(i => s.picks.wolf[i] !== undefined);
  const g = aliveOf(s, "baove"), sr = aliveOf(s, "tientri");
  return wolvesOk && (!g.length || s.picks.guard !== undefined) && (!sr.length || s.picks.seer !== undefined);
}
function wwAfterStep1(s) {
  s.victim = wolfTarget(s);
  const w = aliveOf(s, "phuthuy");
  if (w.length && (s.potion.save || s.potion.poison)) { s.step = 2; s.phaseAt = Date.now(); return; }
  wwResolveNight(s, { save: false, poison: -1 });
}
function wwResolveNight(s, wp) {
  const dead = [];
  if (s.victim >= 0 && s.victim !== s.picks.guard && !wp.save) dead.push(s.victim);
  if (wp.save) s.potion.save = false;
  if (wp.poison >= 0 && s.alive[wp.poison]) { s.potion.poison = false; if (!dead.includes(wp.poison)) dead.push(wp.poison); }
  dead.forEach(i => s.alive[i] = false);
  s.lastGuard = s.picks.guard ?? -1;
  s.log.unshift(dead.length ? `Sáng ngày ${s.day}, ${dead.map(i => s.names[i] + " là " + WW[s.roles[i]]).join(" và ")} đã chết trong đêm.` : `Sáng ngày ${s.day}, đêm qua không ai chết.`);
  s.phase = "day"; s.step = 0; s.picks = { wolf: {} }; s.victim = -1; s.votes = {}; s.phaseAt = Date.now();
  s.winner = wwWin(s);
}
function wwTallyDay(s) {
  const cnt = {}; Object.values(s.votes).forEach(t => { if (t >= 0) cnt[t] = (cnt[t] || 0) + 1; });
  const top = Math.max(0, ...Object.values(cnt)), who = Object.keys(cnt).filter(k => cnt[k] === top).map(Number);
  if (!top || who.length !== 1) s.log.unshift(`Chiều ngày ${s.day}, phiếu bị hòa hoặc không ai bầu nên không ai bị treo.`);
  else { const o = who[0]; s.alive[o] = false; s.log.unshift(`Chiều ngày ${s.day}, ${s.names[o]} bị treo với ${top} phiếu và lộ vai ${WW[s.roles[o]]}.`); }
  s.winner = wwWin(s); if (s.winner) return;
  s.day++; s.phase = "night"; s.step = 1; s.picks = { wolf: {} }; s.votes = {}; s.phaseAt = Date.now();
}
G.werewolf = { kind: "online", flexible: true, minP: 5, maxP: 12, name: "Ma sói",
  desc: "Trang làm quản trò, tự chia vai Ma sói, Tiên tri, Bảo vệ, Phù thủy và Dân làng. Đêm thì các vai hành động, ngày thì cả làng bỏ phiếu treo người khả nghi.",
  init(players) {
    const n = players.length;
    return { names: players.map((p, i) => p.name || "Người chơi " + (i + 1)), roles: wwRoles(n), alive: Array(n).fill(true), day: 1, phase: "night", step: 1,
      picks: { wolf: {} }, lastGuard: -1, potion: { save: true, poison: true }, seen: {}, victim: -1, votes: {}, log: [], chat: [], winner: null, phaseAt: Date.now() };
  },
  move(s0, mv, seat) {
    const s = clone(s0); if (s.winner) fail("Ván đã kết thúc.");
    const role = s.roles[seat];
    if (mv.t === "chat") { if (!s.alive[seat]) fail("Người đã chết chỉ được xem."); if (s.phase !== "day") fail("Ban đêm cả làng phải im lặng."); pushChat(s, seat, mv.text); return s; }
    if (mv.t === "force") {
      if (Date.now() - (s.phaseAt || 0) < STALE_MS) fail("Chưa đủ 2 phút chờ.");
      if (s.phase === "night" && s.step === 1) { aliveOf(s, "soi").forEach(i => { if (s.picks.wolf[i] === undefined) s.picks.wolf[i] = -1; }); if (aliveOf(s, "baove").length && s.picks.guard === undefined) s.picks.guard = -1; if (aliveOf(s, "tientri").length && s.picks.seer === undefined) s.picks.seer = -1; wwAfterStep1(s); }
      else if (s.phase === "night" && s.step === 2) wwResolveNight(s, { save: false, poison: -1 });
      else if (s.phase === "day") { s.alive.forEach((a, i) => { if (a && s.votes[i] === undefined) s.votes[i] = -1; }); wwTallyDay(s); }
      return s;
    }
    if (!s.alive[seat]) fail("Bạn đã chết, chỉ được xem.");
    const t = +mv.target;
    if (s.phase === "night" && s.step === 1) {
      if (role === "soi") { if (t !== -1 && (!s.alive[t] || s.roles[t] === "soi")) fail("Chọn một người không phải sói."); s.picks.wolf[seat] = t; }
      else if (role === "baove") { if (s.picks.guard !== undefined) fail("Bạn đã chọn rồi."); if (!s.alive[t]) fail("Chọn một người còn sống."); if (t === s.lastGuard) fail("Không được che cùng một người hai đêm liền."); s.picks.guard = t; }
      else if (role === "tientri") { if (s.picks.seer !== undefined) fail("Bạn đã soi rồi."); if (!s.alive[t] || t === seat) fail("Chọn một người khác còn sống."); s.picks.seer = t; s.seen[seat] = [...(s.seen[seat] || []), { day: s.day, t, wolf: s.roles[t] === "soi" }]; }
      else fail("Đêm nay bạn chỉ cần chờ.");
      if (wwStep1Done(s)) wwAfterStep1(s);
      return s;
    }
    if (s.phase === "night" && s.step === 2) {
      if (role !== "phuthuy") fail("Đang chờ Phù thủy.");
      const save = !!mv.save && s.potion.save && s.victim >= 0, poison = mv.poison >= 0 && s.potion.poison ? +mv.poison : -1;
      if (poison >= 0 && !s.alive[poison]) fail("Chọn một người còn sống để dùng bình độc.");
      wwResolveNight(s, { save, poison }); return s;
    }
    if (s.phase === "day") {
      if (t !== -1 && (!s.alive[t] || t === seat)) fail("Chọn một người khác còn sống.");
      s.votes[seat] = t;
      if (s.alive.every((a, i) => !a || s.votes[i] !== undefined)) wwTallyDay(s);
      return s;
    }
    fail("Thao tác không hợp lệ.");
  },
  view(el, ctx) {
    const s = ctx.state, me = ctx.seat, my = s.roles[me], over = !!s.winner, alive = me >= 0 && s.alive[me];
    const mates = my === "soi" ? s.roles.map((r, i) => r === "soi" && i !== me ? s.names[i] : null).filter(Boolean) : [];
    const card = me >= 0 ? `<div class="rolecard ww-${my}"><div class="small">VAI CỦA BẠN</div><div class="big">${WW[my].toUpperCase()}</div><div class="hint">${WW_DESC[my]}</div>${mates.length ? `<div class="hint">Đồng đội sói: ${mates.map(esc).join(", ")}.</div>` : ""}${my === "tientri" && (s.seen[me] || []).length ? `<div class="hint">Đã soi: ${(s.seen[me]).map(x => esc(s.names[x.t]) + (x.wolf ? " là sói" : " không phải sói")).join(", ")}.</div>` : ""}${my === "phuthuy" ? `<div class="hint">Bình cứu ${s.potion.save ? "còn" : "đã dùng"}, bình độc ${s.potion.poison ? "còn" : "đã dùng"}.</div>` : ""}${alive ? "" : `<div class="hint">Bạn đã chết, giờ chỉ xem.</div>`}</div>` : "";
    const people = `<ul class="plist">${s.names.map((n, i) => `<li class="${s.alive[i] ? "" : "dead"}"><span>${esc(n)}${i === me ? " · bạn" : ""}</span><span class="rd">${!s.alive[i] || over ? WW[s.roles[i]] : s.phase === "day" ? (s.votes[i] !== undefined ? "Đã bỏ phiếu" : "Đang chọn") : ""}</span></li>`).join("")}</ul>`;
    const pickRow = (key, filter, label) => `<div class="msg">${label}</div><div class="lcdrow">${s.alive.map((a, i) => a && filter(i) ? `<button class="lcdbtn" data-${key}="${i}">${esc(s.names[i])}</button>` : "").join("")}</div>`;
    let act = "";
    if (over) act = `<div class="msg">${esc(s.winner)} thắng.</div>`;
    else if (s.phase === "night" && s.step === 1) {
      if (!alive) act = `<div class="msg">Đêm ${s.day}, cả làng đang ngủ.</div>`;
      else if (my === "soi") act = pickRow("pick", i => s.roles[i] !== "soi", `Đêm ${s.day}, chọn người để cắn.${aliveOf(s, "soi").length > 1 ? " Bầy sói đang chọn: " + aliveOf(s, "soi").map(i => esc(s.names[i]) + " " + (s.picks.wolf[i] === undefined ? "chưa chọn" : s.picks.wolf[i] < 0 ? "bỏ qua" : "chọn " + esc(s.names[s.picks.wolf[i]]))).join(", ") + "." : ""}`) + `<div class="lcdrow"><button class="lcdbtn" data-pick="-1">KHÔNG CẮN</button></div>`;
      else if (my === "baove") act = s.picks.guard !== undefined ? `<div class="msg">Bạn đã che chở ${esc(s.names[s.picks.guard])}. Chờ trời sáng.</div>` : pickRow("pick", i => i !== s.lastGuard, `Đêm ${s.day}, chọn người để che chở.`);
      else if (my === "tientri") act = s.picks.seer !== undefined ? `<div class="msg">${esc(s.names[s.picks.seer])} ${s.roles[s.picks.seer] === "soi" ? "là sói" : "không phải sói"}. Chờ trời sáng.</div>` : pickRow("pick", i => i !== me, `Đêm ${s.day}, chọn người để soi.`);
      else act = `<div class="msg">Đêm ${s.day}, bạn nhắm mắt chờ trời sáng.</div>`;
    } else if (s.phase === "night" && s.step === 2) {
      act = alive && my === "phuthuy" ? `<div class="msg">${s.victim >= 0 ? esc(s.names[s.victim]) + " bị sói cắn đêm nay." : "Đêm nay sói không cắn ai."}</div>
        <div class="lcdrow">${s.potion.save && s.victim >= 0 ? `<button class="lcdbtn" data-witch="save">DÙNG BÌNH CỨU</button>` : ""}<button class="lcdbtn" data-witch="none">KHÔNG DÙNG</button></div>
        ${s.potion.poison ? pickRow("poison", i => i !== me, "Hoặc dùng bình độc lên một người.") : ""}` : `<div class="msg">Đêm ${s.day}, đang chờ Phù thủy.</div>`;
    } else if (s.phase === "day") {
      act = !alive ? `<div class="msg">Cả làng đang bỏ phiếu.</div>` : s.votes[me] !== undefined ? `<div class="msg">Bạn đã bỏ phiếu, chờ mọi người.</div>` : pickRow("vote", i => i !== me, `Ngày ${s.day}, thảo luận rồi bỏ phiếu treo người khả nghi.`) + `<div class="lcdrow"><button class="lcdbtn" data-vote="-1">KHÔNG BẦU</button></div>`;
    }
    el.innerHTML = `<div class="score"><span>${s.phase === "day" ? "NGÀY" : "ĐÊM"} ${s.day}</span><span>${over ? "KẾT THÚC" : s.phase === "day" ? "THẢO LUẬN VÀ BỎ PHIẾU" : "CÁC VAI HÀNH ĐỘNG"}</span></div>
      <div class="party">${card}<div>${people}</div></div>${act}
      ${!over ? `<div class="lcdrow">${staleBtn(s)}</div>` : ""}
      <div class="log">${s.log.slice(0, 8).map(esc).join("<br>")}</div>
      ${s.phase === "day" || over ? chatBox(s, ctx, alive && !over) : ""}`;
    el.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => ctx.send({ target: +b.dataset.pick }));
    el.querySelectorAll("[data-vote]").forEach(b => b.onclick = () => ctx.send({ target: +b.dataset.vote }));
    el.querySelectorAll("[data-poison]").forEach(b => b.onclick = () => ctx.send({ save: false, poison: +b.dataset.poison }));
    el.querySelectorAll("[data-witch]").forEach(b => b.onclick = () => ctx.send({ save: b.dataset.witch === "save", poison: -1 }));
    el.querySelectorAll("[data-force]").forEach(b => b.onclick = () => ctx.send({ t: "force" }));
    bindChat(el, ctx); armStale(el, s, () => G.werewolf.view(el, ctx));
  } };
})();
