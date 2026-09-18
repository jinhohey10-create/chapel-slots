# 논현·선릉 예식 슬롯 비교

더채플앳논현 라메르홀·라포레홀(2027년 5–11월, 470건)과 아펠가모 선릉(2027년 3–10월, 354건)의 계약 가능 예식 슬롯을 비교하는 정적 웹페이지입니다.

- 순수 HTML/CSS/JS (빌드 없음) — `index.html`, `style.css`, `app.js`, `config.js`
- 데이터: 웨딩 DB와 같은 Supabase 프로젝트
  - `chapel_slots` — 수집한 슬롯 (가격·보증인원·혜택·찜)
  - `chapel_slot_notes` — 후보(★), 비교 목록, 예상 하객, 부대상품, 할인, 메모, 웨딩 DB로 보낸 견적 코드 (실시간 공유)
- **견적으로 보내기**: `venue_quotes`에 다음 번호(Q-00N)로 등록 (라메르 V-008 / 라포레 V-003 / 아펠가모 선릉 V-006)

## 배포 (Vercel)
1. 이 폴더를 GitHub 저장소로 올립니다.
2. Vercel → Add New → Project → 저장소 Import
3. Framework Preset: **Other**, Build Command 비움, Output Directory 비움(루트) → Deploy

## 로컬에서 보기
`npx serve .` 또는 `python3 -m http.server` 후 브라우저로 열기
