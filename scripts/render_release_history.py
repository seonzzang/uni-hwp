#!/usr/bin/env python3
import html
import json
import os
import sys
from datetime import datetime
from urllib.request import Request, urlopen


MOCK_RELEASES = [
    {
        "tag_name": "v8.4.0",
        "published_at": "2026-08-16T00:29:00Z",
        "assets": [
            {"name": "Uni-HWP_windows_x64_ko-KR_setup_v8.4.0.exe", "browser_download_url": "https://example.invalid/Uni-HWP_windows_x64_ko-KR_setup_v8.4.0.exe"},
            {"name": "Uni-HWP_windows_x64_ko-KR_msi_v8.4.0.msi", "browser_download_url": "https://example.invalid/Uni-HWP_windows_x64_ko-KR_msi_v8.4.0.msi"},
            {"name": "Uni-HWP_windows_x64_ko-KR_portable_v8.4.0.zip", "browser_download_url": "https://example.invalid/Uni-HWP_windows_x64_ko-KR_portable_v8.4.0.zip"},
            {"name": "Uni-HWP_macos_aarch64_ko-KR_v8.4.0.dmg", "browser_download_url": "https://example.invalid/Uni-HWP_macos_aarch64_ko-KR_v8.4.0.dmg"},
            {"name": "Uni-HWP_macos_x64_ko-KR_v8.4.0.dmg", "browser_download_url": "https://example.invalid/Uni-HWP_macos_x64_ko-KR_v8.4.0.dmg"},
            {"name": "Uni-HWP_linux_x64_ko-KR_v8.4.0.AppImage", "browser_download_url": "https://example.invalid/Uni-HWP_linux_x64_ko-KR_v8.4.0.AppImage"},
        ],
    },
    {
        "tag_name": "v8.3.2",
        "published_at": "2026-08-12T03:10:00Z",
        "assets": [
            {"name": "Uni-HWP_windows_x64_ko-KR_setup_v8.3.2.exe", "browser_download_url": "https://example.invalid/Uni-HWP_windows_x64_ko-KR_setup_v8.3.2.exe"},
            {"name": "Uni-HWP_windows_x64_ko-KR_msi_v8.3.2.msi", "browser_download_url": "https://example.invalid/Uni-HWP_windows_x64_ko-KR_msi_v8.3.2.msi"},
            {"name": "Uni-HWP_windows_x64_ko-KR_portable_v8.3.2.zip", "browser_download_url": "https://example.invalid/Uni-HWP_windows_x64_ko-KR_portable_v8.3.2.zip"},
            {"name": "Uni-HWP_macos_aarch64_ko-KR_v8.3.2.dmg", "browser_download_url": "https://example.invalid/Uni-HWP_macos_aarch64_ko-KR_v8.3.2.dmg"},
            {"name": "Uni-HWP_macos_x64_ko-KR_v8.3.2.dmg", "browser_download_url": "https://example.invalid/Uni-HWP_macos_x64_ko-KR_v8.3.2.dmg"},
            {"name": "Uni-HWP_linux_x64_ko-KR_v8.3.2.AppImage", "browser_download_url": "https://example.invalid/Uni-HWP_linux_x64_ko-KR_v8.3.2.AppImage"},
        ],
    },
    {
        "tag_name": "v8.1.102",
        "published_at": "2026-04-29T14:53:00Z",
        "assets": [
            {"name": "Uni-HWP_windows_x64_ko-KR_setup_v8.1.102.exe", "browser_download_url": "https://example.invalid/Uni-HWP_windows_x64_ko-KR_setup_v8.1.102.exe"},
            {"name": "Uni-HWP_windows_x64_ko-KR_msi_v8.1.102.msi", "browser_download_url": "https://example.invalid/Uni-HWP_windows_x64_ko-KR_msi_v8.1.102.msi"},
            {"name": "Uni-HWP_windows_x64_ko-KR_portable_v8.1.102.zip", "browser_download_url": "https://example.invalid/Uni-HWP_windows_x64_ko-KR_portable_v8.1.102.zip"},
            {"name": "Uni-HWP_macos_aarch64_ko-KR_v8.1.102.dmg", "browser_download_url": "https://example.invalid/Uni-HWP_macos_aarch64_ko-KR_v8.1.102.dmg"},
            {"name": "Uni-HWP_macos_x64_ko-KR_v8.1.102.dmg", "browser_download_url": "https://example.invalid/Uni-HWP_macos_x64_ko-KR_v8.1.102.dmg"},
            {"name": "Uni-HWP_linux_x64_ko-KR_v8.1.102.AppImage", "browser_download_url": "https://example.invalid/Uni-HWP_linux_x64_ko-KR_v8.1.102.AppImage"},
        ],
    },
    {
        "tag_name": "v8.1.101",
        "published_at": "2026-04-29T09:41:00Z",
        "assets": [
            {"name": "Uni-HWP_windows_x64_ko-KR_setup.exe", "browser_download_url": "https://example.invalid/Uni-HWP_windows_x64_ko-KR_setup.exe"},
            {"name": "Uni-HWP_windows_x64_ko-KR_msi.msi", "browser_download_url": "https://example.invalid/Uni-HWP_windows_x64_ko-KR_msi.msi"},
            {"name": "Uni-HWP_windows_x64_ko-KR_portable.zip", "browser_download_url": "https://example.invalid/Uni-HWP_windows_x64_ko-KR_portable.zip"},
            {"name": "Uni-HWP_macos_aarch64_ko-KR.dmg", "browser_download_url": "https://example.invalid/Uni-HWP_macos_aarch64_ko-KR.dmg"},
            {"name": "Uni-HWP_macos_x64_ko-KR.dmg", "browser_download_url": "https://example.invalid/Uni-HWP_macos_x64_ko-KR.dmg"},
            {"name": "Uni-HWP_linux_x64_ko-KR.AppImage", "browser_download_url": "https://example.invalid/Uni-HWP_linux_x64_ko-KR.AppImage"},
        ],
    },
    {
        "tag_name": "v8.1.100",
        "published_at": "2026-04-28T11:10:00Z",
        "assets": [
            {"name": "Uni-HWP_windows_x64_ko-KR_setup.exe", "browser_download_url": "https://example.invalid/Uni-HWP_windows_x64_ko-KR_setup.exe"},
            {"name": "Uni-HWP_windows_x64_ko-KR_portable.zip", "browser_download_url": "https://example.invalid/Uni-HWP_windows_x64_ko-KR_portable.zip"},
            {"name": "Uni-HWP_macos_aarch64_ko-KR.dmg", "browser_download_url": "https://example.invalid/Uni-HWP_macos_aarch64_ko-KR.dmg"},
            {"name": "Uni-HWP_macos_x64_ko-KR.dmg", "browser_download_url": "https://example.invalid/Uni-HWP_macos_x64_ko-KR.dmg"},
            {"name": "Uni-HWP_linux_x64_ko-KR.AppImage", "browser_download_url": "https://example.invalid/Uni-HWP_linux_x64_ko-KR.AppImage"},
        ],
    },
]

