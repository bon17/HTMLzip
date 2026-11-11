# 인계: 중2 프롬프트 특강 덱 (2026-11-11 세션)

## 0. 최신 상태 (2026-11-11 두 번째 세션 · 브랜치 `claude/pensive-mayer-nxsjcp`, main에서 시작)

아래 1~6은 첫 세션의 인계문이에요. 그중 **3-1, 3-2, 3-3은 이 세션에서 끝냈어요.** main에 합칠지는 선생님 답을 기다리는 중이에요.

- **엔진 v2.3** (`engine/`): 랜덤 뽑기 `R`(목록 `script.hz-picker`), 화면 가리기 `.`/`,`, 효과음 `M`(Web Audio, 타이머 종료·뽑기에만), 발표자 창 `S`(같은 파일을 `?hz-presenter`로 열고 postMessage로 연결), 메뉴 서랍 타일(가리기·뽑기·발표자 창), 수업 위젯 4종(`chapter`·`chat`·`autocomplete`·`unlock`), 영상 없음 안내, 그림 자리표시(`img[data-placeholder]` → 점선 상자 SVG, 저장할 때 원래 주소로 되돌림).
  - 위젯 구조: 작성한 마크업은 그대로, 엔진이 붙인 겉모양은 `data-hz-runtime="w"`(저장 때 빠지고 인쇄에는 보임). 쉬는 상태는 '모든 단계가 끝난 모습', 앞으로 들어올 때 `init` → `play`.
  - 고친 것: 점검의 글자 넘침 오탐(줄 간격이 좁은 제목, 높이 없는 상자), SVG 상자 위치 점검, `#hz-ui button { color: inherit }`가 진한 버튼·눌린 타일의 흰 글자를 덮던 문제, 저장을 template 안에서 정리(영상·그림 파일을 다시 불러오지 않음), 화면 안 발표자 보기도 '다음 클릭' 단계를 보여 줌.
  - v1.0 버그 3개 확인: `</main>` 잘림은 main 엔진에 없음(DOM으로 저장), 인쇄 숨김은 main에 없음(`!important`), 점검 오탐은 main도 깨끗한 복사본으로 재고 있었음(대신 위 넘침 오탐을 고침).
- **덱 옮기기 끝**: `decks/2026-12-24-ai-prompt-class/index.html`이 main 표기예요(디자인 구역 `hz-deck-design`, `--accent-2`, 위젯 4종, 뽑기 목록 script, 그림 자리 11곳). 표지 장식 원의 지연만 바꿨어요(동시에 움직이는 것 2개 규칙). 챕터 슬라이드 전환은 `wipe`.
- **검증**: Playwright로 데스크톱 32항목·태블릿(1080×810 터치) 10항목 모두 통과, 점검은 그림 자리 11건만 남음, `sync-engine --check` 통과. 확인 못 한 것: 사파리·엣지, 실제 터치·펜 압력, 파일 직접 저장 창, 영상 재생(파일 없음), 소리를 귀로 듣기, 팝업이 막혔을 때 안내 창.
- **선생님 답 (같은 세션 뒤쪽)**
  1. main에 합침. 단, 엔진 v2.3은 이 특강 덱에만: 시범 덱 2개는 v2.2로 되돌리고 `data-engine-lock`으로 고정(`sync-engine`이 건너뜀).
  2. 미션 구성안은 좋다고 하심. ‘비교 보드·학생 결과 모아 보기 화면도 들어 있냐’고 물으셔서 답했어요(아래).
  3. 실시간 제출·투표는 3단계에서.
  4. 챕터 화면은 미션마다 넣기.
  5. 2차 예시: 그림은 선생님이 제미나이로, 예시 글은 Claude가 초안.
  6. 강의 날짜 2026-12-24 → 덱 폴더를 `decks/2026-12-24-ai-prompt-class/`로 바꾸고 표지 날짜도 고침(덱 id는 그대로).
  7. 슬라이드 색은 그림 보고 정하라고 하심 → 장식 색만 그림 파스텔로 낮춤(표지 원, 칩, 주황·노랑 막대와 알약, 가리개). 글자색과 진한 바탕(남색 막대, 챕터 파랑·보라, 영상 남색)은 그대로.
  8. `wip` 정리는 미션까지 다 옮긴 뒤.
