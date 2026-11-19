(() => {
const APP_V = 11; // tăng mỗi lần đổi luật chơi, máy nào chạy bản cũ sẽ được nhắc tải lại
// Tự lấy bản mới: GitHub giữ bản cũ trong bộ nhớ đệm khoảng 10 phút, nên trang tự hỏi số phiên bản mới nhất.
async function checkVersion(){
  try {
    const v = (await (await fetch("version.json?t=" + Date.now(), { cache: "no-store" })).json()).v;
    if (v > APP_V) {
      let tried = ""; try { tried = sessionStorage.getItem("tlc-reload") || ""; } catch (e) {}
      if (tried === String(v)) return;
      try { sessionStorage.setItem("tlc-reload", String(v)); } catch (e) {}
      location.replace(location.pathname + "?v=" + v + location.hash);
    }
  } catch (e) {}
}
checkVersion(); setInterval(checkVersion, 60000);
const G = window.TLC_GAMES, { esc } = window.TLC_HELPERS;
const SEASONS = {1:{name:"Mùa 1",long:"Devil's Plan mùa 1",c:"var(--s1)"},2:{name:"Mùa 2",long:"Devil's Plan mùa 2",c:"var(--s2)"},3:{name:"Mùa 3",long:"Devil's Plan mùa 3",c:"var(--s3)"},0:{name:"Boardgame khác",long:"Boardgame khác",c:"var(--s0)"}};
const TYPES = {main:"Trận chính",prison:"Trận trong tù",prize:"Trận giải thưởng",exile:"Vùng lưu đày",final:"Chung kết",hidden:"Thử thách ẩn",other:"Boardgame"};
const $ = s => document.querySelector(s);
const main = $("#main");
const norm = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();
function toast(t){ const d=document.createElement("div"); d.className="toast"; d.textContent=t; document.body.appendChild(d); setTimeout(()=>d.remove(),2800); }

/* ---------- state ---------- */
let games = [], fromStore = false, loaded = false;
let fb = null, auth = null, db = null, user = null, isAdmin = false;
const state = {q:"", season:"all", type:"all", playOnly:false};
try { const s = JSON.parse(localStorage.getItem("tlc-filter") || "null"); if (s) Object.assign(state, s, {q:""}); } catch (e) {}
const saveFilter = () => { try { localStorage.setItem("tlc-filter", JSON.stringify({season:state.season,type:state.type,playOnly:state.playOnly})); } catch (e) {} };

/* ---------- firebase ---------- */
if (window.TLC_FIREBASE && window.firebase) {
  try {
    fb = firebase.initializeApp(window.TLC_FIREBASE);
    auth = firebase.auth(); db = firebase.firestore();
    auth.onAuthStateChanged(async u => {
      user = u; isAdmin = false;
      if (u) { try { const a = await db.collection("admins").doc(u.uid).get(); isAdmin = a.exists; } catch (e) {} }
      renderWho(); if (isAdmin) mergeGames(); route();
    });
  } catch (e) { console.error(e); fb = null; }
}
function renderWho(){
  const w = $("#who");
  if (!fb) { w.innerHTML = ""; return; }
  if (user) { w.innerHTML = `${user.photoURL ? `<img src="${esc(user.photoURL)}" alt="">` : ""}<button class="pill" id="logout">Đăng xuất</button>`; $("#logout").onclick = () => auth.signOut(); }
  else { w.innerHTML = `<button class="pill" id="login">Đăng nhập Google</button>`; $("#login").onclick = login; }
  $("#nav-add").hidden = !isAdmin;
}
// Báo cho chủ trang qua mail mỗi lần có người đăng nhập (script Google Apps Script tự kiểm tra mã đăng nhập).
function notifyLogin(res){
  try {
    const tok = res && res.credential && res.credential.idToken;
    if (!tok || !window.TLC_NOTIFY_URL) return;
    fetch(window.TLC_NOTIFY_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ idToken: tok }) }).catch(() => {});
  } catch (e) {}
}
async function login(){
  try { notifyLogin(await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())); }
  catch (e) { if (e && e.code === "auth/popup-blocked") await auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); else toast("Chưa đăng nhập được, thử lại."); }
}
if (auth) auth.getRedirectResult().then(notifyLogin).catch(() => {});
const myName = () => (user && (user.displayName || (user.email || "").split("@")[0])) || "Người chơi";

