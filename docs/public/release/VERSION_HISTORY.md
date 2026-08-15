# Version History

이 문서는 Uni-HWP의 공개 기준 버전과 버전별 주요 변경 사항을 기록합니다.

## RHWP 대응 버전

현재 릴리즈 기준선은 `edwardkim/rhwp@v0.8.4`이며, 최신 공개 버전 `8.4.0`이 이 기준선을 사용합니다.

| Uni-HWP 버전 | 릴리즈 날짜 | RHWP 대응 버전 | 비고 |
| --- | --- | --- | --- |
| 8.4.0 | 2026-08-15 | `edwardkim/rhwp@v0.8.4` | RHWP 엔진 코어를 `v0.7.8`에서 `v0.8.4`로 상향하고, 암호 문서/저장 호환성, 렌더·레이아웃 정합, CLI·배포 채널 정비를 반영해 Uni-HWP 버전 체계 `8.4.x`로 전환한 현재 릴리즈 |
| 8.1.102 | 2026-04-29 | `edwardkim/rhwp@v0.7.8` | 브라우저형 RHWP 편집기를 Tauri + Rust + Vite 기반 독립 실행 데스크톱 앱으로 포장하고, 루트에 노출된 `rhwp-*` 흔적을 Uni-HWP 앱 셸 중심 구조로 재배치 |
| 8.1.101 | 2026-04-29 | `edwardkim/rhwp@v0.7.8` | Tauri 데스크톱 셸 위에서 브라우저형 편집기의 독립 실행 구조를 유지한 상태로 문서 닫기 UX, 인쇄/PDF 미리보기 흐름, 저장 확인 처리를 정리 |
| 8.1.100 | 2026-04-29 | `edwardkim/rhwp@v0.7.8` | 브라우저형 RHWP 편집기를 Tauri 기반 독립 실행 데스크톱 편집기로 옮기기 시작한 초기 로컬 기준점. 폰트 렌더링/폴백 출력과 dirty 문서 보호의 기본 골격을 마련 |

## 8.4.0

RHWP 엔진 코어를 `edwardkim/rhwp@v0.7.8` 기준에서 `edwardkim/rhwp@v0.8.4` 기준으로 상향하고, Uni-HWP 버전 체계도 `8.4.x`로 맞춘 릴리즈입니다.  
이 버전은 엔진 코어 상향과 함께, **암호 문서/저장 호환성 강화, 렌더·레이아웃 정합 보정, CLI·배포 채널 정비, 그리고 현재 Uni-HWP가 참조하는 RHWP 엔진 경계와 배포/버전 메타데이터를 `8.4.0` 기준으로 정렬**한 것이 핵심입니다.

### 핵심 상태

- RHWP 엔진 코어를 `edwardkim/rhwp@v0.7.8`에서 `edwardkim/rhwp@v0.8.4`로 상향
- 암호 문서/저장 호환성과 렌더·레이아웃 정합을 보정하고 CLI·배포 채널 정비를 누적 반영
- 사용자 기능과 UI 동작은 유지
- 제품 버전만 `8.4.0`으로 상향
- RHWP 기준선 적용 범위와 릴리즈 버전 표기 기준을 문서화

### 적용 컴포넌트

- `apps/studio/package.json`
  - 앱 셸 제품 버전을 `8.4.0`으로 상향
- `src-tauri/Cargo.toml`
  - Tauri/Rust 패키지 버전을 `8.4.0`으로 상향
- `src-tauri/tauri.conf.json`
  - 데스크톱 번들 버전 표시를 `8.4.0`으로 일치
- `README.md`
  - Uni-HWP `8.4.0` 릴리즈와 RHWP 기준선 설명, 버전 연표 정리
- `docs/public/release/README.md`
  - 공개 릴리즈 문서의 현재 기준 버전을 `8.4.0`으로 갱신
- `docs/public/release/VERSION_HISTORY.md`
  - 과거 `8.1.x` 릴리즈와 현재 `8.4.0`의 RHWP 대응 관계를 병기

### 검증

- 로컬 빌드 및 Tauri 실행 확인
- 릴리즈 히스토리와 제품 버전 정합화

## 8.1.102

루트 폴더에 노출되어 있던 `rhwp-*` 앱/확장/공유 모듈 흔적을 Uni-HWP 중심 구조로 정리한 아키텍처 패치 버전입니다.

### 핵심 상태

- RHWP 엔진 코어는 수정하지 않고 유지
- RHWP 대응 버전은 `edwardkim/rhwp@v0.7.8`
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
- RHWP 대응 버전은 `edwardkim/rhwp@v0.7.8`
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
- RHWP 대응 버전은 `edwardkim/rhwp@v0.7.8`
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
