@echo off
setlocal EnableExtensions
title Regex Vis Development Server
cd /d "%~dp0"

if "%~1"=="" (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-server.ps1" menu
) else (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-server.ps1" %*
)

exit /b %errorlevel%
