@echo off
echo [stop_service] Stopping services on ports 3000 and 3001...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host ('  Stopped PID ' + $_.OwningProcess) }"
echo [stop_service] Finished.
