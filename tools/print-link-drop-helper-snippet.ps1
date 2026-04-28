param(
  [string]$Url = "https://www.scfmc.or.kr/upload/board/files/2024081_sample.hwpx",
  [string]$SuggestedName = ""
)

$escapedUrl = $Url.Replace("`", "``").Replace("'", "\'")
$escapedSuggestedName = $SuggestedName.Replace("`", "``").Replace("'", "\'")

if ([string]::IsNullOrWhiteSpace($SuggestedName)) {
  $snippet = @"
await window.__debugOpenRemoteHwpUrl('$escapedUrl')
"@
} else {
  $snippet = @"
await window.__debugOpenRemoteHwpUrl('$escapedUrl', '$escapedSuggestedName')
"@
}

$snippet = $snippet.Trim()

try {
  Set-Clipboard -Value $snippet
  $copied = $true
} catch {
  $copied = $false
}

[pscustomobject]@{
  copiedToClipboard = $copied
  snippet = $snippet
}
