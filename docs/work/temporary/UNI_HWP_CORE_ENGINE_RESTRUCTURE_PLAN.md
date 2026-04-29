# Uni-HWP Core Engine Restructure Plan

문서 버전:
- `8.1.102`

참조 문서:
- `docs/work/temporary/UNI_HWP_CORE_ENGINE_RESTRUCTURE_REQUIREMENTS.md`
- `docs/work/temporary/UNI_HWP_CORE_ENGINE_RESTRUCTURE_FILE_MAP.md`
- `docs/work/temporary/UNI_HWP_CORE_ENGINE_RESTRUCTURE_ARCHITECTURE_COMPARISON.md`

작업자는 본 계획서를 실행하기 전에 위 3개 문서를 먼저 확인해야 한다.

문서별 역할:

| 문서 | 역할 |
|---|---|
| `UNI_HWP_CORE_ENGINE_RESTRUCTURE_REQUIREMENTS.md` | 리팩토링 목적, 원칙, 금지사항, 수용 기준 |
| `UNI_HWP_CORE_ENGINE_RESTRUCTURE_FILE_MAP.md` | 신구 파일구조 대조표와 경로 변경 후보 |
| `UNI_HWP_CORE_ENGINE_RESTRUCTURE_ARCHITECTURE_COMPARISON.md` | 현재/목표 아키텍처 비교와 Mermaid 구조도 |

## 1. 목표

루트에 노출된 `rhwp-*` 폴더를 Uni-HWP 중심 구조로 재배치한다.

리팩토링은 단계별로 진행하며, 각 단계는 `오류 없음`과 `기능 유지` 두 조건을 모두 만족해야 다음 단계로 넘어간다.

## 2. 추천 최종 구조

```text
apps/
  studio/
  chrome-extension/
  safari-extension/
  vscode-extension/

packages/
  shared-security/

embedded-engine/
  rhwp/

src-tauri/
site/
docs/
README.md
LICENSE
CONTRIBUTING.md
```

## 3. 단계별 작업 계획

### Phase 0. 기준선 확인

목표:
- 현재 `upgrade` 브랜치 상태와 `release/8.1.101` 기준점을 명확히 구분한다.
- 요구사항 문서의 금지사항과 수용 기준을 확인한다.

작업:
- `upgrade` 브랜치 확인
- 현재 앱 실행 확인
- `npm run build` 확인
- `cargo check` 확인
- 현재 GitHub Actions 성공 워크플로우 백업 확인

통과 기준:
- 리팩토링 전 기준선 로그가 확보된다.

### Phase 1. 문서 및 경로 영향 분석

목표:
- 경로 변경 대상과 참조 지점을 모두 식별한다.
- 신구 파일구조 대조표와 현재 실제 참조 지점을 대조한다.

작업:
- `UNI_HWP_CORE_ENGINE_RESTRUCTURE_FILE_MAP.md` 확인
- `rhwp-studio` 참조 검색
- `rhwp-chrome` 참조 검색
- `rhwp-safari` 참조 검색
- `rhwp-vscode` 참조 검색
- `rhwp-shared` 참조 검색
- `.github/workflows`, `src-tauri`, `site`, `README`, `vite.config.ts`, `tsconfig` 경로 영향 확인

통과 기준:
- 신구 파일구조 대조표가 실제 참조 목록과 일치한다.

### Phase 2. `rhwp-studio`를 `apps/studio`로 이동

목표:
- 현재 Uni-HWP 프론트 앱 셸을 루트 `rhwp-studio`에서 제거한다.
- 아키텍처 비교표의 목표 구조 중 `apps/studio` 경로를 우선 반영한다.

작업:
- `UNI_HWP_CORE_ENGINE_RESTRUCTURE_ARCHITECTURE_COMPARISON.md`의 목표 구조 확인
- `rhwp-studio` -> `apps/studio`
- Vite alias 경로 수정
- Tauri `frontendDist`, `beforeBuildCommand`, `beforeDevCommand` 관련 경로 수정
- root helper script 경로 수정
- GitHub Actions `working-directory` 및 cache path 수정
- README Quick Start 수정

통과 기준:
- `npm run build` 통과
- `cargo check` 통과
- `cargo tauri dev` 실행 성공
- 제품 정보 팝업 정상

