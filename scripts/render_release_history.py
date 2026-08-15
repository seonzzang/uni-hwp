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
        "win_portable": "Uni-HWP_windows_x64_ko-KR_portable_v{version}.zip",
        "mac_arm": "Uni-HWP_macos_aarch64_ko-KR_v{version}.dmg",
        "mac_intel": "Uni-HWP_macos_x64_ko-KR_v{version}.dmg",
        "linux": "Uni-HWP_linux_x64_ko-KR_v{version}.AppImage",
    }

    def find_asset_url(assets, template, version):
        name = template.format(version=version)
        for asset in assets:
            if asset.get("name") == name:
                return asset.get("browser_download_url")
        return None

    rows = []
    for release in releases:
        if release.get("draft") or release.get("prerelease"):
            continue
        version = (release.get("tag_name") or release.get("name") or "").lstrip("v")
        if not version:
            continue
        published_at = release.get("published_at")
        if published_at:
            published_at = datetime.fromisoformat(published_at.replace("Z", "+00:00")).astimezone().strftime("%Y-%m-%d")
        else:
            published_at = "미정"
        assets = release.get("assets", [])

        def link(label, url):
            if url:
                return f'<a href="{html.escape(url, quote=True)}" target="_blank" rel="noopener">{label}</a>'
            return '<span class="asset-missing">-</span>'

        rows.append(
            "<tr>"
            f'<td class="history-date">{html.escape(published_at)}</td>'
            f"<td>{link('데모', '/uni-hwp/demo/')}</td>"
            f"<td>{link('다운로드', find_asset_url(assets, asset_suffixes['win_setup'], version))}</td>"
            f"<td>{link('다운로드', find_asset_url(assets, asset_suffixes['win_portable'], version))}</td>"
            f"<td>{link('다운로드', find_asset_url(assets, asset_suffixes['mac_arm'], version))}</td>"
            f"<td>{link('다운로드', find_asset_url(assets, asset_suffixes['mac_intel'], version))}</td>"
            f"<td>{link('다운로드', find_asset_url(assets, asset_suffixes['linux'], version))}</td>"
            "</tr>"
        )

    if not rows:
        sys.stdout.write('<tr><td class="history-empty" colspan="7">아직 공개된 릴리즈가 없습니다.</td></tr>')
    else:
        sys.stdout.write("\n".join(rows))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
