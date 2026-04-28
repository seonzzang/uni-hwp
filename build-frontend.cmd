@echo off
setlocal
call "%~dp0src-tauri\build-frontend.cmd"
exit /b %ERRORLEVEL%
