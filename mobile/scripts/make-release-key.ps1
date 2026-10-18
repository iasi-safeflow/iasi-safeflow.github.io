# Creates the SafeFlow release signing key and the Gradle settings file (both on D:).
# Run:  powershell -ExecutionPolicy Bypass -File mobile\scripts\make-release-key.ps1
# The password is typed by you, never shown, and only written to the settings file below.

$keyDir   = "D:\safeflow-keys"
$keyFile  = "D:\safeflow-keys\safeflow-release.jks"
$propsDir = "D:\safeflow-build\gradle-home"
$props    = "D:\safeflow-build\gradle-home\gradle.properties"
$keytool  = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"

if (Test-Path $keyFile) {
  Write-Host "A key already exists at $keyFile - not overwriting it." -ForegroundColor Yellow
  exit 1
}

New-Item -ItemType Directory -Force $keyDir | Out-Null
New-Item -ItemType Directory -Force $propsDir | Out-Null

function Read-Secret($prompt) {
  $secure = Read-Host $prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

while ($true) {
  $p1 = Read-Secret "Choose a password for the SafeFlow key"
  $p2 = Read-Secret "Type it again"
  if ($p1 -ne $p2) {
    Write-Host "The passwords don't match, try again." -ForegroundColor Yellow
  } elseif ($p1.Length -lt 6) {
    Write-Host "Use at least 6 characters." -ForegroundColor Yellow
  } elseif ($p1 -match '[^\x21-\x7E]') {
    Write-Host "Use only letters, digits and simple symbols (no spaces or diacritics)." -ForegroundColor Yellow
  } else {
    break
  }
}

$dname = "CN=Iasi SafeFlow, O=SafeFlow Team, C=RO"
& $keytool -genkeypair -keystore $keyFile -alias safeflow `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -dname $dname -storepass $p1 -keypass $p1

if (-not (Test-Path $keyFile)) {
  Write-Host "keytool did not create the key." -ForegroundColor Red
  exit 1
}

$e = $p1.Replace('\', '\\')
$lines = @(
  "SAFEFLOW_RELEASE_STORE_FILE=D:/safeflow-keys/safeflow-release.jks",
  "SAFEFLOW_RELEASE_STORE_PASSWORD=$e",
  "SAFEFLOW_RELEASE_KEY_ALIAS=safeflow",
  "SAFEFLOW_RELEASE_KEY_PASSWORD=$e"
)
$lines | Set-Content -Encoding ascii $props
$p1 = $null; $p2 = $null; $e = $null

"Key created: " + (Test-Path $keyFile)
"Settings file created: " + (Test-Path $props)
