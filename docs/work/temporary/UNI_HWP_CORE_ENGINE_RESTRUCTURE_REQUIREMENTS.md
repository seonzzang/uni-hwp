# Uni-HWP Core Engine Restructure Requirements

문서 버전:
- `8.1.102`

문서 성격:
- 내부 작업 문서
- `upgrade` 브랜치 전용 리팩토링 준비 문서
- 작업 완료 후 `docs/work/archive`로 이동하거나 삭제 가능

## 1. 목적

Uni-HWP 프로젝트 루트에 노출되어 있는 `rhwp-*` 계열 폴더를 정리하여, 외부에 보이는 프로젝트 구조가 Uni-HWP 중심으로 읽히도록 한다.

동시에 RHWP upstream 추적성과 엔진 업데이트 가능성은 보존한다.

## 2. 핵심 원칙

- RHWP를 핵심 엔진으로 사용한다.
- RHWP 엔진 코어의 내부 파일명, 폴더 구조, 함수명은 직접 변경하지 않는다.
- RHWP 업데이트 및 신버전 릴리스 시 Uni-HWP 엔진 업데이트가 어렵지 않아야 한다.
- 외부 루트 구조에서는 `rhwp-*` 흔적이 과도하게 노출되지 않도록 한다.
- 앱 실행, 데모 빌드, 데스크톱 빌드, GitHub Actions 자동 빌드가 유지되어야 한다.
- 리팩토링은 기능 변경이 아니라 구조 정리 작업이다.

## 3. 아키텍처 정의

- 프로젝트 아키텍처: `Uni-HWP Engine Boundary Architecture`
- 구현 패턴: `Black-Box Adapter`
- 엔진 위치: `Embedded RHWP Engine`

## 4. 대상 폴더

루트에서 현재 노출되는 주요 `rhwp` 이름 폴더:

- `rhwp-studio`
- `rhwp-chrome`
- `rhwp-safari`
- `rhwp-vscode`
- `rhwp-shared/security`

## 5. 분류 요구사항

각 폴더는 먼저 다음 성격으로 분류해야 한다.

| 현재 폴더 | 성격 | 처리 방향 |
|---|---|---|
| `rhwp-studio` | 현재 Uni-HWP 프론트 앱 셸 | `apps/studio` 후보 |
| `rhwp-chrome` | 브라우저 확장 모듈 또는 과거 확장 흔적 | `apps/chrome-extension` 또는 제거 후보 |
| `rhwp-safari` | Safari 확장 모듈 또는 과거 확장 흔적 | `apps/safari-extension` 또는 제거 후보 |
| `rhwp-vscode` | VSCode 확장 모듈 또는 과거 확장 흔적 | `apps/vscode-extension` 또는 제거 후보 |
| `rhwp-shared/security` | 확장/공유 보안 유틸 | `packages/shared-security` 후보 |

## 6. 필수 동작 유지 요구사항

리팩토링 후에도 다음 동작은 유지되어야 한다.

- 로컬 실시간 앱 실행
- `npm run build`
- `cargo check`
- Tauri dev 실행
- GitHub Actions 자동 빌드
- 온라인 데모 빌드 및 GitHub Pages 배포
- Windows x64 설치본/포터블 빌드
- macOS Apple Silicon 빌드
- macOS Intel 빌드
- Linux x64 AppImage 빌드
- 제품 정보 팝업 버전 표시
- PDF 내보내기 및 인앱 PDF 미리보기
- 문서 닫기 `X`
- `파일 -> 닫기`
- 미저장 문서 보호 팝업

## 7. 금지사항

- RHWP 엔진 코어 내부 구조를 임의로 변경하지 않는다.
- 단순 이름 감추기를 위해 엔진 업데이트 경로를 망가뜨리지 않는다.
- 빌드가 깨진 상태로 다음 단계로 넘어가지 않는다.
- 한 번에 모든 폴더를 이동하지 않는다.
- release 브랜치에서 직접 개발하지 않는다.

## 8. 수용 기준

- 루트에서 앱/패키지/엔진 경계가 명확하게 보인다.
- `rhwp-*` 폴더가 루트에 직접 노출되지 않는다.
- 경로 변경 후 모든 로컬 검증이 통과한다.
- GitHub Actions 경로가 새 구조에 맞게 수정된다.
- README의 Quick Start 및 Architecture가 새 구조와 일치한다.
- RHWP engine boundary 원칙이 유지된다.
