@echo off
REM Build script for TDT Space with optimal production flags
REM Usage: build.bat [dev|prod|installer|all|windows|linux|macos|macos-arm|debug]

setlocal EnableDelayedExpansion

REM Get script directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Add UPX to PATH if exists in project root
if exist "%SCRIPT_DIR%upx.exe" (
    set "PATH=%SCRIPT_DIR%;%PATH%"
    echo [✓] UPX found in project
)

REM Check UPX
where upx >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] UPX not found. Binary will not be compressed.
    set "UPX_FLAG="
) else (
    echo [✓] UPX available
    set "UPX_FLAG=-upx"
)

REM Check Go version and determine if obfuscation is supported
REM Obfuscation is not supported for Go 1.26+
set "OBFUSCATE_FLAG=-obfuscated"
for /f "tokens=3" %%i in ('go version 2^>nul') do set "GOVERSION=%%i"
if defined GOVERSION (
    echo [i] Go version detected: !GOVERSION!
    REM Extract version number after "go1."
    set "GOVERNUM=!GOVERSION:go1=!"
    for /f "tokens=1 delims=." %%a in ("!GOVERNUM!") do set "GO_MINOR=%%a"
    if !GO_MINOR! GEQ 26 (
        echo [!] Go 1.26+ detected: obfuscation not supported, disabling -obfuscated flag
        set "OBFUSCATE_FLAG="
    )
) else (
    echo [!] Unable to detect Go version, will attempt obfuscation
)

REM Default build mode
set "MODE=%~1"
if "%~1"=="" set "MODE=prod"

echo =========================================
echo   TDT Space - Wails Build
echo =========================================
echo.

if /i "%MODE%"=="dev" goto :dev
if /i "%MODE%"=="d" goto :dev
if /i "%MODE%"=="prod" goto :prod
if /i "%MODE%"=="p" goto :prod
if /i "%MODE%"=="production" goto :prod
if /i "%MODE%"=="installer" goto :installer
if /i "%MODE%"=="i" goto :installer
if /i "%MODE%"=="nsis" goto :installer
if /i "%MODE%"=="windows" goto :windows
if /i "%MODE%"=="win" goto :windows
if /i "%MODE%"=="w" goto :windows
if /i "%MODE%"=="linux" goto :linux
if /i "%MODE%"=="l" goto :linux
if /i "%MODE%"=="macos" goto :macos
if /i "%MODE%"=="mac" goto :macos
if /i "%MODE%"=="m" goto :macos
if /i "%MODE%"=="darwin" goto :macos
if /i "%MODE%"=="macos-arm" goto :macos-arm
if /i "%MODE%"=="mac-arm" goto :macos-arm
if /i "%MODE%"=="ma" goto :macos-arm
if /i "%MODE%"=="apple-silicon" goto :macos-arm
if /i "%MODE%"=="all" goto :all
if /i "%MODE%"=="a" goto :all
if /i "%MODE%"=="debug" goto :debug
goto :help

:dev
echo [^>] Running development build...
wails dev
goto :end

:prod
echo [^>] Building for current platform...
echo     Flags: -clean %OBFUSCATE_FLAG% -trimpath %UPX_FLAG%
echo.
wails build -clean %OBFUSCATE_FLAG% -trimpath %UPX_FLAG%
echo.
echo [✓] Build complete!
dir /b build\bin\
goto :end

:installer
echo [^>] Building with NSIS installer...
echo     Flags: -clean %OBFUSCATE_FLAG% -trimpath %UPX_FLAG% -nsis
echo.
wails build -clean %OBFUSCATE_FLAG% -trimpath %UPX_FLAG% -nsis
echo.
echo [✓] Build complete with installer!
dir /b build\bin\
goto :end

:windows
echo [^>] Building for Windows (amd64)...
wails build -platform windows/amd64 -clean %OBFUSCATE_FLAG% -trimpath %UPX_FLAG%
echo [✓] Windows build complete!
dir /b build\bin\
goto :end

:linux
echo [^>] Building for Linux (amd64)...
wails build -platform linux/amd64 -clean %OBFUSCATE_FLAG% -trimpath %UPX_FLAG%
echo [✓] Linux build complete!
dir /b build\bin\
goto :end

:macos
echo [^>] Building for macOS Intel (amd64)...
wails build -platform darwin/amd64 -clean %OBFUSCATE_FLAG% -trimpath %UPX_FLAG%
echo [✓] macOS Intel build complete!
dir /b build\bin\
goto :end

:macos-arm
echo [^>] Building for macOS Apple Silicon (arm64)...
wails build -platform darwin/arm64 -clean %OBFUSCATE_FLAG% -trimpath %UPX_FLAG%
echo [✓] macOS ARM build complete!
dir /b build\bin\
goto :end

:all
echo [^>] Building for ALL platforms...
echo.

echo [1/4] Building for Windows...
wails build -platform windows/amd64 -clean %OBFUSCATE_FLAG% -trimpath %UPX_FLAG% || echo [X] Windows build failed

echo.
echo [2/4] Building for Linux...
wails build -platform linux/amd64 -clean %OBFUSCATE_FLAG% -trimpath %UPX_FLAG% || echo [X] Linux build failed

echo.
echo [3/4] Building for macOS Intel...
wails build -platform darwin/amd64 -clean %OBFUSCATE_FLAG% -trimpath %UPX_FLAG% || echo [X] macOS Intel build failed

echo.
echo [4/4] Building for macOS ARM...
wails build -platform darwin/arm64 -clean %OBFUSCATE_FLAG% -trimpath %UPX_FLAG% || echo [X] macOS ARM build failed

echo.
echo =========================================
echo   Multi-platform build complete!
echo =========================================
echo.
dir /b build\bin\
goto :end

:debug
echo [^>] Building DEBUG mode (with devtools)...
wails build -debug -devtools
goto :end

:help
echo Usage: build.bat [dev^|prod^|installer^|all^|windows^|linux^|macos^|macos-arm^|debug]
echo.
echo Commands:
echo   dev         - Run development server
echo   prod        - Production build for current platform (default)
echo   installer   - Production build + NSIS installer
echo   all         - Build for ALL platforms (Windows, Linux, macOS)
echo   windows     - Build for Windows (amd64)
echo   linux       - Build for Linux (amd64)
echo   macos       - Build for macOS Intel (amd64)
echo   macos-arm   - Build for macOS Apple Silicon (arm64)
echo   debug       - Debug build with devtools
echo.
echo Examples:
echo   build.bat              - Build for current platform
echo   build.bat all          - Build for all platforms
echo   build.bat windows      - Build Windows executable
echo   build.bat linux        - Build Linux binary
echo.

:end
endlocal
