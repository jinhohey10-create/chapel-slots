# chapel-slots — 작업 인수인계

더채플앳논현 라메르홀·라포레홀(2027-05~11, 470건), 더채플앳대치 대치점(2027-06~11, 109건), 아펠가모 선릉 웨딩홀 4층(2027-03~10, 354건), 아펠가모 잠실 웨딩홀 2층(2027-03~10, 313건), 아펠가모 반포 웨딩홀 LL층(2027-05~10, 109건)의 계약 가능 예식 슬롯 비교 웹. 예비 배우자와 함께 쓰는 용도.

**사용자가 쓰는 설정·데이터는 절대 건드리지 않는다**: `chapel_slot_notes`(★·비교·메모), 브라우저에 저장된 필터(`localStorage` 의 `nh-filter`). 데이터를 더할 때는 추가만 하고, 저장된 필터가 새 기본값을 이기는 구조를 유지한다.

## 구성
- 순수 HTML/CSS/JS, 빌드 없음: `index.html`, `style.css`, `app.js`, `config.js`
- 로컬 경로: `바탕 화면/결혼/chapel-slots` — 웨딩 DB 폴더 안에 있지만 **별도 git 저장소**다(웨딩 DB 쪽 `.gitignore`가 제외 처리).
- 저장소: GitHub `jinhohey10-create/chapel-slots`
- 배포: Vercel 팀 FITI(`team_P7Tgr7hVnEB2623LzUhXkWrl`), 프로젝트 `chapel-slots` → https://chapel-slots.vercel.app
  - **2026-09-17 저장소 연결 완료. main 에 push 하면 자동 배포된다.** (그전에는 파일 직접 업로드 방식이었다)
- DB: 웨딩 DB와 같은 Supabase 프로젝트 `qgwdzuemlacqotnxsupn` (공개 키는 config.js)
  - `chapel_slots` (id 형식 `lamer-2027-11-20-1230`, 홀 = `lamer` / `laforet` / `daechi` / `seolleung` / `jamsil` / `banpo` — CHECK 제약으로 제한): 홀, 날짜, 요일, 시간, 대관료, 식대 합계, 보증인원, 1인 식대, promo_10pct, promo_label(사이트 혜택 문구), likes(사이트 찜), is_available, collected_at
  - `chapel_slot_notes` (slot_id PK): picked, pick_order, expected_guests, extras(jsonb: flower/show/mc/snap/pyebaek/dress/etc), discount_override, starred, memo, sent_quote_code — Realtime 발행 대상
  - RLS는 기존 웨딩 DB처럼 anon 전체 허용(오픈). 로그인 없음.
- 기존 웨딩 DB 앱: https://wedding-db-mu.vercel.app (GitHub `jinhohey10-create/wedding-db`)
  - "견적으로 보내기" → `venue_quotes`에 다음 `Q-00N`으로 insert (라메르 V-008 / 라포레 V-003 / 대치 V-009 / 선릉 V-006 / 잠실 V-010 / 반포 V-011, `config.js` 의 `VENUE_CODE` → `venues.venue_code`로 조회. `VENUE_CODE` 에 없는 홀은 보내기 전에 막는다)
  - 웨딩 DB 쪽 `venue_quotes`에 그 뒤 `valid_until`·`memo` 컬럼이 추가됐다(v7). 지금 insert 페이로드는 그대로 호환된다.

## 홀 추가하는 법
1. `app.js` 맨 위 `HALLS` 에 키·이름·색 클래스·출처 URL 추가
2. `index.html` 홀 버튼(`#f-hall`), `style.css` 의 `--xx` 색 변수(라이트·다크 둘 다)와 `.tag.X` / `.seg button.X` / `.hall.X .name`
3. `config.js` `VENUE_CODE` 에 웨딩 DB 코드
4. DB: `chapel_slots_hall_check` 제약에 키 추가 → 데이터는 `is_available=false` 로 넣고, 새 코드 배포 뒤 true 로 켠다(구 코드가 모르는 홀을 보면 화면이 깨진다)
5. 새 요일·새 달이 생기면 `DOW_ORDER`, `#f-month` 버튼, `st.month` 기본값

## 수집 방법 (더채플·아펠가모 공통 — 유모멘트 플랫폼)
- 결과 페이지 `…/ceremony/ceremonyResultList` 는 `prd-api.umoment.co.kr/api/v2/wedding/rsv_slot` (POST, 로그인 토큰 필요) 결과를 React 상태에 들고 있다. 토큰을 직접 다루지 말고, 사용자가 연 페이지에서 결과 카드 DOM 의 React fiber 를 타고 올라가 길이가 결과 수와 같은 배열(`WEDDING_DT`, `CD_TIME`, `RENT_AMT`, `EAT_DANGA`, `PER_CNT`, `JJIM`, `TEXT_PROMOTION_SMART` …)을 읽는다.
- 검산: `TOT_AMT = RENT_AMT + EAT_AMT`, `EAT_AMT = EAT_DANGA × PER_CNT`. 옮긴 뒤 건수·총액·대관료·찜 합계를 브라우저와 DB 양쪽에서 대조한다.
- `/reserve_ins`, `/reserve_pick` 은 실제 계약·찜이다. 절대 호출하지 않는다.