# Keep the public site focused on the supported release line. Older experimental
# releases stay available on GitHub but are not included in the download table.
RELEASE_BASELINE_TAGS = {"v8.4.0", "v8.1.102", "v8.1.101", "v8.1.100"}
RELEASE_BASELINE_DATE = "2026-08-15T00:00:00Z"


def main() -> int:
    use_mock = os.environ.get("RENDER_RELEASE_HISTORY_MOCK") == "1"
    if use_mock:
        releases = MOCK_RELEASES
    else:
        repo = os.environ["GITHUB_REPOSITORY"]
        token = os.environ["GH_TOKEN"]
        headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "uni-hwp-release-site",
        }
        releases = []
        page = 1
        while True:
            request = Request(
                f"https://api.github.com/repos/{repo}/releases?per_page=100&page={page}",
                headers=headers,
            )
            with urlopen(request) as response:
                batch = json.loads(response.read().decode("utf-8"))
            if not batch:
                break
            releases.extend(batch)
            page += 1

    asset_candidates = {
        "win_setup": [
            "Uni-HWP_windows_x64_ko-KR_setup_v{version}.exe",
            "Uni-HWP_windows_x64_ko-KR_setup.exe",
        ],
        "win_msi": [
            "Uni-HWP_windows_x64_ko-KR_msi_v{version}.msi",
            "Uni-HWP_windows_x64_ko-KR_msi.msi",
        ],
        "win_portable": [
            "Uni-HWP_windows_x64_ko-KR_portable_v{version}.zip",
            "Uni-HWP_windows_x64_ko-KR_portable.zip",
        ],
        "mac_arm": [
            "Uni-HWP_macos_aarch64_ko-KR_v{version}.dmg",
            "Uni-HWP_macos_aarch64_ko-KR.dmg",
        ],
        "mac_intel": [
            "Uni-HWP_macos_x64_ko-KR_v{version}.dmg",
            "Uni-HWP_macos_x64_ko-KR.dmg",
        ],
        "linux": [
            "Uni-HWP_linux_x64_ko-KR_v{version}.AppImage",
            "Uni-HWP_linux_x64_ko-KR.AppImage",
        ],
        "linux_arm": [
            "Uni-HWP_linux_arm64_ko-KR_v{version}.AppImage",
            "Uni-HWP_linux_arm64_ko-KR.AppImage",
        ],
    }

    def find_asset_url(assets, candidates, version):
        for template in candidates:
            name = template.format(version=version)
            for asset in assets:
                if asset.get("name") == name:
                    return asset.get("browser_download_url")
        return None

    releases = list(releases)
    release_items = []
    for release in releases:
        if release.get("draft") or release.get("prerelease"):
            continue
        tag_name = release.get("tag_name") or ""
        published_at = release.get("published_at") or ""
        if tag_name not in RELEASE_BASELINE_TAGS and published_at < RELEASE_BASELINE_DATE:
            continue
        version = (release.get("tag_name") or release.get("name") or "").lstrip("v")
        if not version:
            continue
        published_at = release.get("published_at")
        if not published_at:
            continue
        published_at = datetime.fromisoformat(published_at.replace("Z", "+00:00")).astimezone().strftime("%Y-%m-%d")
        assets = release.get("assets", [])
        release_items.append(
            {
                "version": version,
                "published_at": published_at,
                "assets": assets,
            }
        )

    def link(label, url):
        if url:
            return f'<a href="{html.escape(url, quote=True)}" target="_blank" rel="noopener">{label}</a>'
        return '<span class="asset-missing">-</span>'

    if not release_items:
        sys.stdout.write('<tr><td class="history-empty" colspan="8">아직 공개된 릴리즈가 없습니다.</td></tr>')
    else:
        row_specs = [
            ("온라인 데모", lambda release: link("데모", "/uni-hwp/demo/")),
            ("Windows x64 (amd64)", lambda release: link("다운로드", find_asset_url(release["assets"], asset_candidates["win_setup"], release["version"]))),
            ("Windows MSI", lambda release: link("다운로드", find_asset_url(release["assets"], asset_candidates["win_msi"], release["version"]))),
            ("Windows portable", lambda release: link("다운로드", find_asset_url(release["assets"], asset_candidates["win_portable"], release["version"]))),
            ("macOS arm64", lambda release: link("다운로드", find_asset_url(release["assets"], asset_candidates["mac_arm"], release["version"]))),
            ("macOS x86_64", lambda release: link("다운로드", find_asset_url(release["assets"], asset_candidates["mac_intel"], release["version"]))),
            ("Linux AppImage · amd64", lambda release: link("다운로드", find_asset_url(release["assets"], asset_candidates["linux"], release["version"]))),
            ("Linux AppImage · arm64", lambda release: link("다운로드", find_asset_url(release["assets"], asset_candidates["linux_arm"], release["version"]))),
        ]
        body_rows = []
        for release in release_items:
            version_cell = (
                f'<div class="version-head">v{html.escape(release["version"])}</div>'
                f'<div class="version-meta">{html.escape(release["published_at"])}</div>'
            )
            cells = "".join(f"<td>{cell_renderer(release)}</td>" for _, cell_renderer in row_specs)
            body_rows.append(f"<tr><th scope='row'>{version_cell}</th>{cells}</tr>")
        sys.stdout.write("\n".join(body_rows))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
