@echo off
REM Build script for OpenCode Go Proxy

if "%1"=="clean" goto clean
if "%1"=="dev" goto dev
if "%1"=="prod" goto prod

echo Usage: build.bat [dev^|prod^|clean]
echo   dev   - Build for development
echo   prod  - Build for production
echo   clean - Clean build artifacts
goto :eof

:clean
echo Cleaning build artifacts...
if exist opencode-proxy.exe del /f opencode-proxy.exe
if exist opencode-proxy-linux del /f opencode-proxy-linux
if exist opencode-proxy-mac del /f opencode-proxy-mac
echo Clean complete!
goto :eof

:dev
echo Building for development...
go build -o opencode-proxy.exe .
if errorlevel 1 (
    echo Build failed!
    exit /b 1
)
echo Development build complete: opencode-proxy.exe
goto :eof

:prod
echo Building for production...
go build -ldflags="-s -w" -o opencode-proxy.exe .
if errorlevel 1 (
    echo Build failed!
    exit /b 1
)
echo Production build complete: opencode-proxy.exe
goto :eof
