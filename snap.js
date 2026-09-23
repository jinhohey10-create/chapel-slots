// 야외 스냅 견적 — 공개된 가격표만 모아 둔 조사 결과를 보여준다.
// 데이터: data/snap.json (지역별 출장비 · 야외스냅 상품가 · 스튜디오 추가비용)
// 근거와 해설은 docs/야외스냅-견적-리서치.md 에 있다.
// app.js 는 window.Snap.sheets() 만 부른다.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // 표 안에서 <b> 로 강조한 대목만 살린다. 나머지는 전부 이스케이프.
  const rich = (s) => esc(s).replace(/&lt;(\/?)b&gt;/g, "<$1b>");
  const man = (n) => (n == null ? "–" : n === 0 ? "0원" : `${(n / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만`);
  const median = (a) => { const s = [...a].sort((x, y) => x - y); const i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };

  let D = null;
  const st = { view: "fee", g: "강원도", r: "강릉", shoot: 700000, vat: true };
  try { Object.assign(st, JSON.parse(localStorage.getItem("snap-view") || "{}")); } catch (e) {}

  const Snap = { ready: false };
  window.Snap = Snap;

  const save = () => { try { localStorage.setItem("snap-view", JSON.stringify(st)); } catch (e) {} };
  const regionsOf = (g) => D.regions.find((x) => x.g === g)?.rs || [];
  const feeRows = (g, r) => D.travel.filter((t) => t.g === g && t.r === r).sort((a, b) => a.hi - b.hi || a.v.localeCompare(b.v));

  // 업체가 파는 스냅 상품 중 대표로 보여 줄 것 — 출장비와 합쳐 "이 업체로 가면 얼마" 를 보여주려고 쓴다.
  // 야외스냅이 있으면 그걸 쓰고, 없으면 성격이 가까운 순서로 내려간다. 아이폰 스냅은 결이 달라 맨 뒤.
  const CAT_RANK = ["야외 스냅", "세미 리허설 촬영", "본식 스냅", "서브 스냅", "아이폰 스냅"];
  function cheapest(v) {
    const mine = D.products.filter((p) => p.v === v && p.price);
    if (!mine.length) return null;
    const best = CAT_RANK.find((c) => mine.some((p) => p.cat === c));
    const pool = best ? mine.filter((p) => p.cat === best) : mine;
    return pool.reduce((a, b) => (a.price <= b.price ? a : b));
  }

  // ---------- ① 지역별 출장비 + 총액 ----------
  function viewFee() {
    const rows = feeRows(st.g, st.r);
    const hi = rows.map((t) => t.hi);
    const med = hi.length ? median(hi) : null;
    const vat = (n) => (st.vat ? Math.round(n * 1.1) : n);
    const total = med == null ? null : vat(st.shoot + med);

    const chips = [[2, 400000], [3, 650000], [4, 700000], [6, 1000000]]
      .map(([h, p]) => `<button type="button" class="chip${st.shoot === p ? " on" : ""}" data-shoot="${p}">${h}시간 ${man(p)}</button>`).join("");

    return `<div class="sn-ctl">
      <div class="field"><span>권역</span><div class="seg" id="sn-g">${
        D.regions.map((x) => `<button data-g="${esc(x.g)}" aria-pressed="${x.g === st.g}">${esc(x.g)}</button>`).join("")}</div></div>
      <div class="field"><span>지역</span><select id="sn-r">${
        regionsOf(st.g).map((r) => `<option${r === st.r ? " selected" : ""}>${esc(r)}</option>`).join("")}</select></div>
      <div class="field"><span>촬영비 <em class="muted">자주 쓰는 값을 눌러도 되고 직접 적어도 돼요</em></span>
        <div class="sn-shoot"><div class="seg">${chips}</div>
          <label class="sn-num"><input type="number" id="sn-shoot" min="0" step="10" value="${Math.round(st.shoot / 10000)}"><span>만원</span></label>
        </div></div>
      <label class="check"><input type="checkbox" id="sn-vat"${st.vat ? " checked" : ""}> VAT 10% 더하기</label>
    </div>
    <div class="sn-sum">
      <div><dt>촬영비</dt><dd class="num">${man(st.shoot)}</dd><small>내가 넣은 값</small></div>
      <div><dt>출장비 · ${esc(st.r)}</dt><dd class="num">${man(med)}</dd><small>${
        hi.length ? `${rows.length}개 업체 중간값 · ${man(Math.min(...hi))}~${man(Math.max(...hi))}` : "자료 없음"}</small></div>
      <div class="hi"><dt>예상 총액</dt><dd class="num">${total == null ? "–" : man(total)}</dd><small>${
        st.vat ? "VAT 포함" : "VAT 별도"} · 헤메·의상·헬퍼 제외</small></div>
    </div>
    <div class="tablebox sn-box"><table class="sn"><thead><tr>
      <th class="l">업체</th><th>${esc(st.r)} 출장비</th><th class="l">대표 상품</th><th>상품가</th><th>상품가+출장비</th>
    </tr></thead><tbody>${rows.map((t) => {
      const p = cheapest(t.v);
      const fee = t.lo === t.hi ? man(t.hi) : `${man(t.lo)}~${man(t.hi)}`;
      return `<tr><td class="l"><b>${esc(t.v)}</b></td>
        <td class="num${t.hi === 0 ? " zero" : ""}">${fee}</td>
        <td class="l sn-p">${p ? `${esc(p.cat)}<small>${esc(p.name)}</small>` : "<span class='muted'>공개 상품 없음</span>"}</td>
        <td class="num">${p ? man(p.price) : "–"}</td>
        <td class="num strong">${p ? man(vat(p.price + t.hi)) : man(vat(st.shoot + t.hi))}</td></tr>`;
    }).join("")}</tbody></table></div>
    <p class="sn-note">맨 오른쪽 칸은 <b>그 업체 상품가 + 그 지역 출장비</b>${st.vat ? " (VAT 포함)" : ""}입니다. 공개 상품이 없는 업체는 위에 넣은 촬영비로 계산했어요.
      출장비가 상품마다 다른 업체는 <b>최저~최고</b>로 적었고, 합계에는 최고값을 썼습니다.</p>`;
  }

  // ---------- ② 야외스냅 상품 ----------
  function viewProd() {
    const tbl = (list, cap) => `<div class="sn-cap">${cap}</div><div class="tablebox sn-box"><table class="sn"><thead><tr>
      <th class="l">업체</th><th class="l">상품</th><th>시간</th><th>가격</th><th class="l">구성</th>
      </tr></thead><tbody>${list.map((p) => `<tr><td class="l"><b>${esc(p.v)}</b></td><td class="l">${esc(p.name)}</td>
      <td class="num">${p.h}시간</td><td class="num strong">${man(p.price)}</td><td class="l sn-wrap">${esc(p.note)}</td></tr>`).join("")}</tbody></table></div>`;
    const snap = D.products.filter((p) => p.cat === "본식 스냅" && p.price).map((p) => p.price);
    return tbl(D.outdoor, "서울·수도권 작가 — 야외/리허설 스냅 (VAT 별도)")
      + tbl(D.jeju, "제주 현지 작가 — 출장비 0원, 육지보다 오히려 싸다")
      + `<p class="sn-note"><b>비교용 본식스냅 시세</b> — 같은 플랫폼 ${snap.length}개 상품 기준 최저 ${man(Math.min(...snap))} · 중간값 ${man(median(snap))} · 최고 ${man(Math.max(...snap))}.
        4시간짜리 제대로 된 야외스냅은 본식스냅 한 건과 비슷한 값입니다.
        <br>야외스냅 상품은 <b>헤어·메이크업과 의상이 대부분 불포함</b>이에요. 드레스를 따로 빌리면 22만원부터, 스튜디오에 외부 드레스를 들고 가면 11만원쯤 더 듭니다.</p>`;
  }

  // ---------- ③ 스드메 스튜디오 추가비용 ----------
  function viewStudio() {
    let tier = null;
    const body = D.studios.map((s) => {
      const head = s.tier !== tier ? (tier = s.tier, `<tr class="sn-tier"><td colspan="8">9월 패키지 ${man(s.tier)}원 묶음</td></tr>`) : "";
      return `${head}<tr><td class="l"><b>${esc(s.name)}</b>${s.note ? `<small>${esc(s.note)}</small>` : ""}</td>
        <td class="l">${rich(s.hours)}</td><td class="l sn-wrap">${rich(s.scene)}</td><td class="l sn-wrap">${rich(s.helper)}</td>
        <td class="l sn-wrap">${rich(s.photog)}</td><td class="l sn-wrap">${rich(s.outfit)}</td><td class="l sn-wrap">${rich(s.data)}</td></tr>`;
    }).join("");
    return `<div class="sn-cap">다이렉트결혼준비 9월 스드메 표에 있는 스튜디오 — <b>패키지가에 얹히는 추가비용</b></div>
      <div class="tablebox sn-box"><table class="sn sn-st"><thead><tr>
        <th class="l">스튜디오</th><th class="l">촬영시간</th><th class="l">야간·로드씬</th><th class="l">헬퍼비</th>
        <th class="l">작가 지정비</th><th class="l">의상 추가</th><th class="l">원본·수정본</th>
      </tr></thead><tbody>${body}</tbody></table></div>
      <div class="sn-cap">패키지에 안 들어가는 고정비 — 어느 스튜디오를 골라도 붙는다</div>
      <div class="tablebox sn-box"><table class="sn"><thead><tr><th class="l">항목</th><th>금액</th><th class="l">메모</th></tr></thead>
        <tbody>${D.fixed.map((f) => `<tr><td class="l"><b>${esc(f.k)}</b></td><td class="num strong">${esc(f.v)}</td>
          <td class="l sn-wrap">${esc(f.note)}</td></tr>`).join("")}</tbody></table></div>
      <p class="sn-note">촬영비를 <b>정찰제로 공개한 곳은 라흐(ra:h)와 로에빈 둘뿐</b>이었어요. 나머지는 플래너 패키지가로만 돕니다.
        그래서 스튜디오끼리 비교할 때는 패키지가보다 이 추가비용 표를 보는 쪽이 정확합니다 —
        <b>야간씬이 “필수”인 곳</b>(더청담·가을·이포토에세이·셀럽비비·더브라이드·테오그라피·로에빈)은 오후 타임을 잡는 순간 11~22만원이 확정으로 붙어요.</p>`;
  }

  // ---------- 그리기 ----------
  function render() {
    const box = $("#snap"); if (!box || !D) return;
    box.querySelectorAll("#sn-view button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === st.view));
    $(".sn-body", box).innerHTML = st.view === "fee" ? viewFee() : st.view === "prod" ? viewProd() : viewStudio();
  }

  // ---------- 엑셀 시트 ----------
  Snap.sheets = () => ({
    travel: D.travel.map((t) => ({ "업체": t.v, "권역": t.g, "지역": t.r, "출장비 최저(원)": t.lo, "출장비 최고(원)": t.hi })),
    products: [
      ...D.outdoor.map((p) => ({ "구분": "야외/리허설 스냅", "업체": p.v, "상품": p.name, "시간": p.h, "가격(원, VAT별도)": p.price, "구성": p.note })),
      ...D.jeju.map((p) => ({ "구분": "제주 현지", "업체": p.v, "상품": p.name, "시간": p.h, "가격(원, VAT별도)": p.price, "구성": p.note })),
      ...D.products.map((p) => ({ "구분": p.cat, "업체": p.v, "상품": p.name, "시간": "", "가격(원, VAT별도)": p.price, "구성": "" })),
    ],
    studios: D.studios.map((s) => ({ "패키지 묶음(원)": s.tier, "스튜디오": s.name, "촬영시간": s.hours,
      "야간·로드씬": s.scene.replace(/<[^>]+>/g, ""), "헬퍼비": s.helper, "작가 지정비": s.photog.replace(/<[^>]+>/g, ""),
      "의상 추가": s.outfit, "원본·수정본": s.data.replace(/<[^>]+>/g, ""), "메모": s.note })),
  });

  // ---------- 시작 ----------
  async function init() {
    const box = $("#snap"); if (!box) return;
    try { D = await (await fetch("data/snap.json")).json(); }
    catch (e) { $(".sn-body", box).innerHTML = `<div class="empty">스냅 견적 자료를 불러오지 못했어요.</div>`; return; }
    if (!regionsOf(st.g).includes(st.r)) st.r = regionsOf(st.g)[0];   // 저장해 둔 지역이 사라졌을 때
    Snap.ready = true;

    box.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.closest("#sn-view")) st.view = b.dataset.v;
      else if (b.dataset.g) { st.g = b.dataset.g; st.r = regionsOf(st.g)[0]; }
      else if (b.dataset.shoot) st.shoot = +b.dataset.shoot;
      else return;
      save(); render();
    });
    box.addEventListener("change", (e) => {
      if (e.target.id === "sn-r") st.r = e.target.value;
      else if (e.target.id === "sn-vat") st.vat = e.target.checked;
      else return;
      save(); render();
    });
    box.addEventListener("input", (e) => {
      if (e.target.id !== "sn-shoot") return;
      st.shoot = Math.max(0, Math.round((+e.target.value || 0) * 10000));
      save();
      // 숫자를 치는 중에 입력칸이 다시 그려지면 커서가 튄다. 요약만 고쳐 준다.
      const sum = $(".sn-sum", box); if (!sum) return;
      const rows = feeRows(st.g, st.r).map((t) => t.hi);
      const med = rows.length ? median(rows) : null;
      const total = med == null ? null : Math.round((st.shoot + med) * (st.vat ? 1.1 : 1));
      sum.children[0].querySelector("dd").textContent = man(st.shoot);
      sum.children[2].querySelector("dd").textContent = total == null ? "–" : man(total);
    });
    $("#snap-doc").textContent = `${D.meta.collected_at} 조사 · 업체 ${D.meta.vendors}곳 · 지역 조합 ${D.meta.travel_rows}건`;
    render();
  }
  init();
})();
