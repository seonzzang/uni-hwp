# RHWP Engine Integration Development Plan

Project:
- `RHWP Integration Preservation Framework`
- `RHWP 엔진 통합 보존 프레임워크`

## 목적

향후 RHWP 엔진 업데이트를 BBDG HWP Editor에 안정적으로 반영하기 위한 단계별 개발 계획을 정의한다.

## 전체 전략

1. 현재 BBDG 기능과 UX를 보존 대상으로 고정한다.
2. 현재 BBDG 기능과 RHWP 엔진 의존 지점을 조사한다.
3. 엔진 코어 오염도를 낮춘다.
4. `wasm-bridge`를 명확한 adapter 계층으로 정리한다.
5. RHWP 업데이트 절차를 반복 가능한 프로세스로 만든다.
6. 회귀 테스트 체크리스트를 고정한다.
7. `RHWP_ENGINE_GUARDIAN_AGENT.md` 기준으로 각 단계의 문서 준수 여부를 검증한다.
8. `RHWP_ENGINE_ORCHESTRATION_SUPERVISOR.md` 기준으로 작업 순서와 단계 이동을 감독한다.
9. `RHWP_ENGINE_MOMENTUM_MONITOR.md` 기준으로 작업 정체 여부와 다음 행동을 확인한다.
10. `RHWP_ENGINE_BASELINE_COMPARISON_AGENT.md` 기준으로 기준 앱 대비 UI/UX와 기능 동등성을 확인한다.
11. `RHWP_ENGINE_APP_CONTROL_VERIFICATION_AGENT.md` 기준으로 가능한 범위에서 앱 직접 조작 검증을 수행한다.

모든 단계는 `작게 변경 → 에러 검증 → 기능 유지 검증 → 성능 검증 → UI/UX 검증 → 커밋 → 다음 단계` 순서로 진행한다.

각 단계 종료 전에는 guardian review를 수행한다. guardian review가 `Stop`이면 다음 단계로 넘어가지 않는다.

각 단계 시작 전에는 orchestration supervisor 기준으로 현재 phase, 작업 범위, 필수 문서, 검증 항목, 커밋 경계를 확인한다.

작업이 멈췄거나 다음 행동이 불명확하면 momentum monitor 기준으로 현재 phase, 정체 위험, 다음 최소 행동, 필요한 게이트를 확인한다.

업데이트 수용 전에는 baseline comparison 기준으로 현재 기준 앱과 변경 앱의 UI/UX 및 기능 동등성을 확인한다.

앱 직접 조작이 가능한 영역은 app control verification 기준으로 자동 클릭, 입력, 스크린샷, 로그 확인을 수행하고 자동화가 어려운 영역은 사용자 보조 확인으로 표시한다.

다음 단계로 넘어가려면 반드시 두 가지 게이트가 모두 통과되어야 한다.

- 오류 검증 통과
- 기능 유지 검증 통과

둘 중 하나라도 실패하면 현재 단계를 완료한 것으로 보지 않는다.

## Phase 1. 현황 감사

목표:
- RHWP 코어에 직접 들어간 BBDG성 변경을 식별한다.
- 현재 업그레이드된 BBDG 기능 전체를 보존 체크리스트로 고정한다.

작업:
- `git log -- src pkg rhwp-studio/src/core/wasm-bridge.ts` 분석
- 엔진성 변경과 앱성 변경 분류
- `src/wasm_api.rs` 변경 이력 정리
- `pkg/*` 생성 산출물 갱신 이력 정리
- `wasm-bridge.ts`가 호출하는 RHWP API 목록화

산출물:
- 엔진 의존 API 목록
- 코어 변경 리스크 목록
- 앱 레이어 이전 가능 항목 목록
- 업그레이드 기능 보존 체크리스트
- guardian review 결과

