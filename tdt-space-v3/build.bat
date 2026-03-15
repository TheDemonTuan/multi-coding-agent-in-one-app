@echo off
REM ============================================================
REM TDT Space - Wails v3 Optimized Build Script
REM ============================================================
REM Usage: build.bat [command]
REM Commands:
REM   prod, p      - Production build (optimized + UPX)
REM   dev, d       - Development mode with hot reload
REM   debug        - Debug build with devtools
REM   installer    - Build NSIS installer
REM   windows, w   - Build for Windows
REM   linux, l     - Build for Linux (needs Docker)
REM   macos, m     - Build for macOS Intel
REM   macos-arm    - Build for macOS Apple Silicon
REM   all, a       - Build for all platforms
REM   clean        - Clean build artifacts
REM   info         - Show build information
REM ============================================================

setlocal EnableDelayedExpansion

REM Get script directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Check for UPX
set "UPX_AVAILABLE=false"
if exist "%SCRIPT_DIR%..\upx.exe" (
    set "UPX_AVAILABLE=true"
    set "UPX_PATH=%SCRIPT_DIR%..\"
) else if exist "%SCRIPT_DIR%upx.exe" (
    set "UPX_AVAILABLE=true"
    set "UPX_PATH=%SCRIPT_DIR%"
)

REM Colors
set "GREEN=[✓]"
set "YELLOW=[!]"
set "RED=[X]"
set "INFO=[i]"

REM Get Go version
for /f "tokens=3" %%i in ('go version 2^>nul') do set "GOVERSION=%%i"

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║           TDT Space - Wails v3 Build System              ║
echo ║                     Optimized Edition                    ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo %INFO% Go version: %GOVERSION%
if "!UPX_AVAILABLE!"=="true" (
    echo %GREEN% UPX compression available
) else (
    echo %YELLOW% UPX not found - binaries will be larger
)
echo.

REM Default command
set "CMD=%~1"
if "%~1"=="" set "CMD=help"

REM Execute command
if /i "%CMD%"=="prod" goto :prod
if /i "%CMD%"=="p" goto :prod
if /i "%CMD%"=="production" goto :prod
if /i "%CMD%"=="dev" goto :dev
if /i "%CMD%"=="d" goto :dev
if /i "%CMD%"=="debug" goto :debug
if /i "%CMD%"=="installer" goto :installer
if /i "%CMD%"=="windows" goto :windows
if /i "%CMD%"=="w" goto :windows
if /i "%CMD%"=="linux" goto :linux
if /i "%CMD%"=="l" goto :linux
if /i "%CMD%"=="macos" goto :macos
if /i "%CMD%"=="m" goto :macos
if /i "%CMD%"=="macos-arm" goto :macos_arm
if /i "%CMD%"=="all" goto :all
if /i "%CMD%"=="a" goto :all
if /i "%CMD%"=="clean" goto :clean
if /i "%CMD%"=="info" goto :info
goto :help

:prod
echo ═══════════════════════════════════════════════════════════
echo   Production Build (Optimized)
echo ═══════════════════════════════════════════════════════════
echo.
echo %INFO% Build optimizations:
echo   - Symbol stripping (-s -w)
echo   - Position-independent executable (PIE)
echo   - Static linking where possible
echo   - Trimpath for reproducibility
echo   - UPX compression (handled by Taskfile)
echo.
call :clean_bin
echo %INFO% Building Windows production binary...
echo.
call wails3 task windows:build EXTRA_TAGS=production
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo %RED% Build failed!
    exit /b 1
)
echo.
echo %GREEN% Production build complete!
echo %INFO% Output: bin\TDT Space.exe
dir "bin\TDT Space.exe" 2>nul | findstr /C:"TDT Space.exe"
goto :end

:dev
echo ═══════════════════════════════════════════════════════════
echo   Development Mode (Hot Reload)
echo ═══════════════════════════════════════════════════════════
echo.
echo %INFO% Starting development server...
echo   - Frontend: http://localhost:9245
echo   - Hot reload: Enabled
echo   - Debug symbols: Included
echo.
REM Build frontend dist first if it doesn't exist (required for embed directive)
if not exist "frontend\dist" (
    echo %INFO% Frontend dist not found. Building for the first time...
    echo.
    cd frontend
    call bun install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo %RED% Failed to install frontend dependencies!
        cd ..
        exit /b 1
    )
    call bun run build:dev
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo %RED% Failed to build frontend!
        cd ..
        exit /b 1
    )
    cd ..
    echo.
    echo %GREEN% Frontend build complete!
    echo.
)
call wails3 dev -config ./build/config.yml
goto :end

