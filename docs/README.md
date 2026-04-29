# Docs Guide

`docs`는 Uni-HWP 문서를 공개 문서와 작업 문서로 구분해 관리하는 영역입니다.

## 구조

```text
docs/
├─ public/
│  ├─ product/
│  ├─ architecture/
│  ├─ maintenance/
│  ├─ release/
│  └─ legal/
└─ work/
   ├─ temporary/
   └─ archive/
```

## 원칙

- 루트 문서인 `README.md`, `LICENSE`, `CONTRIBUTING.md`, `.github/CODE_OF_CONDUCT.md`, `.github/SECURITY.md`는 GitHub 표준 위치를 유지합니다.
- `docs/public`에는 외부 공개가 가능한 일반 문서만 둡니다.
- `docs/work/temporary`에는 작업 중 임시 문서를 둡니다.
- `docs/work/archive`에는 내부적으로 장기 보관할 작업 문서를 둡니다.
- 작업 브랜치와 릴리스 브랜치 사이 문서 이동 정책은 `docs/work/archive/BRANCH_DOCUMENT_POLICY.md`를 따릅니다.

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

## 내부 운영 문서

- `docs/work/archive/BRANCH_DOCUMENT_POLICY.md`
  - 작업 브랜치, 공개 문서, 릴리스 브랜치 반영 규칙을 설명하는 내부 정책 문서
