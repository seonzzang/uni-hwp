# RHWP Integration Preservation Framework 스파게티 코드 방지 가이드

Project:
- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

이 문서는 `RHWP 엔진 통합 보존 프레임워크`를 바이브 코딩 중심으로 진행하더라도,
유지보수가 어려운 스파게티 코드로 붕괴하지 않도록 방지 규칙을 정의한다.

이 프로젝트는 빠르게 만들고 바로 시험해보는 흐름을 적극적으로 허용한다.
하지만 그 속도가 계층 붕괴, 거대 파일, 무한 패치 누적, 책임 혼합으로 이어지면
결국 RHWP 업데이트 수용성과 BBDG 기능 보존 둘 다 망가진다.

그래서 이 문서는 다음 두 가지를 함께 다룬다.

1. 스파게티 코드 방지 규칙
2. 현재 코드 기준 위험 파일과 분리 가이드

## 스파게티 코드의 정의

이 프로젝트에서 스파게티 코드는 단순히 파일이 긴 상태만 뜻하지 않는다.

다음이 함께 나타나면 스파게티로 본다.

- 한 파일이 여러 계층 책임을 동시에 가짐
- UI 코드가 worker/engine/Tauri 내부 사정을 직접 앎
- RHWP raw API 호출이 앱 곳곳에 흩어짐
- 같은 계산 로직이 여러 위치에서 중복됨
- 임시 패치가 제거되지 않고 누적됨
- 기능은 늘어나는데 경계가 더 흐려짐
- 문제 발생 시 어디를 고쳐야 할지 즉시 설명할 수 없음

## 핵심 방지 원칙

## 1. 빨리 만들되, 어디에 둘지는 엄격히 정한다

이 프로젝트는 속도를 포기하지 않는다.
대신 코드 위치 결정은 엄격해야 한다.

문제를 고칠 때 항상 먼저 묻는다.

- 이건 RHWP Core 문제인가?
- Adapter 문제인가?
- Studio UI 문제인가?
- Product Service 문제인가?
- Worker/Tauri 문제인가?

정답이 애매하면 구현보다 경계 판단을 먼저 한다.

## 2. 계층을 건너뛰는 직접 연결을 늘리지 않는다

권장 의존 방향:

```text
UI -> Product Service -> Adapter -> RHWP Core
UI -> Product Service -> Worker/Tauri
```

지양:

- UI -> RHWP raw API 직접 호출
- UI -> Tauri 세부 구현 직접 의존
- Product Service -> DOM 세부 조작 혼합
- RHWP Core -> BBDG UX 로직 주입

## 3. 임시 패치는 반드시 추적 가능해야 한다

빠른 수정은 허용한다.
하지만 “일단 이렇게 둠”은 허용하지 않는다.

임시 패치는 반드시 아래 셋 중 하나여야 한다.

- 즉시 정식 구조로 편입
- `TODO + 이유 + 제거 조건` 기록
- 후속 리팩터링 문서/이슈로 승격

## 4. 구현 턴과 구조 정리 턴을 분리한다

바이브 코딩에서 가장 흔한 실패는
구현은 계속 쌓이는데 정리 턴이 오지 않는 것이다.

권장 흐름:

1. 빠르게 구현
2. 앱 실행
3. 체감 확인
4. UX 수정
5. 구조 정리
6. 검증
7. 커밋

## 5. 거대 파일을 정상 상태로 받아들이지 않는다

파일이 커지는 것 자체는 죄가 아니다.
하지만 큰 파일은 “지금은 동작하지만 곧 분리해야 하는 상태”로 본다.

이 프로젝트 권장 경보선:

- 300줄 초과: 책임 혼합 점검
- 500줄 초과: 분리 후보 검토
- 800줄 초과: 리팩터링 계획 필요
- 1000줄 초과: 적극 분리 대상

이 기준은 절대 규칙은 아니지만,
지금 프로젝트에서는 매우 유효한 경보선이다.

## 6. 계산/상태/표시를 한 파일에 몰지 않는다

특히 아래 조합은 분리해야 한다.

- 진행률 계산 + UI 렌더링
- ETA 계산 + 실제 인쇄 실행
- 링크 분석 + 다운로드 + 문서 로드 + 사용자 안내
- document lifecycle + toolbar/event wiring + devtools API

## 7. RHWP 업데이트 수용성을 해치는 방향으로 정리하지 않는다

리팩터링이 예뻐 보여도 아래를 해치면 실패다.

- RHWP 코어를 더 많이 건드리게 되는가
- adapter 경계를 흐리는가
- BBDG 기능이 RHWP 내부로 스며드는가
- upstream 반영 시 충돌 범위를 넓히는가

## 실무 규칙

