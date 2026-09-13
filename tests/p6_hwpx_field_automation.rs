//! Uni-HWP B P6: 실제 HWPX 필드 자동화 왕복 게이트.
//!
//! `pyhwpx`/Hancom COM이 없는 CI에서도 실행 가능한 저장소 대체 경로다. 실제 HWPX
//! fixture를 코어로 열어 필드 탐색·읽기·치환·HWPX 저장·ZIP 무결성·재열기·재조회를
//! 한 번에 고정한다. pyhwpx를 설치하거나 합성 XML을 만들지 않는다.

use std::fs;
use std::io::Cursor;
use std::path::Path;

use rhwp::document_core::DocumentCore;
use zip::ZipArchive;

const FIXTURE: &str = "samples/hwpx/field-multipara-clickhere.hwpx";
const VALUE: &str = "P6-실파일-검증-20260913";
const RENAMED: &str = "P6_자동화_필드";

#[test]
fn real_hwpx_field_discovery_fill_save_reopen_cycle() {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(FIXTURE);
    let original_bytes = fs::read(&path).expect("실제 HWPX fixture 읽기");
    assert!(
        original_bytes.starts_with(b"PK"),
        "fixture가 HWPX ZIP이 아님"
    );

    // 저장소의 실제 패키지 경계를 먼저 확인한다. pyhwpx가 없어도 이 검사는 실행된다.
    let mut original_zip = ZipArchive::new(Cursor::new(&original_bytes)).expect("fixture ZIP 열기");
    assert!(
        original_zip.by_name("mimetype").is_ok(),
        "HWPX mimetype 없음"
    );
    assert!(
        original_zip.by_name("Contents/section0.xml").is_ok(),
        "HWPX 본문 없음"
    );

    let mut core = DocumentCore::from_bytes(&original_bytes).expect("fixture HWPX 파싱");
    let before = core.collect_all_fields();
    let target = before
        .iter()
        .find_map(|field| field.field.field_name().map(str::to_owned))
        .expect("이름 있는 필드가 실제 fixture에 있어야 함");

    let read_before = core.get_field_value_by_name(&target).expect("필드 읽기");
    assert!(
        read_before.contains("\"ok\":true"),
        "읽기 응답 실패: {read_before}"
    );

    let fill = core
        .set_field_value_by_name(&target, VALUE)
        .expect("필드 값 치환");
    assert!(
        fill.contains("\"newValue\""),
        "치환 응답에 새 값 없음: {fill}"
    );

    let rename = core
        .rename_field_by_name(&target, RENAMED)
        .expect("필드 이름 변경");
    assert!(rename.contains("\"ok\":true"), "이름 변경 실패: {rename}");

    let saved = core.export_hwpx_native().expect("HWPX 저장");
    assert!(saved.starts_with(b"PK"), "저장 결과가 HWPX ZIP이 아님");
    let mut saved_zip = ZipArchive::new(Cursor::new(&saved)).expect("저장본 ZIP 무결성");
    assert!(
        saved_zip.by_name("Contents/section0.xml").is_ok(),
        "저장본 본문 없음"
    );

    let reopened = DocumentCore::from_bytes(&saved).expect("저장본 재열기");
    let after = reopened.collect_all_fields();
    assert_eq!(after.len(), before.len(), "저장·재열기 후 필드 수가 달라짐");
    assert!(
        after.iter().any(|f| f.field.field_name() == Some(RENAMED)),
        "변경된 필드 이름 소실"
    );
    assert!(
        after
            .iter()
            .all(|f| f.field.field_name() != Some(target.as_str())),
        "이전 필드 이름 잔존"
    );
    let read_after = reopened
        .get_field_value_by_name(RENAMED)
        .expect("재열기 후 필드 재조회");
    assert!(
        read_after.contains(VALUE),
        "재열기 후 값이 보존되지 않음: {read_after}"
    );

    // 입력 fixture 자체를 덮어쓰지 않았다는 보조 경계도 확인한다.
    assert_eq!(fs::read(&path).expect("fixture 재조회"), original_bytes);
}
