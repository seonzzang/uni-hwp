# Release Document Classification

이 문서는 `release/0.8.100` 브랜치에서 어떤 문서를 공개 배포 대상으로 유지하고, 어떤 문서를 내부 기록으로 제외했는지 정리합니다.

## 공개 유지 문서

- `README.md`
- `CONTRIBUTING.md`
- `LICENSE`
- `docs/legal/THIRD_PARTY_LICENSES.md`
- `.github/CODE_OF_CONDUCT.md`
- `.github/SECURITY.md`
- `.github/pull_request_template.md`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`

## RHWP 업그레이드 및 유지보수 핵심 문서

- `docs/maintenance/RHWP_ENGINE_API_INVENTORY.md`
- `docs/maintenance/RHWP_ENGINE_COMPATIBILITY_CHECKLIST.md`
- `docs/maintenance/RHWP_ENGINE_INTEGRATION_DEVELOPMENT_PLAN.md`
- `docs/maintenance/RHWP_ENGINE_INTEGRATION_DEVELOPMENT_SPEC.md`
- `docs/maintenance/RHWP_ENGINE_INTEGRATION_REQUIREMENTS.md`
- `docs/maintenance/RHWP_ENGINE_UPDATE_RUNBOOK.md`
- `docs/maintenance/RHWP_INTEGRATION_PRESERVATION_ANTI_SPAGHETTI_GUIDE.md`
- `docs/maintenance/RHWP_INTEGRATION_PRESERVATION_ARCHITECTURE.md`
- `docs/maintenance/RHWP_INTEGRATION_PRESERVATION_FRAMEWORK.md`
- `docs/maintenance/RHWP_INTEGRATION_PRESERVATION_NAMING.md`
- `docs/maintenance/RHWP_INTEGRATION_PRESERVATION_VIBE_CODING_GUIDE.md`
- `docs/maintenance/rhwp_rename_map_table.md`
- `rhwp_rename_map.json`

## 배포 브랜치에서 제외한 문서

다음 문서군은 공개 배포 브랜치에서 제거했습니다.

- `mydocs/` 전체
- `doc-packages/` 전체
- 실험/중간 계획 문서
- 단계별 검증 보고서
- 에이전트 운영 문서
- 과거 BBDG/RHWP 작업 스냅샷 문서
- 공개 브랜치 기준으로 최신 상태와 맞지 않는 구버전 변경 이력 문서

대표적인 제외 문서 예시는 다음과 같습니다.

- `BBDG_CRITICAL_BRANCH_SNAPSHOT.md`
- `CHANGELOG.md`
- `CLAUDE.md`
- `COMMIT_AGENT.md`
- `EXPERIMENTAL_PRINT_PATH_REMOVAL_CHECKLIST.md`
- `HWP_LINK_DROP_IMPLEMENTATION_PLAN.md`
- `HWP_LINK_DROP_REQUIREMENTS.md`
- `MEMORY_OPTIMIZATION_PLAN.md`
- `PRINT_EXTRACTION_API_SPEC.md`
- `PUPPETEER_PRINT_PIPELINE_PLAN.md`
- `README_EN.md`
- `RHWP_ENGINE_APP_CONTROL_PHASE2_REPORT_20260423.md`
- `RHWP_ENGINE_APP_CONTROL_REPORT_20260423.md`
- `RHWP_ENGINE_APP_CONTROL_VERIFICATION_AGENT.md`
- `RHWP_ENGINE_APPROVAL_GATE_AGENT.md`
- `RHWP_ENGINE_BASELINE_COMPARISON_AGENT.md`
- `RHWP_ENGINE_GUARDIAN_AGENT.md`
- `RHWP_ENGINE_MOMENTUM_MONITOR.md`
- `RHWP_ENGINE_ORCHESTRATION_SUPERVISOR.md`
- `RHWP_ENGINE_RAW_BYPASS_CANDIDATES.md`
- `RHWP_ENGINE_UPDATE_PHASE2_REPORT_20260423.md`
- `RHWP_ENGINE_UPDATE_REHEARSAL_20260423.md`
- `VERSION_AGENT.md`

## 원칙

- 공개 사용자가 바로 이해해야 하는 문서는 남긴다.
- RHWP 업그레이드와 Uni-HWP 유지보수에 직접 필요한 문서는 남긴다.
- 내부 작업 흐름, 일회성 검증, 에이전트 운영 기록은 로컬/백업 브랜치에만 남긴다.