:debug
echo ═══════════════════════════════════════════════════════════
echo   Debug Build
echo ═══════════════════════════════════════════════════════════
echo.
echo %INFO% Building debug version (with devtools)...
echo %YELLOW% Note: Debug builds are larger and slower
echo.
call :clean_bin
call wails3 task windows:build DEV=true
echo.
echo %INFO% Debug build complete:
dir bin\*.exe 2>nul | findstr /C:".exe"
goto :end

:installer
echo ═══════════════════════════════════════════════════════════
echo   NSIS Installer
echo ═══════════════════════════════════════════════════════════
echo.
echo %INFO% Building NSIS installer...
echo.
call wails3 task package
echo.
echo %GREEN% Installer build complete!
echo %INFO% Output:
dir bin\*.exe 2>nul | findstr /C:"installer"
goto :end

:windows
echo ═══════════════════════════════════════════════════════════
echo   Windows Build (amd64)
echo ═══════════════════════════════════════════════════════════
echo.
call :clean_bin
call wails3 task windows:build ARCH=amd64 EXTRA_TAGS=production
echo.
echo %GREEN% Windows build complete!
echo %INFO% Output: bin\TDT Space.exe
dir "bin\TDT Space.exe" 2>nul | findstr /C:"TDT Space.exe"
goto :end

:linux
echo ═══════════════════════════════════════════════════════════
echo   Linux Build (amd64)
echo ═══════════════════════════════════════════════════════════
echo.
echo %YELLOW% Note: Linux build may require Docker for cross-compilation
echo.
call :clean_bin
call wails3 task linux:build ARCH=amd64 EXTRA_TAGS=production
if "!UPX_AVAILABLE!"=="true" (
    echo.
    echo %INFO% Applying UPX compression...
    if exist "bin\TDT-Space" (
        "!UPX_PATH!upx.exe" --best "bin\TDT-Space"
    )
)
echo.
echo %GREEN% Linux build complete!
echo %INFO% Output: bin\TDT-Space
goto :end

:macos
echo ═══════════════════════════════════════════════════════════
echo   macOS Intel Build (amd64)
echo ═══════════════════════════════════════════════════════════
echo.
call :clean_bin
call wails3 task darwin:build ARCH=amd64 EXTRA_TAGS=production
echo.
echo %YELLOW% Note: UPX not applied (codesigning issues on macOS)
echo.
echo %GREEN% macOS Intel build complete!
echo %INFO% Output: bin\TDT-Space
goto :end

:macos_arm
echo ═══════════════════════════════════════════════════════════
echo   macOS Apple Silicon Build (arm64)
echo ═══════════════════════════════════════════════════════════
echo.
call :clean_bin
call wails3 task darwin:build ARCH=arm64 EXTRA_TAGS=production
echo.
echo %YELLOW% Note: UPX not applied (codesigning issues on macOS)
echo.
echo %GREEN% macOS ARM build complete!
echo %INFO% Output: bin\TDT-Space
goto :end

:all
echo ═══════════════════════════════════════════════════════════
echo   Multi-Platform Build
echo ═══════════════════════════════════════════════════════════
echo.
call :clean_bin

echo %INFO% [1/4] Building for Windows...
call wails3 task windows:build ARCH=amd64 EXTRA_TAGS=production && echo %GREEN% ✓ Windows OK%NC% || echo %RED% ✗ Windows Failed

echo.
echo %INFO% [2/4] Building for Linux...
call wails3 task linux:build ARCH=amd64 EXTRA_TAGS=production && echo %GREEN% ✓ Linux OK%NC% || echo %RED% ✗ Linux Failed

echo.
echo %INFO% [3/4] Building for macOS Intel...
call wails3 task darwin:build ARCH=amd64 EXTRA_TAGS=production && echo %GREEN% ✓ macOS Intel OK%NC% || echo %RED% ✗ macOS Intel Failed

