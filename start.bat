@echo off
title Bet Wizard API Server
cd /d "%~dp0"
echo ============================================
echo   Bet Wizard - Node API Server
echo ============================================
echo.
echo Laragon pages:  http://wc26.test/bet_user.html
echo API health:     http://localhost:3000/api/health
echo.
echo IMPORTANT: Do NOT use wc26.test:3000
echo Keep this window open while using the site.
echo.
node server.js
pause
