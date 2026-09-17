# chapel-slots — 작업 인수인계

더채플앳논현 라메르홀·라포레홀 계약 가능 예식 슬롯(2027-08~11, 269건) 비교 웹. 예비 배우자와 함께 쓰는 용도.

## 구성
- 순수 HTML/CSS/JS, 빌드 없음: `index.html`, `style.css`, `app.js`, `config.js`
- 배포: Vercel 팀 FITI(`team_P7Tgr7hVnEB2623LzUhXkWrl`), 프로젝트 `chapel-slots` → https://chapel-slots.vercel.app
  - 처음엔 파일 직접 배포로 올림(Git 미연결). GitHub 저장소 `chapel-slots` 연결은 Vercel 대시보드 Settings → Git에서.
- DB: 웨딩 DB와 같은 Supabase 프로젝트 `qgwdzuemlacqotnxsupn` (공개 키는 config.js)
  - `chapel_slots` (id 형식 `lamer-2027-11-20-1230`): 홀, 날짜, 요일, 시간, 대관료, 식대 합계, 보증인원, 1인 식대, promo_10pct, likes(사이트 찜), is_available, collected_at
  - `chapel_slot_notes` (slot_id PK): picked, pick_order, expected_guests, extras(jsonb: flower/show/mc/snap/pyebaek/dress/etc), discount_override, starred, memo, sent_quote_code — Realtime 발행 대상
  - RLS는 기존 웨딩 DB처럼 anon 전체 허용(오픈). 로그인 없음.
- 기존 웨딩 DB 앱: https://wedding-db-mu.vercel.app (GitHub `jinhohey10-create/wedding-db`)
  - "견적으로 보내기" → `venue_quotes`에 다음 `Q-00N`으로 insert (라메르 V-008 / 라포레 V-003, `venues.venue_code`로 조회)

## 데이터·계산 규칙
- 출처: thechapel.co.kr 스마트 예약 검색 결과(2026-09-17 수집, 조건: 논현 라메르/라포레, 2027-08-01~11-30, 하객 200~350명)
- 식대 = 1인 식대 × 보증인원. 1인 식대는 역산.
- 10월 2·3·4·9·10·11일 = "특정일 계약 혜택 │ 계약가 10% 할인". 사이트 표시가는 할인 전 정가로 가정, 추정가 = (대관료+식대)×0.9.
- 총 예상 비용 = 대관료 + 1인 식대×max(예상 하객, 보증인원) + 부대상품 − 할인(비우면 혜택일 10% 자동)
- VAT·주류 포함 여부, 필수 부대상품은 미반영.

## 남은 아이디어
- 사이트 재수집해서 마감 슬롯 is_available=false 처리·가격 변동 추적
- 로그인/비밀번호 보호(현재 오픈)