- **받은 그림 (덱 파일 안에 webp로 넣음)**: 표지(손 흔드는 로봇, 학생과 하이파이브 그림 대신), 8번 할루시네이션, 14번 로봇, 15번 왼쪽 고양이, 16번 재료 카드 7장(한 장짜리를 잘라 씀, 잠긴 카드는 흐린 흑백). 원본은 세션 임시 폴더에만 있었어요.
- **아직 없는 그림 7장**: s04-search, s04-create, s09-doubt, s09-check, s09-safety, s11-prompter, s15-cat-detail(필수). 강의 전까지 선택 그림이 안 오면 그 자리는 선 아이콘으로 되돌려요.
- **main과 합치기 (같은 세션 마지막)**: 그사이 다른 세션이 main에 엔진 v2.3(CSS로 그리는 `chat`·`chapter` 위젯)과 교사 연수 덱을 넣었어요. CLAUDE.md 규칙대로 main 표기를 따랐어요.
  - `chat`·`chapter`는 main 구현 그대로(모양은 CSS `:where()`, 런타임 요소 `hz-dots`·`hz-ch-`). 제 채팅·챕터 구현은 뺐어요.
  - `unlock`도 같은 방식으로 CSS만으로 그리게 바꿨어요(잠김 `hz-locked`, 자물쇠는 카드의 `::after`, 날아가는 자물쇠·빛은 `hz-ul-`). `autocomplete`만 입력창·추천 단어·키보드를 엔진이 붙여요(`hz-ac-`).
  - 그 위에 뽑기·가리기·효과음·발표자 창·자리표시·영상 안내·점검 고침을 얹어 **엔진 v2.4**로 만들었고, 이 특강 덱에만 넣었어요. 시범 덱 2개·교사 연수 덱은 main의 v2.3 그대로 `data-engine-lock`으로 고정했어요.
  - 특강 덱 디자인은 `.slide [data-widget="chat"]`처럼 위젯을 덮어쓰는 방식으로 다시 맞췄어요(겉모습은 그대로). 말풍선의 `data-anim`, `data-cap`은 뺐어요(main 기본 등장과 CSS ‘사진’ 글자).
- **다음 할 일**: (1) 비교 보드 질문 답 받기 → 미션 슬라이드 만들기 → (2) 남은 그림 넣기 → (3) 3단계 제출·투표.

---

- 저장소: `bon17/HTMLzip`
- 이 세션의 작업 브랜치: `claude/keen-ramanujan-tzzg8b` (모두 푸시함, **main에는 아직 안 합침**)

## 1. 먼저 알아 둘 것: main과 갈라져 있어요

- 이 브랜치는 `c7087c1`(wip 작업본 추가)에서 갈라졌어요. 그 사이 `main`에 다른 세션이 만든 **엔진 v2.2(필통 + 메뉴 서랍 UI)**와 바뀐 원칙, 시범 덱 2개, `tools/sync-engine.mjs`가 들어갔어요.
- `main`의 CLAUDE.md 규칙: **원칙과 엔진의 기준은 main 하나**예요. 갈라진 브랜치의 좋은 내용은 main 표기로 옮겨 살려요.
- 그래서 이 브랜치를 **그대로 main에 합치면 안 돼요.** 엔진(v1.0, 툴바 UI)과 원칙이 main 것을 덮어써요.
- 새 세션은 **main에서 새 브랜치를 만들어** 시작하고, 이 브랜치에서 아래 파일만 가져와요. (main은 `wip/` 폴더를 바꾸지 않아서 그대로 가져와도 돼요.)

```bash
git fetch origin claude/keen-ramanujan-tzzg8b
git checkout origin/claude/keen-ramanujan-tzzg8b -- decks/2026-12-24-ai-prompt-class wip/ai-prompt-class/CLAUDE.md wip/ai-prompt-class/HANDOFF.md "wip/ai-prompt-class/docs/이미지_프롬프트.md"
```

엔진은 가져오지 말고 참고만 해요.

```bash
git show origin/claude/keen-ramanujan-tzzg8b:engine/engine.js > /tmp/engine-v1-reference.js
```

## 2. 이 브랜치에 있는 것

| 무엇 | 경로 | 상태 |
|---|---|---|
| 도입부 17장 덱 | `decks/2026-12-24-ai-prompt-class/index.html` | 내용·클릭 순서·발표자 노트 완성. **이 브랜치 엔진 v1.0 표기**로 써 있어서 main 표기로 옮겨야 해요. |
| 영상 자리 | `decks/2026-12-24-ai-prompt-class/assets/README.md`, `.gitignore` | 영상 2개(`video1-macbook.mp4`, `video2-jeongwaja.mp4`)는 저장소에 없어요. |
| 그림 프롬프트 | `wip/ai-prompt-class/docs/이미지_프롬프트.md` | **차분한 파스텔 플랫**으로 다시 썼어요(main에는 옛 원색 버전). |
| 작업 안내 | `wip/ai-prompt-class/CLAUDE.md` | 옮기면서 정한 것, 선생님 피드백 |
| 엔진 v1.0 | `engine/engine.js` | **참고용.** main 엔진 v2.2에 아직 없는 기능의 구현이 있어요(아래 3-1). |

