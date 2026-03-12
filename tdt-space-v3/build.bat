@echo off
REM Build script for TDT Space - Wails v3

setlocal EnableDelayedExpansion

set "MODE=%~1"
if "%~1"=="" set "MODE=prod"

echo [TDT Space Build Script - Wails v3]
echo Mode: %MODE%

if "%MODE%"=="dev" goto :dev
if "%MODE%"=="prod" goto :prod
if "%MODE%"=="build" goto :prod
if "%MODE%"=="installer" goto :installer
if "%MODE%"=="package" goto :installer
goto :help

:dev
echo Starting development mode...
cd /d "%~dp0"
task dev
goto :end

:prod
echo Building production binary...
cd /d "%~dp0"
task build
goto :end

:installer
echo Building installer package...
cd /d "%~dp0"
task package
goto :end

:help
echo Usage: build.bat [dev^|prod^|installer]
echo   dev       - Run in development mode with hot reload
echo   prod      - Build production binary (default)
echo   installer - Build installer package
goto :end

:end
endlocal
