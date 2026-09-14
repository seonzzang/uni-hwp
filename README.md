<h1 align="center">Uni-HWP</h1>

<p align="center">
  <strong>Uni-HWP</strong> — 플랫폼의 경계를 허무는 HWP/HWPX 에디터<br/>
  <em>All HWP, Open for Everyone</em>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-1.75%2B-orange.svg" alt="Rust" /></a>
  <a href="https://webassembly.org/"><img src="https://img.shields.io/badge/WebAssembly-Ready-blue.svg" alt="WASM" /></a>
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-Desktop-blueviolet.svg" alt="Tauri" /></a>
</p>

---

HWP 파일을 **어디서든** 열어보세요.

Uni-HWP는 오픈소스 `rhwp`를 Embedded RHWP Engine으로 포함하고, 그 위에 Black-Box Adapter와 앱 셸을 얹어 실사용 기능을 확장한 HWP/HWPX 뷰어 및 에디터입니다. 닫힌 포맷의 벽을 낮추고, 플랫폼의 경계를 넘어 한글 문서를 더 자유롭게 읽고 쓸 수 있게 하는 것을 목표로 합니다.


## 개발 방향성 및 로드맵

Uni-HWP는 문서의 파싱 및 렌더링을 담당하는 **코어 엔진 영역은 오픈소스 `rhwp`의 upstream 추적성을 최대한 보존**하고, 실사용자의 편의성과 애플리케이션의 완성도를 높이는 앱 계층을 별도로 발전시킵니다.

- **RHWP upstream baseline**: 현재 기준선은 `edwardkim/rhwp@v0.8.6`이며, branch head가 아니라 tagged release를 기준으로 판올림 여부를 판단합니다.

### RHWP 적용 기준과 이번 변경 범위

이번 정식 등록 전 실험에서는 `edwardkim/rhwp@v0.8.6`를 RHWP 적용 기준선으로 사용했습니다.
즉, `main` 최신 HEAD를 그대로 따라가는 방식이 아니라, 태그된 안정 릴리즈를 기준으로 Uni-HWP의 엔진 경계를 점검했습니다.

이 기준선을 적용하면서 달라진 점은 다음과 같습니다.

- **동기화 기준 정리**: RHWP와 공통인 코어 엔진만 업스트림 동기화 대상으로 보고, `web/`와 앱 전용 셸은 Uni-HWP 전용 경계로 유지했습니다.
- **업스트림 추적성 확보**: 엔진 계층은 `v0.8.6` 기준으로 비교·판정하도록 맞췄고, 이후 판올림 여부도 이 기준선으로 판단합니다.
- **앱 셸 독립성 유지**: 릴리즈 버전, 배포 방식, 사이트 UI, 제품 문구는 Uni-HWP가 별도로 관리합니다.
- **릴리즈 산출물 유지**: Windows/macOS/Linux 패키지 이름과 배포 흐름은 Uni-HWP 정책에 따라 유지하고, 엔진 버전 기준만 RHWP 태그에 맞춥니다.
- **검증 경로 분리**: RHWP 기준선 확인, Uni-HWP 앱 빌드, Tauri GUI 실행은 서로 다른 단계로 확인할 수 있게 정리했습니다.

### 핵심 개발 목표

- **사용자 편의성(UX) 극대화**: 직관적인 인쇄 다이얼로그, PDF 내보내기 진행 상황 시각화(ETA), 인앱(In-app) 뷰어 등 실무에 즉시 투입 가능한 수준의 UX 제공.
- **플랫폼 확장 및 단독 실행**: 브라우저 종속성을 탈피하여 Tauri 기반의 고성능 데스크톱 단독 앱(`src-tauri`) 환경 구축.
- **메모리 및 성능 최적화**: 대용량 문서 처리 시의 메모리 성장 억제 및 안정성 보장, 독립된 Print Worker를 통한 비동기 PDF 청크 렌더링.
- **유연한 원격 자원 연동**: URL 드래그 앤 드롭 한 번으로 외부의 HWP/HWPX 문서를 안전하고 빠르게 에디터에 다이렉트 로드.

### 아키텍처 및 릴리즈 전략

Uni-HWP의 버전 및 릴리즈 관리는 코어 엔진의 호환성을 유지하면서, 사용자와 직접 맞닿는 앱셸(App Shell) 계층의 기능을 지속적으로 확장하는 데 집중합니다.

- **Embedded RHWP Engine Layer**: HWP 5.0 / HWPX 문서 파서, 문단·표·수식 등 핵심 조판 렌더링, 페이지네이션.
- **Black-Box Adapter Layer**: Uni-HWP 앱이 엔진 내부 구현에 직접 의존하지 않도록 안정된 경계를 제공.
- **Uni-HWP App Shell Layer**: 
  - WASM Bridge 고도화 및 메모리 관리 체계 개선
  - 강력한 인쇄/PDF 통합 파이프라인 제공
  - 파일 입출력 및 외부 리소스(Drag & Drop) 처리의 안정성 확보
