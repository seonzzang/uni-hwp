# Docs Guide

`docs`는 Uni-HWP 공개 배포판에 포함되는 외부 공개 문서를 관리하는 영역입니다.

## 구조

```text
docs/
└─ public/
   ├─ product/
   ├─ architecture/
   ├─ maintenance/
   ├─ release/
   └─ legal/
```

## 원칙

- 루트 문서인 `README.md`, `LICENSE`, `CONTRIBUTING.md`, `.github/CODE_OF_CONDUCT.md`, `.github/SECURITY.md`는 GitHub 표준 위치를 유지합니다.
- `docs/public`에는 외부 공개가 가능한 일반 문서만 둡니다.
- 내부 작업 문서, 임시 계획서, 검증 로그, 에이전트 운영 문서는 공개 릴리스 브랜치에 포함하지 않습니다.

## 공개 문서 분류

- `public/product`
  - 제품 설명, 사용자 관점 기능 문서
- `public/architecture`
  - 아키텍처, 엔진 경계, 네이밍, 구조 보존 원칙
- `public/maintenance`
  - 유지보수 체크리스트, 업그레이드 계획, 호환성 문서
- `public/release`
  - 릴리스 정책, 배포 문서 분류 기준
- `public/legal`
  - 서드파티 라이선스, 법적 고지 문서
