@echo off
rem Keep this file ASCII-only: cmd parses batch files in the system ANSI codepage,
rem so UTF-8 Chinese text here swallows line breaks. Chinese output comes from serve.mjs.
setlocal
chcp 65001 >nul
cd /d "%~dp0"

if not "%~1"=="" set "PORT=%~1"

if not exist "serve.mjs" goto nopackage
if not exist "index.html" goto nopackage

where bun >nul 2>nul
if not errorlevel 1 (
  set "RUNNER=bun"
  goto run
)

if exist "%USERPROFILE%\.bun\bin\bun.exe" (
  set "RUNNER=%USERPROFILE%\.bun\bin\bun.exe"
  goto run
)

where node >nul 2>nul
if not errorlevel 1 (
  set "RUNNER=node"
  goto run
)

if exist "%ProgramFiles%\nodejs\node.exe" (
  set "RUNNER=%ProgramFiles%\nodejs\node.exe"
  goto run
)

goto noruntime

:run
"%RUNNER%" serve.mjs
echo.
echo Server closed.
pause
exit /b 0

:noruntime
echo [ERROR] Neither Bun nor Node.js was found.
echo Install Bun (https://bun.sh) or Node.js LTS (https://nodejs.org), then run this file again.
pause
exit /b 1

:nopackage
echo [ERROR] serve.mjs or index.html is missing.
echo Run this file from inside the built dist folder.
pause
exit /b 1
