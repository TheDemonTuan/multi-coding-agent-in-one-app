#!/bin/bash
# ============================================================
# TDT Space - Wails v3 Optimized Build Script
# ============================================================
# Usage: ./build.sh [command]
# Commands:
#   prod, p      - Production build (optimized + UPX)
#   dev, d       - Development mode with hot reload
#   debug        - Debug build with devtools
#   installer    - Build NSIS installer
#   windows, w   - Build for Windows
#   linux, l     - Build for Linux
#   macos, m     - Build for macOS Intel
#   macos-arm    - Build for macOS Apple Silicon
#   all, a       - Build for all platforms
#   clean        - Clean build artifacts
#   info         - Show build information
# ============================================================

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check for UPX
UPX_AVAILABLE=false
if command -v upx &> /dev/null; then
    UPX_AVAILABLE=true
fi

# Get Go version
GOVERSION=$(go version 2>/dev/null | awk '{print $3}')

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           TDT Space - Wails v3 Build System              ║"
echo "║                     Optimized Edition                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}[i]${NC} Go version: $GOVERSION"
if [ "$UPX_AVAILABLE" = true ]; then
    echo -e "${GREEN}[✓]${NC} UPX compression available"
else
    echo -e "${YELLOW}[!]${NC} UPX not found - binaries will be larger"
fi
echo ""

# Default command
CMD="${1:-help}"

# Helper functions
clean_bin() {
    if [ -d "bin" ]; then
        echo -e "${BLUE}[i]${NC} Cleaning bin directory..."
        rm -rf bin
    fi
    mkdir -p bin
}

run_upx() {
    local binary="$1"
    if [ "$UPX_AVAILABLE" = true ] && [ -f "$binary" ]; then
        echo -e "${BLUE}[i]${NC} Applying UPX compression..."
        upx --best "$binary" 2>/dev/null || echo -e "${YELLOW}[!]${NC} UPX compression failed"
        echo ""
        echo -e "${BLUE}[i]${NC} Size after compression:"
        ls -lh "$binary"
    else
        echo -e "${BLUE}[i]${NC} Binary size:"
        ls -lh "$binary" 2>/dev/null || true
    fi
}

