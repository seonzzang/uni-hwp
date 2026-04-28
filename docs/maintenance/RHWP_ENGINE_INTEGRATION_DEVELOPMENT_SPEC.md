# RHWP Engine Integration Development Specification

Project:
- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

`RHWP_ENGINE_INTEGRATION_REQUIREMENTS.md`의 요구사항을 실제 코드 구조와 개발 규칙으로 구체화한다.

## 목표 아키텍처

```text
BBDG HWP Editor
  ├─ UI / UX
  │   └─ rhwp-studio/src/**
  ├─ App Services
  │   ├─ src-tauri/src/**
  │   └─ scripts/**
  ├─ Engine Adapter
  │   └─ rhwp-studio/src/core/wasm-bridge.ts
  └─ RHWP Engine
      ├─ src/**/*.rs
      └─ pkg/**
```

핵심 방향:
- BBDG 기능은 UI/App Services에 둔다.
- RHWP 호출은 Engine Adapter를 통한다.
- RHWP Engine은 upstream 교체 가능 영역으로 유지한다.
- 단, 엔진 교체 가능성은 현재 BBDG 기능 보존을 해치지 않는 범위에서만 추구한다.
- 엔진 업데이트는 기능뿐 아니라 UI/UX 흐름도 보존해야 한다.
- 변경은 단계별로 수행하고 각 단계마다 에러/성능/회귀를 검증한다.
- 단계별 문서 준수 여부는 `RHWP_ENGINE_GUARDIAN_AGENT.md` 기준으로 검증한다.
- 다음 단계 진행은 오류 검증과 기능 유지 검증을 모두 통과한 경우에만 허용한다.
- 전체 작업 순서와 단계 이동은 `RHWP_ENGINE_ORCHESTRATION_SUPERVISOR.md` 기준으로 감독한다.
- 작업 정체와 다음 행동 누락은 `RHWP_ENGINE_MOMENTUM_MONITOR.md` 기준으로 점검한다.
- 변경 앱의 UI/UX와 기능 동등성은 `RHWP_ENGINE_BASELINE_COMPARISON_AGENT.md` 기준으로 비교한다.
- 가능한 앱 직접 조작 검증은 `RHWP_ENGINE_APP_CONTROL_VERIFICATION_AGENT.md` 기준으로 수행한다.

## 모듈 책임

### RHWP Engine

책임:
- HWP/HWPX 파싱
- 문서 모델 구성
- 페이지 계산
- SVG/HTML/Canvas 렌더링
- hitTest
- export
- validation warnings

비책임:
- BBDG 메뉴/대화창
- PDF 생성 워커
- Tauri 파일 다운로드
- 링크 드롭 UX
- PDF 뷰어 UX
- 인쇄 진행률 오버레이

### Engine Adapter

책임:
- RHWP WASM 초기화
- RHWP document lifecycle 관리
- 앱에서 쓰는 안정 API 제공
- RHWP API 변경 흡수
- null document, retired document, load transition 안전장치

개발 규칙:
- 앱 레이어는 `HwpDocument`를 직접 import하지 않는다.
- RHWP 메서드 이름 변경은 adapter에서만 대응한다.
- adapter에 BBDG 기능이 커지면 별도 service로 이동한다.

### Print/PDF Service

책임:
- 페이지 SVG 추출 호출 조율
- print worker manifest 작성
- Puppeteer 기반 PDF 생성
- chunk PDF 생성 및 병합
- 진행률/취소/ETA
- 내부 PDF 뷰어 연결

위치:
- `rhwp-studio/src/command/commands/file.ts`
- `rhwp-studio/src/ui/print-options-dialog.ts`
- `rhwp-studio/src/ui/print-progress-overlay.ts`
- `rhwp-studio/src/pdf/pdf-preview-controller.ts`
- `scripts/print-worker.ts`
- `src-tauri/src/print_worker.rs`
- `src-tauri/src/print_job.rs`

개발 규칙:
- PDF 생성을 RHWP Rust 코어에 넣지 않는다.
- RHWP는 페이지 SVG 생성까지만 책임진다.
- PDF 병합/저장/열기는 worker/service 레이어에서 처리한다.

### Remote Link Drop Service

책임:
- 브라우저 drag data 후보 분석
- URL 다운로드
- Content-Type/Content-Disposition 기반 문서 판별
- 임시 파일 관리
- 문서 로드 요청

