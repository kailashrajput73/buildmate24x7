@echo off
title BuildMate - building the Android app
cd /d "%~dp0"

rem Find Flutter
set "FLUTTER=C:\src\flutter\bin\flutter.bat"
if not exist "%FLUTTER%" for /f "delims=" %%f in ('where flutter.bat 2^>nul') do set "FLUTTER=%%f"
if not exist "%FLUTTER%" (
  echo Flutter was not found. > apk-build-log.txt
  echo Flutter was not found at C:\src\flutter. & pause & exit /b 1
)

rem Android SDK (installed by Android Studio, or set up here the first time)
if "%ANDROID_HOME%"=="" if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
if "%ANDROID_HOME%"=="" if exist "C:\Android\Sdk\platform-tools" set "ANDROID_HOME=C:\Android\Sdk"
if "%ANDROID_HOME%"=="" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
echo API_URL will be set below > apk-build-log.txt
echo ANDROID_HOME=%ANDROID_HOME% >> apk-build-log.txt
echo JAVA_HOME=%JAVA_HOME% >> apk-build-log.txt
set "SDKM=%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat"
if not exist "%SDKM%" (
  echo.
  echo  First time: downloading the Android SDK tools - this can take several minutes...
  echo Downloading Android command-line tools >> apk-build-log.txt
  if not exist "%ANDROID_HOME%" mkdir "%ANDROID_HOME%"
  powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; $z=Join-Path $env:TEMP 'bm_cmdline.zip'; $ok=$false; foreach($u in 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip','https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip'){ try { Invoke-WebRequest -Uri $u -OutFile $z -UseBasicParsing; $ok=$true; Write-Output ('downloaded '+$u); break } catch { Write-Output ('failed '+$u+' : '+$_.Exception.Message) } }; if($ok){ $t=Join-Path $env:TEMP 'bm_cmdline'; if(Test-Path $t){Remove-Item $t -Recurse -Force}; Expand-Archive $z $t -Force; $d=Join-Path $env:ANDROID_HOME 'cmdline-tools\latest'; New-Item -ItemType Directory -Force (Split-Path $d) | Out-Null; if(Test-Path $d){Remove-Item $d -Recurse -Force}; Move-Item (Join-Path $t 'cmdline-tools') $d; Write-Output 'extracted' }" >> apk-build-log.txt 2>&1
)
if exist "%SDKM%" (
  echo  Accepting Android SDK licences and installing platform tools...
  rem Licence accepted by the owner of this PC (Ruchit) on 29-10-2026
  (for /l %%i in (1,1,40) do @echo y) > "%TEMP%\bm_yes.txt"
  call "%SDKM%" --licenses < "%TEMP%\bm_yes.txt" >> apk-build-log.txt 2>&1
  call "%SDKM%" "platform-tools" "platforms;android-35" "build-tools;35.0.0" < "%TEMP%\bm_yes.txt" >> apk-build-log.txt 2>&1
  call "%FLUTTER%" config --android-sdk "%ANDROID_HOME%" >> apk-build-log.txt 2>&1
) else (
  echo SDK tools could not be installed >> apk-build-log.txt
)

rem Java 21 for Gradle (Android Studio's own Java 25 is too new for this project's Gradle)
set "JDK21=%LOCALAPPDATA%\BuildMate\jdk21"
if not exist "%JDK21%\bin\java.exe" (
  echo  Downloading Java 21 for the build - about 190 MB, one time only...
  echo Downloading Temurin JDK 21 >> apk-build-log.txt
  powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; $z=Join-Path $env:TEMP 'bm_jdk21.zip'; try { Invoke-WebRequest -Uri 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse' -OutFile $z -UseBasicParsing; $t=Join-Path $env:TEMP 'bm_jdk21'; if(Test-Path $t){Remove-Item $t -Recurse -Force}; Expand-Archive $z $t -Force; $inner=Get-ChildItem $t -Directory | Select-Object -First 1; $d=Join-Path $env:LOCALAPPDATA 'BuildMate\jdk21'; New-Item -ItemType Directory -Force (Split-Path $d) | Out-Null; if(Test-Path $d){Remove-Item $d -Recurse -Force}; Move-Item $inner.FullName $d; Write-Output ('JDK 21 installed: '+$inner.Name) } catch { Write-Output ('JDK download failed: '+$_.Exception.Message) }" >> apk-build-log.txt 2>&1
)
if exist "%JDK21%\bin\java.exe" (
  set "JAVA_HOME=%JDK21%"
  set "PATH=%JDK21%\bin;%PATH%"
  call "%FLUTTER%" config --jdk-dir "%JDK21%" >> apk-build-log.txt 2>&1
  echo Using JDK21 at %JDK21% >> apk-build-log.txt
)

rem This PC's address on the Wi-Fi / LAN (the phone reaches the API through it)
set "IP="
powershell -NoProfile -Command "$a = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'vEthernet|Loopback|VirtualBox|VMware|WSL|Bluetooth' -and $_.PrefixOrigin -ne 'WellKnown' }; $g = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway } | ForEach-Object { $_.IPv4Address.IPAddress }; $pick = $a | Where-Object { $g -contains $_.IPAddress } | Select-Object -First 1; if (-not $pick) { $pick = $a | Select-Object -First 1 }; [Console]::Write($pick.IPAddress)" > "%TEMP%\bm_ip.txt"
set /p IP=<"%TEMP%\bm_ip.txt"
if "%IP%"=="" set "IP=127.0.0.1"

echo.
echo  Building BuildMate APK
echo  API address baked into the app: (see below)
echo  This takes 5-10 minutes the first time. Please leave this window open.
echo.

set "API_URL=http://%IP%:5080"
rem PRODUCTION build: put the live API address (https://...) in production-api-url.txt next to this file.
rem Then the app talks to the VPS backend and uses Firebase SMS login only - never the demo OTP.
set "PROD="
if exist "production-api-url.txt" set /p API_URL=<"production-api-url.txt"
if exist "production-api-url.txt" set "PROD=1"
echo API_URL=%API_URL% >> apk-build-log.txt

rem Login mode: real SMS through Firebase when android\app\google-services.json is present AND issued for this
rem app's package (com.buildmate.customerapp); otherwise the demo OTP (code 123456, no SMS) so the build still works.
set "AUTH_MODE=otp"
set "PKG=com.buildmate.customerapp"
if exist "android\app\google-services.json" findstr /c:"\"%PKG%\"" "android\app\google-services.json" >nul && set "AUTH_MODE=firebase"
if exist "android\app\google-services.json" if "%AUTH_MODE%"=="otp" echo WARNING: google-services.json is not for %PKG% - using demo OTP >> apk-build-log.txt
if exist "android\app\google-services.json" if "%AUTH_MODE%"=="otp" move /y "android\app\google-services.json" "android\app\google-services.json.wrong-package" >nul
if defined PROD if not "%AUTH_MODE%"=="firebase" (
  echo PRODUCTION build stopped: android\app\google-services.json for %PKG% is missing. >> apk-build-log.txt
  echo.
  echo  PRODUCTION build stopped: put google-services.json for %PKG% in android\app\ first. See FIREBASE_SETUP.md.
  echo.
  pause
  exit /b 1
)
echo AUTH_MODE=%AUTH_MODE% >> apk-build-log.txt
echo  API: %API_URL%
echo  Login mode: %AUTH_MODE%
call "%FLUTTER%" --version >> apk-build-log.txt 2>&1
call "%FLUTTER%" pub get >> apk-build-log.txt 2>&1
if exist "android\gradlew.bat" (pushd android & call gradlew.bat --stop >> ..\apk-build-log.txt 2>&1 & popd)
call "%FLUTTER%" build apk --release "--dart-define=API_URL=%API_URL%" "--dart-define=AUTH_MODE=%AUTH_MODE%" >> apk-build-log.txt 2>&1
set "RC=%ERRORLEVEL%"
echo EXIT=%RC% >> apk-build-log.txt

rem SHA-1 / SHA-256 of the signing key - add both in Firebase Console > Project settings > Your apps > Android.
rem Release key (android\key.properties) when present; the passwords are read locally and never written out.
if exist "android\key.properties" powershell -NoProfile -Command "$p=@{}; Get-Content 'android\key.properties' | ForEach-Object { if($_ -match '^\s*([^=#]+?)\s*=\s*(.*)$'){ $p[$matches[1]]=$matches[2] } }; $ks=$p['storeFile']; if(-not [IO.Path]::IsPathRooted($ks)){ $ks=Join-Path 'android\app' $ks }; & (Join-Path $env:JAVA_HOME 'bin\keytool.exe') -list -v -keystore $ks -alias $p['keyAlias'] -storepass $p['storePassword'] 2>$null | Select-String 'SHA1:','SHA256:' | ForEach-Object { $_.Line.Trim() } | Set-Content firebase-sha.txt"
if exist "android\key.properties" echo  SHA fingerprints of the release key saved to firebase-sha.txt
if not exist "android\key.properties" if exist "%USERPROFILE%\.android\debug.keystore" (
  "%JAVA_HOME%\bin\keytool.exe" -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android 2>nul | findstr /r /c:"SHA1:" /c:"SHA256:" > firebase-sha.txt
  echo  SHA fingerprints for Firebase saved to firebase-sha.txt
)

if exist "build\app\outputs\flutter-apk\app-release.apk" (
  echo  DONE. The APK is here:
  echo  %~dp0build\app\outputs\flutter-apk\app-release.apk
  explorer /select,"%~dp0build\app\outputs\flutter-apk\app-release.apk"
) else (
  echo  The build failed. Details are in apk-build-log.txt - Claude will read it.
)
echo.
pause
