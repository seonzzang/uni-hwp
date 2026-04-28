@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-frontend.ps1"
exit /b %ERRORLEVEL%
