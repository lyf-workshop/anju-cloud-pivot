$ErrorActionPreference = 'Stop'
$signingConfig = Join-Path $env:LOCALAPPDATA 'AnjuCloudPivot\signing\signing.json'
if (-not (Test-Path -LiteralPath $signingConfig)) {
  & (Join-Path $PSScriptRoot 'create-android-signing.ps1')
}
$secret = Get-Content -Raw -Encoding UTF8 -LiteralPath $signingConfig | ConvertFrom-Json
$env:ANJU_ANDROID_KEYSTORE = $secret.keystorePath
$env:ANJU_ANDROID_STORE_PASSWORD = $secret.storePassword
$env:ANJU_ANDROID_KEY_ALIAS = $secret.keyAlias
$env:ANJU_ANDROID_KEY_PASSWORD = $secret.keyPassword
$sdkRoot = $env:ANDROID_SDK_ROOT
if (-not $sdkRoot) { $sdkRoot = $env:ANDROID_HOME }
if (-not $sdkRoot) {
  $sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}
if (-not (Test-Path -LiteralPath $sdkRoot)) { throw "Android SDK not found: $sdkRoot" }
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_HOME = $sdkRoot
$androidRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\android')).Path
& (Join-Path $androidRoot 'gradlew.bat') --no-daemon assembleRelease -p $androidRoot
if ($LASTEXITCODE -ne 0) { throw 'Android release build failed' }
$sourceApk = Join-Path $androidRoot 'app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path -LiteralPath $sourceApk)) { throw 'Signed APK was not created' }
$outputDir = Join-Path $PSScriptRoot '..\output\installers\android'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$version = (Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot '..\package.json') | ConvertFrom-Json).version
$outputApk = Join-Path $outputDir "Anju-CloudPivot-Android-$version.apk"
Copy-Item -Force -LiteralPath $sourceApk -Destination $outputApk
Write-Output "Signed APK: $outputApk"