case "$CMD" in
    prod|p|production)
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║   Production Build (Optimized)                          ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo ""
        echo -e "${BLUE}[i]${NC} Build optimizations:"
        echo "  - Symbol stripping (-s -w)"
        echo "  - Position-independent executable (PIE)"
        echo "  - Static linking where possible"
        echo "  - Trimpath for reproducibility"
        echo "  - UPX compression (if available)"
        echo ""
        clean_bin
        echo -e "${BLUE}[i]${NC} Building Windows production binary..."
        echo ""
        wails3 task windows:build EXTRA_TAGS=production
        echo ""
        run_upx "bin/TDT Space.exe"
        echo ""
        echo -e "${GREEN}[✓]${NC} Production build complete!"
        echo -e "${BLUE}[i]${NC} Output: bin/TDT Space.exe"
        ;;

    dev|d)
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║   Development Mode (Hot Reload)                         ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo ""
        echo -e "${BLUE}[i]${NC} Starting development server..."
        echo "  - Frontend: http://localhost:9245"
        echo "  - Hot reload: Enabled"
        echo "  - Debug symbols: Included"
        echo ""
        # Build frontend dist first if it doesn't exist (required for embed directive)
        if [ ! -d "frontend/dist" ]; then
            echo -e "${BLUE}[i]${NC} Frontend dist not found. Building for the first time..."
            echo ""
            cd frontend
            bun install || {
                echo ""
                echo -e "${RED}[X]${NC} Failed to install frontend dependencies!"
                cd ..
                exit 1
            }
            bun run build:dev || {
                echo ""
                echo -e "${RED}[X]${NC} Failed to build frontend!"
                cd ..
                exit 1
            }
            cd ..
            echo ""
            echo -e "${GREEN}[✓]${NC} Frontend build complete!"
            echo ""
        fi
        wails3 dev -config ./build/config.yml
        ;;

    debug)
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║   Debug Build                                           ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo ""
        echo -e "${BLUE}[i]${NC} Building debug version (with devtools)..."
        echo -e "${YELLOW}[!]${NC} Note: Debug builds are larger and slower"
        echo ""
        clean_bin
        wails3 task windows:build DEV=true
        echo ""
        echo -e "${BLUE}[i]${NC} Debug build complete:"
        ls -lh bin/*.exe 2>/dev/null || true
        ;;

    installer)
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║   NSIS Installer                                        ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo ""
        echo -e "${BLUE}[i]${NC} Building NSIS installer..."
        echo ""
        wails3 task package
        echo ""
        echo -e "${GREEN}[✓]${NC} Installer build complete!"
        echo -e "${BLUE}[i]${NC} Output:"
        ls -lh bin/*installer* 2>/dev/null || true
        ;;

    windows|w)
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║   Windows Build (amd64)                                 ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo ""
        clean_bin
        wails3 task windows:build ARCH=amd64 EXTRA_TAGS=production
        if [ "$UPX_AVAILABLE" = true ]; then
            echo ""
            echo -e "${BLUE}[i]${NC} Applying UPX compression..."
            upx --best "bin/TDT Space.exe" 2>/dev/null || true
        fi
        echo ""
        echo -e "${GREEN}[✓]${NC} Windows build complete!"
        echo -e "${BLUE}[i]${NC} Output: bin/TDT Space.exe"
        ls -lh "bin/TDT Space.exe" 2>/dev/null || true
        ;;

    linux|l)
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║   Linux Build (amd64)                                   ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo ""
        echo -e "${YELLOW}[!]${NC} Note: Linux build may require Docker for cross-compilation"
        echo ""
        clean_bin
        wails3 task linux:build ARCH=amd64 EXTRA_TAGS=production
        if [ "$UPX_AVAILABLE" = true ]; then
            echo ""
            echo -e "${BLUE}[i]${NC} Applying UPX compression..."
            upx --best "bin/TDT-Space" 2>/dev/null || true
        fi
        echo ""
        echo -e "${GREEN}[✓]${NC} Linux build complete!"
        echo -e "${BLUE}[i]${NC} Output: bin/TDT-Space"
        ls -lh bin/TDT-Space 2>/dev/null || true
        ;;

    macos|m|darwin)
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║   macOS Intel Build (amd64)                             ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo ""
        clean_bin
        wails3 task darwin:build ARCH=amd64 EXTRA_TAGS=production
        echo ""
        echo -e "${YELLOW}[!]${NC} Note: UPX not applied (codesigning issues on macOS)"
        echo ""
        echo -e "${GREEN}[✓]${NC} macOS Intel build complete!"
        echo -e "${BLUE}[i]${NC} Output: bin/TDT-Space"
        ls -lh bin/ 2>/dev/null || true
        ;;

    macos-arm)
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║   macOS Apple Silicon Build (arm64)                     ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo ""
        clean_bin
        wails3 task darwin:build ARCH=arm64 EXTRA_TAGS=production
        echo ""
        echo -e "${YELLOW}[!]${NC} Note: UPX not applied (codesigning issues on macOS)"
        echo ""
        echo -e "${GREEN}[✓]${NC} macOS ARM build complete!"
        echo -e "${BLUE}[i]${NC} Output: bin/TDT-Space"
        ls -lh bin/ 2>/dev/null || true
        ;;

    all|a)
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║   Multi-Platform Build                                  ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo ""
        clean_bin

        echo -e "${BLUE}[i]${NC} [1/4] Building for Windows..."
        wails3 task windows:build ARCH=amd64 EXTRA_TAGS=production && echo -e "${GREEN}[✓]${NC} Windows OK" || echo -e "${RED}[✗]${NC} Windows Failed"

        echo ""
        echo -e "${BLUE}[i]${NC} [2/4] Building for Linux..."
        wails3 task linux:build ARCH=amd64 EXTRA_TAGS=production && echo -e "${GREEN}[✓]${NC} Linux OK" || echo -e "${RED}[✗]${NC} Linux Failed"

        echo ""
        echo -e "${BLUE}[i]${NC} [3/4] Building for macOS Intel..."
        wails3 task darwin:build ARCH=amd64 EXTRA_TAGS=production && echo -e "${GREEN}[✓]${NC} macOS Intel OK" || echo -e "${RED}[✗]${NC} macOS Intel Failed"

        echo ""
        echo -e "${BLUE}[i]${NC} [4/4] Building for macOS ARM..."
        wails3 task darwin:build ARCH=arm64 EXTRA_TAGS=production && echo -e "${GREEN}[✓]${NC} macOS ARM OK" || echo -e "${RED}[✗]${NC} macOS ARM Failed"

        echo ""
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║   Multi-platform build complete!                        ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo ""
        echo -e "${BLUE}[i]${NC} Outputs:"
        ls -lh bin/ 2>/dev/null || true
        ;;

    clean)
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║   Clean Build Artifacts                                 ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo ""
        clean_bin
        if [ -d "frontend/dist" ]; then
            echo -e "${BLUE}[i]${NC} Cleaning frontend dist..."
            rm -rf frontend/dist
        fi
        if [ -d "frontend/bindings" ]; then
            echo -e "${BLUE}[i]${NC} Cleaning bindings..."
            rm -rf frontend/bindings
        fi
        echo ""
        echo -e "${GREEN}[✓]${NC} Clean complete!"
        ;;

    info)
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║   Build Information                                     ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo ""
        echo -e "${BLUE}[i]${NC} Environment:"
        echo "  Go version: $GOVERSION"
        if [ "$UPX_AVAILABLE" = true ]; then
            echo "  UPX: Available"
        else
            echo "  UPX: Not found"
        fi
        echo ""
        echo -e "${BLUE}[i]${NC} Available tasks:"
        wails3 task --list 2>&1 | grep -E "windows:|linux:|darwin:|package" || true
        ;;

    help|h|*)
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║   Build Commands                                        ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo ""
        echo "Usage: ./build.sh [command]"
        echo ""
        echo "Commands:"
        echo "  prod, p      - Production build (optimized + UPX compression)"
        echo "  dev, d       - Development mode with hot reload"
        echo "  debug        - Debug build with devtools enabled"
        echo "  installer    - Build NSIS installer"
        echo "  windows, w   - Build for Windows (amd64)"
        echo "  linux, l     - Build for Linux (amd64, needs Docker)"
        echo "  macos, m     - Build for macOS Intel (amd64)"
        echo "  macos-arm    - Build for macOS Apple Silicon (arm64)"
        echo "  all, a       - Build for all platforms"
        echo "  clean        - Clean build artifacts"
        echo "  info         - Show build information"
        echo "  help, h      - Show this help message"
        echo ""
        echo "Examples:"
        echo "  ./build.sh prod              # Production build"
        echo "  ./build.sh dev               # Development mode"
        echo "  ./build.sh windows           # Windows build only"
        echo "  ./build.sh all               # Build all platforms"
        echo "  ./build.sh clean && ./build.sh prod  # Clean build"
        echo ""
        echo "Build Optimizations (Production):"
        echo "  ✓ Symbol stripping (-s -w)          - ~30% size reduction"
        echo "  ✓ PIE mode                          - Security enhancement"
        echo "  ✓ Static linking                    - Better portability"
        echo "  ✓ Trimpath                          - Reproducible builds"
        echo "  ✓ UPX compression                   - ~50% additional reduction"
        echo ""
        echo "╔══════════════════════════════════════════════════════════╗"
        ;;
esac

echo ""
