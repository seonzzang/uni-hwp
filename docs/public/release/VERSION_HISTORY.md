# Version History

이 문서는 Uni-HWP의 공개 기준 버전과 버전별 주요 변경 사항을 기록합니다.

## 8.1.102

루트 폴더에 노출되어 있던 `rhwp-*` 앱/확장/공유 모듈 흔적을 Uni-HWP 중심 구조로 정리한 아키텍처 패치 버전입니다.

### 핵심 상태

- RHWP 엔진 코어는 수정하지 않고 유지
- 사용자 기능과 UI 동작은 변경하지 않음
- 앱 셸, 확장 앱, 공유 보안 패키지의 저장 위치만 Uni-HWP 구조로 재배치
- 엔진 내부 파일명과 wasm 생성물명은 RHWP upstream 업데이트 추적성을 위해 보존

### 이번 반영 기능

- `rhwp-studio/`를 `apps/studio/`로 이동
  - Tauri `frontendDist`, Vite alias, TypeScript path, dev server, 빌드 스크립트, GitHub Actions 경로 갱신
  - 데스크톱 앱 실행 경로를 새 앱 셸 위치와 동기화
- 확장 앱 폴더를 `apps/` 하위로 이동
  - `rhwp-chrome/` -> `apps/chrome-extension/`
  - `rhwp-safari/` -> `apps/safari-extension/`
  - `rhwp-vscode/` -> `apps/vscode-extension/`
  - 확장 빌드 스크립트의 상대경로 보정
- 공유 보안 유틸을 `packages/shared-security/`로 이동
  - 루트 `rhwp-shared/` 노출 제거
  - Safari 확장 참조 주석 갱신
- README 아키텍처 다이어그램을 새 폴더 구조와 Engine Boundary 정책에 맞춰 갱신

### 구현 범위

- RHWP 엔진 코어 비수정
- Uni-HWP 저장소 구조, 빌드 경로, 문서 구조만 수정
- `src/`, `pkg/`, Cargo 루트는 엔진 교체 용이성을 위해 이동 보류

### 검증

- `npm run build` 통과 (`apps/studio`)
- `cargo check` 통과 (`src-tauri`)
- `cargo tauri dev --no-watch` 실행 확인
- Chrome extension `npm run build` 통과
- 루트 `rhwp-*` 폴더 0개 확인

## 8.1.101

문서 닫기 UX를 완성한 패치 버전입니다.

### 핵심 상태

- RHWP 엔진 코어는 수정하지 않고 유지
- Uni-HWP 앱 셸, 메뉴, 창 제어 계층에서만 기능 확장
- 문서 닫기 진입점을 메뉴와 상단 문서 닫기 버튼으로 통일

### 이번 반영 기능

- `파일 -> 닫기` 메뉴 추가
  - 기존 `file:close` 명령을 그대로 재사용
  - 문서가 열려 있지 않으면 비활성화
  - 문서가 열려 있으면 활성화
  - 상단 문서 닫기 `X`와 동일한 동작 보장
- 문서 닫기 UX 정렬
  - 앱 종료 `X`와 문서 닫기 `X`의 역할을 분리
  - 문서 닫기 `X`의 경계선/배경 이질감을 제거하여 타이틀바 버튼과 시각적으로 정렬
- 미저장 문서 보호 흐름 유지
  - 문서 닫기 `X`, `파일 -> 닫기`, 앱 종료 흐름에서 같은 dirty guard 사용
  - 저장 확인 팝업의 `저장`, `저장 안 함`, `취소` 동작 유지
- PDF 미리보기 닫기 UX 보정
  - PDF 미리보기 화면에서 앱 전체 종료가 아니라 미리보기만 닫히도록 역할 정리
  - 편집기 복귀 흐름과 창 닫기 흐름의 의미를 명확히 분리

### 구현 범위

- RHWP 엔진 코어 비수정
- Uni-HWP App Shell, Command, UI, Tauri capability 계층만 수정

### 검증

- `npm run build` 통과
- `cargo check` 통과
- 사용자 수동 확인 통과

## 8.1.100

현재 로컬 기준점 및 업그레이드 작업 기준 버전입니다.

### 핵심 상태

- RHWP 엔진 코어는 수정하지 않고 유지
- Uni-HWP 앱 셸 계층에서만 UX 기능 확장
- 자동 빌드 및 공개 배포 파이프라인 기준점 유지

### 이번 반영 기능

- 현재 문서를 닫는 `문서 닫기 ×` 버튼 추가
  - 편집기 상단 메뉴바 우측 끝에 배치
  - 앱 종료 버튼과 혼동되지 않도록 명도 차이 적용
  - 윈도우 타이틀바 버튼 축과 어긋나지 않도록 정렬 보정
- 미저장 문서 보호 흐름 추가
  - 문서 닫기 시 `'파일명' 문서를 저장하겠습니까?` 팝업 표시
  - 앱 종료 시 동일한 저장 확인 흐름 재사용
  - `저장`, `저장 안 함`, `취소` 3갈래 처리
- 공통 dirty 문서 상태 관리 추가
  - 문서 변경 감지 후 dirty 상태 유지
  - 저장 성공, 문서 교체, 문서 닫기 시 clean 상태로 복귀
- 문서 빈 상태 복귀 흐름 추가
  - 문서 닫기 후 캔버스/툴바/상태바를 안전한 초기 상태로 복귀

### 구현 범위

- RHWP 엔진 코어 비수정
- Uni-HWP 브리지/앱 셸/UI 계층만 수정

### 검증

- `npm run build` 통과
- `cargo check` 통과
