# RHWP Integration Preservation Framework Naming Rules

## 목적

`RHWP Integration Preservation Framework` 문서군의 제목, 파일명, 인용 방식을 통일하기 위한 규칙을 정의한다.

## 공식 이름

- 영문 공식명: `RHWP Integration Preservation Framework`
- 한글 공식명: `RHWP 엔진 통합 보존 프레임워크`
- 영문 약칭: `RIPF`
- 한글 약칭: `RHWP 통합 보존`

## 파일명 규칙

기존 파일명 접두사는 유지한다.

이유:

- 이미 생성된 문서와 커밋 기록의 연속성을 보존해야 한다.
- 자동/수동 참조 경로를 깨지 않는 것이 더 중요하다.

따라서 현재는 아래 규칙을 사용한다.

1. 엔진 통합 문서군 접두사: `RHWP_ENGINE_`
2. 프레임워크 상위 문서 접두사: `RHWP_INTEGRATION_PRESERVATION_`
3. 결과 보고 문서는 날짜 또는 phase를 파일명 끝에 붙인다.

예시:

- `RHWP_ENGINE_INTEGRATION_REQUIREMENTS.md`
- `RHWP_ENGINE_GUARDIAN_AGENT.md`
- `RHWP_INTEGRATION_PRESERVATION_FRAMEWORK.md`
- `RHWP_ENGINE_UPDATE_PHASE2_REPORT_20260423.md`

## 문서 제목 규칙

문서 제목은 아래 원칙을 따른다.

1. 상위 개념이 필요한 문서는 제목 첫 줄에서 프레임워크 이름을 명시할 수 있다.
2. 세부 역할 문서는 현재 역할 중심 제목을 유지한다.
3. 제목은 파일명보다 사람이 읽기 쉬운 표현을 우선한다.

권장 형태:

- 프레임워크 상위 문서:
  - `RHWP Integration Preservation Framework`
- 세부 역할 문서:
  - `RHWP Engine Guardian Agent`
  - `RHWP Engine Orchestration Supervisor`
  - `RHWP Engine Compatibility Checklist`

## 본문 내 인용 규칙

본문에서 이 프로젝트를 지칭할 때는 다음을 사용한다.

- 공식 선언/소개 문맥:
  - `RHWP Integration Preservation Framework`
- 반복 설명/내부 실무 문맥:
  - `RIPF`
- 한국어 진행 문맥:
  - `RHWP 엔진 통합 보존 프레임워크`
  - 또는 `RHWP 통합 보존`

## 향후 확장 규칙

추가 문서가 생기면 아래 계열 중 하나로 배치한다.

- 요구사항/명세/계획: `RHWP_ENGINE_*`
- 감독/검증 역할: `RHWP_ENGINE_*_AGENT.md`
- 상위 정책/정체성: `RHWP_INTEGRATION_PRESERVATION_*`
- 보고서/회고/리허설: `RHWP_ENGINE_*_REPORT_*`

## 금지 규칙

- 기존 핵심 문서 파일명을 대량 일괄 변경하지 않는다.
- 같은 개념을 여러 다른 프로젝트명으로 혼용하지 않는다.
- 문서마다 다른 약칭을 새로 만들지 않는다.

## 현재 권장 사용

지금 시점의 권장 표기는 아래와 같다.

- 프로젝트명 소개:
  - `RHWP Integration Preservation Framework`
- 내부 진행 대화:
  - `RIPF`
- 한국어 설명:
  - `RHWP 엔진 통합 보존 프레임워크`