위치:
- `rhwp-studio/src/command/link-drop.ts`
- `rhwp-studio/src/main.ts`
- `src-tauri/src/remote_hwp.rs`

개발 규칙:
- 원격 다운로드 로직을 RHWP 코어에 넣지 않는다.
- RHWP에는 최종 문서 bytes만 전달한다.

## API 경계 명세

### 앱이 기대하는 안정 API

`wasm-bridge`는 최소한 다음 기능을 안정 API로 제공한다.

- `initialize()`
- `loadDocument(data, fileName)`
- `createNewDocument()`
- `pageCount`
- `fileName`
- `renderPageSvg(pageIndex)`
- `getPageInfo(pageIndex)`
- `hitTest(...)`
- `exportHwp()`
- `exportHwpx()`
- `getValidationWarnings()`
- `reflowLinesegs()`

RHWP upstream API가 변경되면 앱 호출부가 아니라 이 안정 API 내부에서 대응한다.

## 엔진 교체 절차 명세

### 1. Upstream 반영 브랜치 생성

```bash
git switch -c chore/update-rhwp-engine-YYYYMMDD
```

### 2. RHWP 코어 갱신

갱신 대상:
- `src/**`
- `pkg/**`
- `Cargo.toml`
- `Cargo.lock`
- generated binding 관련 파일

주의:
- 앱 UX 변경과 같은 커밋에 섞지 않는다.

### 3. Adapter 빌드 오류 수정

우선 수정 대상:
- `rhwp-studio/src/core/wasm-bridge.ts`
- `rhwp-studio/src/core/types.ts`

수정 원칙:
- 앱 호출부 변경은 최소화한다.
- adapter가 RHWP API 변경을 흡수한다.

### 4. 앱 서비스 회귀 수정

필요 시 수정 대상:
- print service
- link drop service
- canvas view
- input handler

수정 원칙:
- RHWP 코어를 다시 수정하기 전에 앱 레이어 우회를 먼저 검토한다.

## 호환성 테스트 명세

### 자동 테스트

