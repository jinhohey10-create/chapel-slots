// 드레스 견적 — 9월 스드메 표에 올라온 드레스샵 21곳과, 패키지가에 얹히는 추가금 구조.
// 데이터: data/dress.json (샵 목록 · 추가금 · 시세)
// 근거와 출처는 docs/드레스-견적-리서치.md 에 있다.
// app.js 는 window.Dress.sheets() 만 부른다.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const man = (n) => (n == null ? "–" : `${(n / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만`);

  let D = null;
  const st = { view: "calc", tier: 2130000, tours: 3, label: 0, second: 0, outdoor: false, data: true, helper: true };
  try { Object.assign(st, JSON.parse(localStorage.getItem("dress-view") || "{}")); } catch (e) {}

  const Dress = { ready: false };
  window.Dress = Dress;
  const save = () => { try { localStorage.setItem("dress-view", JSON.stringify(st)); } catch (e) {} };

  // ---------- ⓪ 견적 계산 ----------
  // 묶음가 자체는 플래너가 부르는 값이고, 여기 더하는 것들이 '표에 안 적힌 돈'이다.
  function calcLines() {
    const L = [];
    L.push(["9월 스드메 묶음가", st.tier, "스튜디오 + 드레스 + 메이크업"]);
    if (st.data) L.push(["원본 + 수정본 데이터", 440000, "표의 불포함 항목. 샵에 따라 55만인 곳도 있다"]);
    if (st.helper) {
      const h = st.outdoor ? 300000 : 250000;
      L.push(["헬퍼비 · 촬영", h, st.outdoor ? "야외 촬영이라 +5만" : "5시간 초과·2부드레스여도 +5만~"]);
      L.push(["헬퍼비 · 본식", 250000, "촬영과 별도로 한 번 더"]);
    }
    if (st.tours) L.push([`드레스 투어 피팅비 · ${st.tours}곳`, st.tours * 55000, "샵당 5.5만. 투어 당일 결정하면 이후 가봉엔 대개 없다"]);
    if (st.label) L.push(["라벨 업그레이드", st.label, "기본 패키지는 일반 라벨 기준"]);
    if (st.second) L.push(["2부 드레스", st.second, "당일지정혜택으로 서비스하는 샵도 있다"]);
    return L;
  }

  function viewCalc() {
    const tiers = [...new Set(D.shops.map((s) => s.tier))].sort((a, b) => a - b);
    const L = calcLines();
    const total = L.reduce((s, r) => s + r[1], 0);
    const extra = total - st.tier;
    const scope = D.shops.find((s) => s.tier === st.tier)?.scope || "";
    const opt = (v, cur, label) => `<option value="${v}"${+cur === v ? " selected" : ""}>${label}</option>`;
    return `<div class="sn-ctl">
      <div class="field"><span>9월 스드메 묶음</span><div class="seg" id="dc-tier">${
        tiers.map((t) => `<button data-t="${t}" aria-pressed="${t === st.tier}">${man(t)}</button>`).join("")}</div></div>
      <div class="field"><span>드레스 투어</span><select id="dc-tours">${
        [0, 1, 2, 3, 4, 5].map((n) => opt(n, st.tours, n ? `${n}곳` : "안 함")).join("")}</select></div>
      <div class="field"><span>라벨 업그레이드</span><select id="dc-label">${
        [[0, "안 함"], [300000, "30만 (최소선)"], [550000, "55만 (블랙라벨)"], [1100000, "110만 (프리미엄)"], [2000000, "200만 (수입·하이엔드)"]]
          .map(([v, t]) => opt(v, st.label, t)).join("")}</select></div>
      <div class="field"><span>2부 드레스</span><select id="dc-second">${
        [[0, "안 함"], [300000, "30만"], [500000, "50만"], [800000, "80만"]].map(([v, t]) => opt(v, st.second, t)).join("")}</select></div>
      <div class="dc-checks">
        <label class="check"><input type="checkbox" id="dc-data"${st.data ? " checked" : ""}> 원본+수정본 44만</label>
        <label class="check"><input type="checkbox" id="dc-helper"${st.helper ? " checked" : ""}> 헬퍼비 촬영·본식</label>
        <label class="check"><input type="checkbox" id="dc-outdoor"${st.outdoor ? " checked" : ""}> 야외 촬영</label>
      </div>
    </div>
    <div class="sn-sum">
      <div><dt>묶음가</dt><dd class="num">${man(st.tier)}</dd><small>${esc(scope === "본식 1회" ? "드레스샵은 본식만" : "드레스샵이 촬영+본식")}</small></div>
      <div><dt>표에 안 적힌 추가금</dt><dd class="num">${man(extra)}</dd><small>아래 항목 합계</small></div>
      <div class="hi"><dt>총 예상</dt><dd class="num">${man(total)}</dd><small>투어에서 실제 견적으로 확인 필요</small></div>
    </div>
    <div class="tablebox sn-box"><table class="sn"><thead><tr>
      <th class="l">항목</th><th>금액</th><th class="l">메모</th></tr></thead>
      <tbody>${L.map((r) => `<tr><td class="l"><b>${esc(r[0])}</b></td><td class="num strong">${man(r[1])}</td>
        <td class="l sn-wrap">${esc(r[2])}</td></tr>`).join("")}
        <tr class="dc-total"><td class="l"><b>총 예상</b></td><td class="num strong">${man(total)}</td>
        <td class="l sn-wrap">VAT·부케·본식사진·드레스 지정비는 아직 안 넣었습니다</td></tr></tbody></table></div>
    <p class="sn-note">${scope === "본식 1회"
      ? `이 묶음은 <b>(토탈촬영)</b>이라 드레스샵이 <b>본식 한 번만</b> 맡습니다. 촬영 드레스는 스튜디오에서 빌리니, <b>촬영 드레스 벌 수·라벨 추가금은 스냅 견적 탭의 스튜디오 표</b>를 보세요.`
      : `이 묶음은 드레스샵이 <b>촬영 3벌 + 본식 1벌</b>을 다 맡습니다. 위 라벨 업그레이드는 그중 한 벌을 올릴 때 기준이에요.`}
      <br>라벨 업그레이드는 <b>샵마다 이름도 금액도 다릅니다</b> — 30만이 최소선이고 수입·하이엔드는 200만도 갑니다. 투어 때 "라벨 구조가 어떻게 되나요"를 꼭 물어보세요.</p>`;
  }

  // ---------- ① 샵별 보기 ----------
  function viewShops() {
    let tier = null;
    const body = D.shops.map((s) => {
      const head = s.tier !== tier ? (tier = s.tier, `<tr class="dr-tier"><td colspan="6">9월 패키지 ${man(s.tier)}원 묶음</td></tr>`) : "";
      const price = s.bc || s.bs
        ? `${s.bc ? `<b>${man(s.bc)}</b><small>촬영+본식</small>` : ""}${s.bs ? `<span class="dr-sec">${man(s.bs)}<small>본식만</small></span>` : ""}`
        : `<span class="muted">비공개</span>`;
      return `${head}<tr><td class="l"><b>${esc(s.n)}</b>${s.full !== s.n ? `<small>${esc(s.full)}</small>` : ""}</td>
        <td class="l"><span class="dr-scope ${s.scope === "본식 1회" ? "one" : ""}">${esc(s.scope)}</span></td>
        <td class="l">${s.tags.map((t) => `<span class="dr-tag">${esc(t)}</span>`).join("")}</td>
        <td class="l dr-price">${price}</td>
        <td class="l sn-wrap">${esc(s.add || "")}${s.src ? `<small>${s.src === "threads" ? "플래너 한 곳 기준 2차 정리" : "아이웨딩 공개 금액대"}</small>` : ""}</td>
        <td class="l sn-wrap">${esc(s.addr)}${s.ig ? `<a class="dr-ig" href="https://www.instagram.com/${esc(s.ig)}/" target="_blank" rel="noopener">@${esc(s.ig)} ↗</a>` : ""}${s.blurb ? `<small>${esc(s.blurb)}</small>` : ""}</td></tr>`;
    }).join("");
    const known = D.shops.filter((s) => s.bc || s.bs).length;
    return `<div class="sn-cap">다이렉트결혼준비 9월 스드메 표의 드레스샵 ${D.shops.length}곳</div>
      <div class="tablebox sn-box"><table class="sn dr"><thead><tr>
        <th class="l">샵</th><th class="l">패키지 범위</th><th class="l">성격</th><th class="l">공개 대여가</th><th class="l">추가금·근거</th><th class="l">위치 · 소개</th>
      </tr></thead><tbody>${body}</tbody></table></div>
      <p class="sn-note">샵 이름 아래 <b>@아이디</b>를 누르면 그 샵 인스타로 바로 갑니다. 드레스샵은 홈페이지가 따로 없고 <b>인스타가 공식 채널</b>이라, 가격표를 올려 두는 곳도 대개 인스타 하이라이트예요.
        <br><b>패키지 범위</b>가 <b>‘본식 1회’</b>인 묶음(135·160·195만)은 <b>촬영 드레스를 스튜디오에서 빌립니다</b>(토탈촬영).
        드레스샵은 본식 한 번만 맡아요. 그래서 이 묶음에서는 촬영 드레스 벌 수·라벨 추가금이 <b>드레스샵이 아니라 스튜디오 가격표</b>에 붙습니다 — 스냅 견적 탭의 스튜디오 추가비용 표를 같이 보세요.
        <br>대여가를 공개한 곳은 ${D.shops.length}곳 중 ${known}곳뿐입니다. 드레스샵은 스튜디오보다도 가격을 안 여는 업종이라, 나머지는 투어 때 직접 물어봐야 해요.</p>`;
  }

  // ---------- ② 추가금 구조 ----------
  function viewFees() {
    return `<div class="sn-cap">패키지가에 얹히는 것들 — 기본 구성은 <b>촬영 드레스 3벌 + 본식 화이트 1벌</b></div>
      <div class="tablebox sn-box"><table class="sn"><thead><tr>
        <th class="l">항목</th><th>금액</th><th class="l">언제 붙나</th><th class="l">출처</th>
      </tr></thead><tbody>${D.fees.map((f) => `<tr><td class="l"><b>${esc(f.k)}</b></td>
        <td class="num strong">${esc(f.v)}</td><td class="l sn-wrap">${esc(f.note)}</td>
        <td class="l"><small>${esc(f.src)}</small></td></tr>`).join("")}</tbody></table></div>
      <p class="sn-note">계약 전에 이 네 가지만 물어봐도 예산이 크게 안 샙니다 —
        <b>① 투어 피팅비 얼마</b> · <b>② 재가봉 비용 있나</b> · <b>③ 라벨 구조가 어떻게 되나</b> · <b>④ 퍼스트웨어 비용 붙나</b>.
        <br>여기에 <b>2부 드레스 포함 여부와 추가금 기준</b>까지 확인해 두면 당일에 놀랄 일이 줄어요.
        드레스 투어는 샵당 4벌 피팅 + 헤어세팅까지 40~50분 걸리고, 청담 안에서는 샵 간 이동이 10~15분입니다.</p>`;
  }

  // ---------- ③ 시세 ----------
  function viewMarket() {
    const m = D.market;
    return `<div class="sn-cap">한국소비자원 참가격 — 전국 14개 지역 조사 (공식 공개값)</div>
      <div class="tablebox sn-box"><table class="sn"><thead><tr>
        <th class="l">항목</th><th>중간가격</th><th class="l">가장 비싼 지역</th><th class="l">가장 싼 지역</th>
      </tr></thead><tbody>${m.official.map((r) => `<tr><td class="l"><b>${esc(r.k)}</b></td>
        <td class="num strong">${esc(r.mid)}</td><td class="l">${esc(r.hi) || "–"}</td><td class="l">${esc(r.lo) || "–"}</td></tr>`).join("")}</tbody></table></div>

      <div class="sn-cap">공개 계약정보 기준 전국 중간값</div>
      <div class="tablebox sn-box"><table class="sn"><thead><tr><th class="l">항목</th><th>중간값</th></tr></thead>
        <tbody>${m.contract.map(([k, v]) => `<tr><td class="l"><b>${esc(k)}</b></td><td class="num strong">${esc(v)}</td></tr>`).join("")}</tbody></table></div>

      <div class="sn-cap">공개된 샵별 대여가 — 플래너 한 곳 기준으로 2차 정리된 값 (VAT 포함 · 헬퍼 25만 별도)</div>
      <div class="tablebox sn-box"><table class="sn"><thead><tr>
        <th class="l">샵</th><th>촬영+본식</th><th>본식만</th></tr></thead>
        <tbody>${m.listed.map(([n, bc, bs]) => `<tr><td class="l"><b>${esc(n)}</b></td>
          <td class="num strong">${man(bc)}</td><td class="num">${man(bs)}</td></tr>`).join("")}</tbody></table></div>

      <div class="sn-cap">아이웨딩 금액대별 묶음 — [촬영+본식] 드레스 4벌 기준</div>
      <div class="tablebox sn-box"><table class="sn"><thead><tr><th class="l">금액대</th><th class="l">샵</th></tr></thead>
        <tbody>${m.bands.map(([k, v]) => `<tr><td class="l"><b>${esc(k)}</b></td><td class="l sn-wrap">${esc(v)}</td></tr>`).join("")}</tbody></table></div>

      <p class="sn-note">위 두 표는 <b>한국소비자원 참가격</b>의 공개값이고, 아래 두 표는 업계에서 돌아다니는 2차 정리입니다 —
        같은 샵이라도 <b>어느 플래너를 통하느냐에 따라 값이 달라지므로</b> 참고선으로만 보세요.
        표의 9월 패키지가는 드레스 단독 가격이 아니라 <b>스튜디오+드레스+메이크업 묶음값</b>이라, 이 시세표와 직접 비교하면 안 됩니다.</p>`;
  }

  // ---------- 그리기 ----------
  function render() {
    const box = $("#dress"); if (!box || !D) return;
    box.querySelectorAll("#dr-view button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === st.view));
    $(".dr-body", box).innerHTML = st.view === "calc" ? viewCalc()
      : st.view === "shops" ? viewShops() : st.view === "fees" ? viewFees() : viewMarket();
  }

  // ---------- 엑셀 시트 ----------
  Dress.sheets = () => ({
    shops: D.shops.map((s) => ({ "9월 패키지 묶음(원)": s.tier, "샵": s.n, "등록명": s.full, "패키지 범위": s.scope,
      "성격": s.tags.join(" · "), "공개 대여가 촬영+본식(원)": s.bc ?? "", "공개 대여가 본식만(원)": s.bs ?? "",
      "추가금·비고": s.add, "출처": s.src, "위치": s.addr, "소개": s.blurb })),
    calc: calcLines().map((r) => ({ "항목": r[0], "금액(원)": r[1], "메모": r[2] }))
      .concat([{ "항목": "총 예상", "금액(원)": calcLines().reduce((s, r) => s + r[1], 0), "메모": "VAT·부케·본식사진·지정비 제외" }]),
    fees: D.fees.map((f) => ({ "항목": f.k, "금액": f.v, "언제 붙나": f.note, "출처": f.src })),
    market: [
      ...D.market.official.map((r) => ({ "구분": "한국소비자원 참가격", "항목": r.k, "값": r.mid, "비고": [r.hi, r.lo].filter(Boolean).join(" / ") })),
      ...D.market.contract.map(([k, v]) => ({ "구분": "공개 계약정보 중간값", "항목": k, "값": v, "비고": "" })),
      ...D.market.listed.map(([n, bc, bs]) => ({ "구분": "샵별 공개 대여가(2차 정리)", "항목": n, "값": bc ? man(bc) : "", "비고": bs ? `본식만 ${man(bs)}` : "" })),
      ...D.market.bands.map(([k, v]) => ({ "구분": "아이웨딩 금액대", "항목": k, "값": "", "비고": v })),
    ],
  });

  // ---------- 시작 ----------
  async function init() {
    const box = $("#dress"); if (!box) return;
    try { D = await (await fetch("data/dress.json")).json(); }
    catch (e) { $(".dr-body", box).innerHTML = `<div class="empty">드레스 자료를 불러오지 못했어요.</div>`; return; }
    Dress.ready = true;
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.closest("#dr-view")) st.view = b.dataset.v;
      else if (b.dataset.t) st.tier = +b.dataset.t;
      else return;
      save(); render();
    });
    box.addEventListener("change", (e) => {
      const id = e.target.id;
      if (id === "dc-tours") st.tours = +e.target.value;
      else if (id === "dc-label") st.label = +e.target.value;
      else if (id === "dc-second") st.second = +e.target.value;
      else if (id === "dc-data") st.data = e.target.checked;
      else if (id === "dc-helper") st.helper = e.target.checked;
      else if (id === "dc-outdoor") st.outdoor = e.target.checked;
      else return;
      save(); render();
    });
    $("#dress-doc").textContent = `${D.meta.collected_at} 조사 · 표의 샵 ${D.meta.shops}곳 (다이렉트 등록 드레스샵 ${D.meta.pool}곳 중)`;
    render();
  }
  init();
})();
