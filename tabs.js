// 화면 탭 — 한 페이지를 다섯 칸으로 나눠 보여준다.
// index.html 의 `data-tab` 이 붙은 최상위 요소를 켜고 끄는 게 전부다.
// 기본값은 HTML 이 들고 있어(슬롯만 보이고 나머지는 hidden) JS 가 늦어도 화면이 깜빡이지 않는다.
(() => {
  const KEYS = ["slots", "compare", "travel", "snap", "dress", "notes"];
  const nav = document.getElementById("tabs"); if (!nav) return;
  const panels = [...document.querySelectorAll("[data-tab]")].filter((el) => el.parentElement.classList.contains("wrap"));

  const Tabs = { current: "slots" };
  window.Tabs = Tabs;

  function show(k, { scroll = false, push = false } = {}) {
    if (!KEYS.includes(k)) k = "slots";
    Tabs.current = k;
    panels.forEach((el) => (el.hidden = el.dataset.tab !== k));
    nav.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tab === k));
    try { localStorage.setItem("nh-tab", k); } catch (e) {}
    if (push && location.hash !== `#tab-${k}`) history.replaceState(null, "", `#tab-${k}`);
    if (scroll) window.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
    window.dispatchEvent(new CustomEvent("tab-change", { detail: k }));
  }

  // 견적 비교 탭에 담은 개수 — 다른 탭에서 담아도 몇 건인지 보이게
  Tabs.badge = (k, n) => {
    const el = nav.querySelector(`button[data-tab="${k}"] .tb`); if (!el) return;
    el.textContent = n; el.hidden = !n;
  };

  nav.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]"); if (!b) return;
    show(b.dataset.tab, { scroll: true, push: true });
  });
  // 링크로 받은 #tab-snap 같은 주소, 뒤로가기 모두 여기로 들어온다
  const fromHash = () => (location.hash.startsWith("#tab-") ? location.hash.slice(5) : null);
  window.addEventListener("hashchange", () => { const k = fromHash(); if (k) show(k); });

  let saved = null;
  try { saved = localStorage.getItem("nh-tab"); } catch (e) {}
  show(fromHash() || saved || "slots");
})();
