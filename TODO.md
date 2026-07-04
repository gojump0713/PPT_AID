# TODO — Interactive HTML Presentation (PPT_AID)

작업지시서(workorder.docx, "ScrollDeck Pro" v2.0)와 사용자 지시(52장 PPT 1:1 변환)를 기준으로 정리한 작업 목록.

## M1. 기본 발표 시스템
- [x] 저장소 클론 및 파일 구조 파악
- [x] 작업지시서(workorder.docx) 정독 → 요구사항 정리
- [x] PPT 소스(PPT소스.pptx, 52장) 파싱 파이프라인 구축 (`tools/convert.js`)
- [x] 16:9(1920×1080) 스테이지 + transform scale 레터박스 피팅
- [x] 슬라이드 DOM 구조(절대좌표 1:1 변환) 및 슬라이드 번호 대조 (52/52)
- [x] 키보드 내비게이션 (→ ← Space PageUp/PageDown Home End)
- [x] 프레젠터 리모컨 대응 (PageUp/PageDown 신호)
- [x] 진행률 바 + 현재 섹션 + 페이지 번호 HUD
- [x] URL 해시 딥링크 (#/slide-N) + LocalStorage 마지막 위치 복구
- [x] 오프라인 실행 (CDN 0건, 모든 에셋 로컬)

## M2. 핵심 인터랙션
- [x] Overview Mode (O/ESC, 라이브 DOM 썸네일 그리드, 섹션 색상 코드, 현재 슬라이드 강조)
- [x] Overview 키보드 탐색 (방향키 + Enter) / 클릭 즉시 이동
- [x] 시네마틱 전환 (fade / slide push / wipe(챕터 경계) / zoom) + 전환 중 입력 잠금
- [x] 도형 stagger 진입 리빌 (전환과 동시 시작)
- [x] 마우스 휠 / 터치 스와이프 / 클릭 진행
- [x] 숫자 + Enter 특정 슬라이드 이동

## M3. 시그니처 모션
- [x] 인트로/클로징 파티클 배경 (Canvas, 마우스 반응 패럴랙스)
- [x] 배경 영상 자동재생·루프 (풀블리드 영상 감지)
- [x] 세로쓰기 텍스트(eaVert) 지원

## M4. 발표 최적화·안정화
- [x] 전체화면 (F) / 블랙아웃 (B) / 타이머 리셋 (R)
- [x] 발표자 노트 창 (N) — 현재/다음 슬라이드, 노트, 경과 시간
- [x] prefers-reduced-motion 대응
- [x] 저사양 자동 감지 (3초 FPS 샘플링 <45fps → low-power 모드)
- [x] 자가 QA: 헤드리스 브라우저로 52장 전수 주행, 콘솔 에러 0건 확인
- [x] README.md (실행 방법, 조작법, 파일 구조, 체크리스트)
- [x] git 커밋 및 main 푸시 → GitHub Pages 배포
