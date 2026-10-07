[CmdletBinding(SupportsShouldProcess)]
param(
  [switch]$Execute
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'package.json')) -or
    -not (Test-Path -LiteralPath (Join-Path $projectRoot 'app.json'))) {
  throw "Refusing cleanup because the project markers were not found in $projectRoot"
}

$directoryCandidates = @(
  '.playwright-cli',
  'node_modules',
  'dist',
  'build',
  'output',
  'android/.gradle',
  'android/build',
  'android/app/build',
  'android/capacitor-cordova-android-plugins',
  'artifacts/local',
  'artifacts/devtools-runner',
  'artifacts/connected-backend',
  'artifacts/connected-devtools',
  'artifacts/member-web-merge-20260929',
  'artifacts/member-merge-20260929-202510'
)

$memberArchive = [Text.Encoding]::UTF8.GetString(
  [Convert]::FromBase64String('5a6J5bGF5LqR5p6i572R6aG156uvKDIpLnppcA==')
)

$fileCandidates = @(
  'anju-cloud-pivot-main.zip',
  $memberArchive,
  'artifacts/deployment/20260929-member-web-v1-upload.tar.gz'
)

function Resolve-SafeCandidate([string]$relativePath) {
  $candidate = [IO.Path]::GetFullPath((Join-Path $projectRoot $relativePath))
  $rootPrefix = $projectRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if (-not $candidate.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing path outside the project: $candidate"
  }
  return $candidate
}

$existing = @()
foreach ($relativePath in $directoryCandidates + $fileCandidates) {
  $candidate = Resolve-SafeCandidate $relativePath
  if (Test-Path -LiteralPath $candidate) {
    $existing += [PSCustomObject]@{ RelativePath = $relativePath; FullPath = $candidate }
  }
}

if (-not $Execute) {
  Write-Host 'Dry run. These generated or duplicate paths would be removed:'
  $existing.RelativePath | ForEach-Object { Write-Host "  $_" }
  Write-Host 'Run with -Execute to perform the cleanup.'
  exit 0
}

$cleanupFailures = @()
foreach ($entry in $existing) {
  if ($PSCmdlet.ShouldProcess($entry.FullPath, 'Remove generated or duplicate project content')) {
    $isDirectory = (Get-Item -LiteralPath $entry.FullPath -Force).PSIsContainer
    try {
      Remove-Item -LiteralPath $entry.FullPath -Recurse -Force -ErrorAction Stop
    } catch {
      # Windows PowerShell can fail on deeply nested Android/npm paths. The
      # extended path fallback is used only after Resolve-SafeCandidate has
      # confirmed that the target remains inside this project.
      if (Test-Path -LiteralPath $entry.FullPath) {
        $extendedPath = '\\?\' + $entry.FullPath
        try {
          if ($isDirectory) {
            [IO.Directory]::Delete($extendedPath, $true)
          } else {
            [IO.File]::Delete($extendedPath)
          }
        } catch {
          $cleanupFailures += $entry.RelativePath
          Write-Warning "Could not remove $($entry.RelativePath): $($_.Exception.Message)"
          continue
        }
      }
    }
    if (Test-Path -LiteralPath $entry.FullPath) {
      $cleanupFailures += $entry.RelativePath
      Write-Warning "Cleanup target still exists: $($entry.FullPath)"
      continue
    }
    Write-Host "Removed $($entry.RelativePath)"
  }
}

if ($cleanupFailures.Count -gt 0) {
  Write-Warning ('Cleanup completed with locked paths left in place: ' + ($cleanupFailures -join ', '))
}
Write-Host 'Cleanup complete. Restore dependencies with npm ci and generated clients with the documented build commands.'