### Phase 3. 확장 모듈 폴더 이동 또는 보류

목표:
- 현재 배포 제품에 직접 필요하지 않은 확장 모듈의 위치를 정리한다.

작업:
- `rhwp-chrome` -> `apps/chrome-extension`
- `rhwp-safari` -> `apps/safari-extension`
- `rhwp-vscode` -> `apps/vscode-extension`
- 사용하지 않는 확장이라면 별도 제거 후보 문서 작성 후 보류

통과 기준:
- 현재 앱 빌드에 영향 없음
- 관련 README/문서 링크 갱신

### Phase 4. 공유 보안 패키지 이동

목표:
- 공유 보안 유틸을 앱이 아닌 패키지 영역으로 분리한다.

작업:
- `rhwp-shared/security` -> `packages/shared-security`
- 확장 모듈에서 참조하는 상대경로 수정
- 테스트 또는 정적 검사 수행

통과 기준:
- 참조 깨짐 없음
- 앱 빌드 영향 없음

### Phase 5. Embedded RHWP Engine 경계 정리

목표:
- 진짜 RHWP 엔진 경계를 `embedded-engine/rhwp`로 명확히 한다.
- 아키텍처 비교표의 Engine Boundary 정책을 따른다.

작업:
- `UNI_HWP_CORE_ENGINE_RESTRUCTURE_ARCHITECTURE_COMPARISON.md`의 경계 정책 확인
- 실제 upstream engine 소스 범위를 확인
- 이동 가능 여부 판단
- 빌드/wasm-pack 경로 영향 분석
- 이동이 위험하면 문서상 경계만 먼저 명확히 하고 코드 이동은 별도 Phase로 보류

통과 기준:
- 엔진 업데이트 경로가 명확히 문서화된다.
- 엔진 내부 이름 변경이 발생하지 않는다.

실행 판단:
- `src/`, `pkg/`, Cargo 루트는 RHWP upstream 교체/비교와 wasm-pack/Tauri 빌드 경로에 직접 연결된다.
- 현 단계에서 실제 엔진 소스까지 `embedded-engine/rhwp`로 이동하면 유지보수성이 좋아지는 것이 아니라, 오히려 신규 RHWP 버전 반영 시 충돌면이 커질 수 있다.
- 따라서 `8.1.102 upgrade` 작업에서는 루트에 직접 노출된 `rhwp-*` 앱/확장/공유 폴더만 제거하고, 엔진 내부 파일명과 생성물명은 보존한다.
- Engine Boundary는 `apps/studio/src/engine-boundary/`와 `src-tauri`/WASM bridge 계층에서 유지하며, 실제 엔진 디렉터리 이동은 별도 장기 작업으로 분리한다.

### Phase 6. 통합 검증

목표:
- 전체 리팩토링 후 기능 동일성을 확인한다.

검증:
- `npm run build`
- `cargo check`
- `cargo tauri dev`
- 문서 열기
- 문서 닫기 `X`
- `파일 -> 닫기`
- PDF 내보내기
- 인앱 PDF 미리보기 닫기
- GitHub Actions dry-run 수준의 경로 검토

통과 기준:
- 기능 저하 없음
- 새 구조와 README/문서가 일치

## 4. 리스크와 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| Tauri 경로 깨짐 | 앱 실행 실패 | Phase 2에서 가장 먼저 검증 |
| GitHub Actions 경로 깨짐 | 자동 배포 실패 | workflow path를 단계별 수정 |
| WASM alias 깨짐 | 프론트 빌드 실패 | `vite.config.ts` alias 확인 |
| 확장 모듈 상대경로 깨짐 | 확장 빌드 실패 | 확장은 앱과 분리 검증 |
| 엔진 업데이트 경로 손상 | 장기 유지보수 악화 | 엔진 내부는 마지막까지 이동 보류 가능 |

## 5. 커밋 전략

- Phase 단위로 커밋한다.
- 각 Phase마다 검증 후 커밋한다.
- 실패 시 직전 Phase 커밋으로 되돌릴 수 있게 한다.
- release 브랜치는 건드리지 않는다.

권장 커밋 예:

```text
refactor: move studio app under apps
refactor: move browser extension folders under apps
refactor: move shared security package
docs: update engine boundary structure
```
