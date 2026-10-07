$ErrorActionPreference = 'Stop'
$signingRoot = Join-Path $env:LOCALAPPDATA 'AnjuCloudPivot\signing'
$configPath = Join-Path $signingRoot 'signing.json'
$keystorePath = Join-Path $signingRoot 'anju-judge-release.jks'
if (Test-Path -LiteralPath $configPath) {
  Write-Output "Android signing configuration already exists at $configPath"
  exit 0
}
New-Item -ItemType Directory -Force -Path $signingRoot | Out-Null
$bytes = New-Object byte[] 30
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$password = [Convert]::ToBase64String($bytes).Replace('+','A').Replace('/','B').Replace('=','C')
$keytool = (Get-Command keytool.exe -ErrorAction Stop).Source
& $keytool -genkeypair -v -keystore $keystorePath -storepass $password -keypass $password -alias anju-judge -keyalg RSA -keysize 3072 -validity 7300 -dname 'CN=Anju CloudPivot Judge Demo, OU=Competition Demo, O=Anju CloudPivot, L=Demo, ST=Demo, C=CN'
if ($LASTEXITCODE -ne 0) { throw 'keytool failed to create the Android signing key' }
$config = [ordered]@{
  keystorePath = $keystorePath
  storePassword = $password
  keyAlias = 'anju-judge'
  keyPassword = $password
}
$config | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath $configPath
& icacls.exe $signingRoot /inheritance:r /grant:r "$env:USERNAME`:(OI)(CI)F" | Out-Null
Write-Output "Created Android signing material outside the repository at $signingRoot"
