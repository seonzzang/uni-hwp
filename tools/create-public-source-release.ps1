param(
    [string]$Version = "8.1.100",
    [string]$OutputRoot = "Release_Temp"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$outputBase = Join-Path $repoRoot $OutputRoot
$packageName = "Uni-HWP_$Version`_source"
$packageRoot = Join-Path $outputBase $packageName
$zipPath = Join-Path $outputBase "$packageName.zip"

$semverVersion = if ($Version -match '^\d+\.\d+$') {
    "$Version.0"
} else {
    $Version
}

$allowedRootFiles = @(
    ".dockerignore",
    ".env.docker.example",
    ".gitignore",
    "Cargo.lock",
    "Cargo.toml",
    "CONTRIBUTING.md",
    "LICENSE",
    "README.md"
)

$allowedPrefixes = @(
    "pkg/",
    "apps/studio/",
    "scripts/",
    "src/",
    "src-tauri/",
    "tools/",
    "ttfs/",
    "web/"
)

$allowedExact = @(
    ".github/CODE_OF_CONDUCT.md",
    ".github/SECURITY.md",
    ".github/workflows/release-bundles.yml"
)

$requiredLocalFiles = @(
    "build-frontend.cmd",
    "ensure-vite-dev-server.cmd",
    "src-tauri/build-frontend.cmd",
    "src-tauri/build-frontend.ps1",
    "src-tauri/ensure-vite-dev-server.cmd",
    "src-tauri/ensure-vite-dev-server.ps1"
)

$requiredLocalDirs = @(
    "pkg"
)

function Test-IncludedPath {
    param([string]$Path)

    if ($allowedRootFiles -contains $Path) {
        return $true
    }

    if ($allowedExact -contains $Path) {
        return $true
    }

    foreach ($prefix in $allowedPrefixes) {
        if ($Path.StartsWith($prefix, [System.StringComparison]::Ordinal)) {
            return $true
        }
    }

    return $false
}

function Copy-TrackedFile {
    param(
        [string]$RelativePath
    )

    $sourcePath = Join-Path $repoRoot $RelativePath
    $targetPath = Join-Path $packageRoot $RelativePath
    $targetDir = Split-Path -Parent $targetPath
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }
    Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
}