완료 기준:
- 어떤 기능이 RHWP 코어에 의존하는지 한눈에 볼 수 있어야 한다.
- 현재 UI/UX 기준 흐름이 문서화되어야 한다.
- 오류 검증과 기능 유지 검증이 모두 통과해야 한다.
- orchestration supervisor가 다음 단계 진행을 허용해야 한다.
- guardian review가 `Continue` 또는 `Continue with caution`이어야 한다.

## Phase 2. 엔진 경계 고정

목표:
- BBDG 앱이 RHWP 엔진을 직접 만지는 면적을 줄인다.

작업:
- `wasm-bridge.ts`를 공식 adapter로 선언
- RHWP raw import 사용 위치 검색
- 앱 레이어에서 직접 `HwpDocument`를 호출하는 코드 제거 또는 예외 문서화
- adapter public method 목록 정리
- adapter에 없는 엔진 호출은 추가 전 검토 규칙 적용

산출물:
- 안정 adapter API 목록
- raw engine access 예외 목록
- guardian review 결과

완료 기준:
- RHWP API 변경 시 수정 지점이 대부분 adapter로 제한되어야 한다.
- 오류 검증과 기능 유지 검증이 모두 통과해야 한다.
- orchestration supervisor가 다음 단계 진행을 허용해야 한다.
- guardian review가 `Continue` 또는 `Continue with caution`이어야 한다.

## Phase 3. 과거 실험성 엔진 변경 정리

목표:
- 인쇄 추출 등 RHWP 코어에 섞였던 실험성 변경을 제거 또는 앱 레이어로 이동한다.

작업:
- print extraction 관련 과거 커밋 재검토
- 현재 사용하지 않는 WASM print API 제거 여부 확인
- `src/print_module.rs` 제거 상태 확인
- `src/wasm_api.rs`에 남은 BBDG 전용 API 식별
- 필요 API는 일반화하거나 adapter/worker 경로로 이동

산출물:
- 제거된 실험성 API 목록
- 유지해야 하는 엔진 API 목록
- upstream PR 후보 목록
- guardian review 결과

완료 기준:
- PDF/인쇄 기능이 RHWP 코어가 아니라 앱/worker 레이어에서 완결되어야 한다.
- 오류 검증과 기능 유지 검증이 모두 통과해야 한다.
- orchestration supervisor가 다음 단계 진행을 허용해야 한다.
- guardian review가 `Continue` 또는 `Continue with caution`이어야 한다.

## Phase 4. RHWP 업데이트 리허설

목표:
- 실제 엔진 업데이트 전에 충돌 포인트를 예측한다.

작업:
- upstream RHWP 기준 커밋 확인
- 임시 브랜치에서 RHWP 코어만 갱신
- 빌드 오류 확인
- adapter 수정만으로 앱 빌드가 가능한지 확인
- 핵심 수동 테스트 수행
- UI/UX 회귀 테스트 수행
- 대형 문서 성능 비교 수행
- 업그레이드 기능 보존 체크리스트 전체 수행

산출물:
- 충돌 파일 목록
- adapter 수정 목록
- 회귀 테스트 결과
- UI/UX 회귀 테스트 결과
- 성능 비교 결과
- 업그레이드 기능 보존 체크리스트 결과
- guardian review 결과

완료 기준:
- RHWP 업데이트가 어떤 비용으로 가능한지 명확해야 한다.
- 오류 검증과 기능 유지 검증이 모두 통과해야 한다.
- orchestration supervisor가 다음 단계 진행을 허용해야 한다.
- guardian review가 `Continue` 또는 `Continue with caution`이어야 한다.

## Phase 5. 업데이트 자동 체크 스크립트

목표:
- 엔진 업데이트 후 반복 검증을 빠르게 수행한다.

작업:
- 엔진 API 사용 검색 스크립트 작성
- generated `pkg` 변경 확인 스크립트 작성
- 기본 빌드/체크 명령 묶음 작성
- 수동 테스트 체크리스트 문서화

권장 명령:

