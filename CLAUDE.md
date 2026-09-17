# chapel-slots — 작업 인수인계

더채플앳논현 라메르홀·라포레홀 계약 가능 예식 슬롯(2027-08~11, 269건) 비교 웹. 예비 배우자와 함께 쓰는 용도.

## 구성
- 순수 HTML/CSS/JS, 빌드 없음: `index.html`, `style.css`, `app.js`, `config.js`
- 로컬 경로: `바탕 화면/결혼/chapel-slots` — 웨딩 DB 폴더 안에 있지만 **별도 git 저장소**다(웨딩 DB 쪽 `.gitignore`가 제외 처리).
- 저장소: GitHub `jinhohey10-create/chapel-slots`
- 배포: Vercel 팀 FITI(`team_P7Tgr7hVnEB2623LzUhXkWrl`), 프로젝트 `chapel-slots` → https://chapel-slots.vercel.app
  - **2026-09-17 저장소 연결 완료. main 에 push 하면 자동 배포된다.** (그전에는 파일 직접 업로드 방식이었다)
- DB: 웨딩 DB와 같은 Supabase 프로젝트 `qgwdzuemlacqotnxsupn` (공개 키는 config.js)
  - `chapel_slots` (id 형식 `lamer-2027-11-20-1230`): 홀, 날짜, 요일, 시간, 대관료, 식대 합계, 보증인원, 1인 식대, promo_10pct, likes(사이트 찜), is_available, collected_at
  - `chapel_slot_notes` (slot_id PK): picked, pick_order, expected_guests, extras(jsonb: flower/show/mc/snap/pyebaek/dress/etc), discount_override, starred, memo, sent_quote_code — Realtime 발행 대상
  - RLS는 기존 웨딩 DB처럼 anon 전체 허용(오픈). 로그인 없음.
- 기존 웨딩 DB 앱: https://wedding-db-mu.vercel.app (GitHub `jinhohey10-create/wedding-db`)
  - "견적으로 보내기" → `venue_quotes`에 다음 `Q-00N`으로 insert (라메르 V-008 / 라포레 V-003, `venues.venue_code`로 조회)
  - 웨딩 DB 쪽 `venue_quotes`에 그 뒤 `valid_until`·`memo` 컬럼이 추가됐다(v7). 지금 insert 페이로드는 그대로 호환된다.

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
- 출처: thechapel.co.kr 스마트 예약 검색 결과(2026-09-17 수집, 조건: 논현 라메르/라포레, 2027-08-01~11-30, 하객 200~350명)
- 식대 = 1인 식대 × 보증인원. 1인 식대는 역산.
- 10월 2·3·4·9·10·11일 = "특정일 계약 혜택 │ 계약가 10% 할인". 사이트 표시가는 할인 전 정가로 가정, 추정가 = (대관료+식대)×0.9.
- 총 예상 비용 = 대관료 + 1인 식대×max(예상 하객, 보증인원) + 부대상품 − 할인(비우면 혜택일 10% 자동)
- VAT·주류 포함 여부, 필수 부대상품은 미반영.

## 남은 아이디어
- 사이트 재수집해서 마감 슬롯 is_available=false 처리·가격 변동 추적
- 로그인/비밀번호 보호(현재 오픈)
- 투어에서 받은 실제 견적으로 `chapel_slots` 금액 검증 (사이트 표시가와 다를 수 있음)
