$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$package = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $projectRoot 'package.json') | ConvertFrom-Json
$version = $package.version
$buildId = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
$stagingDir = Join-Path $env:LOCALAPPDATA "AnjuCloudPivot\build\windows-$version-$buildId"

# WeChat DevTools watches the project tree and can hold generated ASAR files open.
# Package in per-user application data, then copy only the distributable artifacts back.
New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null
Push-Location $projectRoot
try {
  & npx.cmd electron-builder --config electron-builder.yml --win nsis --x64 "--config.directories.output=$stagingDir"
  if ($LASTEXITCODE -ne 0) { throw 'Windows installer build failed' }
}
finally {
  Pop-Location
}

$installer = Get-ChildItem -LiteralPath $stagingDir -File |
  Where-Object { $_.Name -like "*-Windows-$version-Setup.exe" } |
  Select-Object -First 1
if (-not $installer) { throw 'Windows installer was not created' }

$outputDir = Join-Path $projectRoot 'output\installers\windows'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
Copy-Item -Force -LiteralPath $installer.FullName -Destination (Join-Path $outputDir $installer.Name)

$blockMap = Get-Item -LiteralPath ($installer.FullName + '.blockmap') -ErrorAction SilentlyContinue
if ($blockMap) {
  Copy-Item -Force -LiteralPath $blockMap.FullName -Destination (Join-Path $outputDir $blockMap.Name)
}

Write-Output "Windows installer: $(Join-Path $outputDir $installer.Name)"