```bash
cargo check
cargo test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

### 문서 준수 테스트

각 단계 종료 전 `RHWP_ENGINE_GUARDIAN_AGENT.md` 기준 guardian review를 수행한다.

guardian review는 다음 문서를 기준으로 현재 diff를 검사한다.

- `BBDG_CRITICAL_BRANCH_SNAPSHOT.md`
- `RHWP_ENGINE_INTEGRATION_REQUIREMENTS.md`
- `RHWP_ENGINE_INTEGRATION_DEVELOPMENT_SPEC.md`
- `RHWP_ENGINE_INTEGRATION_DEVELOPMENT_PLAN.md`
- `RHWP_ENGINE_API_INVENTORY.md`
- `RHWP_ENGINE_COMPATIBILITY_CHECKLIST.md`
- `RHWP_ENGINE_ORCHESTRATION_SUPERVISOR.md`
- `RHWP_ENGINE_MOMENTUM_MONITOR.md`
- `RHWP_ENGINE_BASELINE_COMPARISON_AGENT.md`
- `RHWP_ENGINE_APP_CONTROL_VERIFICATION_AGENT.md`
- `RHWP_ENGINE_UPDATE_RUNBOOK.md`

guardian decision이 `Stop`이면 구현을 계속하지 않는다.

### 단계 진행 게이트

각 단계는 다음 두 검증을 모두 통과해야 완료된다.

- 오류 검증: 빌드 오류, 런타임 오류, WASM 오류, worker 오류, 관련 console 오류가 없거나 원인이 문서화되어야 한다.
- 기능 유지 검증: 현재 BBDG 기능, UI/UX 흐름, print/PDF/link-drop/document-load 동작이 유지되어야 한다.

한쪽만 통과한 단계는 완료로 간주하지 않는다.

### 수동 테스트

문서 로딩:
- HWP 샘플 열기
- HWPX 샘플 열기
- 대형 문서 열기
- 비표준 HWPX validation warning 확인

편집기:
- 클릭 hitTest
- 스크롤
- 현재 페이지 표시
- 저장/export

원격 문서:
- 직접 `.hwp` URL 드롭
- 직접 `.hwpx` URL 드롭
- 실패 URL 오류 처리

인쇄/PDF:
- 전체 문서 PDF 내보내기
- 페이지 범위 PDF 내보내기
- PDF 생성 취소
- 내부 PDF 뷰어 열기
- 편집기로 복귀
- 기존 브라우저 인쇄

### UI/UX 회귀 테스트

확인 항목:
- 파일 메뉴에는 사용자가 기대하는 인쇄 진입점이 유지되는가
- 파일 메뉴에 불필요한 PDF 청크 미리보기 개발 메뉴가 다시 나타나지 않는가
- 인쇄 대화창의 범위/방식 선택 위치가 유지되는가
- 페이지 범위 숫자 입력창 클릭 시 `페이지 범위`가 자동 선택되는가
- 끝 페이지 입력창에서 Enter로 인쇄가 실행되는가
- PDF 진행 오버레이가 프리징처럼 보이지 않는가
- 전체 남은 시간이 단계별 시간이 아니라 전체 작업 기준으로 표시되는가
- 전체 남은 시간이 이전 작업 평균을 활용해 보정되는가
- 취소 버튼이 실제 PDF 작업을 중단하는가
- PDF 생성 후 앱 내부 PDF 뷰어가 열리는가
- PDF 뷰어에서 편집기로 자연스럽게 복귀되는가
- 기존 인쇄 선택 시 브라우저 인쇄 창이 열리는가

### 업그레이드 기능 보존 테스트

RHWP 엔진 업데이트 후 다음 업그레이드 기능이 모두 유지되는지 확인한다.

- 원격 HWP/HWPX 링크 드롭
- 링크 후보 분석
- 응답 헤더 기반 문서 판별
- 비문서 다운로드 차단
- 임시 다운로드 정리
- 반복 문서 교체 안정성
- 웹폰트 실패 캐시
- 인쇄 대화창 UX
- 페이지 범위 자동 선택
- 끝 페이지 Enter 실행
- PDF 내보내기
- PDF 청크 생성
- PDF 병합
- PDF 취소
- 전체 남은 시간 ETA
- ETA 학습
- 내부 PDF 뷰어
- 편집기로 복귀
- 기존 인쇄 방식

### 성능 회귀 테스트

측정 항목:
- 앱 시작 후 첫 문서 로딩 시간
- 대형 문서 첫 페이지 표시 시간
- 페이지 스크롤 반응성
- PDF 데이터 준비 시간
- PDF 생성 청크당 평균 시간
- PDF 병합 청크당 평균 시간
- PDF 저장 시간
- 전체 PDF 작업 시간
- 메모리 증가 추세

성능 기준:
- RHWP 엔진 업데이트 후 심각한 성능 저하가 발생하면 업데이트 완료로 간주하지 않는다.
- 정확한 원인 분석 없이 추측성 최적화를 진행하지 않는다.
- 성능 변화는 가능한 한 로그와 수치로 비교한다.

## 개발 금지 패턴

금지:
- BBDG UI 상태를 Rust 엔진 구조체에 저장
- PDF worker 상태를 RHWP 코어에 저장
- remote download helper를 RHWP 코어에 추가
- generated `pkg` 파일 수동 수정
- 엔진 업데이트 중 앱 UX 변경 동시 진행

허용:
- adapter에서 RHWP API 호출 보정
- 앱 레이어에서 RHWP 결과 후처리
- Tauri command로 OS/파일시스템 작업 처리
- worker에서 PDF 생성/병합 처리

## 문서화 규칙

엔진 업데이트 PR 또는 커밋에는 다음을 포함한다.

- RHWP upstream 기준
- 변경된 엔진 API
- adapter 수정 내역
- 앱 기능 영향
- 검증 결과
- guardian review 결과
- baseline comparison 결과
- 임시 우회 또는 남은 리스크

## 완료 기준

엔진 업데이트 작업은 다음 조건을 만족해야 완료된다.

- 현재 구현된 BBDG 기능과 UX가 유지되어야 한다.
- 업그레이드 기능 보존 테스트가 모두 통과해야 한다.
- RHWP 코어 변경과 BBDG 앱 변경이 분리되어 있다.
- 앱 주요 기능이 회귀 없이 동작한다.
- UI/UX 주요 흐름이 회귀 없이 유지된다.
- 대형 문서와 PDF 작업에서 심각한 성능 저하가 없다.
- adapter 외 앱 전역에서 RHWP API 변경 여파가 확산되지 않았다.
- guardian review 최종 decision이 `Continue`이다.
- 오류 검증과 기능 유지 검증이 모두 통과했다.
- baseline comparison decision이 `Pass` 또는 `Pass with documented exceptions`이다.
- 충돌/우회/미해결 리스크가 문서화되었다.
