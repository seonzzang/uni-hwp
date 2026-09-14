#!/usr/bin/env python3
import html
import json
import os
import sys
from datetime import datetime
from urllib.request import Request, urlopen


def main() -> int:
    repo = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["GH_TOKEN"]
    request = Request(
        f"https://api.github.com/repos/{repo}/releases?per_page=100",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "uni-hwp-release-site",
        },
    )
    with urlopen(request) as response:
        releases = json.loads(response.read().decode("utf-8"))

    asset_suffixes = {
        "win_setup": "Uni-HWP_windows_x64_ko-KR_setup_v{version}.exe",
        "win_msi": "Uni-HWP_windows_x64_ko-KR_msi_v{version}.msi",
        "win_portable": "Uni-HWP_windows_x64_ko-KR_portable_v{version}.zip",
        "mac_arm": "Uni-HWP_macos_aarch64_ko-KR_v{version}.dmg",
        "mac_intel": "Uni-HWP_macos_x64_ko-KR_v{version}.dmg",
        "linux_x64": "Uni-HWP_linux_x64_ko-KR_v{version}.AppImage",
        "linux_arm": "Uni-HWP_linux_arm64_ko-KR_v{version}.AppImage",
    }

    # Release tags are retained as asset lookup keys, while the public table
    # displays only the integrated Uni-HWP version. Legacy tags are aliases
    # only; they never become the public product version.
    release_versions = {}
    history_path = os.path.join(os.path.dirname(__file__), "..", "release", "version-history.json")
    try:
        with open(history_path, encoding="utf-8") as history_file:
            history = json.load(history_file)
        for item in history.get("releases", []):
            version_info = {
                "full": item["productVersion"],
                "shell": item["shellVersion"],
                "engine": item["engineVersion"],
            }
            release_versions[item["releaseTag"].lstrip("v")] = version_info
            for legacy_tag in item.get("legacyReleaseTags", []):
                release_versions[legacy_tag.lstrip("v")] = version_info
    except OSError:
        pass
    except (KeyError, TypeError, json.JSONDecodeError) as error:
        raise SystemExit(f"invalid release/version-history.json: {error}")

    def find_asset_url(assets, template, version):
        name = template.format(version=version)
        for asset in assets:
            if asset.get("name") == name:
                return asset.get("browser_download_url")
        return None

    def link(label, url):
        if url:
            return f'<a href="{html.escape(url, quote=True)}" target="_blank" rel="noopener">{label}</a>'
        return '<span class="asset-missing">-</span>'

    rows = []
    for release in releases:
        if release.get("draft") or release.get("prerelease"):
            continue
        version = (release.get("tag_name") or release.get("name") or "").lstrip("v")
        published_at = release.get("published_at")
        if not version or not published_at:
            continue
        date = datetime.fromisoformat(published_at.replace("Z", "+00:00")).astimezone().strftime("%Y-%m-%d")
        assets = release.get("assets", [])
        version_info = release_versions.get(
            version,
            {"full": version, "shell": "-", "engine": "-"},
        )
        rows.append(
            "<tr>"
            f'<td class="history-date"><div>{html.escape(date)}</div>'
            f'<div class="history-version">v{html.escape(version_info["full"])}</div></td>'
            f"<td>{link('데모', '/uni-hwp/demo/')}</td>"
            f"<td>{link('다운로드', find_asset_url(assets, asset_suffixes['win_setup'], version))}</td>"
            f"<td>{link('다운로드', find_asset_url(assets, asset_suffixes['win_msi'], version))}</td>"
            f"<td>{link('다운로드', find_asset_url(assets, asset_suffixes['win_portable'], version))}</td>"
            f"<td>{link('다운로드', find_asset_url(assets, asset_suffixes['mac_arm'], version))}</td>"
            f"<td>{link('다운로드', find_asset_url(assets, asset_suffixes['mac_intel'], version))}</td>"
            f"<td>{link('다운로드', find_asset_url(assets, asset_suffixes['linux_x64'], version))}</td>"
            f"<td>{link('다운로드', find_asset_url(assets, asset_suffixes['linux_arm'], version))}</td>"
            "</tr>"
        )

    if not rows:
        sys.stdout.write('<tr><td class="history-empty" colspan="9">아직 공개된 릴리즈가 없습니다.</td></tr>')
        return 0

    latest_row = rows[0]
    historical_rows = rows[1:]
    output = [latest_row]
    if historical_rows:
        output.append(
            '<tr class="history-accordion-row"><td colspan="9">'
            '<details class="history-accordion">'
            f'<summary>과거 릴리스 보기 ({len(historical_rows)}개)</summary>'
            '<div class="history-nested-table-wrap"><table class="history-table history-nested-table">'
            '<thead><tr>'
            '<th>버전 정보</th><th>온라인 데모</th>'
            '<th>Windows Installer · amd64</th><th>Windows MSI Installer · amd64</th>'
            '<th>Windows Portable · amd64</th><th>macOS Apple Silicon · arm64</th>'
            '<th>macOS Intel · amd64</th><th>Linux AppImage · amd64</th>'
            '<th>Linux AppImage · arm64</th>'
            '</tr></thead><tbody>'
            + "\n".join(historical_rows)
            + '</tbody></table></div></details></td></tr>'
        )
    sys.stdout.write("\n".join(output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
