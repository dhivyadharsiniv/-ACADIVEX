@echo off
title EduManage Student Management System
echo ========================================================
echo       EduManage - Student Management System
echo ========================================================
echo.
echo [1/2] Starting EduManage Full-Stack API & Web Server...
set "PATH=C:\Program Files\nodejs;%PATH%"
start cmd /k "cd /d %~dp0backend && node src\server.js"

echo.
echo [2/2] Opening EduManage Web Application...
timeout /t 2 >nul
start http://localhost:5000

echo.
echo ========================================================
echo Application Live: http://localhost:5000
echo API Base        : http://localhost:5000/api
echo ========================================================
echo.
pause