## 3. 다음 할 일 (순서대로)

### 3-1. main 엔진 v2.2에 빠진 기능 채우기
main CLAUDE.md에 적힌 목록이에요. 원칙(main의 `docs/PRINCIPLES.md`) 표기를 따르고, 구현은 엔진 v1.0 참고 파일에서 가져다 다듬어요.

| main 원칙의 기능 | 엔진 v1.0 참고 위치 (`/tmp/engine-v1-reference.js`) |
|---|---|
| 랜덤 뽑기 `R` (§3.4, 목록은 `<script type="application/json" class="hz-picker">`) | `var Picker` (v1.0은 `<template class="hz-picker-list">`를 읽음 → main 표기로 바꾸기) |
| 효과음 `M` (타이머 종료·뽑기만) | `var Sound` |
| 발표자 창 `S` | `var PWin`, `function bootPW` |
| 화면 가리기 `.` / `,` | 없음 (예전 `wip/ai-prompt-class/src/engine.js`의 `setBlank` 참고) |
| 수업 위젯 `chapter` (§4.6) | `function chapter` (v1.0은 전환 효과 → main은 `data-widget="chapter"`) |
| 수업 위젯 `chat` | `ENTRANCES.typing` (점 세 개 → 내용) |
| 수업 위젯 `autocomplete` | `ENTRANCES.autocomplete` |
| 수업 위젯 `unlock` | `ENTRANCES.unlock` (잠김 → 흔들리며 열림) |
| 영상 없음 안내 (§6.3) | `function videoMissing`, `watchVideos` |
| 그림 자리표시 `<img data-placeholder>` (§6.3) | 없음 (새로 만들기) |
| 메뉴 서랍의 ‘가리기·뽑기·발표자 창’ 타일 | main 엔진 UI에 맞춰 새로 |

엔진 버전을 올리고 `node tools/sync-engine.mjs`로 덱에 넣어요.

**v1.0에서 찾은 버그 (main 엔진에도 같은 문제가 있는지 확인)**
- 저장할 때 원본 HTML에서 `</main>`의 **마지막** 위치를 찾으면, 엔진 코드 안의 `'</main>'` 글자를 잘못 잡아 저장 파일에서 엔진이 잘려요. → 엔진 스크립트 시작보다 **앞에서** 찾기.
- 인쇄 CSS에서 단계 전 숨김(`html.hz-motion-ready .hz-pending`)이 더 구체적인 선택자라 인쇄 때도 이겨요. → 같은 구체도로 풀기.
- 점검이 진행 중인 모션이나 엔진이 붙인 힌트 배지 때문에 "글자 넘침"으로 잘못 셀 수 있어요. → 화면 밖 깨끗한 복사본으로 재기.

### 3-2. 덱을 main 표기로 옮기기
디자인·내용·클릭 순서는 그대로 두고 표기만 바꿔요.

| 지금 (v1.0 표기) | main 표기 |
|---|---|
| 3·10번 챕터: `data-transition="chapter"` + 숫자·제목·도형 상자들 | `data-widget="chapter" data-part="PART 1" data-num="1"` + `<h2>`, `<p>` |
| 2번 채팅: `.chat` 직접 마크업 + `data-anim="typing"` | `data-widget="chat"`, `<p data-from="me|ai" data-step="n">`, 사진 말풍선은 `data-kind="doc"` |
| 5번 자동완성: `data-anim="autocomplete"` + 직접 만든 키보드 | `data-widget="autocomplete" data-step="1" data-words=… data-pool=…` |
| 16번 재료 카드: 디자인 클래스 `.ing`, `.locked` | `data-widget="unlock"`, `<div data-card>`, 보너스(안전장치)는 `data-open`. 16번에서는 6개 모두 잠긴 채예요(미션마다 열림). |
| 뽑기 목록 `<template class="hz-picker-list">` 3개 | `<script type="application/json" class="hz-picker">{"1~5반":[…],"번호 1~30":[…],"미션 3 역할 카드":[…]}</script>` |
| 그림 자리: `.art` 아이콘 배지 + `data-art="s08-hallucination"` | `<img src="assets/s08-hallucination.png" alt="…" data-placeholder="…">` (그림 파일 이름은 그림 프롬프트 문서 표) |
| 디자인 구역 `<style id="hz-deck-style">` | `hz-deck-design` (main 시범 덱 뼈대 확인) |
| 표지 장식 원(무대 밖에 걸침)은 SVG 상자로 잘라 둠 | 그대로 두거나 `data-check-ignore` 사용 |
| — | 위젯이 쓰는 `--accent-2` 변수를 덱에 추가 |