echo.
echo %INFO% [4/4] Building for macOS ARM...
call wails3 task darwin:build ARCH=arm64 EXTRA_TAGS=production && echo %GREEN% ✓ macOS ARM OK%NC% || echo %RED% ✗ macOS ARM Failed

echo.
echo ═══════════════════════════════════════════════════════════
echo   Multi-platform build complete!
echo ═══════════════════════════════════════════════════════════
echo.
echo %INFO% Outputs:
dir bin\ 2>nul | findstr /V "^$"
goto :end

:clean
echo ═══════════════════════════════════════════════════════════
echo   Clean Build Artifacts
echo ═══════════════════════════════════════════════════════════
echo.
call :clean_bin
if exist "frontend\dist" (
    echo %INFO% Cleaning frontend dist...
    rmdir /s /q frontend\dist
)
if exist "frontend\bindings" (
    echo %INFO% Cleaning bindings...
    rmdir /s /q frontend\bindings
)
if exist "frontend\node_modules" (
    echo %INFO% Keeping node_modules (use 'bun install' to reinstall)
)
echo.
echo %GREEN% Clean complete!
goto :end

:info
echo ═══════════════════════════════════════════════════════════
echo   Build Information
echo ═══════════════════════════════════════════════════════════
echo.
echo %INFO% Environment:
echo   Go version: %GOVERSION%
if "!UPX_AVAILABLE!"=="true" (
    echo   UPX: Available
) else (
    echo   UPX: Not found
)
echo.
echo %INFO% Available tasks:
call wails3 task --list 2>&1 | findstr /C:"windows:" /C:"linux:" /C:"darwin:" /C:"package"
goto :end

:help
echo ═══════════════════════════════════════════════════════════
echo   Build Commands
echo ═══════════════════════════════════════════════════════════
echo.
echo Usage: build.bat [command]
echo.
echo Commands:
echo   prod, p      - Production build (optimized + UPX compression)
echo   dev, d       - Development mode with hot reload
echo   debug        - Debug build with devtools enabled
echo   installer    - Build NSIS installer
echo   windows, w   - Build for Windows (amd64)
echo   linux, l     - Build for Linux (amd64, needs Docker)
echo   macos, m     - Build for macOS Intel (amd64)
echo   macos-arm    - Build for macOS Apple Silicon (arm64)
echo   all, a       - Build for all platforms
echo   clean        - Clean build artifacts
echo   info         - Show build information
echo   help, h      - Show this help message
echo.
echo Examples:
echo   build.bat prod         - Production build
echo   build.bat dev          - Development mode
echo   build.bat windows      - Windows build only
echo   build.bat all          - Build all platforms
echo   build.bat clean ^&^& build.bat prod  - Clean build
echo.
echo Build Optimizations (Production):
echo   ✓ Symbol stripping (-s -w)          - ~30%% size reduction
echo   ✓ PIE mode                          - Security enhancement
echo   ✓ Static linking                    - Better portability
echo   ✓ Trimpath                          - Reproducible builds
echo   ✓ UPX compression                   - ~50%% additional reduction
echo.
echo ═══════════════════════════════════════════════════════════
goto :end

:clean_bin
if exist "bin" (
    echo %INFO% Cleaning bin directory...
    echo %INFO% Attempting to terminate running instances...
    taskkill /f /im "TDT Space.exe" 2>nul || echo %INFO% No running instances found
    timeout /t 1 /nobreak >nul 2>&1

    REM Try to delete with retry logic
    set "retryCount=0"
    :retry_clean
    rmdir /s /q bin 2>nul
    if exist "bin" (
        set /a retryCount+=1
        if !retryCount! lss 3 (
            echo %YELLOW% Directory locked, retrying... (attempt !retryCount!/3)
            timeout /t 2 /nobreak >nul
            goto :retry_clean
        ) else (
            echo %YELLOW% Warning: Could not fully clean bin directory (file in use)
            echo %YELLOW% Build will continue, but may use stale files
        )
    )
)
if not exist "bin" mkdir bin
goto :eof

:end
echo.
endlocal
