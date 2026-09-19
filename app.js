(() => {
  const CFG = window.APP_CONFIG;
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
  // 홀 목록 — 홀을 더할 때는 여기, index.html 의 홀 버튼, style.css 의 색 세 곳만 손대면 된다
  const HALLS = {
    lamer:     { name: "라메르홀", short: "라메르", cls: "M", gloss: "더채플앳논현 · La Mer", src: "https://thechapel.co.kr/ceremony/ceremonyResultList" },
    laforet:   { name: "라포레홀", short: "라포레", cls: "F", gloss: "더채플앳논현 · La Forêt", src: "https://thechapel.co.kr/ceremony/ceremonyResultList" },
    daechi:    { name: "더채플앳대치", short: "대치", cls: "D", gloss: "더채플앳대치 · 대치점", src: "https://thechapel.co.kr/ceremony/ceremonyResultList" },
    seolleung: { name: "아펠가모 선릉", short: "선릉", cls: "S", gloss: "단독홀 4F · 한신인터밸리24", src: "https://www.apelgamo.com/ceremony/ceremonyResultList" },
    jamsil:    { name: "아펠가모 잠실", short: "잠실", cls: "J", gloss: "웨딩홀 2F · 한국광고문화회관", src: "https://www.apelgamo.com/ceremony/ceremonyResultList" },
    banpo:     { name: "아펠가모 반포", short: "반포", cls: "B", gloss: "웨딩홀 LL층 · 반포 효성빌딩", src: "https://www.apelgamo.com/ceremony/ceremonyResultList" },
  };
  const HALL_KEYS = Object.keys(HALLS);
  const HALL = Object.fromEntries(HALL_KEYS.map((k) => [k, HALLS[k].name]));
  const CLS = Object.fromEntries(HALL_KEYS.map((k) => [k, HALLS[k].cls]));
  const EXTRAS = [["flower", "꽃장식", "decoration_fee"], ["show", "연출·음향·조명", "sound_lighting_fee"], ["mc", "사회·축가", "mc_singer_fee"], ["snap", "본식 스냅·DVD", "snap_dvd_fee"], ["pyebaek", "폐백", "pyebaek_fee"], ["dress", "드레스·외부업체 반입료", "dress_bring_in_fee"], ["etc", "기타 부대상품", "other_fixed_fee"]];
  const MAX_PICKS = 4;

  const $ = (s) => document.querySelector(s);
  const won = (n) => (n == null ? "–" : Number(n).toLocaleString("ko-KR"));
  const man = (n) => (n / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "만";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // 혜택: 표시가가 할인 전 정가인 것(10%, 대관료 N%)은 추정가를 따로 내고,
  // 이미 할인이 들어간 표시가(특별할인 적용가)나 조건형 상품(금요일)은 문구만 보여준다
  const rentPctOf = (label) => { const m = /대관료 추가 (\d+)% 할인/.exec(label || ""); return m ? +m[1] : 0; };
  const autoDisc = (x) => (x.promo ? Math.round(x.total * 0.1) : x.rentPct ? Math.round(x.rental * x.rentPct / 100) : 0);
  function promoTag(x) {
    if (x.promo) return "10%";
    const l = x.label || "";
    if (!l) return "";
    if (x.rentPct) return `대관료 ${x.rentPct}%↓` + (/숙박/.test(l) ? " · 숙박권" : "");
    if (/적용가/.test(l)) return "특별할인 적용가";
    if (/시크릿/.test(l)) return "1주년 시크릿가";
    if (/금요일/.test(l)) return "금요일 상품";
    return l.split("│")[0].replace(/[^\p{L}\p{N}\s%·~()\/-]/gu, "").trim();
  }
  const store = { get(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  let rows = [];
  const notes = new Map(); // slot_id -> note
  // off: 보고 싶지 않은 "요일|시간" 조합. 요일 필터와 시간 필터를 따로 두면
  // 일요일 17시를 빼려다 토요일 17시까지 사라져서, 조합 단위로 끈다.
  const saved = store.get("nh-filter", {});
  const st = Object.assign({ hallOff: [], month: ["03", "04", "05", "06", "07", "08", "09", "10", "11"], off: [], guar: "all", max: "0", promo: false, star: false, sort: "date", dir: 1 }, saved);
  if (!Array.isArray(st.off)) st.off = [];
  delete st.dow; delete st.time;   // 예전 저장값 정리
  // 홀은 예전에 한 곳만 고르는 방식(hall: "lamer")이었다. 같은 뜻 그대로 '끈 홀 목록'으로 옮긴다.
  // 켠 홀이 아니라 끈 홀을 저장하므로, 나중에 새 홀이 생기면 저절로 보인다.
  if (!Array.isArray(st.hallOff)) st.hallOff = [];
  if (!Array.isArray(saved.hallOff) && saved.hall && saved.hall !== "all") st.hallOff = HALL_KEYS.filter((h) => h !== saved.hall);
  delete st.hall;
  const showHall = (h) => !st.hallOff.includes(h);
  const DOW_ORDER = ["토", "일", "금", "월", "수", "목"];
  const offKey = (d, t) => d + "|" + t;
  const isOff = (d, t) => st.off.includes(offKey(d, t));

  $("#weddingdb").href = CFG.WEDDING_DB_URL;

  function setSync(state, text) { const el = $("#sync"); el.className = "sync " + state; el.querySelector("span").textContent = text; }
  function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); }

  const note = (id) => notes.get(id) || { slot_id: id, picked: false, pick_order: null, expected_guests: null, extras: {}, discount_override: null, starred: false, memo: null, sent_quote_code: null };
  const passesFilter = (x) =>
    showHall(x.hall) &&
    st.month.includes(x.date.slice(5, 7)) &&
    !isOff(x.dow, x.time) &&
    (st.guar === "all" || x.guar === +st.guar) &&
    (st.max === "0" || (x.disc ?? x.total) <= +st.max) &&
    (!st.promo || x.promo) &&
    (!st.star || note(x.id).starred);
  const picks = () => rows.filter((r) => note(r.id).picked).sort((a, b) => (note(a.id).pick_order || 0) - (note(b.id).pick_order || 0));

  // ---------- data ----------
  // Supabase 는 한 번에 최대 1,000행만 돌려준다. 홀이 늘어 슬롯이 1,000건을 넘으면서
  // 날짜가 늦은 슬롯이 말없이 잘렸다 — 끝까지 나눠 받는다. id 로 순서를 확정해 페이지 사이에서 빠지거나 겹치지 않게.
  async function fetchAll(query) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await query().range(from, from + 999);
      if (error) return { error };
      out.push(...data);
      if (data.length < 1000) return { data: out };
    }
  }

  async function load() {
    setSync("", "불러오는 중");
    const [s, n] = await Promise.all([
      fetchAll(() => sb.from("chapel_slots").select("*").eq("is_available", true).order("ceremony_date").order("ceremony_time").order("id")),
      fetchAll(() => sb.from("chapel_slot_notes").select("*").order("slot_id")),
    ]);
    if (s.error || n.error) { setSync("err", "불러오기 실패"); $("#halls").innerHTML = `<div class="loading">데이터를 불러오지 못했어요: ${esc((s.error || n.error).message)}</div>`; return; }
    rows = s.data.map((x) => {
      const total = x.hall_rental_fee + x.meal_total;
      const o = { id: x.id, hall: x.hall, date: x.ceremony_date, dow: x.day_of_week, time: x.ceremony_time.slice(0, 5), rental: x.hall_rental_fee, meal: x.meal_total, guar: x.guaranteed_guests, per: x.meal_price_per_person, likes: x.likes, promo: x.promo_10pct, label: x.promo_label, rentPct: rentPctOf(x.promo_label), total, collected: x.collected_at };
      const d = autoDisc(o); o.disc = d ? total - d : null;   // 할인 추정가 (혜택 없으면 null)
      return o;
    });
    n.data.forEach((x) => notes.set(x.slot_id, x));
    initControls(); renderPattern(); render(); renderCmp();   // renderHalls 는 render() 가 필터 결과로 호출
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
  // 필터를 건 결과(view)를 그대로 받아 홀별 요약을 다시 계산한다 — 필터와 항상 같은 숫자를 보게
  const payable = (x) => x.disc ?? x.total;   // 혜택일은 10% 할인 추정가가 실제 낼 돈에 가깝다

  function renderHalls(view) {
    const list = view || rows;
    $("#halls").innerHTML = HALL_KEYS.map((h) => {
      const all = rows.filter((x) => x.hall === h);
      const r = list.filter((x) => x.hall === h);
      const gloss = HALLS[h].gloss;
      if (!all.length) return "";

      if (!r.length) return `<article class="hall ${CLS[h]} off">
        <div class="name">${HALL[h]}</div><div class="gloss">${gloss}</div>
        <div class="count num">0<small>조건에 맞는 슬롯 없음</small></div>
        <dl><div><dt>이 홀 전체</dt><dd class="num">${all.length}건</dd></div></dl></article>`;

      const narrowed = r.length !== all.length;
      const min = r.reduce((a, b) => (payable(a) < payable(b) ? a : b));
      const pers = r.map((x) => x.per);
      const gs = [...new Set(r.map((x) => x.guar))].sort((a, b) => a - b);
      const times = [...new Set(r.map((x) => x.time))].sort().join(" · ");
      return `<article class="hall ${CLS[h]}"><div class="name">${HALL[h]}</div><div class="gloss">${gloss} · ${times}</div>
      <div class="count num">${r.length}<small>${narrowed ? `조건에 맞는 슬롯 · 전체 ${all.length}` : "계약 가능 슬롯"}</small></div>
      <dl><div><dt>최저 실구매가</dt><dd class="num">${man(payable(min))}<span class="hint">${min.date.slice(5).replace("-", "/")} (${min.dow}) ${min.time}${promoTag(min) ? " · " + esc(promoTag(min)) : ""}</span></dd></div>
      <div><dt>1인 식대 범위</dt><dd class="num">${won(Math.min(...pers))}~${won(Math.max(...pers))}</dd></div>
      <div><dt>보증인원</dt><dd class="num">${gs[0]}~${gs.at(-1)}명</dd></div></dl></article>`;
    }).join("");
  }

  // ---------- filters & table ----------
  // 지금 홀 선택에서 실제로 존재하는 (요일, 시간) 조합만 다룬다
  const hallRows = () => rows.filter((x) => showHall(x.hall));
  const dtTimes = () => [...new Set(hallRows().map((x) => x.time))].sort();
  const dtDays = () => DOW_ORDER.filter((d) => rows.some((x) => x.dow === d));
  const dtExists = (d, t) => hallRows().some((x) => x.dow === d && x.time === t);

  function setOff(keys, off) {
    const s = new Set(st.off);
    keys.forEach((k) => (off ? s.add(k) : s.delete(k)));
    st.off = [...s];
  }

  function renderMatrix() {
    const times = dtTimes(), days = dtDays();
    $("#dowtime").innerHTML = `<table class="dtm"><thead><tr><th></th>${
      times.map((t) => `<th><button type="button" class="dth" data-col="${t}">${t}</button></th>`).join("")
    }</tr></thead><tbody>${days.map((d) => `<tr>
      <th><button type="button" class="dth" data-row="${d}">${d}${d === "월" ? "<small>대체공휴일</small>" : ""}</button></th>
      ${times.map((t) => dtExists(d, t)
        ? `<td><button type="button" class="dtc ${isOff(d, t) ? "off" : "on"}" data-cell="${offKey(d, t)}"
             aria-pressed="${!isOff(d, t)}" aria-label="${d}요일 ${t} ${isOff(d, t) ? "제외됨" : "포함"}"></button></td>`
        : `<td><span class="dtc none" aria-hidden="true"></span></td>`).join("")}
    </tr>`).join("")}</tbody></table>`;
  }

  function initControls() {
    $("#f-guar").insertAdjacentHTML("beforeend", [...new Set(rows.map((r) => r.guar))].sort((a, b) => a - b).map((g) => `<option value="${g}">${g}명</option>`).join(""));
    // 전체를 보던 중에 홀을 누르면 그 홀만, 그다음부터는 누를 때마다 더하고 뺀다. 다 빼면 다시 전체.
    $("#f-hall").onclick = (e) => {
      const v = e.target.closest("button")?.dataset.v; if (!v) return;
      if (v === "all") st.hallOff = [];
      else if (!st.hallOff.length) st.hallOff = HALL_KEYS.filter((h) => h !== v);
      else {
        const s = new Set(st.hallOff); s.has(v) ? s.delete(v) : s.add(v);
        st.hallOff = HALL_KEYS.every((h) => s.has(h)) ? [] : [...s];
      }
      render();
    };
    const toggle = (key) => (e) => { const v = e.target.dataset.v; if (!v) return; const s = new Set(st[key]); s.has(v) ? s.delete(v) : s.add(v); st[key] = [...s]; render(); };
    $("#f-month").onclick = toggle("month");
    ["guar", "max"].forEach((k) => ($("#f-" + k).onchange = (e) => { st[k] = e.target.value; render(); }));

    // 요일 · 시간 격자 (다시 그려도 살아남도록 위임)
    $("#dowtime").onclick = (e) => {
      const cell = e.target.closest("[data-cell]");
      if (cell) { setOff([cell.dataset.cell], !isOff(...cell.dataset.cell.split("|"))); return render(); }
      const row = e.target.closest("[data-row]");
      if (row) {
        const d = row.dataset.row, keys = dtTimes().filter((t) => dtExists(d, t)).map((t) => offKey(d, t));
        setOff(keys, keys.some((k) => !st.off.includes(k)));   // 하나라도 켜져 있으면 전부 끈다
        return render();
      }
      const col = e.target.closest("[data-col]");
      if (col) {
        const t = col.dataset.col, keys = dtDays().filter((d) => dtExists(d, t)).map((d) => offKey(d, t));
        setOff(keys, keys.some((k) => !st.off.includes(k)));
        return render();
      }
    };
    $("#dt-on").onclick = () => { st.off = []; render(); };
    $("#dt-off").onclick = () => {
      const keys = [];
      dtDays().forEach((d) => dtTimes().forEach((t) => dtExists(d, t) && keys.push(offKey(d, t))));
      setOff(keys, true); render();
    };
    $("#f-promo").onchange = (e) => { st.promo = e.target.checked; render(); };
    $("#f-star").onchange = (e) => { st.star = e.target.checked; render(); };
    $("#f-sort").onchange = (e) => { const [k, d] = e.target.value.split("|"); st.sort = k; st.dir = +d; render(); };
    document.querySelectorAll("#tbl th[data-sort]").forEach((th) => (th.onclick = () => { const k = th.dataset.sort; st.dir = st.sort === k ? -st.dir : 1; st.sort = k; render(); }));
    $("#tbl tbody").onclick = onTableClick;
    $("#cards").onclick = onTableClick;
  }
  function syncControls() {
    const allHalls = !HALL_KEYS.some((h) => st.hallOff.includes(h));
    document.querySelectorAll("#f-hall button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === "all" ? allHalls : !allHalls && showHall(b.dataset.v)));
    document.querySelectorAll("#f-month button").forEach((b) => b.setAttribute("aria-pressed", st.month.includes(b.dataset.v)));
    renderMatrix();
    $("#f-guar").value = st.guar; $("#f-max").value = st.max; $("#f-promo").checked = st.promo; $("#f-star").checked = st.star;
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
    let r = rows.filter(passesFilter);
    const k = st.sort;
    r.sort((a, b) => { let va = a[k], vb = b[k]; if (k === "date") { va = a.date + a.time; vb = b.date + b.time; } if (k === "disc") { va = a.disc ?? a.total; vb = b.disc ?? b.total; } return (va > vb ? 1 : va < vb ? -1 : 0) * st.dir || (a.date + a.time).localeCompare(b.date + b.time); });
    document.querySelectorAll("#tbl th[data-sort]").forEach((th) => { th.textContent = th.textContent.replace(/ [▲▼]$/, ""); if (th.dataset.sort === k) th.textContent += st.dir > 0 ? " ▲" : " ▼"; });
    renderHalls(r);
    const starred = rows.filter((x) => note(x.id).starred).length;
    const byHall = HALL_KEYS.filter((h) => rows.some((x) => x.hall === h)).map((h) => `${HALLS[h].short} ${r.filter((x) => x.hall === h).length}`).join(" / ");
    $("#count").innerHTML = `<b>${r.length}</b>건 표시 · ${byHall} · ★ 후보 ${starred}`;
    $("#tbl tbody").innerHTML = r.length ? r.map((x) => { const n = note(x.id); return `<tr class="${n.picked ? "picked" : ""}">
      <td class="l"><button class="star" data-id="${x.id}" aria-pressed="${n.starred}" aria-label="후보 표시">★</button></td>
      <td class="l"><span class="tag ${CLS[x.hall]}">${HALL[x.hall]}</span>${n.sent_quote_code ? ` <span class="sent">${esc(n.sent_quote_code)}</span>` : ""}${window.Travel?.chips(x) || ""}</td><td class="l num">${x.date.replace(/-/g, ".")}</td><td class="l dow-${x.dow}">${x.dow}</td><td class="l num">${x.time}</td>
      <td class="num">${won(x.rental)}</td><td class="num">${won(x.meal)}</td><td class="num">${x.guar}명</td><td class="num">${won(x.per)}</td>
      <td class="num ${x.disc != null ? "strike" : ""}">${won(x.total)}</td><td class="num">${x.disc != null ? `<span class="tag P">${esc(promoTag(x))}</span> ${won(x.disc)}` : x.label ? `<span class="tag P">${esc(promoTag(x))}</span>` : "–"}</td>
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
          ${promoTag(x) ? `<span class="tag P">${esc(x.promo ? "10% 혜택일" : promoTag(x))}</span>` : ""}
          ${n.sent_quote_code ? `<span class="sent">${esc(n.sent_quote_code)}</span>` : ""}
          <button class="star" data-id="${x.id}" aria-pressed="${n.starred}" aria-label="후보 표시">★</button>
        </div>
        <div class="c-when">${x.date.replace(/-/g, ".")} <span class="dow-${x.dow}">(${x.dow})</span><span class="t">${x.time}</span></div>
        ${window.Travel?.chips(x) || ""}
        <dl class="c-money">
          <div><dt>대관료</dt><dd>${won(x.rental)}</dd></div>
          <div><dt>식대</dt><dd>${won(x.meal)}</dd></div>
          <div><dt>보증인원</dt><dd>${x.guar}명</dd></div>
          <div><dt>1인 식대</dt><dd>${won(x.per)}</dd></div>
        </dl>
        <div class="c-sum">
          <span class="lbl">대관료+식대</span>
          <b class="${x.disc != null ? "strike" : ""}">${won(x.total)}</b>
          ${x.disc != null ? `<b>${won(x.disc)}</b>` : ""}
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
      <div class="wide"><dt>${x.disc != null ? `할인 추정가 (${esc(promoTag(x))})` : /적용가|시크릿/.test(x.label || "") ? `대관료+식대 (${esc(promoTag(x))})` : "대관료+식대"}</dt><dd>${won(x.disc ?? x.total)}</dd></div>`;
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
    const disc = n.discount_override != null ? +n.discount_override : autoDisc(x);
    const billed = Math.max(+n.expected_guests || 0, x.guar);
    const meal = x.per * billed; const total = x.rental + meal + add - disc;
    return { add, disc, billed, meal, total, perHead: Math.round(total / billed) };
  }
  let cmpPending = false;
  function safeRenderCmp() { if ($("#cmpbody").contains(document.activeElement) && document.activeElement.matches("input,textarea")) { cmpPending = true; updateCalc(); } else renderCmp(); }
  $("#cmpbody").addEventListener("focusout", () => setTimeout(() => { if (cmpPending && !$("#cmpbody").contains(document.activeElement)) { cmpPending = false; renderCmp(); } }, 50));

  const openCards = new Set();   // 폰에서 펼쳐둔 슬롯 카드

  function renderCmp() {
    const box = $("#cmpbody"); const P = picks();
    $("#cmpcount").textContent = `${P.length}/${MAX_PICKS}`;
    if (!P.length) { box.innerHTML = `<div class="empty">위 목록에서 <b>비교</b>를 눌러 슬롯을 추가하세요. 예: 같은 토요일의 라메르 12:30과 라포레 13:00.</div>`; return; }
    box.innerHTML = cmpTable(P) + cmpCards(P);
    updateCalc();
  }

  // 입력칸 — 표와 카드가 같이 떠 있으므로 id 앞에 접두사를 붙여 겹치지 않게 한다
  const numInput = (x, key, val, ph, step = 10000, pre = "") =>
    `<input type="number" inputmode="numeric" id="${pre}in-${x.id}-${key}" data-id="${x.id}" data-k="${key}" min="0" step="${step}" placeholder="${ph}" value="${val ?? ""}">`;

  // ---------- 넓은 화면: 지금까지의 표 ----------
  function cmpTable(P) {
    const cols = P.length + 1;
    const col = (f) => P.map((x) => `<td class="num">${f(x, note(x.id))}</td>`).join("");
    const num = (x, k, v, ph, step) => numInput(x, k, v, ph, step);
    return `<div class="cmpbox"><table class="cmp"><thead><tr><th>항목</th>${P.map((x) => `<th><span class="tag ${CLS[x.hall]}">${HALL[x.hall]}</span><div class="num" style="color:var(--ink);font-size:13px;margin-top:4px">${x.date.replace(/-/g, ".")} (${x.dow}) ${x.time}</div><button class="rm" data-id="${x.id}">빼기</button></th>`).join("")}</tr></thead><tbody>
    <tr class="grp"><td colspan="${cols}">기본 정보</td></tr>
    <tr><td>후보</td>${P.map((x) => `<td><button class="star" data-id="${x.id}" aria-pressed="${note(x.id).starred}" aria-label="후보 표시">★</button></td>`).join("")}</tr>
    <tr><td>혜택</td>${col((x) => (x.promo ? '<span class="tag P">계약가 10% 할인</span>' : x.label ? `<span class="tag P">${esc(x.label)}</span>` : "–"))}</tr>
    <tr><td>찜 (사이트)</td>${col((x) => "♥ " + x.likes)}</tr>
    <tr class="grp"><td colspan="${cols}">인원 · 식대</td></tr>
    <tr><td>보증인원</td>${col((x) => x.guar + "명")}</tr>
    <tr><td>예상 하객 <span class="hint">보증인원보다 많으면 그만큼 청구</span></td>${P.map((x) => `<td>${num(x, "guests", note(x.id).expected_guests, x.guar, 10)}</td>`).join("")}</tr>
    <tr><td>1인 식대</td>${col((x) => won(x.per))}</tr>
    <tr class="calc"><td>식대 합계 <span class="hint">1인 식대 × 청구 인원</span></td>${P.map((x) => `<td class="num" data-calc="meal-${x.id}"></td>`).join("")}</tr>
    <tr class="grp"><td colspan="${cols}">비용</td></tr>
    <tr><td>대관료</td>${col((x) => won(x.rental))}</tr>
    ${EXTRAS.map(([k, l]) => `<tr><td>${l}</td>${P.map((x) => `<td>${num(x, k, (note(x.id).extras || {})[k], 0)}</td>`).join("")}</tr>`).join("")}
    <tr><td>할인 <span class="hint">비워두면 혜택 추정 자동 (10% 혜택일 · 대관료 할인)</span></td>${P.map((x) => `<td>${num(x, "disc", note(x.id).discount_override, autoDisc(x))}</td>`).join("")}</tr>
    <tr class="grp"><td colspan="${cols}">합계</td></tr>
    <tr class="calc"><td>부대상품 합계</td>${P.map((x) => `<td class="num" data-calc="add-${x.id}"></td>`).join("")}</tr>
    <tr class="calc total"><td>총 예상 비용</td>${P.map((x) => `<td class="num" data-calc="total-${x.id}"></td>`).join("")}</tr>
    <tr class="calc"><td>1인당 환산 <span class="hint">총 예상 비용 ÷ 청구 인원</span></td>${P.map((x) => `<td class="num" data-calc="per-${x.id}"></td>`).join("")}</tr>
    <tr class="grp"><td colspan="${cols}">메모 · 웨딩 DB</td></tr>
    <tr><td>상담 메모</td>${P.map((x) => `<td><textarea id="in-${x.id}-memo" data-id="${x.id}" data-k="memo" placeholder="예: 폐백실 무료, 꽃장식 업그레이드 필수">${esc(note(x.id).memo)}</textarea></td>`).join("")}</tr>
    <tr><td>견적으로 보내기 <span class="hint">웨딩 DB 견적 비교에 새 견적으로 등록</span></td>${P.map((x) => { const c = note(x.id).sent_quote_code; return `<td>${c ? `<span class="sent">✓ ${esc(c)} 등록됨</span>` : `<button class="sendbtn" data-id="${x.id}">견적으로 보내기</button>`}</td>`; }).join("")}</tr>
    </tbody></table></div>`;
  }

  // ---------- 폰: 순위 요약 + 슬롯 카드 ----------
  function cmpCards(P) {
    const C = P.map(calc);
    const maxT = Math.max(...C.map((c) => c.total));
    const minT = Math.min(...C.map((c) => c.total));
    const ranked = P.map((x, i) => ({ x, c: C[i] })).sort((a, b) => a.c.total - b.c.total);

    const rank = `<div class="rankcard">
      <div class="rank-h">총 예상 비용 순 <span>${P.length}건</span></div>
      ${ranked.map((r, i) => `<button type="button" class="rrow ${i === 0 ? "top" : ""}" data-goto="${r.x.id}">
        <span class="no">${i + 1}</span>
        <span class="rnm"><span class="tag ${CLS[r.x.hall]}">${HALL[r.x.hall]}</span>${r.x.date.slice(5).replace("-", "/")} (${r.x.dow}) ${r.x.time}</span>
        <span class="track"><i style="width:${Math.round((r.c.total / maxT) * 100)}%"></i></span>
        <span class="amt">${man(r.c.total)}</span></button>`).join("")}
      ${P.length > 1 ? `<div class="rank-f">최저 <b>${man(minT)}</b> · 최고와 <b>${man(maxT - minT)}</b> 차이</div>` : ""}
    </div>`;

    const cards = P.map((x, i) => {
      const n = note(x.id); const c = C[i]; const open = openCards.has(x.id);
      const num = (k, v, ph, step) => numInput(x, k, v, ph, step, "m-");
      return `<article class="slotcard ${P.length > 1 && c.total === minT ? "best" : ""}" id="card-${x.id}">
        <div class="sc-h">
          <button class="star" data-id="${x.id}" aria-pressed="${n.starred}" aria-label="후보 표시">★</button>
          <span class="tag ${CLS[x.hall]}">${HALL[x.hall]}</span>
          <span class="sc-when">${x.date.replace(/-/g, ".")} (${x.dow}) ${x.time}</span>
          ${promoTag(x) ? `<span class="tag P">${esc(promoTag(x))}</span>` : ""}
        </div>
        <div class="sc-tot">
          <span class="lb">총 예상 비용</span>
          <b class="num" data-calc="ctotal-${x.id}"></b>
          <em data-calc="delta-${x.id}"></em>
        </div>
        <dl class="sc-kv">
          <div><dt>1인당 환산</dt><dd class="num" data-calc="per-${x.id}"></dd></div>
          <div><dt>대관료</dt><dd class="num">${won(x.rental)}</dd></div>
          <div><dt>식대 합계</dt><dd class="num" data-calc="meal-${x.id}"></dd></div>
          <div><dt>부대상품</dt><dd class="num" data-calc="add-${x.id}"></dd></div>
          <div><dt>할인</dt><dd class="num" data-calc="disc-${x.id}"></dd></div>
          <div><dt>보증 / 1인 식대</dt><dd class="num">${x.guar}명 · ${won(x.per)}</dd></div>
        </dl>
        <button type="button" class="sc-more" data-toggle="${x.id}">${open ? "입력 접기 ▲" : "부대상품 입력 · 메모 ▼"}</button>
        <div class="sc-edit" ${open ? "" : "hidden"}>
          <label class="sc-f"><span>예상 하객 <em>보증보다 많으면 그만큼 청구</em></span>${num("guests", n.expected_guests, x.guar, 10)}</label>
          ${EXTRAS.map(([k, l]) => `<label class="sc-f"><span>${l}</span>${num(k, (n.extras || {})[k], 0)}</label>`).join("")}
          <label class="sc-f"><span>할인 <em>비우면 혜택 추정 자동</em></span>${num("disc", n.discount_override, autoDisc(x))}</label>
          <label class="sc-f col"><span>상담 메모</span><textarea id="m-in-${x.id}-memo" data-id="${x.id}" data-k="memo" placeholder="예: 폐백실 무료, 꽃장식 업그레이드 필수">${esc(n.memo)}</textarea></label>
          <div class="sc-acts">
            <button type="button" class="rm" data-id="${x.id}">비교에서 빼기</button>
            ${n.sent_quote_code ? `<span class="sent">✓ ${esc(n.sent_quote_code)} 등록됨</span>` : `<button type="button" class="sendbtn" data-id="${x.id}">견적으로 보내기</button>`}
          </div>
        </div>
      </article>`;
    }).join("");

    return `<div class="cmpcards">${rank}${cards}</div>`;
  }

  function updateCalc() {
    const P = picks(); if (!P.length) return;
    const C = P.map(calc); const minT = Math.min(...C.map((c) => c.total));
    const set = (key, html) => document.querySelectorAll(`[data-calc="${key}"]`).forEach((el) => (el.innerHTML = html));
    P.forEach((x, i) => {
      const c = C[i]; const lowest = P.length > 1 && c.total === minT;
      set(`meal-${x.id}`, `${won(c.meal)}<span class="hint">${c.billed}명 청구</span>`);
      set(`add-${x.id}`, won(c.add));
      set(`disc-${x.id}`, c.disc ? `−${won(c.disc)}` : "–");
      set(`total-${x.id}`, `<span class="${lowest ? "best" : ""}">${won(c.total)}</span>${P.length > 1 ? (lowest ? '<span class="hint">가장 낮음</span>' : `<span class="hint">최저 대비 +${man(c.total - minT)}</span>`) : ""}`);
      set(`ctotal-${x.id}`, won(c.total));
      set(`delta-${x.id}`, P.length > 1 ? (lowest ? "최저" : `+${man(c.total - minT)}`) : "");
      set(`per-${x.id}`, won(c.perHead));
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
    const go = e.target.closest("[data-goto]");
    if (go) { document.getElementById("card-" + go.dataset.goto)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const tg = e.target.closest("[data-toggle]");
    if (tg) {
      const id = tg.dataset.toggle;
      openCards.has(id) ? openCards.delete(id) : openCards.add(id);
      const card = document.getElementById("card-" + id);
      card.querySelector(".sc-edit").hidden = !openCards.has(id);
      tg.textContent = openCards.has(id) ? "입력 접기 ▲" : "부대상품 입력 · 메모 ▼";
      return;
    }
    const rm = e.target.closest(".rm"); if (rm) { openCards.delete(rm.dataset.id); return togglePick(rm.dataset.id); }
    const s = e.target.closest(".star"); if (s) { saveNote(s.dataset.id, { starred: !note(s.dataset.id).starred }); render(); renderCmp(); return; }
    const send = e.target.closest(".sendbtn"); if (send) sendQuote(send.dataset.id, send);
  });

  // ---------- send to wedding DB ----------
  async function sendQuote(id, btn) {
    const x = rows.find((r) => r.id === id); const n = note(id); const c = calc(x);
    if (!CFG.VENUE_CODE[x.hall]) { toast(`${HALL[x.hall]}은 아직 웨딩 DB 웨딩홀 마스터에 없어요. 먼저 등록해 주세요.`); return; }
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
        discount_amount: c.disc, expected_total: c.total, promo_notes: x.promo ? "특정일 계약 혜택 │ 계약가 10% 할인 (추정 적용)" : x.rentPct ? `${x.label} (대관료 ${x.rentPct}% 추정 적용)` : (x.label || ""),
        source_url: HALLS[x.hall].src,
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

  // ---------- 엑셀 내보내기 ----------
  // 화면에서 보던 것을 그대로: 지금 필터된 목록 / 전체 / 비교표 / 요금 패턴
  function filteredRows() { return rows.filter(passesFilter); }
  function filterSummary() {
    const p = [];
    p.push("홀: " + (HALL_KEYS.every(showHall) ? "전체" : HALL_KEYS.filter(showHall).map((h) => HALL[h]).join(", ")));
    p.push("월: " + (st.month.length >= document.querySelectorAll("#f-month button").length ? "전체" : st.month.map((m) => +m + "월").join(", ")));
    const excluded = {};
    st.off.forEach((k) => { const [d, t] = k.split("|"); (excluded[d] ||= []).push(t); });
    const exText = DOW_ORDER.filter((d) => excluded[d]).map((d) => {
      const all = dtTimes().filter((t) => dtExists(d, t));
      return excluded[d].length >= all.length ? `${d} 전체` : `${d} ${excluded[d].sort().join("·")}`;
    }).join(" / ");
    p.push("요일·시간: " + (exText ? "제외 → " + exText : "전체"));
    if (st.guar !== "all") p.push("보증인원: " + st.guar + "명");
    if (st.max !== "0") p.push("총액 상한: " + won(+st.max) + "원");
    if (st.promo) p.push("10% 혜택일만");
    if (st.star) p.push("★ 후보만");
    return p.join(" · ");
  }
  const slotRow = (x) => {
    const n = note(x.id);
    return {
      "홀": HALL[x.hall], "예식일": x.date, "요일": x.dow, "시간": x.time,
      "대관료": x.rental, "식대": x.meal, "보증인원": x.guar, "1인 식대": x.per,
      "대관료+식대": x.total,
      "10% 혜택일": x.promo ? "예" : "",
      "할인 추정가": x.disc ?? "",
      "프로모션": x.label || "",
      "찜(사이트)": x.likes,
      "★ 후보": n.starred ? "★" : "",
      "비교중": n.picked ? "예" : "",
      "상담 메모": n.memo || "",
      "웨딩DB 견적": n.sent_quote_code || "",
      "슬롯ID": x.id,
    };
  };
  function sheetFrom(list) {
    const ws = XLSX.utils.json_to_sheet(list);
    const keys = Object.keys(list[0] || {});
    ws["!cols"] = keys.map((k) => ({ wch: Math.min(Math.max(k.length + 2, ...list.map((r) => String(r[k] ?? "").length + 2)), 42) }));
    return ws;
  }

  function cmpSheet() {
    const P = picks(); if (!P.length) return null;
    const C = P.map(calc);
    const out = [["항목", ...P.map((x) => `${HALL[x.hall]} ${x.date.replace(/-/g, ".")} (${x.dow}) ${x.time}`)]];
    const row = (label, f) => out.push([label, ...P.map((x, i) => f(x, note(x.id), C[i]))]);
    out.push(["■ 기본 정보"]);
    row("예식일", (x) => x.date); row("요일", (x) => x.dow); row("시간", (x) => x.time);
    row("혜택", (x) => (x.promo ? "계약가 10% 할인" : x.label || ""));
    row("찜(사이트)", (x) => x.likes);
    row("★ 후보", (x, n) => (n.starred ? "★" : ""));
    out.push(["■ 인원 · 식대"]);
    row("보증인원", (x) => x.guar);
    row("예상 하객", (x, n) => n.expected_guests ?? "");
    row("청구 인원", (x, n, c) => c.billed);
    row("1인 식대", (x) => x.per);
    row("식대 합계", (x, n, c) => c.meal);
    out.push(["■ 비용"]);
    row("대관료", (x) => x.rental);
    EXTRAS.forEach(([k, l]) => row(l, (x, n) => (n.extras || {})[k] ?? ""));
    row("할인", (x, n, c) => c.disc);
    out.push(["■ 합계"]);
    row("부대상품 합계", (x, n, c) => c.add);
    row("총 예상 비용", (x, n, c) => c.total);
    row("1인당 환산", (x, n, c) => c.perHead);
    out.push(["■ 메모"]);
    row("상담 메모", (x, n) => n.memo || "");
    row("웨딩DB 견적", (x, n) => n.sent_quote_code || "");
    const ws = XLSX.utils.aoa_to_sheet(out);
    ws["!cols"] = [{ wch: 18 }, ...P.map(() => ({ wch: 26 }))];
    return ws;
  }

  // 요금 패턴의 시즌 — 8월까지는 달마다, 9~11월은 묶고, 이미 할인된 날·10% 혜택일은 따로 뗀다
  function seasonOf(x) {
    const m = +x.date.slice(5, 7);
    if (/적용가|시크릿/.test(x.label || "")) return m + "월 특별할인일";
    if (x.promo) return m + "월 혜택일";
    return m <= 8 ? m + "월" : "9~11월";
  }
  const seasonRank = (s) => parseInt(s, 10) * 10 + (/특별할인일/.test(s) ? 1 : /혜택일/.test(s) ? 2 : 0);

  function patternList() {
    const g = {};
    rows.forEach((x) => { const season = seasonOf(x); const key = [x.hall, season, x.dow, x.time, x.rental, x.guar, x.per].join("|"); g[key] = (g[key] || 0) + 1; });
    const dw = Object.fromEntries(DOW_ORDER.map((d, i) => [d, i]));
    return Object.entries(g).map(([k, n]) => { const [h, s, d, t, r, gu, p] = k.split("|"); return { h, s, d, t, r: +r, gu: +gu, p: +p, n }; })
      .sort((a, b) => (HALL_KEYS.indexOf(a.h) - HALL_KEYS.indexOf(b.h)) || seasonRank(a.s) - seasonRank(b.s) || dw[a.d] - dw[b.d] || a.t.localeCompare(b.t) || b.n - a.n)
      .map((x) => ({ "홀": HALL[x.h], "시즌": x.s, "요일": x.d, "시간": x.t, "대관료": x.r, "보증인원": x.gu, "1인 식대": x.p, "대관료+식대": x.r + x.p * x.gu, "슬롯 수": x.n }));
  }

  function exportXlsx() {
    const btn = $("#xlsx"); const label = btn.textContent;
    btn.disabled = true; btn.textContent = "내보내는 중…";
    try {
      const shown = filteredRows();
      const starred = rows.filter((x) => note(x.id).starred);
      const P = picks();
      const now = new Date();
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

      const info = [
        { "항목": "내보낸 일시", "내용": now.toLocaleString("ko-KR") },
        { "항목": "자료 수집일", "내용": [...new Set(rows.map((x) => x.collected))].sort().join(", ") },
        { "항목": "대상", "내용": HALL_KEYS.map((h) => { const d = rows.filter((x) => x.hall === h).map((x) => x.date).sort(); return d.length ? `${HALLS[h].name} ${d[0]} ~ ${d.at(-1)}` : ""; }).filter(Boolean).join(" / ") },
        { "항목": "전체 슬롯", "내용": `${rows.length}건 (${HALL_KEYS.map((h) => `${HALLS[h].short} ${rows.filter((x) => x.hall === h).length}`).join(" / ")})` },
        { "항목": "01_슬롯목록 필터", "내용": filterSummary() },
        { "항목": "01_슬롯목록 건수", "내용": `${shown.length}건` },
        { "항목": "★ 후보", "내용": `${starred.length}건` },
        { "항목": "비교 담은 슬롯", "내용": `${P.length}건` },
        { "항목": " ", "내용": " " },
        { "항목": "식대", "내용": "1인 식대 × 보증인원 (사이트 표시가 기준, 1인 식대는 역산)" },
        { "항목": "10% 혜택일", "내용": "표시가를 할인 전 정가로 보고 (대관료+식대)×0.9 를 추정가로 병기" },
        { "항목": "대관료 N% 할인", "내용": "아펠가모 선릉·잠실·반포 3~8월 '대관료 추가 50% 할인 [~10/12]'. 표시가를 할인 전으로 보고 대관료×50% 를 뺀 값을 추정가로 병기 (2026-10-12까지 계약 조건)" },
        { "항목": "총 예상 비용", "내용": "대관료 + 1인 식대×max(예상 하객, 보증인원) + 부대상품 − 할인" },
        { "항목": "주의", "내용": "VAT·주류 포함 여부와 필수 부대상품은 반영하지 않았습니다. 실제 상담에서 확인하세요." },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheetFrom(info), "00_안내");
      XLSX.utils.book_append_sheet(wb, sheetFrom(shown.length ? shown.map(slotRow) : [{ "홀": "조건에 맞는 슬롯이 없습니다" }]), "01_슬롯목록");
      XLSX.utils.book_append_sheet(wb, sheetFrom(rows.map(slotRow)), "02_전체슬롯");
      const cmp = cmpSheet();
      if (cmp) XLSX.utils.book_append_sheet(wb, cmp, "03_견적비교");
      XLSX.utils.book_append_sheet(wb, sheetFrom(patternList()), "04_요금패턴");
      if (window.Travel?.ready) {
        const t = window.Travel.sheets();
        XLSX.utils.book_append_sheet(wb, sheetFrom(t.summary), "05_이동시간_요약");
        XLSX.utils.book_append_sheet(wb, sheetFrom(t.rows), "06_이동시간_원자료");
      }

      XLSX.writeFile(wb, `예식슬롯_비교_${stamp}.xlsx`);
      toast(`엑셀로 내보냈어요 — 목록 ${shown.length}건${P.length ? ` · 비교 ${P.length}건` : ""}`);
    } catch (err) {
      toast("내보내지 못했어요: " + (err.message || err));
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  }
  $("#xlsx").onclick = exportXlsx;

  // ---------- pattern ----------
  function renderPattern() {
    const g = {};
    rows.forEach((x) => { const season = seasonOf(x); const key = [x.hall, season, x.dow, x.time, x.rental, x.guar, x.per].join("|"); g[key] = (g[key] || 0) + 1; });
    const dw = Object.fromEntries(DOW_ORDER.map((d, i) => [d, i]));
    const list = Object.entries(g).map(([k, n]) => { const [h, s, d, t, r, gu, p] = k.split("|"); return { h, s, d, t, r: +r, gu: +gu, p: +p, n }; });
    list.sort((a, b) => (HALL_KEYS.indexOf(a.h) - HALL_KEYS.indexOf(b.h)) || seasonRank(a.s) - seasonRank(b.s) || dw[a.d] - dw[b.d] || a.t.localeCompare(b.t) || b.n - a.n);
    $("#pattern tbody").innerHTML = list.map((x) => `<tr><td class="l"><span class="tag ${CLS[x.h]}">${HALL[x.h]}</span></td><td class="l">${x.s}</td><td class="l">${x.d}</td><td class="l num">${x.t}</td><td class="num">${won(x.r)}</td><td class="num">${x.gu}명</td><td class="num">${won(x.p)}</td><td class="num">${won(x.r + x.p * x.gu)}</td><td class="num">${x.n}</td></tr>`).join("");
  }

  window.addEventListener("travel-ready", () => { if (rows.length) render(); });
  load();
})();