- main은 모션 강도 기본값이 **화려**예요. 덱이 화려에서도 과하지 않은지 확인해요.
- 상호작용(4번 뒤집기, 11번·15번 가리개), 17번 들어올 때 별(`data-celebrate="stars"`, 임시 마지막 장)은 main에도 있는 표기라 그대로 써요.

### 3-3. 검증 → main에 합칠지 묻기
- main CLAUDE.md의 검증 목록대로 확인해요. `HTMLzip.check()` 0건, 태블릿 크기 1080×810과 터치, `node tools/sync-engine.mjs --check`도 포함이에요.
- 결과는 원칙 §7 기준으로 보고하고, main에 합칠지 선생님께 여쭤봐요.

### 3-4. 그다음
- 2단계 미션 슬라이드(미션 1~6, Before/After 보드, 마무리)를 만들어요. 구성안을 먼저 보여 드려요.
- 선생님이 그림을 주시면 넣어요(파스텔 플랫 스타일).
- 3단계는 실시간 제출·투표예요(`wip/ai-prompt-class/docs/수업_설계.md` 끝부분).

## 4. 이 세션에서 선생님이 정한 것

- **제목 효과**: 모두 `split-chars`(글자 하나씩). 제목은 연속 효과 규칙에서 빼요. main 원칙에 이미 반영돼 있어요.
- **상호작용**: 4번 검색/생성형 AI 카드는 뒤집기 카드, 11번 "원래 무슨 뜻일까?"와 15번 재료 넣은 고양이 그림은 가리개(예측한 뒤 공개)예요.
- **이모지**: 쓰지 않아요. 덱에 `data-emoji="off"`를 붙여요(main 원칙에 반영됨).
- **그림 스타일**: 차분한 파스텔 플랫이에요. 원색과 굵은 스티커 선은 촌스럽다고 하셨어요.
- **글자 대비 4.5:1**: 밝은 색 바탕에는 남색 글씨, 흰 글씨는 진한 파랑 #1E5BD8·보라 #6A3DE8 바탕에만 써요. 크림 바탕 위 강조 글씨는 진한 주황 #C2410C를 써요.
- **아직 정하지 않은 것**
  - 강의 날짜: 정해지면 덱 폴더 이름의 날짜를 바꿔요.
  - 슬라이드 색: 파스텔 그림에 맞춰 차분하게 낮출지
  - `wip/ai-prompt-class` 폴더: 정리할지
  - 17번 별: 마무리 슬라이드가 생기면 옮겨요.

## 5. 선생님 요청 (항상 지키기)

- 이모지 금지. 그림은 일러스트, 작은 아이콘은 선 아이콘이에요.
- 제목·강조·버튼은 주아, 본문은 나눔고딕. 본문은 44px 이상이고, 회색 글씨와 긴 문장은 피해요.
- 슬라이드 안에 효과음은 넣지 않아요. 소리는 타이머와 랜덤 뽑기에만 있어요.
- 챕터가 바뀔 때는 ‘우와’ 소리가 나오는 모션을 넣어요.
- 훈계조는 쓰지 않아요. “평균적인 답”이라는 표현도 쓰지 않고, “맥락을 모르면 엉뚱한 답, 틀린 답”이라고 말해요.
- 미션 재료는 보기(약 10개)에서 고르게 해요.
- 큰 방향을 바꾸기 전에는 구성안을 먼저 보여 드려요. 원칙과 요청이 부딪히면 선생님께 여쭤봐요.

## 6. 검증 기록 (이 브랜치, 엔진 v1.0 기준)

- 헤드리스 크롬(Playwright)에서 확인했어요.
  - 점검 0건, 17장 1920×1080 스크린샷
  - 필기 22항목, 전체 화면, 발표 기능 25항목, 편집·저장 29항목
  - 모션 끄기·reduced-motion, 인쇄 17쪽, JS 없이 열기, 인터넷 없이 열기
- 확인하지 못한 것: 사파리·엣지, 실제 터치·펜 압력, 파일 직접 저장 창, 영상 재생
- 테스트 스크립트는 저장소에 넣지 않았어요(세션 임시 폴더에 있었음). main은 `window.HTMLzip` 확인용 객체가 있으니 그걸로 다시 짜요.