- **Repository Boundary Layout**:
  - `apps/studio`: Uni-HWP 데스크톱/웹 앱 셸
  - `apps/chrome-extension`, `apps/safari-extension`, `apps/vscode-extension`: 확장 앱 계층
  - `packages/shared-security`: 확장 모듈 공용 보안 유틸
  - `src`, `pkg`, `src-tauri`: RHWP 엔진 추적성과 Tauri 통합을 보존하는 핵심 경계

---

## Features

### Advanced Workflows (Uni-HWP 특화 기능)
- **Print & PDF Export**: 향상된 다이얼로그와 ETA 계산, 대용량 PDF 청크 기반 병합 처리
- **Remote Link Drop**: 보안이 강화된 외부 링크 드래그 앤 드롭 다이렉트 렌더링
- **Desktop Application**: Tauri 기반의 고성능 데스크톱 앱 모드 지원


## Quick Start (소스 빌드)

### Requirements
- Rust 1.75+
- Node.js 18+ (for web editor)
- Docker (for WASM build)
- Tauri CLI (for Desktop app build)

### Native Build

```bash
cargo build                    # Development build
cargo build --release          # Release build
cargo test                     # Run tests (755+ tests)
```

### WASM Build

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker run --rm wasm
```

### Web Editor & Desktop App

```bash
# Web Editor 실행
# Uni-HWP Studio 앱 셸
cd apps/studio
npm install
npx vite --host 0.0.0.0 --port 7700

# Tauri Desktop App 실행
cd ../../src-tauri
cargo tauri dev
```

## Maintenance Documents

RHWP 엔진 업그레이드 및 Uni-HWP 유지보수에 필요한 핵심 문서는 `docs/public/maintenance` 아래에 정리되어 있습니다.

- `VERSION_HISTORY.md`
- `docs/public/maintenance/RHWP_ENGINE_API_INVENTORY.md`
- `docs/public/maintenance/RHWP_ENGINE_COMPATIBILITY_CHECKLIST.md`
- `docs/public/maintenance/RHWP_ENGINE_INTEGRATION_DEVELOPMENT_PLAN.md`
- `docs/public/maintenance/RHWP_ENGINE_INTEGRATION_DEVELOPMENT_SPEC.md`
- `docs/public/maintenance/RHWP_ENGINE_INTEGRATION_REQUIREMENTS.md`
- `docs/public/maintenance/RHWP_ENGINE_UPDATE_RUNBOOK.md`
- `docs/public/architecture/RHWP_INTEGRATION_PRESERVATION_ARCHITECTURE.md`
- `docs/public/architecture/RHWP_INTEGRATION_PRESERVATION_FRAMEWORK.md`

문서 구조 가이드는 `docs/README.md`에서, 배포 브랜치 문서 분류 기준은 `docs/public/release/RELEASE_DOCUMENT_CLASSIFICATION.md`에서 확인할 수 있습니다.

## Versioning Rule

Uni-HWP 외피 버전과 RHWP 엔진 버전은 서로 독립적으로 관리합니다.

- 현재 Uni-HWP 외피/API 버전은 `0.1.0`으로 고정합니다.
- RHWP 엔진 버전은 upstream 원본의 SemVer를 그대로 사용합니다.
- 엔진 업데이트는 RHWP 태그와 커밋·해시만 교체하며 외피 버전을 자동 변경하지 않습니다.
- 제품 외피 기능 변경은 `8.8.x` patch로 관리합니다.
- 제품정보 화면의 엔진 버전은 실제 설치된 WASM 엔진에서 읽습니다.

## Version History

Uni-HWP 공개 버전은 최신 릴리즈부터 아래처럼 정리했습니다.

| Uni-HWP 버전 | 외피/API 버전 | 릴리즈 날짜 | RHWP 대응 버전 | 주요 변경 |
| --- | --- | --- | --- | --- |
| 8.6.0 | 0.1.0 | 2026-09-14 | `edwardkim/rhwp@v0.8.6` | RHWP 엔진 업데이트·검증·복원 기반과 제품 버전 표시를 정리한 현재 릴리즈입니다.
| 8.4.0 | 0.0.9 | 2026-08-15 | `edwardkim/rhwp@v0.8.4` | RHWP 엔진 코어를 `v0.7.8`에서 `v0.8.4`로 상향한 릴리즈입니다.
| 8.1.102 | 0.0.8 | 2026-04-29 | `edwardkim/rhwp@v0.7.8` | 브라우저형 RHWP 편집기를 Tauri + Rust + Vite 기반 독립 실행 데스크톱 앱으로 포장하고 앱 셸 경계를 정리했습니다.
| 8.1.101 | 0.0.7 | 2026-04-29 | `edwardkim/rhwp@v0.7.8` | 문서 닫기 UX와 인쇄/PDF 미리보기 흐름을 정리했습니다.
| 8.1.100 | 0.0.6 | 2026-04-29 | `edwardkim/rhwp@v0.7.8` | Tauri 기반 독립 실행 편집기 셸의 초기 기준점입니다.

현재 Uni-HWP 통합 버전은 `8.6.0`, 외피/API 버전은 `0.1.0`, 엔진 기준선은 `edwardkim/rhwp@v0.8.6`입니다.
엔진 업데이트 기능은 호환성 정책 확정 전까지 제품 화면에서 비활성화되어 있습니다.

## Architecture

```mermaid
flowchart TB
  subgraph Engine["Embedded RHWP Engine"]
    direction LR
    F["HWP/HWPX File"] --> P["Parser / Model"] --> C["Core"] --> R["Render / Layout"]
    C --> W["WASM API"]
    R --> S["SVG Output"]
    R --> A["Canvas Output"]
  end

  subgraph Extensions["apps/ + packages/"]
    direction LR
    CH["chrome-extension"] --> SEC["shared-security"]
    SA["safari-extension"] --> SEC
    VS["vscode-extension"] --> X
  end

  subgraph Bridge["Uni-HWP Adapter Layer"]
    direction LR
    W --> X["wasm-bridge / Adapter"] --> L["Document Lifecycle"]
    X --> V["Validation / Compatibility Guard"]
  end

  subgraph Surface["Uni-HWP App Surface"]
    direction LR
    SH["App Shell"] --> VU["Canvas View / Input / Toolbar"]
    SH --> PD["Print Dialog UX"]
    SH --> PV["In-App PDF Viewer"]
    SH --> RL["Remote Link Drop UX"]
    SH --> ET["Progress / ETA / Cancel Overlay"]
  end

  subgraph Desktop["src-tauri / OS"]
    direction LR
    PD --> PS["Print / PDF Service"] --> PW["Print Worker Pipeline"] --> T["Tauri App Services"] --> O["Temp Files / Cleanup / OS Integration"]
    PV --> PS
    ET --> PS
    RL --> RH["Remote HWP Service"] --> T
  end

  X --> SH
  L --> SH
  V --> SH

  classDef surfaceBox fill:#111827,stroke:#94a3b8,color:#f8fafc,stroke-width:1.5px;
  classDef surfaceNode fill:#374151,stroke:#cbd5e1,color:#f8fafc,stroke-width:1px;

  class Surface surfaceBox;
  class SH,VU,PD,PV,RL,ET surfaceNode;