/* ---------- data ---------- */
const EXTRA_PLAY = { "s2-equation-pyramid": ["pyramidrace"] };
const withExtra = g => EXTRA_PLAY[g.id] ? { ...g, playable: [...new Set([...(g.playable || []), ...EXTRA_PLAY[g.id]])] } : g;
let builtIn = [], storeGames = null, upserting = false;
function mergeGames(){
  if (!storeGames) { games = builtIn.map(withExtra); return; }
  const have = new Set(storeGames.map(g => g.id));
  games = [...storeGames, ...builtIn.filter(g => !have.has(g.id))].map(withExtra);
  // Quản trị viên đăng nhập thì tự thêm vào kho những game mới có trong bản cài sẵn.
  const missing = builtIn.filter(g => !have.has(g.id));
  if (isAdmin && db && missing.length && !upserting) {
    upserting = true; const b = db.batch();
    missing.forEach(g => { const {id, ...d} = g; b.set(db.collection("games").doc(id), {...d, updatedAt: new Date().toISOString()}); });
    b.commit().catch(() => {}).finally(() => { upserting = false; });
  }
}
async function loadGames(){
  if (db) {
    db.collection("games").onSnapshot(snap => {
      if (snap.empty) return;
      storeGames = snap.docs.map(d => ({id:d.id, ...d.data()})); fromStore = true; loaded = true; mergeGames(); refresh();
    }, () => {});
  }
  try { const r = await fetch("games.json", {cache:"no-cache"}); builtIn = await r.json(); mergeGames(); loaded = true; refresh(); }
  catch (e) { loaded = true; refresh(); }
}
function refresh(){ if (view === "" || view === "all") renderResults(); else if (!view.startsWith("play-") && !view.startsWith("local-") && !view.startsWith("room-") && !view.startsWith("score-")) route(); }
const sortKey = g => [g.season===0?9:g.season, typeof g.order==="number"?g.order:9999, g.name||""];
const sorted = l => [...l].sort((a,b)=>{const x=sortKey(a),y=sortKey(b); for(let i=0;i<3;i++){ if(x[i]<y[i])return -1; if(x[i]>y[i])return 1;} return 0;});

/* ---------- routing ---------- */
let view = location.hash.slice(1), cleanup = null, roomUnsub = null;
function stopAll(){ if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; } if (roomUnsub) { roomUnsub(); roomUnsub = null; } }
function go(h){ view = h; stopAll(); if (location.hash.slice(1) !== h) location.hash = "#" + (h || "all"); route(); window.scrollTo({top:0}); }
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (h === view || (h === "all" && view === "")) return; view = h; stopAll(); route(); window.scrollTo({top:0}); });
document.querySelectorAll(".pill[data-go]").forEach(p => p.addEventListener("click", () => go(p.dataset.go)));
function route(){
  const h = view;
  document.querySelectorAll(".pill[data-go]").forEach(p => p.setAttribute("aria-current", String(p.dataset.go !== "" && h.startsWith(p.dataset.go))));
  if (h.startsWith("g-")) return renderDetail(h.slice(2));
  if (h === "play") return renderPlayList();
  if (h.startsWith("play-")) return renderSolo(h.slice(5));
  if (h.startsWith("local-")) return renderLocal(h.slice(6));
  if (h === "rooms" || h.startsWith("rooms-")) return renderRooms(h.slice(6));
  if (h.startsWith("room-")) return renderRoom(h.slice(5));
  if (h.startsWith("score-")) return renderScore(h.slice(6));
  renderList();
}

