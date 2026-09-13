# Uni-HWP B P6 검증 경계

P6의 저장소 대체 검증은 `tests/p6_hwpx_field_automation.rs`가 담당한다. 이 테스트는
실제 `samples/hwpx/field-multipara-clickhere.hwpx`를 사용해 필드 탐색, 값 읽기, 값 치환,
HWPX 저장, ZIP 무결성, 재열기, 변경 필드 재조회를 검증한다. 입력 fixture는 덮어쓰지 않는다.

`pyhwpx`는 선택적 외부 검증 도구이며 이 사이클에서는 설치하지 않았다. 따라서 pyhwpx가
없는 환경에서도 `cargo test --test p6_hwpx_field_automation`으로 제품 코어의 실제 파일
결과를 검증할 수 있다. Hancom/pyhwpx와의 별도 오라클 비교는 P7 범위다.

Studio의 `SetCurFieldName`은 `MoveToField`가 선택한 실제 필드에 대해 코어 `renameField`를
호출하고, `RenameField`는 성공 JSON을 확인한다. 선택 필드가 없거나 코어 API가 없으면
성공을 가장하지 않고 `false`로 차단한다.

## P7 이월 조사 범위

- Hancom Windows 실행에서 동일 fixture의 필드 목록·값·이름 변경 결과 대조
- Tauri Windows GUI smoke: 실행, HWPX 열기, 필드 자동화, 저장, 재열기
- Windows 설치 산출물 생성·서명/해시·설치 후 실행 확인
- 다중 필드·셀 필드·중첩 위치 및 시각 렌더링 회귀
