@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

rem --- AYAR: API adresinizi buraya koyun ---
set "API_URL=http://127.0.0.1:10000/api/verify"
rem ---------------------------------------

color 0C
echo ============================================================
echo           EON BYPASS .BAT LISANS TEST EKRANI
echo ============================================================
echo.

set "KEY="
set /p "KEY=[>] Lütfen Test Edeceğiniz Key'i Girin: "
if "%KEY%"=="" (
  echo Anahtar girilmedi. Cikis...
  pause
  exit /b 1
)

echo.
echo [*] Anakart UUID'si (HWID) alınıyor...

set "HWID="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "try{ (Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID }catch{ '' }" 2^>nul`) do set "HWID=%%i"
if not defined HWID (
  for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "try{ (Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Cryptography').MachineGuid }catch{ '' }" 2^>nul`) do set "HWID=%%i"
)
if not defined HWID (
  for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "try{ (Get-CimInstance -ClassName Win32_BIOS).SerialNumber }catch{ '' }" 2^>nul`) do set "HWID=%%i"
)
if not defined HWID (
  for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "try{ (Get-CimInstance -ClassName Win32_BaseBoard).SerialNumber }catch{ '' }" 2^>nul`) do set "HWID=%%i"
)
if not defined HWID set "HWID=%COMPUTERNAME%"

echo [*] Çekilen HWID: !HWID!
echo.
echo [*] Sunucuya bağlanılıyor: %API_URL%
echo.

rem --- create temp ps1 script ---
set "PSFILE=%TEMP%\eon_verify_%RANDOM%.ps1"
(
  echo $api = '%API_URL%'
  echo $key = '%KEY%'
  echo $hwid = '%HWID%'
  echo try {
  echo^    $body = @{ key = $key; hwid = $hwid } ^| ConvertTo-Json
  echo^    $r = Invoke-RestMethod -Uri $api -Method Post -ContentType 'application/json' -Body $body -ErrorAction Stop
  echo^    if ($r.success) {
  echo^        Write-Host '============================================================' -ForegroundColor Yellow
  echo^        Write-Host '[-] GİRİŞ BAŞARILI!' -ForegroundColor Green
  echo^        Write-Host '============================================================' -ForegroundColor Yellow
  echo^        if ($r.expiresAt) { Write-Host ('Expires (GG-AA-YYYY): ' + $r.expiresAt) -ForegroundColor Green }
  echo^        if ($r.expiresAtIso) { Write-Host ('Expires ISO: ' + $r.expiresAtIso) -ForegroundColor Green }
  echo^    } else {
  echo^        Write-Host '============================================================' -ForegroundColor Yellow
  echo^        Write-Host '[-] GİRİŞ BAŞARISIZ!' -ForegroundColor Red
  echo^        Write-Host '============================================================' -ForegroundColor Yellow
  echo^        if ($r.message) { Write-Host $r.message -ForegroundColor Red } else { Write-Host 'Anahtar geçersiz, süresi bitmiş veya HWID uyuşmuyor.' -ForegroundColor Red }
  echo^    }
  echo } catch {
  echo^    Write-Host '============================================================' -ForegroundColor Yellow
  echo^    Write-Host '[-] Sunucuya bağlanırken veya veritabanı kontrolünde hata oluştu!' -ForegroundColor Red
  echo^    Write-Host '============================================================' -ForegroundColor Yellow
  echo^    Write-Host $_.Exception.Message -ForegroundColor Red
  echo }
) > "%PSFILE%"

rem run the ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%PSFILE%"

rem cleanup
del "%PSFILE%" >nul 2^>1

echo.
echo Press any key to continue . . .
pause >nul
