# RHWP Integration Preservation Framework

## 프로젝트 선언

이 문서 묶음의 공식 프로젝트명은 다음과 같다.

- 영문명: `RHWP Integration Preservation Framework`
- 한글명: `RHWP 엔진 통합 보존 프레임워크`

이 프로젝트의 목적은 BBDG HWP Editor가 RHWP 엔진의 향후 업데이트를 지속적으로 수용할 수 있도록 만들면서도, 이미 업그레이드된 BBDG 전용 기능, UI/UX 흐름, 인쇄/PDF/link-drop 동작, 성능 피드백 체계를 손실 없이 보존하는 것이다.

이 프로젝트는 단순한 엔진 업데이트 작업이 아니다.

이 프로젝트는 다음 네 가지를 함께 다룬다.

- 엔진 통합
- 기능 보존
- UI/UX 동등성 유지
- 검증/감독/운영 거버넌스
- 구조 보존과 스파게티 코드 방지

## 핵심 명제

1. RHWP 코어는 가능한 한 upstream 교체 가능 상태로 유지한다.
2. BBDG 제품 경험은 엔진 청결성보다 우선 보존 대상이다.
3. 구현은 작게 나누고, 각 단계마다 오류 검증과 기능 유지 검증을 모두 통과해야 한다.
4. 감독, 가디언, 기준 비교, 앱 조작 검증, 런북 문서까지 포함한 운영 체계로 관리한다.

## 문서군 역할

이 프레임워크 문서군은 아래 역할로 구성된다.

- 요구사항: 무엇을 반드시 지켜야 하는가
- 개발 명세: 어떤 구조로 구현해야 하는가
- 개발 계획: 어떤 순서로 나눠 진행할 것인가
- 호환성 체크리스트: 무엇을 통과해야 완료인가
- 가디언: 문서 준수와 회귀 방지 감시
- 승인 게이트: 완료 보고 수신 후 다음 단계 자동 승인
- 오케스트레이션 슈퍼바이저: 단계, 범위, 커밋 경계 통제
- 모멘텀 모니터: 작업 정체 감지와 다음 최소 행동 제시
- 기준 비교: 기준 앱과 변경 앱의 동등성 확인
- 앱 조작 검증: 실제 UI/UX 자동 검증
- 런북: 반복 가능한 업데이트 절차
- 구조 보존 가이드: 바이브 코딩 환경에서 스파게티 코드 방지

## 우선 문서

이 프로젝트를 시작하거나 재개할 때 가장 먼저 보는 문서는 아래 순서로 권장한다.

1. `RHWP_ENGINE_INTEGRATION_REQUIREMENTS.md`
2. `RHWP_ENGINE_INTEGRATION_DEVELOPMENT_SPEC.md`
3. `RHWP_ENGINE_INTEGRATION_DEVELOPMENT_PLAN.md`
4. `RHWP_ENGINE_COMPATIBILITY_CHECKLIST.md`
5. `RHWP_ENGINE_ORCHESTRATION_SUPERVISOR.md`
6. `RHWP_ENGINE_GUARDIAN_AGENT.md`
7. `RHWP_ENGINE_MOMENTUM_MONITOR.md`
8. `RHWP_ENGINE_BASELINE_COMPARISON_AGENT.md`
9. `RHWP_ENGINE_APP_CONTROL_VERIFICATION_AGENT.md`
10. `RHWP_ENGINE_UPDATE_RUNBOOK.md`

## 현재 문서 인덱스

핵심 통제 문서:

- `RHWP_ENGINE_INTEGRATION_REQUIREMENTS.md`
- `RHWP_ENGINE_INTEGRATION_DEVELOPMENT_SPEC.md`
- `RHWP_ENGINE_INTEGRATION_DEVELOPMENT_PLAN.md`
- `RHWP_ENGINE_COMPATIBILITY_CHECKLIST.md`

감독/검증 문서:

- `RHWP_ENGINE_GUARDIAN_AGENT.md`
- `RHWP_ENGINE_APPROVAL_GATE_AGENT.md`
- `RHWP_ENGINE_ORCHESTRATION_SUPERVISOR.md`
- `RHWP_ENGINE_MOMENTUM_MONITOR.md`
- `RHWP_ENGINE_BASELINE_COMPARISON_AGENT.md`
- `RHWP_ENGINE_APP_CONTROL_VERIFICATION_AGENT.md`

운영 문서:

- `RHWP_ENGINE_UPDATE_RUNBOOK.md`
- `RHWP_ENGINE_API_INVENTORY.md`
- `BBDG_CRITICAL_BRANCH_SNAPSHOT.md`
- `RHWP_INTEGRATION_PRESERVATION_ARCHITECTURE.md`
- `RHWP_INTEGRATION_PRESERVATION_VIBE_CODING_GUIDE.md`
- `RHWP_INTEGRATION_PRESERVATION_ANTI_SPAGHETTI_GUIDE.md`

실행/결과 기록 문서:

- `RHWP_ENGINE_UPDATE_REHEARSAL_20260423.md`
- `RHWP_ENGINE_UPDATE_PHASE2_REPORT_20260423.md`
- `RHWP_ENGINE_APP_CONTROL_REPORT_20260423.md`
- `RHWP_ENGINE_APP_CONTROL_PHASE2_REPORT_20260423.md`

## 이름 사용 원칙

앞으로 이 문서군을 통칭할 때는 기본적으로 아래 표현을 사용한다.

- 긴 이름: `RHWP Integration Preservation Framework`
- 짧은 이름: `RIPF`
- 한글 작업명: `RHWP 통합 보존`

대외적/공식 문서에는 긴 이름을 우선 사용한다.
실무 메모, 진행 기록, 내부 대화에서는 `RIPF` 또는 `RHWP 통합 보존` 약칭을 사용할 수 있다.

## 구조 보존 원칙

이 프레임워크는 기능 보존만이 아니라 구조 보존도 관리 대상에 포함한다.

즉, 바이브 코딩의 속도는 허용하지만 아래 상태는 정상 상태로 받아들이지 않는다.

- 거대 파일의 무제한 비대화
- 계층을 건너뛰는 직접 의존 증가
- 임시 패치의 무기한 누적
- 계산, 상태, UI 표시, worker 제어의 한 파일 집중

관련 문서:

- `RHWP_INTEGRATION_PRESERVATION_ARCHITECTURE.md`
- `RHWP_INTEGRATION_PRESERVATION_VIBE_CODING_GUIDE.md`
- `RHWP_INTEGRATION_PRESERVATION_ANTI_SPAGHETTI_GUIDE.md`

이 세 문서는 각각 아래 역할을 가진다.

- Architecture: 왜 계층을 분리해야 하는가
- Vibe Coding Guide: 어떤 개발 태도로 작업하는가
- Anti-Spaghetti Guide: 어디서 구조 정리를 걸어야 하는가

## 최종 규칙

이 프레임워크는 코드가 빌드되는지만 확인하는 프로젝트가 아니다.

이 프레임워크의 완료 기준은 아래가 모두 만족되는 상태다.

- RHWP 엔진 업데이트를 다시 받을 수 있다.
- 현재 BBDG 기능이 보존된다.
- 현재 BBDG UI/UX 흐름이 보존된다.
- 성능과 진행 피드백 체계가 유지된다.
- 문서, 검증, 감독 체계가 함께 유지된다.
