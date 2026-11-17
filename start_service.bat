@echo off
cd /d "%~dp0"
echo [start_service] Starting client (3000) + server (3001) in a new window...
start "D365 CRM Tools" cmd /k "pnpm dev"
echo [start_service] Waiting for port 3000 to become available...
:wait
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('localhost', 3000); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto wait
echo [start_service] Services ready! Opening browser...
start "" http://localhost:3000
echo [start_service] Done. Close the "D365 CRM Tools" window or run stop_service.bat to stop.