## 화면 구성
- **목록**: 데스크톱은 13열 표, 760px 아래에서는 카드(`renderCards`)로 바뀐다. 카드에서는 열 제목 정렬을 쓸 수 없어 정렬 드롭다운(`#f-sort`)을 따로 뒀다.
- **슬롯 시트**(`#sheet` / `openSheet`): 행·카드의 `✎` 버튼으로 연다. ★ · 비교 추가 · 상담 메모가 한 화면에 있어 투어 현장에서 폰으로 바로 남길 수 있다. 비교에 넣지 않은 슬롯에도 메모를 쓸 수 있다.
- **견적 비교**(`renderCmp`): 최대 4건. 부대상품·예상 하객·할인을 넣으면 총 예상 비용과 1인당 환산이 즉시 다시 계산된다.

## 저장 규칙 — 건드릴 때 주의
`saveNote(id, patch, delay)` 는 디바운스 저장이다. 아직 서버로 나가지 않은 수정은 `pending[id]` 에 따로 쌓아두고,

- 타이머가 돌 때 `note(id)` 가 아니라 `{...note(id), ...pending[id]}` 를 보낸다
- Realtime 수신 시에도 `{...p.new, ...pending[slot_id]}` 로 병합해 내 수정이 되돌아가지 않게 한다

이 장치가 없으면 ★를 누른 직후 메모를 치는 흐름에서 **메모가 사라진다**(실제로 재현된 버그). 저장 경로를 고칠 때 두 군데를 같이 봐야 한다.

## 데이터·계산 규칙
- 출처: thechapel.co.kr 스마트 예약 검색 결과(2026-09-17 수집, 조건: 논현 라메르/라포레, 2027-08-01~11-30, 하객 200~350명 / 5~7월은 2026-09-18 추가)
- 더채플앳대치: thechapel.co.kr 스마트 예약 검색 결과(2026-09-18 수집, 조건: 대치점, 2027-06-01~11-30, 하객 200~400명)
- 아펠가모 잠실: apelgamo.com 스마트 예약 검색 결과(2026-09-18 수집, 조건: 잠실 웨딩홀(2층), 2027-03-01~10-31, 하객 100~400명). 3~8월 대관료 50%·10월 특정일 10% 구조가 선릉과 같다.
- 아펠가모 반포: apelgamo.com 스마트 예약 검색 결과(2026-09-18 수집, 조건: 반포 웨딩홀(LL층), 2027-05-01~10-30, 하객 100~400명). 혜택 구조가 선릉·잠실과 같다.
- 슬롯이 1,000건을 넘었다. Supabase 는 한 번에 1,000행만 주므로 `load()` 는 `fetchAll` 로 끝까지 나눠 받는다(순서 확정용 `id` 정렬 필수).
- 아펠가모 선릉: apelgamo.com 스마트 예약 검색 결과(2026-09-18 수집, 조건: 선릉 웨딩홀(4층), 2027-03-01~10-30, 토·일·금·주중공휴일, 전 시간대, 하객 100~400명). 11월은 검색 범위 밖이라 없다.
- 식대 = 1인 식대 × 보증인원. 1인 식대는 역산.
- 혜택 해석은 `app.js` 의 `rentPctOf` / `autoDisc` / `promoTag` 한곳에서 한다.
  - `promo_10pct` (더채플 10월 혜택일, 선릉 9~10월 계약가 10%): 표시가 = 할인 전 정가로 가정, 추정가 = (대관료+식대)×0.9
  - `promo_label` 에 "대관료 추가 N% 할인" (선릉 3~8월, [~10/12] = 2026-10-12까지 계약 조건): 같은 요일·시간·보증의 할인 없는 가을 대관료(682만)보다 봄·여름 표시가(517만)가 낮지 않으므로 할인 전 정가로 판단, 추정가 = 대관료+식대 − 대관료×N%
  - "특별할인 적용가" (더채플 5/5·5/13), "1주년 시크릿 혜택 [~9/20]" (대치 6/26·27, 같은 달 혜택 없는 토요일보다 대관료가 낮음): 이미 할인된 가격 → 추정가 없음
  - "금요일 · 보증 150명" (선릉 금 18:30): 상품 설명일 뿐 → 추정가 없음
- 총 예상 비용 = 대관료 + 1인 식대×max(예상 하객, 보증인원) + 부대상품 − 할인(비우면 `autoDisc` 추정 자동)
- VAT·주류 포함 여부, 필수 부대상품은 미반영.

## 남은 아이디어
- 사이트 재수집해서 마감 슬롯 is_available=false 처리·가격 변동 추적
- 로그인/비밀번호 보호(현재 오픈)
- 투어에서 받은 실제 견적으로 `chapel_slots` 금액 검증 (사이트 표시가와 다를 수 있음)
