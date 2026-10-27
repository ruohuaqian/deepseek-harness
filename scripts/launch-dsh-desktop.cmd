@echo off
setlocal
rem Repo-root launcher for Desktop / Start Menu shortcuts.
cd /d "%~dp0.."
title DeepSeek Harness
echo Starting DeepSeek Harness from:
echo   %CD%
echo.
where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm not found in PATH. Install Node.js + pnpm, then retry.
  pause
  exit /b 1
)
pnpm desktop %*
set ERR=%ERRORLEVEL%
if not %ERR%==0 (
  echo.
  echo Launch failed ^(exit %ERR%^). If this is a fresh clone, run:
  echo   pnpm install
  echo   pnpm run build
  echo   pnpm desktop
  pause
)
exit /b %ERR%