```bash
cargo check
cargo test
cd rhwp-studio && npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

산출물:
- 엔진 업데이트 체크리스트
- 검증 명령 문서
- UI/UX 회귀 체크리스트
- 성능 측정 체크리스트
- guardian review 결과

완료 기준:
- 업데이트 담당자가 매번 같은 순서로 검증할 수 있어야 한다.
- 오류 검증과 기능 유지 검증이 모두 통과해야 한다.
- orchestration supervisor가 다음 단계 진행을 허용해야 한다.
- guardian review가 `Continue` 또는 `Continue with caution`이어야 한다.

## Phase 6. 운영 규칙 적용

목표:
- 이후 개발에서 엔진 오염이 다시 증가하지 않게 한다.

작업:
- PR/커밋 리뷰 기준에 계층 구분 추가
- 엔진 코어 수정 시 사유 문서화 강제
- 앱 레이어 우회 가능성 검토 체크 추가
- upstream PR 후보와 BBDG 전용 패치 분리

산출물:
- 개발 규칙 업데이트
- 엔진 수정 예외 기록 양식
- guardian review 결과

완료 기준:
- 새 기능 개발 시 RHWP 코어 수정 여부를 먼저 검토하는 문화가 생겨야 한다.
- 오류 검증과 기능 유지 검증이 모두 통과해야 한다.
- orchestration supervisor가 다음 단계 진행을 허용해야 한다.
- guardian review가 `Continue` 또는 `Continue with caution`이어야 한다.

## 우선순위

### P0
- `wasm-bridge` API 목록화
- RHWP raw API 직접 호출 위치 검색
- `src/wasm_api.rs` BBDG 전용 변경 식별

### P1
- 실험성 print extraction 잔여물 정리
- 엔진 업데이트 리허설
- 회귀 테스트 체크리스트 고정

### P2
- 자동 체크 스크립트 작성
- upstream PR 후보 분리
- adapter 모듈 세분화

## 리스크

### 엔진 API 변경

영향:
- `wasm-bridge` 빌드 오류
- rendering/hitTest/export 호출 실패

대응:
- adapter에서 호환 레이어 추가
- 앱 호출부 변경 최소화

### generated pkg 불일치

영향:
- TypeScript 타입과 WASM 실제 함수 불일치

대응:
- RHWP 빌드 절차로 `pkg` 재생성
- 수동 수정 금지

### 기존 BBDG 기능 회귀

영향:
- 인쇄/PDF/링크드롭/편집기 UX 깨짐

대응:
- 수동 회귀 테스트 체크리스트 수행
- 앱 레이어 기능은 엔진 업데이트 커밋과 분리

### UI/UX 회귀

영향:
- 기능은 동작하지만 사용 흐름이 달라져 사용자가 혼란을 느낄 수 있음
- 인쇄/PDF/뷰어 흐름이 기존보다 불편해질 수 있음

대응:
- 업데이트 전후 화면과 흐름을 비교
- UI 변경은 엔진 업데이트와 별도 작업으로 분리
- 불가피한 UI 변경은 사유와 영향을 문서화

### 성능 회귀

영향:
- 대형 문서 로딩 지연
- PDF 생성/병합 지연
- 메모리 증가
- 프리징처럼 보이는 UX 재발

대응:
- 단계별 성능 로그 확인
- PDF 단계별 평균 시간 비교
- 성능 저하 원인 확인 전 다음 단계 진행 금지

## 작업 완료 정의

이 계획의 1차 완료 조건:
- 요구사항 명세서 작성 완료
- 개발명세서 작성 완료
- 개발계획 명세서 작성 완료
- 엔진 경계 원칙 합의
- 현재 업그레이드된 BBDG 기능 유지 원칙 합의
- UI/UX 유지 원칙 합의
- 단계별 에러/성능 검증 원칙 합의
- 다음 RHWP 업데이트 시 적용 가능한 절차 확보
