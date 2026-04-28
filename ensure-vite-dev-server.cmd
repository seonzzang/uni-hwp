@echo off
setlocal
call "%~dp0src-tauri\ensure-vite-dev-server.cmd"
exit /b %ERRORLEVEL%