/* ---------- list ---------- */
function filtered(){
  const q = norm(state.q.trim());
  return sorted(games).filter(g => {
    if (state.season !== "all" && String(g.season) !== state.season) return false;
    if (state.type !== "all" && g.type !== state.type) return false;
    if (state.playOnly && !(g.playable||[]).length) return false;
    if (!q) return true;
    const hay = norm([g.name,g.nameEn,g.meta,(g.body||[]).map(b=>b.x).join(" ")].join(" "));
    return q.split(/\s+/).every(w => hay.includes(w));
  });
}
const chip = (group, val, label) => `<button class="chip" data-g="${group}" data-v="${esc(val)}" aria-pressed="${state[group]===val}">${esc(label)}</button>`;
function renderList(){
  const focusQ = document.activeElement && document.activeElement.id === "q";
  main.innerHTML = `
    <div class="search">
      <label for="q"><span class="tag" aria-hidden="true">&gt;_</span><input id="q" type="search" placeholder="Tìm theo tên game hoặc luật, ví dụ xúc xắc" value="${esc(state.q)}" autocomplete="off"></label>
      ${isAdmin ? `<button class="btn primary" id="add2">Thêm game</button>` : ""}
    </div>
    <div class="filters">
      <div class="frow"><span>Nhóm</span>${chip("season","all","Tất cả")}${["1","2","3","0"].map(s=>chip("season",s,SEASONS[s].name)).join("")}</div>
      <div class="frow"><span>Loại</span>${chip("type","all","Tất cả")}${Object.keys(TYPES).map(t=>chip("type",t,TYPES[t])).join("")}</div>
      <div class="frow"><span>Khác</span><button class="chip" id="playonly" aria-pressed="${state.playOnly}">Chơi được trên web</button></div>
    </div>
    ${isAdmin && !fromStore && db ? `<div class="note">Kho trên Firebase đang trống. <button class="btn" id="seed">Nạp ${games.length} game vào kho</button> để bắt đầu sửa trên web.</div>` : ""}
    <div id="results"></div>`;
  $("#q").addEventListener("input", e => { state.q = e.target.value; renderResults(); });
  main.querySelectorAll(".chip[data-g]").forEach(c => c.addEventListener("click", () => { state[c.dataset.g] = c.dataset.v; saveFilter(); renderList(); }));
  $("#playonly").addEventListener("click", () => { state.playOnly = !state.playOnly; saveFilter(); renderList(); });
  if ($("#add2")) $("#add2").onclick = () => openEditor(null);
  if ($("#seed")) $("#seed").onclick = seed;
  if (focusQ) { const i=$("#q"); i.focus(); i.setSelectionRange(i.value.length,i.value.length); }
  renderResults();
}
async function seed(){
  const b = db.batch(); games.forEach(g => { const {id, ...d} = g; b.set(db.collection("games").doc(id), {...d, updatedAt: new Date().toISOString()}); });
  try { await b.commit(); toast("Đã nạp game vào kho"); } catch (e) { toast("Chưa nạp được, kiểm tra quyền quản trị."); }
}
function cardHTML(g){
  const s = SEASONS[g.season] || SEASONS[0];
  return `<button class="cart" style="--c:${s.c}" data-id="${esc(g.id)}">
    <div class="label"><div class="num"><span class="tag">${esc(g.num||"")}</span><span class="tag">${esc(s.name.toUpperCase())}</span></div>
      <h3>${esc(g.name)}</h3><div class="en">${esc(g.nameEn||"")}</div></div>
    <div class="meta">${esc(g.meta||"")}</div>
    <div class="badges"><span class="badge">${esc(TYPES[g.type]||"Boardgame")}</span>${g.players?`<span class="badge">${esc(g.players)} người</span>`:""}${(g.playable||[]).length?`<span class="badge play">Chơi được</span>`:""}</div>
  </button>`;
}
function renderResults(){
  const box = $("#results"); if (!box) return;
  if (!loaded) { box.innerHTML = `<div class="empty"><div class="tag">ĐANG MỞ TỦ</div><p>Danh sách game đang được tải.</p></div>`; return; }
  const list = filtered();
  box.innerHTML = `<div class="count"><span class="tag">${list.length} GAME</span><small>Bấm vào một hộp game để xem cách chơi.</small></div>` +
    (list.length ? `<div class="grid">${list.map(cardHTML).join("")}</div>` : `<div class="empty"><div class="tag">KHÔNG THẤY GAME</div><p>Thử bỏ bớt bộ lọc hoặc gõ từ khóa khác.</p></div>`);
  box.querySelectorAll(".cart").forEach(c => c.onclick = () => go("g-" + c.dataset.id));
}

/* ---------- detail ---------- */
function playButtons(keys){
  return keys.filter(k => G[k]).map(k => G[k].kind === "solo"
    ? `<button class="btn primary" data-go="play-${k}">Chơi thử ${esc(G[k].name)}</button>`
    : `<button class="btn primary" data-go="rooms-${k}">${esc(G[k].name)} với bạn bè</button>${G[k].flexible ? "" : `<button class="btn" data-go="local-${k}">${esc(G[k].name)} chung một máy</button>`}`).join("");
}
function renderDetail(id){
  const g = games.find(x => x.id === id);
  if (!g) { main.innerHTML = `<button class="btn back" data-go="">Về danh sách</button><div class="empty" style="margin-top:14px"><div class="tag">${loaded?"KHÔNG CÓ GAME NÀY":"ĐANG TẢI"}</div></div>`; bindGo(); return; }
  const s = SEASONS[g.season] || SEASONS[0];
  const body = (g.body||[]).map(b => b.t==="h" ? `<h4>${esc(b.x)}</h4>` : `<p>${esc(b.x)}</p>`).join("");
  main.innerHTML = `<button class="btn back" data-go="">Về danh sách</button>
    <div class="detail" style="--c:${s.c}">
      <article><h2>${esc(g.name)}</h2><div class="en">${esc(g.nameEn||"")}</div>
        ${g.meta?`<div class="metabox">${esc(g.meta)}</div>`:""}<div class="body">${body || "<p>Chưa có nội dung cách chơi.</p>"}</div></article>
      <aside class="side">
        <div class="label"><div class="num"><span class="tag">${esc(g.num||"")}</span><span class="tag">${esc(s.name.toUpperCase())}</span></div><h3>${esc(g.name)}</h3></div>
        <div class="card"><dl><dt>Nhóm</dt><dd>${esc(s.long)}</dd><dt>Loại</dt><dd>${esc(TYPES[g.type]||"Boardgame")}</dd>${g.players?`<dt>Người chơi</dt><dd>${esc(g.players)}</dd>`:""}</dl></div>
        ${playButtons(g.playable||[])}
        ${SCORE_TOOLS[g.id] ? `<button class="btn primary" data-go="score-${SCORE_TOOLS[g.id]}">Bảng tính điểm khi chơi ngoài đời</button>` : ""}
        ${(g.playable||[]).length ? "" : `<div class="note">Trò này là thiết kế riêng của chương trình nên trang không có bản chơi online.${SCORE_TOOLS[g.id] ? " Cả nhóm chơi bằng thẻ thật, trang giúp ghi điểm." : ""}</div>`}
        ${isAdmin?`<button class="btn" id="edit">Sửa game này</button>`:""}
      </aside>
    </div>`;
  bindGo(); if ($("#edit")) $("#edit").onclick = () => openEditor(g);
}
function bindGo(root = main){ root.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go)); }

