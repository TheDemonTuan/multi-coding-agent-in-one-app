#!/bin/bash
# Build script for TDT Space with optimal production flags
# Usage: ./build.sh [dev|prod|installer|all|windows|linux|macos|macos-arm]

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Add UPX to PATH if exists in project root
if [ -f "$SCRIPT_DIR/upx.exe" ]; then
    export PATH="$SCRIPT_DIR:$PATH"
fi

# Check UPX
if ! command -v upx &> /dev/null; then
    UPX_FLAG=""
else
    UPX_FLAG="-upx"
fi

# Check Go version and determine if obfuscation is supported
# Obfuscation is not supported for Go 1.26+
OBFUSCATE_FLAG="-obfuscated"
GOVERSION=$(go version 2>/dev/null | awk '{print $3}')
if [ -n "$GOVERSION" ]; then
    echo -e "${BLUE}[i]${NC} Go version detected: $GOVERSION"
    # Extract version number (e.g., go1.26.1 -> 1.26.1)
    GOVER_NUM=${GOVERSION#go}
    # Get major.minor version
    GO_MAJOR=$(echo $GOVER_NUM | cut -d. -f1)
    GO_MINOR=$(echo $GOVER_NUM | cut -d. -f2)
    
    if [ "$GO_MAJOR" -gt 1 ] || ([ "$GO_MAJOR" -eq 1 ] && [ "$GO_MINOR" -ge 26 ]); then
        echo -e "${YELLOW}[!]${NC} Go 1.26+ detected: obfuscation not supported, disabling -obfuscated flag"
        OBFUSCATE_FLAG=""
    fi
else
    echo -e "${YELLOW}[!]${NC} Unable to detect Go version, will attempt obfuscation"
fi

# Default build mode
MODE="${1:-prod}"

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}  TDT Space - Wails Build${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""

case "$MODE" in
    dev|d)
        echo -e "${YELLOW}▶ Running development build...${NC}"
        wails dev
        ;;

    prod|p|production)
        echo -e "${YELLOW}▶ Building for current platform...${NC}"
        echo -e "${BLUE}  Flags: -clean $OBFUSCATE_FLAG -trimpath $UPX_FLAG${NC}"
        echo ""
        wails build -clean $OBFUSCATE_FLAG -trimpath $UPX_FLAG
        echo ""
        echo -e "${GREEN}✓ Build complete!${NC}"
        ls -lh build/bin/ 2>/dev/null || true
        ;;

    installer|i|nsis)
        echo -e "${YELLOW}▶ Building with NSIS installer...${NC}"
        echo -e "${BLUE}  Flags: -clean $OBFUSCATE_FLAG -trimpath $UPX_FLAG -nsis${NC}"
        echo ""
        wails build -clean $OBFUSCATE_FLAG -trimpath $UPX_FLAG -nsis
        echo ""
        echo -e "${GREEN}✓ Build complete with installer!${NC}"
        ls -lh build/bin/ 2>/dev/null || true
        ;;

    windows|win|w)
        echo -e "${YELLOW}▶ Building for Windows (amd64)...${NC}"
        wails build -platform windows/amd64 -clean $OBFUSCATE_FLAG -trimpath $UPX_FLAG
        echo -e "${GREEN}✓ Windows build complete!${NC}"
        ls -lh build/bin/*windows* 2>/dev/null || ls -lh build/bin/*.exe 2>/dev/null || true
        ;;

    linux|l)
        echo -e "${YELLOW}▶ Building for Linux (amd64)...${NC}"
        wails build -platform linux/amd64 -clean $OBFUSCATE_FLAG -trimpath $UPX_FLAG
        echo -e "${GREEN}✓ Linux build complete!${NC}"
        ls -lh build/bin/*linux* 2>/dev/null || ls -lh build/bin/TDTSpace 2>/dev/null || true
        ;;

    macos|mac|m|darwin)
        echo -e "${YELLOW}▶ Building for macOS (Intel amd64)...${NC}"
        wails build -platform darwin/amd64 -clean $OBFUSCATE_FLAG -trimpath $UPX_FLAG
        echo -e "${GREEN}✓ macOS Intel build complete!${NC}"
        ls -lh build/bin/*darwin* 2>/dev/null || true
        ;;

    macos-arm|mac-arm|ma|apple-silicon)
        echo -e "${YELLOW}▶ Building for macOS (Apple Silicon arm64)...${NC}"
        wails build -platform darwin/arm64 -clean $OBFUSCATE_FLAG -trimpath $UPX_FLAG
        echo -e "${GREEN}✓ macOS ARM build complete!${NC}"
        ls -lh build/bin/*darwin* 2>/dev/null || true
        ;;

    all|a)
        echo -e "${YELLOW}▶ Building for ALL platforms...${NC}"
        echo ""

        echo -e "${BLUE}[1/4] Building for Windows...${NC}"
        wails build -platform windows/amd64 -clean $OBFUSCATE_FLAG -trimpath $UPX_FLAG || echo -e "${RED}✗ Windows build failed${NC}"

        echo ""
        echo -e "${BLUE}[2/4] Building for Linux...${NC}"
        wails build -platform linux/amd64 -clean $OBFUSCATE_FLAG -trimpath $UPX_FLAG || echo -e "${RED}✗ Linux build failed${NC}"

        echo ""
        echo -e "${BLUE}[3/4] Building for macOS Intel...${NC}"
        wails build -platform darwin/amd64 -clean $OBFUSCATE_FLAG -trimpath $UPX_FLAG || echo -e "${RED}✗ macOS Intel build failed${NC}"

        echo ""
        echo -e "${BLUE}[4/4] Building for macOS ARM...${NC}"
        wails build -platform darwin/arm64 -clean $OBFUSCATE_FLAG -trimpath $UPX_FLAG || echo -e "${RED}✗ macOS ARM build failed${NC}"

        echo ""
        echo -e "${GREEN}═══════════════════════════════════════${NC}"
        echo -e "${GREEN}  Multi-platform build complete!${NC}"
        echo -e "${GREEN}═══════════════════════════════════════${NC}"
        echo ""
        ls -lh build/bin/ 2>/dev/null || true
        ;;

    debug)
        echo -e "${YELLOW}▶ Building DEBUG mode (with devtools)...${NC}"
        wails build -debug -devtools
        ;;

    *)
        echo "Usage: ./build.sh [dev|prod|installer|all|windows|linux|macos|macos-arm|debug]"
        echo ""
        echo "Commands:"
        echo "  dev         - Run development server"
        echo "  prod        - Production build for current platform (default)"
        echo "  installer   - Production build + NSIS installer"
        echo "  all         - Build for ALL platforms (Windows, Linux, macOS)"
        echo "  windows     - Build for Windows (amd64)"
        echo "  linux       - Build for Linux (amd64)"
        echo "  macos       - Build for macOS Intel (amd64)"
        echo "  macos-arm   - Build for macOS Apple Silicon (arm64)"
        echo "  debug       - Debug build with devtools"
        echo ""
        echo "Examples:"
        echo "  ./build.sh              # Build for current platform"
        echo "  ./build.sh all          # Build for all platforms"
        echo "  ./build.sh windows      # Build Windows executable"
        echo "  ./build.sh linux        # Build Linux binary"
        exit 1
        ;;
esac