## A. 새 기능 추가 전 질문

1. 어느 계층 책임인가?
2. 비슷한 로직이 이미 있는가?
3. 기존 파일에 붙이는 게 맞는가, 새 모듈이 맞는가?
4. 이 변경이 RHWP 업데이트 수용성을 악화시키는가?

## B. 새 함수 추가 전 질문

1. 이 함수는 UI용인가, 서비스용인가, adapter용인가?
2. 계산만 하는가, side effect도 하는가?
3. 같은 데이터 변환이 다른 데에도 있는가?
4. 이 함수 이름만 보고 책임이 드러나는가?

## C. 커밋 전 질문

1. 이번 커밋이 한 가지 목적만 담고 있는가?
2. 임시 패치가 문서화되었는가?
3. 검증 없이 넘어간 흐름이 없는가?
4. 더 적절한 계층으로 옮길 수 있는 코드가 남아 있는가?

## 현재 코드 기준 위험 파일

아래 파일들은 현재 시점에서 “문제가 있다”기보다
`향후 스파게티 위험이 높은 집중 관리 대상`으로 본다.

## 1. `rhwp-studio/src/main.ts`

현재 줄 수:
- 약 `978`줄

위험 신호:

- 앱 초기화
- devtools/test API
- 파일 드롭 처리
- remote load 흐름
- eventBus wiring
- UI 상태 업데이트
- 일부 PDF/print dev helper

이런 서로 다른 책임이 한 파일에 함께 있다.

현재 보이는 위험 포인트:

- `setupPrintWorkerDevtoolsApi`
- `loadRemoteCandidate`
- 대량의 `eventBus.on(...)`
- 초기화 코드와 운영 코드 혼재

권장 분리 방향:

- `app/bootstrap.ts`
  - 초기화 순서만 담당
- `app/event-bindings.ts`
  - `eventBus.on(...)` 묶음 분리
- `app/file-drop.ts`
  - 드래그 앤 드롭/remote candidate load 분리
- `app/devtools.ts`
  - 개발용 전역 API 분리

분리 원칙:

- `main.ts`는 “앱 조립 파일”로 줄인다.
- 실제 로직은 옆 모듈로 빼고 `main.ts`는 연결만 한다.

## 2. `rhwp-studio/src/command/commands/file.ts`

현재 줄 수:
- 약 `1061`줄

위험 신호:

- 파일 커맨드
- 인쇄 대화창 진입
- PDF 내보내기 실행
- 진행률 오버레이 제어
- ETA 계산
- worker 분석 로그 파싱
- 취소 처리
- PDF 뷰어 연결

즉, 파일 커맨드 파일이 사실상 `파일 + 인쇄 + PDF + ETA + progress orchestration`까지 다 먹고 있다.

현재 보이는 위험 포인트:

- `estimateRemaining...` 계열 함수 다수
- overlay 업데이트
- SVG 추출 루프
- worker 단계 처리
- PDF preview 연결

권장 분리 방향:

- `print/estimate.ts`
  - ETA, 평균치, 추정 계산
- `print/progress.ts`
  - 진행률 메시지 해석, overlay 표시 데이터 변환
- `print/export-current-doc.ts`
  - 실제 PDF export orchestration
- `print/worker-analysis.ts`
  - worker log parsing, stats update
- `commands/file.ts`
  - 최종 command entry만 유지

분리 원칙:

- `file.ts`는 커맨드 정의/진입점만 남기고
- 실제 PDF/print 오케스트레이션은 `print/*`로 이동한다.

## 3. `rhwp-studio/src/core/wasm-bridge.ts`

현재 줄 수:
- 약 `1161`줄

위험 신호:

- adapter 파일인데 점점 기능이 비대해짐
- hitTest 계열
- export 계열
- document lifecycle
- footnote/header/footer 관련 API
- viewer API

이 파일은 원래 adapter 경계 역할이라 커질 수는 있다.
하지만 너무 커지면 “모든 걸 아는 거대 신 객체”가 된다.

현재 보이는 위험 포인트:

- 여러 종류의 `hitTest*`
- render/export/query/lifecycle 혼재
- 문서 상태 보호와 기능 API가 한데 섞임

권장 분리 방향:

- `core/wasm-bridge/document-lifecycle.ts`
- `core/wasm-bridge/render-api.ts`
- `core/wasm-bridge/hit-test-api.ts`
- `core/wasm-bridge/export-api.ts`
- `core/wasm-bridge/header-footer-api.ts`

분리 원칙:

- 외부에서는 여전히 `WasmBridge` 하나만 보게 할 수 있다.
- 내부 구현만 기능별 모듈로 쪼갠다.
- 즉, public boundary는 유지하고 internal composition만 분리한다.