```

## HWPUNIT

- 1 inch = 7,200 HWPUNIT
- 1 inch = 25.4 mm
- 1 HWPUNIT ≈ 0.00353 mm

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

온라인 데모와 배포된 현재 화면은 [https://seonzzang.github.io/uni-hwp](https://seonzzang.github.io/uni-hwp) 에서 확인할 수 있습니다.

## Product Information

1. **제품 및 제조사 정보 (Product & Manufacturer)**
  - 제품명 (Product): Uni HWP
  - 버전 (Version): 0.1.0
   - 제조사 (Manufacturer): Uni-HWP Studio
   - Copyright © 2026 Uni-HWP Studio

2. **오픈소스 라이선스 (Open Source License)**
   - 본 제품은 오픈소스 프로젝트 rhwp를 기반으로 고도화되었습니다. (This product has been advanced based on the open-source project rhwp.)
   - 원저작자 (Original Author): rhwp
   - 본 소프트웨어 및 원저작물은 MIT 라이선스를 준수하며, 상업적/비상업적 목적으로 무료로 자유롭게 사용 가능합니다. (This software and original works comply with the MIT License and are free to use for both commercial and non-commercial purposes.)

   **rhwp Dependencies Licenses**
   - wasm-bindgen, web-sys, js-sys: MIT / Apache-2.0
   - cfb, flate2: MIT
   - byteorder: MIT / Unlicense
   - base64, console_error_panic_hook: MIT / Apache-2.0

3. **상표권 및 권리 고지 (Trademark & Rights Notice)**
   - 본 제품은 주식회사 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발되었습니다. (This product was developed by referring to the official HWP file format documentation provided by Hancom Inc.)
   - "한글", "한컴", "HWP", "HWPX"는 주식회사 한글과컴퓨터의 등록 상표입니다. 본 소프트웨어는 해당 상표권자와 무관한 독립적 결과물임을 알립니다. (Hangul, Hancom, HWP, and HWPX are registered trademarks of Hancom Inc. This software is an independent result and is not affiliated with the trademark holder.)
   - **UNI-HWP IS AN INDEPENDENT SOFTWARE PROJECT.**

## License

본 프로젝트는 [MIT 라이선스](LICENSE)를 따릅니다.
This project is licensed under the [MIT License](LICENSE).
