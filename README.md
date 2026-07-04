# AI Native Campus — Interactive HTML Presentation

원본 PowerPoint(`PPT소스.pptx`, 52장)를 **한 장도 빠짐없이 1:1로** 인터랙티브 HTML 발표 슬라이드로 변환한 프로젝트입니다.
오프라인 실행을 전제로 모든 라이브러리·폰트·이미지·영상을 로컬 에셋으로 포함합니다 (외부 CDN 0건).

**라이브 데모**: https://gojump0713.github.io/PPT_AID/

## 실행 방법

### 1) 그냥 열기 (오프라인 발표)
`index.html`을 Chrome 또는 Edge에서 더블클릭으로 열면 됩니다. 인터넷 연결이 필요 없습니다.

### 2) 로컬 서버 (선택)
```bash
cd PPT_AID
npx serve .        # 또는 python -m http.server
```

## 키보드 조작법

| 키 | 기능 |
|----|------|
| `→` `Space` `PageDown` | 다음 슬라이드 |
| `←` `PageUp` | 이전 슬라이드 |
| `Home` / `End` | 첫 / 마지막 슬라이드 |
| `O` 또는 `ESC` | 전체 목차 (Overview Mode) 토글 |
| Overview에서 방향키 + `Enter` | 썸네일 탐색 · 이동 |
| `F` | 전체 화면 |
| `B` | 블랙아웃 화면 |
| `N` | 발표자 노트 창 (현재/다음 슬라이드, 노트, 경과 시간) |
| `R` | 발표 타이머 리셋 |
| 숫자 + `Enter` | 해당 번호 슬라이드로 즉시 이동 (예: `4` `2` `Enter`) |
| 마우스 휠 / 터치 스와이프 / 클릭 | 슬라이드 이동 |

- 프레젠터 리모컨(PageUp/PageDown 신호) 지원
- URL 해시 딥링크: `index.html#/slide-22`
- 새로고침 시 마지막 발표 위치 자동 복구 (LocalStorage)

## 파일 구조

```
PPT_AID/
├─ index.html            # 실행 파일 (발표 전체)
├─ css/
│  ├─ reset.css          # 최소 리셋
│  ├─ tokens.css         # 디자인 토큰 + @font-face (로컬 폰트)
│  ├─ layout.css         # 16:9 스테이지 스케일링, 슬라이드 지오메트리
│  ├─ components.css     # HUD, Overview, 블랙아웃, 이동 박스
│  ├─ animations.css     # 전환(fade/push/wipe/zoom) + 리빌 + reduced-motion
│  └─ fallback.css       # JS/캔버스 실패·저사양 폴백
├─ js/
│  ├─ config.js          # 발표 제목, 섹션(챕터) 맵, 전환 오버라이드
│  ├─ content.js         # ★ 자동 생성: 52장 슬라이드 HTML + 제목 + 발표자 노트
│  ├─ main.js            # 부트스트랩, 스테이지 피팅, 상태/HUD
│  ├─ navigation.js      # 키보드/휠/터치/리모컨 입력
│  ├─ overview.js        # 전체 목차 모드 (라이브 DOM 썸네일)
│  ├─ transitions.js     # 시네마틱 전환 + 입력 잠금
│  ├─ effects.js         # 파티클(인트로·클로징), 도형 리빌
│  ├─ speaker-notes.js   # 발표자 노트 팝업
│  ├─ performance.js     # FPS 샘플링, 저사양 자동 폴백
│  └─ vendor/gsap.min.js # GSAP 로컬 번들
├─ assets/
│  ├─ fonts/             # 나눔스퀘어 네오(TTF) + 에이투지체(OTF)
│  └─ media/             # 원본 pptx에서 추출한 이미지·영상 (161개)
├─ tools/convert.js      # PPTX → HTML 변환기 (빌드타임 도구, Node.js)
├─ TODO.md / DECISIONS.md / KNOWN_ISSUES.md / PENDING_ASSETS.md
└─ README.md
```

## 콘텐츠 교체 방법

슬라이드 콘텐츠는 코드와 분리되어 `js/content.js`에서 관리됩니다.

1. **PPT를 수정한 경우** — 새 pptx를 압축 해제 후 변환기를 다시 실행:
   ```bash
   cd tools && npm install
   # pptx를 unzip한 디렉토리를 지정
   node convert.js <extracted-pptx-dir> <repo-root>
   ```
2. **텍스트만 고치는 경우** — `js/content.js`에서 해당 슬라이드의 `html` 문자열을 직접 수정.
3. **섹션(챕터) 구성 변경** — `js/config.js`의 `sections` 배열 수정.

## 발표 전 체크리스트

- [ ] Chrome/Edge 최신 버전에서 실행 확인
- [ ] 인터넷을 끊은 상태에서 실행 확인 (오프라인 First)
- [ ] `F`로 전체 화면 → 빔프로젝터 16:9 비율 확인
- [ ] 방향키·Space·PageUp/PageDown·리모컨 동작 확인
- [ ] `O` Overview 모드, `B` 블랙아웃 확인
- [ ] 영상 슬라이드(3, 9, 12, 13, 24, 26~28, 33, 36, 37) 재생 확인
- [ ] `N` 발표자 노트 팝업 허용 여부 확인
- [ ] 예비용 PDF/이미지 백업 준비

## 기술 요약

- HTML5 + CSS3(Custom Properties) + Vanilla JS, GSAP 로컬 번들
- 1920×1080 설계 기준, `transform: scale` 레터박스 피팅
- 전환·애니메이션은 `transform`/`opacity`만 사용 (60fps)
- `prefers-reduced-motion` 시 0.25초 크로스페이드로 자동 축소
- 3초 평균 FPS < 45 → 저사양 모드(파티클·블러 비활성) 자동 진입
- 변환 파이프라인: OOXML(도형·그룹·테이블·세로쓰기·그라디언트·크롭·영상) → 절대좌표 HTML