이 파일은 무조건 작게 만드는 것보다
`경계를 유지한 채 내부를 모듈화하는 방식`
이 적절하다.

## 4. `rhwp-studio/src/view/canvas-view.ts`

현재 줄 수:
- 약 `480`줄

위험 신호:

- page window 계산
- viewport 이벤트 연결
- canvas pool 협력
- 렌더링 트리거
- 디버그 로그

줄 수는 다른 파일보다 적지만,
렌더링 UX의 핵심이라 응집도가 무너지면 연쇄적으로 꼬인다.

현재 보이는 위험 포인트:

- 생성자에서 여러 이벤트 직접 바인딩
- page window 계산과 렌더 orchestration 결합
- 디버그 로그와 실사용 로직 혼재

권장 분리 방향:

- `view/page-window-controller.ts`
  - 현재 페이지 주변 윈도우 계산
- `view/canvas-view-events.ts`
  - viewport/eventBus wiring
- `view/canvas-view-debug.ts`
  - debug logging helper

분리 원칙:

- 이 파일은 “render orchestration coordinator”로 남기고
- 계산기와 이벤트 묶음을 밖으로 뺀다.

## 5. `src/wasm_api.rs`

현재 줄 수:
- 약 `3851`줄

위험 신호:

- 매우 큰 파일
- 엔진의 외부 노출 표면
- 테스트와 기능 확장이 누적되기 쉬움

다만 이 파일은 특별 취급해야 한다.

이유:

- RHWP 코어 영역
- BBDG 프로젝트의 직접 리팩터링 대상으로 함부로 건드리면 안 됨

권장 지침:

- BBDG 목적의 구조 정리를 이유로 이 파일을 대규모 분해하지 않는다.
- 이 파일에 새 BBDG 제품 흐름을 넣지 않는다.
- 이 파일이 커서 불편하더라도, 우선은 app/service/adapter 쪽에서 압력을 줄인다.
- 정말 수정이 필요하면 upstream 일반성, 테스트, 예외 문서화를 먼저 한다.

즉, 이 파일은 “위험 파일”이지만
`적극 분리 대상`이라기보다
`직접 침투 금지 대상`으로 관리하는 편이 맞다.

## 파일별 리팩터링 우선순위

추천 우선순위:

1. `rhwp-studio/src/command/commands/file.ts`
2. `rhwp-studio/src/main.ts`
3. `rhwp-studio/src/core/wasm-bridge.ts`
4. `rhwp-studio/src/view/canvas-view.ts`
5. `src/wasm_api.rs`는 직접 분해보다 침투 억제가 우선

이 순서를 추천하는 이유:

- `file.ts`는 현재 기능 추가가 가장 빨리 엉키는 구간
- `main.ts`는 앱 진입점이므로 조립 파일로 줄여야 함
- `wasm-bridge.ts`는 지금 안 쪼개면 다음 RHWP 업데이트 때 충격 흡수층이 신 객체가 됨
- `canvas-view.ts`는 렌더링 UX 핵심이라 꼬이기 전에 분리해야 함

## 권장 리팩터링 방식

좋은 리팩터링:

- 새 모듈을 만들고 호출만 옮김
- public API는 유지
- 동작 변경 없이 책임만 분리
- 검증 후 작은 커밋으로 확정

나쁜 리팩터링:

- 구조 정리하면서 동작까지 동시에 바꿈
- 파일 이름과 위치를 대규모 일괄 변경
- RHWP 코어까지 한 번에 손댐
- “이번 기회에 다 정리” 접근

## 실전 운영 규칙

앞으로 아래 상황이 보이면 리팩터링 후보로 승격한다.

- 같은 함수 파일 안에 `estimate`, `render`, `dialog`, `worker`, `open`, `cancel`이 같이 있음
- 한 파일이 DOM 조작과 비즈니스 계산을 같이 함
- 같은 데이터 구조를 여러 군데서 따로 해석함
- 한 수정이 세 계층 이상 동시에 건드림
- 파일 줄 수가 늘어나는데 역할은 더 흐려짐

## 최종 원칙

이 프로젝트는 바이브 코딩 성격이 강하다.
그래서 스파게티 코드 위험도 항상 높다.

하지만 이 위험은 속도를 포기해서 없애는 것이 아니라,
다음 방식으로 통제해야 한다.

- 경계를 먼저 정한다
- 큰 파일을 정상으로 착각하지 않는다
- 구현과 정리를 분리한다
- 임시 패치를 추적 가능하게 만든다
- RHWP 코어 침투를 억제한다

한 줄로 정리하면:

`빠르게 만드는 것은 허용하지만, 엉킨 상태를 정상 상태로 인정하지는 않는다.`