function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Content
    )

    if ($Content.Length -gt 0 -and $Content[0] -eq [char]0xFEFF) {
        $Content = $Content.Substring(1)
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

if (Test-Path $packageRoot) {
    Remove-Item -LiteralPath $packageRoot -Recurse -Force
}

if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null

$trackedFiles = git -C $repoRoot ls-files
foreach ($file in $trackedFiles) {
    if (Test-IncludedPath -Path $file) {
        Copy-TrackedFile -RelativePath $file
    }
}

foreach ($file in $requiredLocalFiles) {
    $sourcePath = Join-Path $repoRoot $file
    if (Test-Path $sourcePath) {
        Copy-TrackedFile -RelativePath $file
    }
}

foreach ($dir in $requiredLocalDirs) {
    $sourceDir = Join-Path $repoRoot $dir
    $targetDir = Join-Path $packageRoot $dir
    if (Test-Path $sourceDir) {
        if (Test-Path $targetDir) {
            Remove-Item -LiteralPath $targetDir -Recurse -Force
        }
        Copy-Item -LiteralPath $sourceDir -Destination $targetDir -Recurse -Force
    }
}

$readmeKr = @"
# Uni-HWP

Uni-HWP 공개 소스 배포판 v$Version 입니다.

이 패키지는 데스크톱 앱 빌드와 핵심 엔진 검토에 필요한 파일만 남기고, 내부 작업 기록 문서(`mydocs/`, `doc-packages/`, 임시 계획/에이전트 문서 등)는 제외한 정리본입니다.

## 포함 범위

- Uni-HWP 데스크톱 앱 소스 (`src-tauri/`, `apps/studio/`)
- Embedded RHWP Engine 소스 (`src/`, `pkg/`)
- 공개 빌드/보조 스크립트 (`tools/`, `scripts/`)
- 웹/폰트 리소스 (`web/`, `ttfs/`)
- 공개용 기본 문서 (`README`, `CHANGELOG`, `CONTRIBUTING`, `LICENSE`, `SECURITY`, `CODE_OF_CONDUCT`)

## 제외 범위

- 내부 작업 문서와 단계별 보고서
- 에이전트 운영 문서
- 임시 검증 로그 및 개발 중간 산출물
- 브라우저 확장/부가 제품군 소스

## 빌드 개요

### 데스크톱 앱

```bash
cd apps/studio
npm install

cd ../../src-tauri
cargo tauri dev
```

### 코어 엔진

```bash
cargo build
```

## 엔진 고지

Uni-HWP는 오픈소스 `rhwp`를 Embedded RHWP Engine으로 사용합니다. 이 배포판은 upstream 추적 가능성을 유지하기 위해 엔진 코어의 내부 구조를 보존합니다.

## 버전

- 공개 소스 패키지 버전: $Version
- 앱 내부 버전(semver): $semverVersion
- 제품명: Uni-HWP
- 제조사 표기: Uni-HWP Studio
"@

$contributing = @"
# Contributing

Uni-HWP welcomes focused, reviewable contributions.

## Guidelines

1. Keep app-shell changes separated from engine-core changes whenever possible.
2. Do not mix internal experimental artifacts into public release packages.
3. Preserve upstream compatibility in the embedded RHWP engine area.
4. Prefer small, testable commits with clear intent.
5. Document user-visible behavior changes in `CHANGELOG.md`.

## Local checks

```bash
cargo build

cd apps/studio
npm install
npm run build
```
"@

$security = @"
# Security Policy

If you discover a security issue in Uni-HWP, please report it privately before public disclosure.

## Reporting

- Open a private security report through the repository security channel when available.
- If that is not available, contact the project maintainers through the repository owner account.

Please include:

- affected version
- platform
- reproduction steps
- impact summary
- proof-of-concept if available
"@

$codeOfConduct = @"
# Code of Conduct

## Our Commitment

We want Uni-HWP to be a respectful, practical, and welcoming open-source project.

Participants are expected to:

- be respectful and constructive
- focus on the software and the user impact
- avoid harassment, personal attacks, and hostile behavior

## Enforcement

Project maintainers may remove comments, issues, or contributions that violate this code of conduct and may restrict participation when necessary to protect the project community.
"@

Set-Content -LiteralPath (Join-Path $packageRoot "README.md") -Value $readmeKr -Encoding UTF8
Set-Content -LiteralPath (Join-Path $packageRoot "CONTRIBUTING.md") -Value $contributing -Encoding UTF8

$githubDir = Join-Path $packageRoot ".github"
if (-not (Test-Path $githubDir)) {
    New-Item -ItemType Directory -Path $githubDir -Force | Out-Null
}
Set-Content -LiteralPath (Join-Path $githubDir "SECURITY.md") -Value $security -Encoding UTF8
Set-Content -LiteralPath (Join-Path $githubDir "CODE_OF_CONDUCT.md") -Value $codeOfConduct -Encoding UTF8

$unwantedDocs = @(
    "README_EN.md",
    "CHANGELOG.md",
    "THIRD_PARTY_LICENSES.md",
    "SOURCE_RELEASE_MANIFEST.md",
    "ttfs/FONTS.md",
    "web/fonts/FONTS.md"
)

foreach ($relativePath in $unwantedDocs) {
    $fullPath = Join-Path $packageRoot $relativePath
    if (Test-Path $fullPath) {
        Remove-Item -LiteralPath $fullPath -Force
    }
}

Get-ChildItem -Path $packageRoot -Recurse -File -Filter "FONTS.md" | Remove-Item -Force

$versionTargets = @(
    "Cargo.toml",
    "src-tauri/Cargo.toml",
    "src-tauri/tauri.conf.json",
    "apps/studio/package.json",
    "apps/studio/package-lock.json",
    "apps/studio/src/assets/product-info.json",
    ".github/workflows/release-bundles.yml"
)

foreach ($relativePath in $versionTargets) {
    $fullPath = Join-Path $packageRoot $relativePath
    if (-not (Test-Path $fullPath)) {
        continue
    }

    $content = Get-Content -LiteralPath $fullPath -Raw
    $content = $content -replace '0\.7\.139', $semverVersion
    $content = $content -replace 'v0\.7\.139', "v$Version"
    Write-Utf8NoBom -Path $fullPath -Content $content
}

Compress-Archive -Path (Join-Path $packageRoot "*") -DestinationPath $zipPath -Force

Write-Output "PACKAGE_ROOT=$packageRoot"
Write-Output "ZIP_PATH=$zipPath"
