(() => {
  const CFG = window.APP_CONFIG;
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
  const HALL = { lamer: "라메르홀", laforet: "라포레홀" };
  const CLS = { lamer: "M", laforet: "F" };
  const EXTRAS = [["flower", "꽃장식", "decoration_fee"], ["show", "연출·음향·조명", "sound_lighting_fee"], ["mc", "사회·축가", "mc_singer_fee"], ["snap", "본식 스냅·DVD", "snap_dvd_fee"], ["pyebaek", "폐백", "pyebaek_fee"], ["dress", "드레스·외부업체 반입료", "dress_bring_in_fee"], ["etc", "기타 부대상품", "other_fixed_fee"]];
  const MAX_PICKS = 4;

  const $ = (s) => document.querySelector(s);
  const won = (n) => (n == null ? "–" : Number(n).toLocaleString("ko-KR"));
  const man = (n) => (n / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "만";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = { get(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  let rows = [];
  const notes = new Map(); // slot_id -> note
  const st = Object.assign({ hall: "all", month: ["08", "09", "10", "11"], dow: ["토", "일", "월"], time: "all", guar: "all", max: "0", promo: false, star: false, sort: "date", dir: 1 }, store.get("nh-filter", {}));

  $("#weddingdb").href = CFG.WEDDING_DB_URL;

  function setSync(state, text) { const el = $("#sync"); el.className = "sync " + state; el.querySelector("span").textContent = text; }
  function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); }

  const note = (id) => notes.get(id) || { slot_id: id, picked: false, pick_order: null, expected_guests: null, extras: {}, discount_override: null, starred: false, memo: null, sent_quote_code: null };
  const picks = () => rows.filter((r) => note(r.id).picked).sort((a, b) => (note(a.id).pick_order || 0) - (note(b.id).pick_order || 0));

  // ---------- data ----------
  async function load() {
    setSync("", "불러오는 중");
    const [s, n] = await Promise.all([
      sb.from("chapel_slots").select("*").eq("is_available", true).order("ceremony_date").order("ceremony_time"),
      sb.from("chapel_slot_notes").select("*"),
    ]);
    if (s.error || n.error) { setSync("err", "불러오기 실패"); $("#halls").innerHTML = `<div class="loading">데이터를 불러오지 못했어요: ${esc((s.error || n.error).message)}</div>`; return; }
    rows = s.data.map((x) => {
      const total = x.hall_rental_fee + x.meal_total;
      return { id: x.id, hall: x.hall, date: x.ceremony_date, dow: x.day_of_week, time: x.ceremony_time.slice(0, 5), rental: x.hall_rental_fee, meal: x.meal_total, guar: x.guaranteed_guests, per: x.meal_price_per_person, likes: x.likes, promo: x.promo_10pct, total, disc: x.promo_10pct ? Math.round(total * 0.9) : null, collected: x.collected_at };
    });
    n.data.forEach((x) => notes.set(x.slot_id, x));
    if (rows[0]) $("#collected").textContent = rows[0].collected;
    initControls(); renderHalls(); renderPattern(); render(); renderCmp();
    setSync("ok", "실시간 공유 중");
    sb.channel("notes").on("postgres_changes", { event: "*", schema: "public", table: "chapel_slot_notes" }, (p) => {
      if (p.eventType === "DELETE") notes.delete(p.old.slot_id);
      else notes.set(p.new.slot_id, { ...p.new, ...(pending[p.new.slot_id] || {}) }); // 저장 대기 중인 내 수정은 유지
      render(); safeRenderCmp();
      if (sheetId && (p.new?.slot_id === sheetId || p.old?.slot_id === sheetId)) syncSheet();
    }).subscribe((status) => { if (status === "SUBSCRIBED") setSync("ok", "실시간 공유 중"); else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setSync("err", "실시간 연결 끊김 · 새로고침"); });
  }

  const saveTimers = {};
  const pending = {}; // 아직 서버로 못 보낸 내 수정 — 실시간 수신이 덮어쓰지 못하게 따로 들고 있는다
  function saveNote(id, patch, delay = 0) {
    notes.set(id, { ...note(id), ...patch, updated_at: new Date().toISOString() });
    pending[id] = { ...(pending[id] || {}), ...patch };
    clearTimeout(saveTimers[id]);
    const run = async () => {
      setSync("", "저장 중");
      const mine = pending[id] || {};
      delete pending[id];
      const m = { ...note(id), ...mine };
      const row = { slot_id: id, picked: m.picked, pick_order: m.pick_order, expected_guests: m.expected_guests,
        extras: m.extras, discount_override: m.discount_override, starred: m.starred, memo: m.memo,
        sent_quote_code: m.sent_quote_code, updated_at: new Date().toISOString() };
      notes.set(id, { ...m, updated_at: row.updated_at });
      const { error } = await sb.from("chapel_slot_notes").upsert(row);
      if (error) { pending[id] = { ...mine, ...(pending[id] || {}) }; setSync("err", "저장 실패"); toast("저장하지 못했어요: " + error.message); }
      else setSync("ok", "저장됨 · 실시간 공유 중");
    };
    if (delay) saveTimers[id] = setTimeout(run, delay); else return run();
  }

  // ---------- summary ----------
  function renderHalls() {
    $("#halls").innerHTML = ["lamer", "laforet"].map((h) => {
      const r = rows.filter((x) => x.hall === h); if (!r.length) return "";
      const min = r.reduce((a, b) => (a.total < b.total ? a : b));
      const pers = r.map((x) => x.per); const gs = [...new Set(r.map((x) => x.guar))].sort((a, b) => a - b);
      const times = [...new Set(r.map((x) => x.time))].sort().join(" · ");
      return `<article class="hall ${CLS[h]}"><div class="name">${HALL[h]}</div><div class="gloss">${h === "lamer" ? "La Mer · 바다" : "La Forêt · 숲"} · ${times}</div>
      <div class="count num">${r.length}<small>계약 가능 슬롯</small></div>
      <dl><div><dt>최저 대관료+식대</dt><dd class="num">${man(min.total)}</dd></div>
      <div><dt>1인 식대 범위</dt><dd class="num">${won(Math.min(...pers))}~${won(Math.max(...pers))}</dd></div>
      <div><dt>보증인원</dt><dd class="num">${gs[0]}~${gs.at(-1)}명</dd></div></dl></article>`;
    }).join("");
  }

  // ---------- filters & table ----------
  function initControls() {
    $("#f-time").insertAdjacentHTML("beforeend", [...new Set(rows.map((r) => r.time))].sort().map((t) => `<option>${t}</option>`).join(""));
    $("#f-guar").insertAdjacentHTML("beforeend", [...new Set(rows.map((r) => r.guar))].sort((a, b) => a - b).map((g) => `<option value="${g}">${g}명</option>`).join(""));
    $("#f-hall").onclick = (e) => { if (e.target.dataset.v) { st.hall = e.target.dataset.v; render(); } };
    const toggle = (key) => (e) => { const v = e.target.dataset.v; if (!v) return; const s = new Set(st[key]); s.has(v) ? s.delete(v) : s.add(v); st[key] = [...s]; render(); };
    $("#f-month").onclick = toggle("month"); $("#f-dow").onclick = toggle("dow");
    ["time", "guar", "max"].forEach((k) => ($("#f-" + k).onchange = (e) => { st[k] = e.target.value; render(); }));
    $("#f-promo").onchange = (e) => { st.promo = e.target.checked; render(); };
    $("#f-star").onchange = (e) => { st.star = e.target.checked; render(); };
    $("#f-sort").onchange = (e) => { const [k, d] = e.target.value.split("|"); st.sort = k; st.dir = +d; render(); };
    document.querySelectorAll("#tbl th[data-sort]").forEach((th) => (th.onclick = () => { const k = th.dataset.sort; st.dir = st.sort === k ? -st.dir : 1; st.sort = k; render(); }));
    $("#tbl tbody").onclick = onTableClick;
    $("#cards").onclick = onTableClick;
  }
  function syncControls() {
    document.querySelectorAll("#f-hall button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === st.hall));
    document.querySelectorAll("#f-month button").forEach((b) => b.setAttribute("aria-pressed", st.month.includes(b.dataset.v)));
    document.querySelectorAll("#f-dow button").forEach((b) => b.setAttribute("aria-pressed", st.dow.includes(b.dataset.v)));
    $("#f-time").value = st.time; $("#f-guar").value = st.guar; $("#f-max").value = st.max; $("#f-promo").checked = st.promo; $("#f-star").checked = st.star;
    const sortSel = $("#f-sort"); const want = `${st.sort}|${st.dir}`;
    sortSel.value = [...sortSel.options].some((o) => o.value === want) ? want : "";
  }
  function togglePick(id) {
    const n = note(id);
    if (!n.picked && picks().length >= MAX_PICKS) { toast("비교는 최대 4건까지예요. 비교표에서 하나를 빼고 추가해 주세요."); return; }
    saveNote(id, { picked: !n.picked, pick_order: !n.picked ? Math.max(0, ...[...notes.values()].map((v) => v.pick_order || 0)) + 1 : null });
    render(); renderCmp();
  }
  function onTableClick(e) {
    const p = e.target.closest(".pickbtn"); if (p) return togglePick(p.dataset.id);
    const s = e.target.closest(".star"); if (s) { saveNote(s.dataset.id, { starred: !note(s.dataset.id).starred }); render(); renderCmp(); return; }
    const m = e.target.closest(".memobtn"); if (m) return openSheet(m.dataset.id);
  }
  function render() {
    if (!rows.length) return;
    syncControls(); store.set("nh-filter", st);
    let r = rows.filter((x) => (st.hall === "all" || x.hall === st.hall) && st.month.includes(x.date.slice(5, 7)) && st.dow.includes(x.dow) && (st.time === "all" || x.time === st.time) && (st.guar === "all" || x.guar === +st.guar) && (st.max === "0" || (x.disc ?? x.total) <= +st.max) && (!st.promo || x.promo) && (!st.star || note(x.id).starred));
    const k = st.sort;
    r.sort((a, b) => { let va = a[k], vb = b[k]; if (k === "date") { va = a.date + a.time; vb = b.date + b.time; } if (k === "disc") { va = a.disc ?? a.total; vb = b.disc ?? b.total; } return (va > vb ? 1 : va < vb ? -1 : 0) * st.dir || (a.date + a.time).localeCompare(b.date + b.time); });
    document.querySelectorAll("#tbl th[data-sort]").forEach((th) => { th.textContent = th.textContent.replace(/ [▲▼]$/, ""); if (th.dataset.sort === k) th.textContent += st.dir > 0 ? " ▲" : " ▼"; });
    const nm = r.filter((x) => x.hall === "lamer").length;
    const starred = rows.filter((x) => note(x.id).starred).length;
    $("#count").innerHTML = `<b>${r.length}</b>건 표시 · 라메르 ${nm} / 라포레 ${r.length - nm} · ★ 후보 ${starred}`;
    $("#tbl tbody").innerHTML = r.length ? r.map((x) => { const n = note(x.id); return `<tr class="${n.picked ? "picked" : ""}">
      <td class="l"><button class="star" data-id="${x.id}" aria-pressed="${n.starred}" aria-label="후보 표시">★</button></td>
      <td class="l"><span class="tag ${CLS[x.hall]}">${HALL[x.hall]}</span>${n.sent_quote_code ? ` <span class="sent">${esc(n.sent_quote_code)}</span>` : ""}</td><td class="l num">${x.date.replace(/-/g, ".")}</td><td class="l dow-${x.dow}">${x.dow}</td><td class="l num">${x.time}</td>
      <td class="num">${won(x.rental)}</td><td class="num">${won(x.meal)}</td><td class="num">${x.guar}명</td><td class="num">${won(x.per)}</td>
      <td class="num ${x.promo ? "strike" : ""}">${won(x.total)}</td><td class="num">${x.promo ? `<span class="tag P">10%</span> ${won(x.disc)}` : "–"}</td>
      <td class="num heart ${x.likes >= 3 ? "hot" : ""}">♥ ${x.likes}</td>
      <td class="l"><button class="pickbtn" data-id="${x.id}" aria-pressed="${n.picked}">${n.picked ? "✓ 비교중" : "비교"}</button>
        <button class="memobtn ${n.memo ? "has" : ""}" data-id="${x.id}" aria-label="메모">✎</button></td></tr>`; }).join("")
      : `<tr><td colspan="13" class="empty">조건에 맞는 슬롯이 없어요. 필터를 하나 풀어보세요.</td></tr>`;
    renderCards(r);
  }

  // 투어 현장에서 폰으로 볼 화면 — 표 대신 카드
  function renderCards(r) {
    $("#cards").innerHTML = r.length ? r.map((x) => { const n = note(x.id); return `
      <article class="card ${n.picked ? "picked" : ""}">
        <div class="c-top">
          <span class="tag ${CLS[x.hall]}">${HALL[x.hall]}</span>
          ${x.promo ? '<span class="tag P">10% 혜택일</span>' : ""}
          ${n.sent_quote_code ? `<span class="sent">${esc(n.sent_quote_code)}</span>` : ""}
          <button class="star" data-id="${x.id}" aria-pressed="${n.starred}" aria-label="후보 표시">★</button>
        </div>
        <div class="c-when">${x.date.replace(/-/g, ".")} <span class="dow-${x.dow}">(${x.dow})</span><span class="t">${x.time}</span></div>
        <dl class="c-money">
          <div><dt>대관료</dt><dd>${won(x.rental)}</dd></div>
          <div><dt>식대</dt><dd>${won(x.meal)}</dd></div>
          <div><dt>보증인원</dt><dd>${x.guar}명</dd></div>
          <div><dt>1인 식대</dt><dd>${won(x.per)}</dd></div>
        </dl>
        <div class="c-sum">
          <span class="lbl">대관료+식대</span>
          <b class="${x.promo ? "strike" : ""}">${won(x.total)}</b>
          ${x.promo ? `<b>${won(x.disc)}</b>` : ""}
        </div>
        <div class="c-foot">
          <span class="heart ${x.likes >= 3 ? "hot" : ""}">♥ ${x.likes}</span>
          <button class="pickbtn" data-id="${x.id}" aria-pressed="${n.picked}">${n.picked ? "✓ 비교중" : "비교"}</button>
          <button class="memobtn ${n.memo ? "has" : ""}" data-id="${x.id}">${n.memo ? "메모 보기" : "메모"}</button>
          ${n.memo ? `<span class="memoprev">✎ ${esc(n.memo)}</span>` : ""}
        </div>
      </article>`; }).join("")
      : `<div class="empty">조건에 맞는 슬롯이 없어요. 필터를 하나 풀어보세요.</div>`;
  }

  // ---------- 슬롯 시트 (★ · 메모 · 비교를 한 화면에서) ----------
  let sheetId = null;
  function openSheet(id) {
    const x = rows.find((r) => r.id === id); if (!x) return;
    const n = note(id);
    sheetId = id;
    $("#sheet-title").innerHTML = `<span class="tag ${CLS[x.hall]}">${HALL[x.hall]}</span>${x.date.replace(/-/g, ".")} (${x.dow}) ${x.time}`;
    $("#sheet-money").innerHTML = `
      <div><dt>대관료</dt><dd>${won(x.rental)}</dd></div>
      <div><dt>식대</dt><dd>${won(x.meal)}</dd></div>
      <div><dt>보증인원</dt><dd>${x.guar}명</dd></div>
      <div><dt>1인 식대</dt><dd>${won(x.per)}</dd></div>
      <div class="wide"><dt>${x.promo ? "10% 할인 추정가" : "대관료+식대"}</dt><dd>${won(x.disc ?? x.total)}</dd></div>`;
    $("#sheet-memo").value = n.memo || "";
    syncSheet();
    $("#sheet").showModal();
  }
  function syncSheet() {
    if (!sheetId) return;
    const n = note(sheetId);
    $("#sheet-star").setAttribute("aria-pressed", String(!!n.starred));
    $("#sheet-star").textContent = n.starred ? "★ 후보임" : "★ 후보";
    $("#sheet-pick").setAttribute("aria-pressed", String(!!n.picked));
    $("#sheet-pick").textContent = n.picked ? "✓ 비교 중" : "비교에 추가";
  }
  $("#sheet-close").onclick = () => $("#sheet").close();
  $("#sheet").addEventListener("close", () => { sheetId = null; render(); });
  $("#sheet").addEventListener("click", (e) => { if (e.target.id === "sheet") $("#sheet").close(); });
  $("#sheet-star").onclick = () => { saveNote(sheetId, { starred: !note(sheetId).starred }); syncSheet(); renderCmp(); };
  $("#sheet-pick").onclick = () => { const id = sheetId; togglePick(id); sheetId = id; syncSheet(); };
  $("#sheet-memo").addEventListener("input", (e) => {
    if (!sheetId) return;
    saveNote(sheetId, { memo: e.target.value.trim() || null }, 600);
  });

  // ---------- compare ----------
  function calc(x) {
    const n = note(x.id); const e = n.extras || {};
    const add = EXTRAS.reduce((s, [k]) => s + (+e[k] || 0), 0);
    const disc = n.discount_override != null ? +n.discount_override : x.promo ? Math.round(x.total * 0.1) : 0;
    const billed = Math.max(+n.expected_guests || 0, x.guar);
    const meal = x.per * billed; const total = x.rental + meal + add - disc;
    return { add, disc, billed, meal, total, perHead: Math.round(total / billed) };
  }
  let cmpPending = false;
  function safeRenderCmp() { if ($("#cmpbody").contains(document.activeElement) && document.activeElement.matches("input,textarea")) { cmpPending = true; updateCalc(); } else renderCmp(); }
  $("#cmpbody").addEventListener("focusout", () => setTimeout(() => { if (cmpPending && !$("#cmpbody").contains(document.activeElement)) { cmpPending = false; renderCmp(); } }, 50));

  function renderCmp() {
    const box = $("#cmpbody"); const P = picks();
    $("#cmpcount").textContent = `${P.length}/${MAX_PICKS}`;
    if (!P.length) { box.innerHTML = `<div class="empty">위 목록에서 <b>비교</b>를 눌러 슬롯을 추가하세요. 예: 같은 토요일의 라메르 12:30과 라포레 13:00.</div>`; return; }
    const cols = P.length + 1;
    const col = (f) => P.map((x) => `<td class="num">${f(x, note(x.id))}</td>`).join("");
    const num = (x, key, val, ph, step = 10000) => `<input type="number" inputmode="numeric" id="in-${x.id}-${key}" data-id="${x.id}" data-k="${key}" min="0" step="${step}" placeholder="${ph}" value="${val ?? ""}">`;
    box.innerHTML = `<div class="cmpbox"><table class="cmp"><thead><tr><th>항목</th>${P.map((x) => `<th><span class="tag ${CLS[x.hall]}">${HALL[x.hall]}</span><div class="num" style="color:var(--ink);font-size:13px;margin-top:4px">${x.date.replace(/-/g, ".")} (${x.dow}) ${x.time}</div><button class="rm" data-id="${x.id}">빼기</button></th>`).join("")}</tr></thead><tbody>
    <tr class="grp"><td colspan="${cols}">기본 정보</td></tr>
    <tr><td>후보</td>${P.map((x) => `<td><button class="star" data-id="${x.id}" aria-pressed="${note(x.id).starred}" aria-label="후보 표시">★</button></td>`).join("")}</tr>
    <tr><td>혜택</td>${col((x) => (x.promo ? '<span class="tag P">계약가 10% 할인</span>' : "–"))}</tr>
    <tr><td>찜 (사이트)</td>${col((x) => "♥ " + x.likes)}</tr>
    <tr class="grp"><td colspan="${cols}">인원 · 식대</td></tr>
    <tr><td>보증인원</td>${col((x) => x.guar + "명")}</tr>
    <tr><td>예상 하객 <span class="hint">보증인원보다 많으면 그만큼 청구</span></td>${P.map((x) => `<td>${num(x, "guests", note(x.id).expected_guests, x.guar, 10)}</td>`).join("")}</tr>
    <tr><td>1인 식대</td>${col((x) => won(x.per))}</tr>
    <tr class="calc"><td>식대 합계 <span class="hint">1인 식대 × 청구 인원</span></td>${P.map((x) => `<td class="num" id="c-meal-${x.id}"></td>`).join("")}</tr>
    <tr class="grp"><td colspan="${cols}">비용</td></tr>
    <tr><td>대관료</td>${col((x) => won(x.rental))}</tr>
    ${EXTRAS.map(([k, l]) => `<tr><td>${l}</td>${P.map((x) => `<td>${num(x, k, (note(x.id).extras || {})[k], 0)}</td>`).join("")}</tr>`).join("")}
    <tr><td>할인 <span class="hint">비워두면 혜택일은 (대관료+식대)×10% 자동</span></td>${P.map((x) => `<td>${num(x, "disc", note(x.id).discount_override, x.promo ? Math.round(x.total * 0.1) : 0)}</td>`).join("")}</tr>
    <tr class="grp"><td colspan="${cols}">합계</td></tr>
    <tr class="calc"><td>부대상품 합계</td>${P.map((x) => `<td class="num" id="c-add-${x.id}"></td>`).join("")}</tr>
    <tr class="calc total"><td>총 예상 비용</td>${P.map((x) => `<td class="num" id="c-total-${x.id}"></td>`).join("")}</tr>
    <tr class="calc"><td>1인당 환산 <span class="hint">총 예상 비용 ÷ 청구 인원</span></td>${P.map((x) => `<td class="num" id="c-per-${x.id}"></td>`).join("")}</tr>
    <tr class="grp"><td colspan="${cols}">메모 · 웨딩 DB</td></tr>
    <tr><td>상담 메모</td>${P.map((x) => `<td><textarea id="in-${x.id}-memo" data-id="${x.id}" data-k="memo" placeholder="예: 폐백실 무료, 꽃장식 업그레이드 필수">${esc(note(x.id).memo)}</textarea></td>`).join("")}</tr>
    <tr><td>견적으로 보내기 <span class="hint">웨딩 DB 견적 비교에 새 견적으로 등록</span></td>${P.map((x) => { const c = note(x.id).sent_quote_code; return `<td>${c ? `<span class="sent">✓ ${esc(c)} 등록됨</span>` : `<button class="sendbtn" data-id="${x.id}">견적으로 보내기</button>`}</td>`; }).join("")}</tr>
    </tbody></table></div>`;
    updateCalc();
  }
  function updateCalc() {
    const P = picks(); if (!P.length) return; const C = P.map(calc); const minT = Math.min(...C.map((c) => c.total));
    P.forEach((x, i) => {
      const c = C[i]; const set = (k, h) => { const el = document.getElementById(`c-${k}-${x.id}`); if (el) el.innerHTML = h; };
      set("meal", `${won(c.meal)}<span class="hint">${c.billed}명 청구</span>`);
      set("add", won(c.add));
      set("total", `<span class="${P.length > 1 && c.total === minT ? "best" : ""}">${won(c.total)}</span>${P.length > 1 ? (c.total === minT ? '<span class="hint">가장 낮음</span>' : `<span class="hint">최저 대비 +${man(c.total - minT)}</span>`) : ""}`);
      set("per", won(c.perHead));
    });
  }
  $("#cmpbody").addEventListener("input", (e) => {
    const t = e.target; const id = t.dataset.id, k = t.dataset.k; if (!k) return;
    const n = note(id); const v = t.value === "" ? null : t.value;
    let patch;
    if (k === "memo") patch = { memo: v };
    else if (k === "guests") patch = { expected_guests: v == null ? null : parseInt(v, 10) };
    else if (k === "disc") patch = { discount_override: v == null ? null : Math.round(+v) };
    else { const ex = { ...(n.extras || {}) }; if (v == null) delete ex[k]; else ex[k] = Math.round(+v); patch = { extras: ex }; }
    saveNote(id, patch, 600); updateCalc();
  });
  $("#cmpbody").addEventListener("click", (e) => {
    const rm = e.target.closest(".rm"); if (rm) return togglePick(rm.dataset.id);
    const s = e.target.closest(".star"); if (s) { saveNote(s.dataset.id, { starred: !note(s.dataset.id).starred }); render(); renderCmp(); return; }
    const send = e.target.closest(".sendbtn"); if (send) sendQuote(send.dataset.id, send);
  });

  // ---------- send to wedding DB ----------
  async function sendQuote(id, btn) {
    const x = rows.find((r) => r.id === id); const n = note(id); const c = calc(x);
    if (!confirm(`${HALL[x.hall]} ${x.date} (${x.dow}) ${x.time} 슬롯을 웨딩 DB 견적으로 등록할까요?\n\n총 예상 비용 ${won(c.total)}원`)) return;
    btn.disabled = true; btn.textContent = "보내는 중…";
    try {
      await saveNote(id, {}); // flush pending edits
      const { data: venue, error: ve } = await sb.from("venues").select("id").eq("venue_code", CFG.VENUE_CODE[x.hall]).single();
      if (ve) throw new Error("웨딩홀(" + CFG.VENUE_CODE[x.hall] + ")을 찾지 못했어요");
      const { data: codes, error: ce } = await sb.from("venue_quotes").select("quote_code").like("quote_code", "Q-%");
      if (ce) throw ce;
      const next = Math.max(0, ...codes.map((q) => parseInt(q.quote_code.replace(/\D/g, ""), 10) || 0)) + 1;
      const code = "Q-" + String(next).padStart(3, "0");
      const e = n.extras || {}; const m = +x.date.slice(5, 7);
      const payload = {
        quote_code: code, venue_id: venue.id, ceremony_date: x.date, ceremony_year: +x.date.slice(0, 4), ceremony_month: m,
        season: m >= 9 && m <= 11 ? "가을" : m >= 6 ? "여름" : m >= 3 ? "봄" : "겨울", day_of_week: x.dow, ceremony_time: x.time + ":00",
        guaranteed_guests: x.guar, expected_guests: c.billed, meal_price_per_person: x.per, hall_rental_fee: x.rental,
        discount_amount: c.disc, expected_total: c.total, promo_notes: x.promo ? "특정일 계약 혜택 │ 계약가 10% 할인 (추정 적용)" : "",
        source_url: "https://thechapel.co.kr/ceremony/ceremonyResultList",
        memo: [`슬롯 비교에서 등록 (${x.id}, 수집 ${x.collected}, 사이트 찜 ${x.likes})`, n.memo].filter(Boolean).join("\n"),
      };
      EXTRAS.forEach(([k, , col]) => { if (e[k] != null) payload[col] = +e[k]; });
      const { error: ie } = await sb.from("venue_quotes").insert(payload);
      if (ie) throw ie;
      await saveNote(id, { sent_quote_code: code });
      toast(`${code}로 웨딩 DB에 등록했어요`); render(); renderCmp();
    } catch (err) {
      btn.disabled = false; btn.textContent = "견적으로 보내기"; toast("등록하지 못했어요: " + (err.message || err));
    }
  }

  // ---------- pattern ----------
  function renderPattern() {
    const g = {};
    rows.forEach((x) => { const season = x.date.slice(5, 7) === "08" ? "8월" : x.promo ? "10월 혜택일" : "9~11월"; const key = [x.hall, season, x.dow, x.time, x.rental, x.guar, x.per].join("|"); g[key] = (g[key] || 0) + 1; });
    const order = { "8월": 0, "9~11월": 1, "10월 혜택일": 2 }, dw = { 토: 0, 일: 1, 월: 2 };
    const list = Object.entries(g).map(([k, n]) => { const [h, s, d, t, r, gu, p] = k.split("|"); return { h, s, d, t, r: +r, gu: +gu, p: +p, n }; });
    list.sort((a, b) => (a.h === b.h ? 0 : a.h === "lamer" ? -1 : 1) || order[a.s] - order[b.s] || dw[a.d] - dw[b.d] || a.t.localeCompare(b.t) || b.n - a.n);
    $("#pattern tbody").innerHTML = list.map((x) => `<tr><td class="l"><span class="tag ${CLS[x.h]}">${HALL[x.h]}</span></td><td class="l">${x.s}</td><td class="l">${x.d}</td><td class="l num">${x.t}</td><td class="num">${won(x.r)}</td><td class="num">${x.gu}명</td><td class="num">${won(x.p)}</td><td class="num">${won(x.r + x.p * x.gu)}</td><td class="num">${x.n}</td></tr>`).join("");
  }

  load();
})();