/* ---------- editor ---------- */
const dlg = $("#dlg"); let editing = null;
const bodyToText = body => (body||[]).map(b => b.t==="h" ? "## " + b.x : b.x).join("\n\n");
const textToBody = t => t.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean).map(x => x.startsWith("##") ? {t:"h",x:x.replace(/^#+\s*/,"")} : {t:"p",x:x.replace(/\s*\n\s*/g," ")});
const slug = s => norm(s).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60) || "game";
function openEditor(g){
  if (!fromStore) { toast("Nạp game vào kho Firebase trước rồi mới sửa được."); return; }
  editing = g; $("#dlg-title").textContent = g ? "SỬA GAME" : "THÊM GAME";
  $("#f-name").value = g?.name || ""; $("#f-en").value = g?.nameEn || ""; $("#f-season").value = String(g?.season ?? 0); $("#f-type").value = g?.type || "other";
  $("#f-players").value = g?.players || ""; $("#f-num").value = g?.num || ""; $("#f-meta").value = g?.meta || ""; $("#f-body").value = bodyToText(g?.body);
  $("#ed-del").hidden = !g; $("#del-confirm").hidden = true; $("#ed-status").textContent = ""; dlg.showModal(); $("#f-name").focus();
}
$("#ed-cancel").onclick = () => dlg.close();
$("#ed-del").onclick = () => { $("#del-confirm").hidden = false; };
$("#del-no").onclick = () => { $("#del-confirm").hidden = true; };
$("#del-yes").onclick = async () => { try { await db.collection("games").doc(editing.id).delete(); dlg.close(); toast("Đã xóa game"); go(""); } catch (e) { $("#ed-status").textContent = "Chưa xóa được, bạn cần quyền quản trị."; } };
$("#ed").addEventListener("submit", async e => {
  e.preventDefault();
  const season = Number($("#f-season").value);
  const doc = { name:$("#f-name").value.trim(), nameEn:$("#f-en").value.trim(), season, type:$("#f-type").value, players:$("#f-players").value.trim(), num:$("#f-num").value.trim(), meta:$("#f-meta").value.trim(),
    body:textToBody($("#f-body").value), playable:editing?.playable||[], order: typeof editing?.order==="number" ? editing.order : 1000+games.length, updatedAt:new Date().toISOString(), source:editing?.source||"" };
  if (!doc.name || !doc.body.length) { $("#ed-status").textContent = "Cần có tên game và cách chơi."; return; }
  let id = editing?.id; if (!id) { id = "s"+season+"-"+slug(doc.nameEn||doc.name); if (games.some(g=>g.id===id)) id += "-"+Date.now().toString(36); }
  $("#ed-save").disabled = true; $("#ed-status").textContent = "Đang lưu";
  try { await db.collection("games").doc(id).set(doc); dlg.close(); toast(editing?"Đã lưu thay đổi":"Đã thêm game"); go("g-"+id); }
  catch (err) { $("#ed-status").textContent = "Chưa lưu được, bạn cần quyền quản trị."; }
  finally { $("#ed-save").disabled = false; }
});
$("#nav-add").onclick = () => openEditor(null);

/* ---------- play list ---------- */
function linkedGames(key){ return games.filter(g => (g.playable||[]).includes(key)); }
function renderPlayList(){
  const solo = Object.entries(G).filter(([,g]) => g.kind==="solo"), online = Object.entries(G).filter(([,g]) => g.kind==="online");
  const card = ([k,g]) => `<div class="playcard"><h3>${esc(g.name)}</h3><p>${esc(g.desc)}</p><div class="lcdrow" style="justify-content:flex-start">${g.kind==="solo"
      ? `<button class="lcdbtn" data-go="play-${k}">CHƠI</button>` : `<button class="lcdbtn" data-go="rooms-${k}">VÀO PHÒNG</button>${g.flexible ? "" : `<button class="lcdbtn" data-go="local-${k}">MỘT MÁY</button>`}`}</div></div>`;
  main.innerHTML = `<div class="sec">CHƠI VỚI BẠN BÈ</div><p>Đăng nhập Google rồi vào một trong 3 phòng có sẵn của mỗi trò. Hoặc hai người chơi chung một máy.</p><div class="playlist">${online.map(card).join("")}</div>
    <div class="sec">CHƠI MỘT MÌNH</div><div class="playlist">${solo.map(card).join("")}</div>`;
  bindGo();
}
function shell(title, back, links){
  main.innerHTML = `<button class="btn back" data-go="${back}">Quay lại</button>
    <div class="console"><div class="top"><span>${esc(title.toUpperCase())}</span><span>${links}</span></div><div class="screen" id="screen"></div></div>`;
  bindGo(); return $("#screen");
}
const ruleLinks = key => linkedGames(key).map(g=>`<a href="#g-${esc(g.id)}">Luật ${esc(g.name)}</a>`).join(" · ");
const SCORE_TOOLS = { "s3-heavy-13": "heavy13" };
function renderScore(key){
  const t = window.TLC_SCORE && window.TLC_SCORE[key]; if (!t) return renderList();
  main.innerHTML = `<button class="btn back" data-go="g-s3-heavy-13">Về luật Heavy 13</button><div class="count"><span class="tag">${esc(t.name.toUpperCase())}</span><small>Ván đang ghi được lưu trên máy này.</small></div><div id="score"></div>`;
  bindGo(); cleanup = t.mount($("#score"));
}
function renderSolo(key){ const g = G[key]; if (!g || g.kind !== "solo") return renderPlayList(); const el = shell(g.name, "play", ruleLinks(key)); cleanup = g.mount(el); }

/* ---------- local hotseat ---------- */
function renderLocal(key){
  const g = G[key]; if (!g || g.kind !== "online") return renderPlayList();
  const el = shell(g.name + " chung một máy", "play", ruleLinks(key));
  const players = [{name:"Người 1"},{name:"Người 2"}];
  let st = g.init(players);
  const draw = () => g.view(el, { state: st, seat: st.turn ?? 0, players, hotseat: true, send(mv){ try { st = g.move(st, mv, st.turn); } catch (e) { toast(e.message); } draw(); } });
  draw();
  const again = document.createElement("div"); again.className = "lcdrow"; again.innerHTML = `<button class="lcdbtn" id="again">VÁN MỚI</button>`;
  el.after(again); $("#again").onclick = () => { st = g.init(players); el._sel = null; draw(); };
}

/* ---------- rooms ---------- */
function needLogin(msg){
  if (!fb) { main.innerHTML = `<div class="empty"><div class="tag">CHƯA BẬT ĐĂNG NHẬP</div><p>Trang chưa được nối với Firebase nên chưa mở phòng được. Bạn vẫn chơi chung một máy ở mục Chơi thử.</p><button class="btn" data-go="play">Tới mục Chơi thử</button></div>`; bindGo(); return true; }
  if (!user) { main.innerHTML = `<div class="empty"><div class="tag">ĐĂNG NHẬP ĐỂ CHƠI</div><p>${esc(msg)}</p><button class="btn primary" id="lg">Đăng nhập Google</button></div>`; $("#lg").onclick = login; return true; }
  return false;
}
const CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({length:5}, () => CODE[Math.floor(Math.random()*CODE.length)]).join("");
const me = () => ({ uid:user.uid, name:myName(), photo:user.photoURL||"", ready:false });
const STALE = 30 * 60 * 1000;           // phòng bỏ quên quá 30 phút thì coi như trống
const FIXED = 3;                         // số phòng có sẵn cho mỗi game
const ONLINE = () => Object.keys(G).filter(k => G[k].kind === "online");
const gameOf = id => id.split("-")[0];
const roomLabel = id => /-\d+$/.test(id) ? "Phòng " + id.split("-")[1] : "Phòng thêm " + id.split("-x")[1];
const isFree = r => !r || !r.players || !r.players.length || Date.now() - (r.updatedAt || 0) > STALE;
const isFull = r => !isFree(r) && (r.status !== "lobby" || r.players.length >= r.need);
const freshRoom = game => ({ game, need: G[game].flexible ? G[game].maxP : G[game].minP, host: user.uid, status: "lobby", players: [me()], memberIds: [user.uid], state: null, createdAt: Date.now(), updatedAt: Date.now() });

function renderRooms(pre){
  if (needLogin("Đăng nhập bằng Google để vào phòng chơi cùng bạn bè.")) return;
  const keys = ONLINE();
  main.innerHTML = `<div class="count"><span class="tag">PHÒNG CHƠI</span><small>Mỗi trò có sẵn ${FIXED} phòng. Khi cả ${FIXED} phòng đều đủ người, bạn mở thêm phòng mới.</small></div>` +
    keys.map(k => `<section id="sec-${k}"><div class="sec">${esc(G[k].name.toUpperCase())}</div><p class="hint">${esc(G[k].desc)} Mỗi phòng ${G[k].flexible ? `từ ${G[k].minP} đến ${G[k].maxP}` : G[k].minP} người.</p><div class="playlist" id="rl-${k}"><p>Đang tải phòng.</p></div></section>`).join("");
  const draw = rooms => keys.forEach(k => {
    const ids = Array.from({length:FIXED}, (_, i) => `${k}-${i + 1}`);
    Object.keys(rooms).filter(id => gameOf(id) === k && !ids.includes(id) && !isFree(rooms[id])).forEach(id => ids.push(id));
    const allFull = ids.every(id => isFull(rooms[id]));
    $("#rl-" + k).innerHTML = ids.map(id => {
      const r = rooms[id], free = isFree(r), mine = r && !free && r.memberIds.includes(user.uid), full = isFull(r);
      const st = free ? "Trống" : r.status === "playing" ? "Đang chơi" : r.status === "done" ? "Vừa chơi xong" : full ? "Đủ người" : `Đang chờ ${r.players.length}/${r.need}`;
      const who = free ? "Chưa có ai" : r.players.map(p => esc(p.name)).join(", ");
      const btn = mine ? `<button class="lcdbtn" data-go="room-${id}">VÀO LẠI</button>` : full ? `<span class="small">KÍN CHỖ</span>` : `<button class="lcdbtn" data-go="room-${id}">VÀO PHÒNG</button>`;
      return `<div class="playcard"><h3>${esc(roomLabel(id))}</h3><p><b>${st}</b><br>${who}</p><div class="lcdrow" style="justify-content:flex-start">${btn}</div></div>`;
    }).join("") + `<div class="playcard"><h3>PHÒNG MỚI</h3><p>${allFull ? "Mọi phòng đều kín, bạn mở thêm một phòng." : "Còn phòng trống, mời bạn vào phòng có sẵn trước."}</p><div class="lcdrow" style="justify-content:flex-start"><button class="lcdbtn" data-new="${k}" ${allFull ? "" : "disabled"}>MỞ PHÒNG MỚI</button></div></div>`;
    bindGo($("#rl-" + k));
    $("#rl-" + k).querySelectorAll("[data-new]").forEach(b => b.onclick = async () => {
      const id = `${k}-x${newCode()}`;
      try { await db.collection("rooms").doc(id).set(freshRoom(k)); go("room-" + id); } catch (e) { toast("Chưa mở được phòng, thử lại."); }
    });
  });
  roomUnsub = db.collection("rooms").where("game", "in", keys).onSnapshot(snap => {
    const rooms = {}; snap.docs.forEach(d => rooms[d.id] = d.data()); draw(rooms);
    if (pre && $("#sec-" + pre)) { $("#sec-" + pre).scrollIntoView(); pre = null; }
  }, () => keys.forEach(k => { $("#rl-" + k).innerHTML = "<p>Chưa tải được danh sách phòng. Thử tải lại trang.</p>"; }));
}
async function txRoom(code, fn){
  const ref = db.collection("rooms").doc(code);
  return db.runTransaction(async t => { const d = await t.get(ref); if (!d.exists) throw new Error("Không tìm thấy phòng này."); const r = d.data(); const upd = fn(r); if (upd) t.update(ref, {...upd, updatedAt:Date.now()}); });
}
async function joinRoom(code){
  const game = gameOf(code); if (!G[game] || G[game].kind !== "online") throw new Error("Phòng này không có trò chơi hợp lệ.");
  const ref = db.collection("rooms").doc(code);
  return db.runTransaction(async t => {
    const d = await t.get(ref);
    if (!d.exists) { if (/-\d+$/.test(code)) { t.set(ref, freshRoom(game)); return; } throw new Error("Phòng này đã đóng."); }
    const r = d.data();
    if (r.memberIds.includes(user.uid) && !isFree(r)) return;
    if (isFree(r)) { t.update(ref, { ...freshRoom(game), createdAt: r.createdAt || Date.now() }); return; }
    if (r.status !== "lobby") throw new Error("Phòng đang chơi, bạn chọn phòng khác nhé.");
    if (r.players.length >= r.need) throw new Error("Phòng đã đủ người.");
    t.update(ref, { players: [...r.players, me()], memberIds: [...r.memberIds, user.uid], updatedAt: Date.now() });
  });
}
function renderRoom(code){
  if (needLogin("Đăng nhập bằng Google để vào phòng chơi.")) return;
  main.innerHTML = `<button class="btn back" data-go="rooms-${esc(gameOf(code))}">Về danh sách phòng</button><div id="room-body"><p>Đang vào ${esc(roomLabel(code))}.</p></div>`; bindGo();
  joinRoom(code).catch(e => toast(e.message)).finally(() => {
    if (view !== "room-" + code) return;
    roomUnsub = db.collection("rooms").doc(code).onSnapshot(d => {
      if (!d.exists) { $("#room-body").innerHTML = `<div class="empty"><div class="tag">PHÒNG ĐÃ ĐÓNG</div><p>Quay lại danh sách để chọn phòng khác.</p></div>`; return; }
      drawRoom(code, d.data());
    }, () => { $("#room-body").innerHTML = `<div class="empty"><div class="tag">CHƯA VÀO ĐƯỢC PHÒNG</div><p>Thử tải lại trang.</p></div>`; });
  });
}
let rmAsk = null;
function drawRoom(code, r){
  const g = G[r.game], seat = r.players.findIndex(p => p.uid === user.uid), host = r.host === user.uid;
  const link = location.origin + location.pathname + "#room-" + code;
  const plist = `<ul class="plist">${r.players.map((p,i)=>`<li>${p.photo?`<img src="${esc(p.photo)}" alt="">`:`<span class="av"></span>`}<span>${esc(p.name)}${p.uid===r.host?" · chủ phòng":""}</span><span class="rd ${p.ready?"on":""}">${r.status==="lobby"?(p.ready?"Sẵn sàng":"Chưa sẵn sàng"):"Ghế "+(i+1)}</span></li>`).join("")}${g && g.flexible ? (r.need>r.players.length ? `<li><span class="av"></span><span class="hint">Còn ${r.need-r.players.length} chỗ trống</span></li>` : "") : Array.from({length:Math.max(0,r.need-r.players.length)}).map(()=>`<li><span class="av"></span><span class="hint">Đang chờ người vào</span></li>`).join("")}</ul>`;
  const side = `<div class="panel"><h3>${esc(roomLabel(code).toUpperCase())}</h3><p class="hint">Gửi đường link này cho bạn bè để vào đúng phòng.</p>
     <div class="lcdrow" style="justify-content:flex-start"><button class="btn" id="cp">Chép link mời</button></div>
     <h3 style="margin-top:14px">${r.players.length}/${r.need} NGƯỜI</h3>${plist}
     ${seat<0 && r.status!=="lobby" ? `<p class="hint">Bạn đang xem, không có ghế trong ván này.</p>` : ""}
     ${seat>=0 ? `<div class="lcdrow" style="justify-content:flex-start"><button class="btn danger" id="leave">Rời phòng</button></div>` : ""}</div>`;
  let mainCol;
  if (r.status === "lobby") {
    const flex = g && g.flexible, enough = flex ? r.players.length >= g.minP : r.players.length === r.need, full = enough, allReady = enough && r.players.every(p => p.ready);
    mainCol = `<div class="panel"><h3>${esc(g?.name||r.game)}</h3><p>${esc(g?.desc||"")}</p>
      <div class="note">${flex ? `Phòng nhận từ ${g.minP} đến ${r.need} người, có ${r.players.length} người.` : `Phòng cần đúng ${r.need} người.`} ${full ? (allReady ? "Đủ người và mọi người đã sẵn sàng." : "Đã đủ người, chờ mọi người bấm Sẵn sàng.") : `Còn thiếu ${r.need - r.players.length} người.`}</div>
      <div class="lcdrow" style="justify-content:flex-start">${seat>=0?`<button class="btn" id="ready">${r.players[seat].ready?"Bỏ sẵn sàng":"Sẵn sàng"}</button>`:""}
      ${host?`<button class="btn primary" id="start" ${allReady?"":"disabled"}>Bắt đầu chơi</button>`:`<span class="hint">Chủ phòng sẽ bấm bắt đầu khi đủ người.</span>`}</div></div>`;
  } else {
    mainCol = `<div class="console"><div class="top"><span>${esc((g?.name||"").toUpperCase())}</span><span>${ruleLinks(r.game)}</span></div>
      ${host?`<div class="lcdrow" style="justify-content:flex-end;margin:0 0 8px">${rmAsk === code ? `<span class="hint">Bỏ ván đang chơi và chia ván mới?</span> <button class="lcdbtn" id="rm-yes">CHIA VÁN MỚI</button> <button class="lcdbtn" id="rm-no">GIỮ VÁN NÀY</button>` : `<button class="lcdbtn" id="rematch">VÁN MỚI CÙNG NHÓM</button>`}</div>`:""}<div class="screen" id="screen"></div></div>`;
  }
  const body = $("#room-body"), oldScreen = $("#screen"), scrollY = window.scrollY;
  // Giữ chữ đang gõ, con trỏ và vị trí cuộn khi phòng có thay đổi, để điện thoại không bị nhảy chữ hay mất tin nhắn.
  const typed = [...body.querySelectorAll("input[id], textarea[id]")].map(i => ({ id: i.id, v: i.value, f: document.activeElement === i, a: i.selectionStart, b: i.selectionEnd }));
  const stale = (r.appV || 0) > APP_V ? `<div class="newver">Trang vừa có bản mới, máy bạn đang chạy bản cũ nên có thể chơi lệch với cả phòng. <button class="btn" id="reload">Tải lại trang</button></div>` : "";
  body.innerHTML = `${stale}<div class="room"><div>${mainCol}</div><aside>${side}</aside></div>`;
  if ($("#reload")) $("#reload").onclick = () => location.reload();
  $("#cp").onclick = () => { navigator.clipboard.writeText(link).then(()=>toast("Đã chép link mời"), ()=>toast(link)); };
  if ($("#leave")) $("#leave").onclick = async () => {
    try { await txRoom(code, x => { const pl = x.players.filter(p => p.uid !== user.uid), ids = x.memberIds.filter(u => u !== user.uid);
      if (!pl.length) return { players: [], memberIds: [], host: "", status: "lobby", state: null };
      return { players: pl.map(p => ({...p, ready:false})), memberIds: ids, host: x.host === user.uid ? pl[0].uid : x.host, status: "lobby", state: null }; });
      go("rooms-" + gameOf(code)); }
    catch (e) { toast(e.message); }
  };
  if ($("#ready")) $("#ready").onclick = () => txRoom(code, x => ({ players: x.players.map(p => p.uid === user.uid ? {...p, ready:!p.ready} : p) })).catch(e=>toast(e.message));
  if ($("#start")) $("#start").onclick = () => txRoom(code, x => {
    const gx = G[x.game]; if (gx.flexible ? x.players.length < gx.minP : x.players.length !== x.need) throw new Error("Phòng chưa đủ người.");
    if (!x.players.every(p => p.ready)) throw new Error("Còn người chưa sẵn sàng.");
    return { status:"playing", state: G[x.game].init(x.players), appV: Math.max(x.appV || 0, APP_V) };
  }).catch(e=>toast(e.message));
  // Ván mới cần bấm hai lần (hỏi lại) để không lỡ tay bỏ ván đang chơi.
  if ($("#rematch")) $("#rematch").onclick = () => { rmAsk = code; drawRoom(code, r); };
  if ($("#rm-no")) $("#rm-no").onclick = () => { rmAsk = null; drawRoom(code, r); };
  if ($("#rm-yes")) $("#rm-yes").onclick = () => { rmAsk = null; txRoom(code, x => ({ state: G[x.game].init(x.players), status:"playing", appV: Math.max(x.appV || 0, APP_V) })).catch(e=>toast(e.message)); };
  if (r.status !== "lobby" && g) {
    let el = $("#screen");
    if (oldScreen && oldScreen !== el) { el.replaceWith(oldScreen); el = oldScreen; } // giữ nguyên khung màn hình để đồng hồ và lựa chọn không bị đặt lại
    g.view(el, { state:r.state, seat, players:r.players, hotseat:false, isHost: host,
      send(mv){ txRoom(code, x => { if ((x.appV || 0) > APP_V) throw new Error("Trang có bản mới. Tải lại trang để chơi tiếp cùng cả phòng."); if (x.status !== "playing") throw new Error("Ván chưa bắt đầu."); const s = G[x.game].move(x.state, mv, x.players.findIndex(p=>p.uid===user.uid), { hostSeat: x.players.findIndex(p=>p.uid===x.host) }); return { state:s, status: s.winner !== null && s.winner !== undefined ? "done" : "playing", appV: Math.max(x.appV || 0, APP_V) }; }).catch(e=>{ if (e.message) toast(e.message); }); } });
  }
  typed.forEach(k => { const n = document.getElementById(k.id); if (!n) return; if (!n.value) n.value = k.v; if (k.f) { n.focus({ preventScroll: true }); try { n.setSelectionRange(k.a, k.b); } catch (e) {} } });
  if (Math.abs(window.scrollY - scrollY) > 2) window.scrollTo(0, scrollY);
}

/* ---------- header sprites ---------- */
function sprites(){
  const c = $("#sprites"); const w = c.parentElement.clientWidth; c.width = w; const x = c.getContext("2d"); x.clearRect(0,0,w,60);
  const px = (ox,oy,map,col,s=4) => map.forEach((row,j)=>[...row].forEach((ch,i)=>{ if(ch!=="."||col["."]) { if (!col[ch]) return; x.fillStyle = col[ch]; x.fillRect(ox+i*s, oy+j*s, s, s); } }));
  const die = ["#######","#.....#","#.o...#","#..o..#","#...o.#","#.....#","#######"], cube = ["..###..",".#ttt#.","#ttttt#","#lltrr#","#llrrr#",".#lrr#.","..###.."], card = ["#####","#r..#","#.r.#","#..r#","#...#","#####"];
  for (let i=0, ox=10; ox < w-40; i++, ox += 120) { const k = i % 3, oy = 18 + (i%2)*10;
    if (k===0) px(ox, oy, die, {"#":"#1f2340",".":"#ffffff","o":"#1f2340"});
    if (k===1) px(ox, oy, cube, {"#":"#1f2340","t":"#f4f7e8","l":"#9fb08a","r":"#6f8360"});
    if (k===2) px(ox, oy, card, {"#":"#1f2340",".":"#ffffff","r":"#d23a3a"}); }
}
sprites(); window.addEventListener("resize", sprites);
renderWho(); route(); loadGames();
})();
