# Uni-HWP Core Engine Restructure File Map

문서 버전:
- `8.1.102`

## 1. 목적

리팩토링 전후 파일/폴더 구조를 1:1로 비교하여 경로 변경 범위를 명확히 한다.

## 2. 신구 폴더 대조표

| 현재 경로 | 제안 경로 | 성격 | 우선순위 | 비고 |
|---|---|---|---|---|
| `rhwp-studio/` | `apps/studio/` | Uni-HWP 프론트 앱 셸 | 높음 | 현재 제품 실행 핵심 |
| `rhwp-chrome/` | `apps/chrome-extension/` | Chrome 확장 모듈 | 중간 | 현재 배포에 포함 여부 확인 필요 |
| `rhwp-safari/` | `apps/safari-extension/` | Safari 확장 모듈 | 중간 | 현재 배포에 포함 여부 확인 필요 |
| `rhwp-vscode/` | `apps/vscode-extension/` | VSCode 확장 모듈 | 중간 | 현재 배포에 포함 여부 확인 필요 |
| `rhwp-shared/security/` | `packages/shared-security/` | 공유 보안 유틸 | 중간 | 확장 모듈 참조 경로 확인 필요 |
| `src/` | `embedded-engine/rhwp/src/` 또는 유지 | RHWP 엔진 소스 후보 | 보류 | 이동 시 wasm-pack/Cargo 영향 큼 |
| `pkg/` | 생성물 유지 또는 `target` 성격으로 유지 | WASM 생성물 | 보류 | Git ignore 대상, CI 생성 |
| `npm/` | `packages/npm/` 또는 유지 | npm 패키지 | 낮음 | 별도 판단 |
| `typescript/` | `packages/typescript/` 또는 유지 | TS 패키지 후보 | 낮음 | 별도 판단 |
| `web/` | `apps/web/` 또는 유지 | 웹 관련 자산 | 낮음 | 실제 사용 여부 확인 필요 |

## 3. Phase 2 상세 대조표: Studio 이동

| 현재 경로 | 변경 후 경로 |
|---|---|
| `rhwp-studio/index.html` | `apps/studio/index.html` |
| `rhwp-studio/package.json` | `apps/studio/package.json` |
| `rhwp-studio/package-lock.json` | `apps/studio/package-lock.json` |
| `rhwp-studio/vite.config.ts` | `apps/studio/vite.config.ts` |
| `rhwp-studio/src/**` | `apps/studio/src/**` |
| `rhwp-studio/public/**` | `apps/studio/public/**` |
| `rhwp-studio/e2e/**` | `apps/studio/e2e/**` |

## 4. 반드시 수정해야 하는 참조 후보

| 파일/영역 | 예상 수정 내용 |
|---|---|
| `src-tauri/tauri.conf.json` | `frontendDist`, `beforeBuildCommand` 경로 확인 |
| `src-tauri/build-frontend.mjs` | `rhwp-studio` -> `apps/studio` |
| `src-tauri/ensure-vite-dev-server.ps1` | dev server 경로 확인 |
| `build-frontend.cmd` | 하위 script 경로 확인 |
| `ensure-vite-dev-server.cmd` | 하위 script 경로 확인 |
| `.github/workflows/release-bundles.yml` | `working-directory`, cache path, build path 수정 |
| `.github/workflows/fast-windows-release-check.yml` | `working-directory`, cache path 수정 |
| `README.md` | Quick Start 경로 수정 |
| `docs/**` | 구조 설명 문서 수정 |
| `site/index.html` | 다운로드/데모 링크 영향 확인 |

## 5. 보류 대상

다음 항목은 이름이 `rhwp`를 포함하더라도 즉시 변경하지 않는다.

| 항목 | 이유 |
|---|---|
| `pkg/rhwp.js` | wasm-pack 생성물이며 upstream 엔진 API 이름과 연결 |
| `pkg/rhwp_bg.wasm` | wasm-pack 생성물 |
| 코드 내부 `rhwp` 라이선스/원저작자 표기 | 오픈소스 고지상 유지 필요 |
| RHWP 엔진 내부 함수명 | upstream 업데이트 추적성 보존 |

## 6. 삭제/제외 후보

다음은 리팩토링 중 별도 검토가 필요하다.

| 경로 | 이유 |
|---|---|
| `Release_Temp/` | 로컬 릴리스 작업 산출물 |
| `release-assets/` | 로컬 산출물 |
| `run-artifacts/` | 로컬 실행/검증 산출물 |
| `run-logs/` | 로컬 로그 |
| `rhwp-studio/.vite/` | Vite 캐시 |

## 7. 완료 후 기대 루트 구조

이번 단계의 검증 완료 구조는 다음과 같다.

```text
.github/
apps/
  studio/
  chrome-extension/
  safari-extension/
  vscode-extension/
assets/
docs/
packages/
  shared-security/
site/
src/
src-tauri/
pkg/
README.md
LICENSE
CONTRIBUTING.md
```

`src/`, `pkg/`, Cargo 루트는 RHWP 엔진 업데이트 추적성을 보존하기 위해 `8.1.102` 단계에서 이동하지 않는다.

장기 목표 후보 구조는 다음과 같지만, 실제 적용은 별도 검증 프로젝트로 분리한다.

```text
.github/
apps/
  studio/
  chrome-extension/
  safari-extension/
  vscode-extension/
assets/
docs/
embedded-engine/
  rhwp/
packages/
  shared-security/
site/
src-tauri/
README.md
LICENSE
CONTRIBUTING.md
```
