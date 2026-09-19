// 하객 이동시간 (자차) — 카카오모빌리티 '미래 운행 정보 길찾기'로 미리 뽑아 둔 조사 결과를 보여준다.
// 데이터: data/travel_times.json (요약·원자료), data/travel_routes.json (대표 경로), data/travel_raw.jsonl (모든 호출 기록)
// app.js 는 window.Travel.chips(slot) / window.Travel.sheets() 만 부른다.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const hm = (m) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`;
  const kor = (m) => (m >= 60 ? `${Math.floor(m / 60)}시간 ${Math.round(m % 60)}분` : `${Math.round(m)}분`);
  const won = (n) => (n == null ? "–" : Number(n).toLocaleString("ko-KR") + "원");
  const median = (a) => { const s = [...a].sort((x, y) => x - y); const i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  let DATA = null, ROUTES = null;
  const st = { dow: "토", cer: "12:00" };
  try { Object.assign(st, JSON.parse(localStorage.getItem("tt-view") || "{}")); } catch (e) {}

  const Travel = { ready: false };
  window.Travel = Travel;

  // 같은 출발지·웨딩홀·요일·예식 시각의 9개 달 값
  const cellRows = (o, v, dow, cer) => DATA.rows.filter((r) => r.origin === o && r.venue === v && r.dow === dow && r.ceremony === cer);
  function stats(rows) {
    if (!rows.length) return null;
    const d = rows.map((r) => r.duration_min);
    const deps = rows.map((r) => toMin(r.departure));
    return { min: Math.min(...d), med: median(d), max: Math.max(...d), depMed: median(deps), depWorst: Math.min(...deps), n: rows.length };
  }

  // ---------- 히트맵 ----------
  function render() {
    const box = $("#travel"); if (!box || !DATA) return;
    const O = DATA.meta.origins, V = DATA.meta.venues;
    const grid = V.map((v) => ({ v, cells: O.map((o) => stats(cellRows(o.key, v.key, st.dow, st.cer))) }));
    grid.forEach((g) => (g.sum = g.cells.reduce((s, c) => s + (c ? c.med : 0), 0)));
    grid.sort((a, b) => a.sum - b.sum);
    // 출발지마다 따로 색을 매긴다 (부산 4시간대와 김포 50분대를 한 눈금에 놓으면 차이가 안 보인다)
    const range = O.map((_, i) => { const m = grid.map((g) => g.cells[i]?.med).filter((x) => x != null); return [Math.min(...m), Math.max(...m)]; });
    const tint = (i, m) => { const [a, b] = range[i]; const t = b > a ? (m - a) / (b - a) : 0; return `hsla(${Math.round(140 - 140 * t)},65%,45%,.20)`; };

    box.querySelector(".tt-body").innerHTML = `<table class="tt"><thead><tr><th class="l">웨딩홀</th>${
      O.map((o) => `<th>${esc(o.label)}<small>출발</small></th>`).join("")}<th>3곳 합</th></tr></thead><tbody>${
      grid.map((g, gi) => `<tr><td class="l"><b>${gi + 1}. ${esc(g.v.label)}</b>${
        g.v.halls.length ? `<small class="in">슬롯 비교 중</small>` : `<small>웨딩 DB</small>`}</td>${
        g.cells.map((c, i) => c ? `<td class="ttc" style="background:${tint(i, c.med)}"><button type="button" data-o="${O[i].key}" data-v="${g.v.key}">
          <b class="num">${hm(c.med)}</b><span class="num">${hm(c.min)}~${hm(c.max)}</span><span class="num dep">${hm(c.depMed)} 출발</span></button></td>` : `<td class="ttc">–</td>`).join("")}
        <td class="num sum">${hm(g.sum)}</td></tr>`).join("")}</tbody></table>`;
    box.querySelectorAll("#tt-dow button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === st.dow));
    box.querySelectorAll("#tt-cer button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === st.cer));
  }

  // ---------- 근거 창 ----------
  async function openSheet(o, v) {
    const O = DATA.meta.origins.find((x) => x.key === o), V = DATA.meta.venues.find((x) => x.key === v);
    const rows = cellRows(o, v, st.dow, st.cer).sort((a, b) => a.date.localeCompare(b.date));
    const s = stats(rows);
    const dlg = $("#tt-sheet");
    $("#tt-title", dlg).innerHTML = `${esc(O.label)} → ${esc(V.label)}<small>${st.dow}요일 ${+st.cer.slice(0, 2)}시 예식 · ${hm(toMin(st.cer) - 30)} 도착 기준 (예식 30분 전)</small>`;
    $("#tt-sum", dlg).innerHTML = `<div><dt>중간값</dt><dd>${kor(s.med)}</dd></div><div><dt>범위 (9개 달)</dt><dd>${kor(s.min)} ~ ${kor(s.max)}</dd></div>
      <div><dt>보통 출발</dt><dd>${hm(s.depMed)}</dd></div><div><dt>가장 막히는 달 기준 출발</dt><dd>${hm(s.depWorst)}</dd></div>`;
    $("#tt-rows", dlg).innerHTML = rows.map((r) => `<tr><td class="l num">${r.date.replace(/-/g, ".")} (${r.dow})</td><td class="num">${r.departure}</td>
      <td class="num">${r.arrival}</td><td class="num"><b>${hm(r.duration_min)}</b></td><td class="num">${r.distance_km}km</td><td class="num">${won(r.toll_won)}</td></tr>`).join("");
    $("#tt-evid", dlg).innerHTML = `출처: 카카오모빌리티 미래 운행 정보 길찾기 (추천 경로, 승용차) · 조회일 ${esc(DATA.meta.collected_at)}<br>
      조회 ID: ${rows.map((r) => `<code title="${esc(r.date)}">${esc(String(r.trans_id).slice(0, 10))}</code>`).join(" ")}
      <br><a href="data/travel_raw.jsonl" download>모든 호출 기록 내려받기</a>`;
    dlg.showModal();
    drawRoute(o, v);
  }

  let leafletP = null, map = null, layer = null;
  function loadLeaflet() {
    if (leafletP) return leafletP;
    leafletP = new Promise((res, rej) => {
      const css = document.createElement("link"); css.rel = "stylesheet";
      css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(css);
      const js = document.createElement("script"); js.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      js.onload = res; js.onerror = rej; document.head.appendChild(js);
    });
    return leafletP;
  }
  async function drawRoute(o, v) {
    const el = $("#tt-map");
    try {
      if (!ROUTES) ROUTES = await (await fetch("data/travel_routes.json")).json();
      const r = ROUTES[`${o}|${v}`];
      if (!r) { el.textContent = "경로 지도 없음"; return; }
      await loadLeaflet();
      const L = window.L;
      if (!map) { map = L.map(el, { zoomControl: true, attributionControl: true }); L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map); }
      if (layer) layer.remove();
      const pts = r.path.map(([x, y]) => [y, x]);
      layer = L.layerGroup([L.polyline(pts, { color: "#1D6A78", weight: 4 }), L.circleMarker(pts[0], { radius: 6, color: "#1D6A78", fillOpacity: 1 }),
        L.circleMarker(pts.at(-1), { radius: 6, color: "#A63D40", fillOpacity: 1 })]).addTo(map);
      setTimeout(() => { map.invalidateSize(); map.fitBounds(L.latLngBounds(pts), { padding: [18, 18] }); }, 60);
      $("#tt-mapcap").textContent = `지도 경로: ${r.label}`;
    } catch (e) { el.textContent = "경로 지도를 불러오지 못했어요"; }
  }

  // ---------- 슬롯 카드·표에 붙는 칩 ----------
  const CERS = ["11:00", "12:00", "13:00", "14:00"];
  Travel.chips = (x) => {
    if (!DATA || (x.dow !== "토" && x.dow !== "일")) return "";
    const v = DATA.meta.venues.find((z) => z.halls.includes(x.hall)); if (!v) return "";
    const t = toMin(x.time);
    const near = CERS.map((c) => [c, Math.abs(toMin(c) - t)]).sort((a, b) => a[1] - b[1])[0];
    if (near[1] > 30) return "";   // 11~14시 예식에서 30분 넘게 벗어난 슬롯은 조사 범위 밖
    const month = x.date.slice(0, 7);
    const parts = DATA.meta.origins.map((o) => {
      const r = DATA.rows.find((z) => z.origin === o.key && z.venue === v.key && z.dow === x.dow && z.ceremony === near[0] && z.date.startsWith(month));
      return r ? `${esc(o.short)} ${hm(r.duration_min)}` : null;
    }).filter(Boolean);
    return parts.length ? `<span class="ttchip" title="자차 · ${+near[0].slice(0, 2)}시 예식 30분 전 도착 기준 (${month} 같은 요일 예측)">🚗 ${parts.join(" · ")}</span>` : "";
  };

  // ---------- 엑셀 시트 ----------
  Travel.sheets = () => {
    const O = DATA.meta.origins, V = DATA.meta.venues, lab = (arr, k) => arr.find((a) => a.key === k).label;
    const summary = [];
    V.forEach((v) => O.forEach((o) => ["토", "일"].forEach((dow) => CERS.forEach((c) => {
      const s = stats(cellRows(o.key, v.key, dow, c)); if (!s) return;
      summary.push({ "출발지": o.label, "웨딩홀": v.label, "요일": dow, "예식": c, "도착 목표": `${hm(toMin(c) - 30)}`,
        "중간값(분)": s.med, "최소(분)": s.min, "최대(분)": s.max, "보통 출발": hm(s.depMed), "가장 막히는 달 기준 출발": hm(s.depWorst), "표본(달)": s.n });
    }))));
    const rows = DATA.rows.map((r) => ({ "출발지": lab(O, r.origin), "웨딩홀": lab(V, r.venue), "날짜": r.date, "요일": r.dow, "예식": r.ceremony,
      "도착 목표": r.target_arrival, "출발": r.departure, "도착": r.arrival, "도착 오차(분)": r.arrival_gap_min, "소요(분)": r.duration_min,
      "거리(km)": r.distance_km, "통행료(원)": r.toll_won, "조회 ID": r.trans_id }));
    return { summary, rows };
  };

  // ---------- 시작 ----------
  async function init() {
    const box = $("#travel"); if (!box) return;
    try { DATA = await (await fetch("data/travel_times.json")).json(); }
    catch (e) { box.querySelector(".tt-body").innerHTML = `<div class="empty">이동시간 자료를 불러오지 못했어요.</div>`; return; }
    Travel.ready = true;
    box.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.closest("#tt-dow")) st.dow = b.dataset.v;
      else if (b.closest("#tt-cer")) st.cer = b.dataset.v;
      else if (b.dataset.o) return openSheet(b.dataset.o, b.dataset.v);
      else return;
      try { localStorage.setItem("tt-view", JSON.stringify(st)); } catch (err) {}
      render();
    };
    $("#tt-close").onclick = () => $("#tt-sheet").close();
    $("#tt-sheet").addEventListener("click", (e) => { if (e.target.id === "tt-sheet") e.currentTarget.close(); });
    $("#tt-meta").textContent = `${DATA.meta.collected_at} 조회 · 2027년 3~11월 달마다 연휴 없는 주말 1번씩 (9개 달)`;
    render();
    window.dispatchEvent(new Event("travel-ready"));   // app.js 가 슬롯 칩을 다시 그린다
  }
  init();
})();
